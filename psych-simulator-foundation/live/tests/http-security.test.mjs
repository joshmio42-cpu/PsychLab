import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
import {createRequestLimiter,validateRequest} from '../http-security.mjs';
import {mockProvider,reasoning} from './helpers.mjs';

async function fixture(t,options={}){
  const app=await createApp({provider:mockProvider(),...options});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  t.after(()=>{app.server.closeAllConnections();app.server.close();});
  const base=`http://127.0.0.1:${app.server.address().port}`;
  const call=(path,{method='GET',body,headers={}}={})=>new Promise((resolve,reject)=>{
    const payload=body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body);
    const req=http.request(base+path,{method,headers:{Origin:base,'Content-Type':'application/json','X-PsychLab':'1',...headers}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>{const text=Buffer.concat(chunks).toString();resolve({status:res.statusCode,headers:res.headers,text,json:()=>JSON.parse(text)});});
    });req.on('error',reject);req.end(payload);
  });
  return {...app,base,call};
}
const createBody={mode:'generated',days:1,seed:42};
const cookie=response=>response.headers['set-cookie'][0].split(';')[0];

test('read and write APIs reject cross-origin requests and never grant CORS',async t=>{
  const {call}=await fixture(t);
  for(const headers of [{Origin:'https://attacker.example'},{Origin:'null'},{'Sec-Fetch-Site':'cross-site'},{'Sec-Fetch-Site':'same-site'}]){
    const response=await call('/api/status',{headers});assert.equal(response.status,403);assert.equal(response.headers['access-control-allow-origin'],undefined);
  }
  assert.equal((await call('/api/session',{method:'POST',body:{},headers:{Origin:''}})).status,403);
  assert.equal((await call('/api/session',{method:'OPTIONS'})).status,405);
  const response=await call('/');assert.equal(response.status,200);
  assert.match(response.headers['content-security-policy'],/object-src 'none'/);assert.match(response.headers['content-security-policy'],/script-src 'self'/);
  assert.equal(response.headers['cross-origin-resource-policy'],'same-origin');assert.equal(response.headers['x-frame-options'],'DENY');assert.equal(response.headers['cache-control'],'no-store');
});

test('JSON types, size, encoding and unexpected privilege fields are rejected before creation',async t=>{
  const {call}=await fixture(t);
  for(const body of ['null','[]','"value"','{',JSON.stringify({...createBody,isAdmin:true}),JSON.stringify({...createBody,owner:'victim'})]){
    assert.equal((await call('/api/session',{method:'POST',body})).status,400);
  }
  for(const type of ['multipart/form-data; boundary=test','text/plain','application/jsonp'])assert.equal((await call('/api/session',{method:'POST',body:'{}',headers:{'Content-Type':type}})).status,415);
  assert.equal((await call('/api/session',{method:'POST',body:'{}',headers:{'Content-Encoding':'gzip'}})).status,415);
  assert.equal((await call('/api/session',{method:'POST',body:JSON.stringify({extra:'x'.repeat(33000)}),headers:{'Content-Length':'33012'}})).status,413);
  assert.equal((await call('/api/upload',{method:'POST',body:{}})).status,404);
  assert.equal((await call('/api/webhook',{method:'POST',body:{}})).status,404);
  assert.equal((await call('/admin')).status,404);
});

test('form schemas reject nested privilege fields and invalid turn counters',()=>{
  for(const expectedTurn of [-1,1.1,'0',null])assert.throws(()=>validateRequest('/api/turn',{question:'Hello',requestId:'request-0001',expectedTurn}),e=>e.status===400);
  assert.throws(()=>validateRequest('/api/finish',{reasoning:{...reasoning,isAdmin:true}}),e=>e.status===400);
  assert.throws(()=>validateRequest('/api/prepare',{selection:{mode:'random',owner:'victim'}}),e=>e.status===400);
  assert.throws(()=>validateRequest('/api/guide',{state:{items:{one:{status:'supported',turnId:'T1',note:'text',token:'secret'}},reviewed:true}}),e=>e.status===400);
});

test('rate limits cannot be reset by rotating session cookies or spoofing forwarded IPs',async t=>{
  let now=0;const {call}=await fixture(t,{rateLimitOptions:{now:()=>now}});
  for(let i=0;i<12;i++){
    const response=await call('/api/session',{method:'POST',body:createBody,headers:{'X-Forwarded-For':`192.0.2.${i}`}});assert.equal(response.status,201);
  }
  const rejected=await call('/api/session',{method:'POST',body:createBody});assert.equal(rejected.status,429);assert.ok(Number(rejected.headers['retry-after'])>0);
  now+=5000;assert.equal((await call('/api/session',{method:'POST',body:createBody})).status,201);
});

test('limiter bounds memory and refills without trusting request identifiers',()=>{
  let now=0;const limiter=createRequestLimiter({now:()=>now,maxEntries:2});
  limiter.take('a',1);assert.throws(()=>limiter.take('a',1),e=>e.status===429&&e.retryAfter===60);
  limiter.take('b',1);assert.throws(()=>limiter.take('c',1),e=>e.status===429);
  now=60001;limiter.take('c',1);limiter.take('a',1);
});

test('signed identities own sessions across read, mutation, replacement and reviewer routes',async t=>{
  // JWT cryptographic validation is independently exercised in public-access.test.
  const users={alice:{id:'issuer:alice',isAdmin:false},bob:{id:'issuer:bob',isAdmin:false},admin:{id:'issuer:admin',isAdmin:true}};
  const publicAccess={host:'psychlab.example',origin:'https://psychlab.example',authenticate:async token=>users[token]??null};
  const {call,base}=await fixture(t,{publicAccess});
  const headers=(user,session)=>({Host:publicAccess.host,Origin:publicAccess.origin,'cf-access-jwt-assertion':user,...(session?{Cookie:session}:{})});
  const created=await call('/api/session',{method:'POST',body:createBody,headers:headers('alice')});assert.equal(created.status,201);const session=cookie(created);
  assert.match(created.headers['set-cookie'][0],/HttpOnly; SameSite=Strict/);assert.match(created.headers['set-cookie'][0],/; Secure/);
  assert.equal((await call('/api/status',{headers:headers('alice')})).json().permissions.review,false);
  const switched=await call('/api/session',{headers:headers('bob',session)});assert.equal(switched.status,403);assert.match(switched.headers['set-cookie'][0],/Max-Age=0; Secure/);
  const recovered=await call('/api/session',{method:'POST',body:createBody,headers:headers('bob')});assert.equal(recovered.status,201);assert.notEqual(cookie(recovered),session);
  for(const path of ['/api/session','/api/preparation','/api/report','/api/review'])assert.equal((await call(path,{headers:headers('bob',session)})).status,403);
  for(const path of ['/api/session','/api/prepare','/api/turn','/api/finish','/api/preparation/cancel','/api/guide','/api/assessment'])assert.equal((await call(path,{method:'POST',body:{},headers:headers('bob',session)})).status,403);
  assert.equal((await call('/api/session',{method:'DELETE',headers:headers('bob',session)})).status,403);
  assert.equal((await call('/api/session',{headers:{Cookie:session}})).status,403,'public cookie cannot be used as a local session');
  assert.equal((await call('/api/session',{headers:headers('alice',session)})).status,200);
  // Even a valid signed assertion cannot downgrade the public host to localhost.
  assert.equal((await call('/api/status',{headers:{Origin:base,'cf-access-jwt-assertion':'admin'}})).status,403);
  const request={question:'What brings you here?',requestId:'security-turn-01',expectedTurn:0};
  assert.equal((await call('/api/turn',{method:'POST',body:request,headers:headers('alice',session)})).status,200);
  assert.equal((await call('/api/finish',{method:'POST',body:{reasoning},headers:headers('alice',session)})).status,200);
  assert.equal((await call('/api/report',{headers:headers('alice',session)})).status,200);
  assert.equal((await call('/api/review',{headers:headers('alice',session)})).status,403,'completion does not grant a reviewer role');
  assert.equal((await call('/api/review',{headers:headers('admin',session)})).status,403,'reviewer role does not grant another user’s session');
  const admin=await call('/api/session',{method:'POST',body:createBody,headers:headers('admin')});const own=cookie(admin);
  assert.equal((await call('/api/review',{headers:headers('admin',own)})).status,403,'reviewer must still finish own interview');
  await call('/api/turn',{method:'POST',body:request,headers:headers('admin',own)});await call('/api/finish',{method:'POST',body:{reasoning},headers:headers('admin',own)});
  assert.equal((await call('/api/review',{headers:headers('admin',own)})).status,200);
});

test('production HTTP errors do not expose stacks, provider errors, secrets or request content',async t=>{
  const provider=mockProvider(()=>{throw new Error('PRIVATE_KEY_secret-token-and-sensitive-question');});
  const {call}=await fixture(t,{provider});const created=await call('/api/session',{method:'POST',body:createBody});
  const response=await call('/api/turn',{method:'POST',body:{question:'What brings you here?',requestId:'security-error-01',expectedTurn:0},headers:{Cookie:cookie(created)}});
  assert.equal(response.status,500);assert.deepEqual(response.json(),{error:'The request could not be completed.'});
  assert.doesNotMatch(response.text,/PRIVATE_KEY|secret-token|stack|Error:/);
  assert.equal((await call('/api/session',{headers:{Cookie:'psychlab_session='+'a'.repeat(64)+'; psychlab_session='+'b'.repeat(64)}})).status,400);
});
