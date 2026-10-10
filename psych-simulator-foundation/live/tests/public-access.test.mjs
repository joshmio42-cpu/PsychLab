import http from 'node:http';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {once} from 'node:events';
import {createPublicAccess} from '../public-access.mjs';
import {createApp} from '../server.mjs';
import {mockProvider} from './helpers.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const config={origin:'https://psychlab.example.com',issuer:'https://test.cloudflareaccess.com',audience:'test-aud',emails:['owner@example.com']};
const claims={iss:config.issuer,aud:[config.audience],email:config.emails[0],sub:'owner-identity',type:'app',exp:2000000000};
function token(changes={},key=privateKey,header={}){const parts=[{alg:'RS256',kid:'key1',...header},{...claims,...changes}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url'));return [...parts,sign('RSA-SHA256',Buffer.from(parts.join('.')),key).toString('base64url')].join('.');}
const keyBody=(kid='key1')=>({keys:[{...publicKey.export({format:'jwk'}),kid}]});
const response=(body=keyBody())=>new Response(JSON.stringify(body),{headers:{'Content-Type':'application/json'}});
function access(overrides={}){return createPublicAccess({...config,...overrides},{now:()=>1900000000000,fetchKeys:async()=>response()});}
test('Access rejects missing, forged, expired, wrong audience, wrong issuer and unapproved identities',async()=>{
 const gate=access();assert.equal(await gate.authorize(token()),true);
 for(const value of [undefined,'bad',token({exp:1}),token({aud:['other']}),token({iss:'https://evil.example'}),token({email:'other@example.com'}),token({nbf:2000000000}),token({iat:2000000000}),token({type:'service'}),token({sub:''}),token({sub:undefined}),token({email_verified:false}),token({email_verified:'true'}),token({},privateKey,{alg:'HS256'}),token({},privateKey,{crit:['unknown']}),token()+'.extra',token().slice(0,-8)+'abcdefgh'])assert.equal(await gate.authorize(value),false);
 const unavailable=createPublicAccess(config,{now:()=>1900000000000,fetchKeys:async()=>{throw new Error('offline');}});assert.equal(await unavailable.authorize(token()),false);
});
test('Access identities have stable subjects and only explicitly granted administrator permissions',async()=>{
 assert.deepEqual(await access().authenticate(token()),{id:`${config.issuer}:owner-identity`,subject:'owner-identity',email:'owner@example.com',isAdmin:false});
 assert.equal((await access({adminEmails:['OWNER@example.com']}).authenticate(token())).isAdmin,true);
 assert.throws(()=>access({adminEmails:['outsider@example.com']}),/approved users/);
 for(const changes of [{origin:'http://psychlab.example.com'},{issuer:'https://evil.cloudflareaccess.com.attacker.example'},{emails:['bad']},{audience:''},{emails:'owner@example.com'}])assert.throws(()=>access(changes),/Invalid public Access/);
});
test('JWKS fetching coalesces requests, limits failure retries and refreshes rotated keys',async()=>{
 let now=1900000000000,calls=0,kid='key1',offline=false;
 const gate=createPublicAccess(config,{now:()=>now,fetchKeys:async()=>{calls++;await new Promise(resolve=>setImmediate(resolve));if(offline)throw new Error('offline');return response(keyBody(kid));}});
 assert.ok((await Promise.all(Array.from({length:12},()=>gate.authorize(token())))).every(Boolean));assert.equal(calls,1);
 kid='key2';assert.equal(await gate.authorize(token({},privateKey,{kid})),false);assert.equal(calls,1);
 now+=30001;assert.equal(await gate.authorize(token({},privateKey,{kid})),true);assert.equal(calls,2);
 offline=true;now+=300001;assert.equal(await gate.authorize(token({},privateKey,{kid})),false);assert.equal(calls,3);
 assert.equal(await gate.authorize(token({},privateKey,{kid})),false);assert.equal(calls,3);
});
test('Access fails closed on invalid, oversized or unsuitable signing keys',async()=>{
 const weak=generateKeyPairSync('rsa',{modulusLength:1024}).publicKey.export({format:'jwk'});
 for(const body of [{keys:[]},{keys:[{...weak,kid:'key1'}]},{keys:[{...keyBody().keys[0],alg:'HS256'}]},{keys:[keyBody().keys[0],keyBody().keys[0]]},{keys:keyBody().keys,padding:'a'.repeat(65536)}]){
  const gate=createPublicAccess(config,{now:()=>1900000000000,fetchKeys:async()=>response(body)});assert.equal(await gate.authorize(token()),false);
 }
});
test('a token that expires during certificate loading cannot authenticate',async()=>{
 let now=1900000000000;
 const gate=createPublicAccess(config,{now:()=>now,fetchKeys:async()=>{now+=2000;return response();}});
 assert.equal(await gate.authenticate(token({exp:now/1000+1})),null);
});
test('public HTTP requests require identity, exact HTTPS origin and secure cookies; localhost still works',async t=>{
 const {server}=await createApp({provider:mockProvider(),publicAccess:access()});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const request=(url,options={})=>new Promise((resolve,reject)=>{const req=http.request(url,options,res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,headers:{get:name=>[].concat(res.headers[name]||[]).join(';')}}));});req.on('error',reject);req.end(options.body);});
 const headers={Host:'psychlab.example.com','cf-access-jwt-assertion':token(),Origin:config.origin,'X-PsychLab':'1','Content-Type':'application/json'};
 assert.equal((await request(base)).status,200);
 assert.equal((await request(base,{headers:{Host:'psychlab.example.com'}})).status,403);
 assert.equal((await request(base,{headers})).status,200);
 assert.equal((await request(base+'/api/session',{method:'POST',headers:{...headers,Origin:'https://evil.example'},body:'{}'})).status,403);
 const result=await request(base+'/api/session',{method:'POST',headers,body:JSON.stringify({mode:'generated',seed:42})});assert.equal(result.status,201);assert.match(result.headers.get('set-cookie'),/; Secure/);
});
