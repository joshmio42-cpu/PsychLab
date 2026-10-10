import {test} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createDemoServer} from '../demo.mjs';
import {productionEnvironment} from '../runtime.mjs';

async function demo(t){
  const server=createDemoServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const call=(path,options={})=>new Promise((resolve,reject)=>{
    const request=http.request(base+path,options,response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,text:Buffer.concat(chunks).toString()}));
    });request.on('error',reject);request.end();
  });
  return {call};
}

test('scripted demo serves its explicit public assets and clearly labels historical behavior',async t=>{
  const {call}=await demo(t);
  for(const path of ['/','/index.html','/app.mjs','/core.mjs','/agents.mjs','/style.css','/data.json'])assert.equal((await call(path)).status,200,path);
  const html=await call('/');assert.match(html.text,/Responses are scripted\. Live AI is not connected\./);
  assert.match(html.headers['content-security-policy'],/object-src 'none'/);assert.equal(html.headers['cache-control'],'no-store');
  const data=JSON.parse((await call('/data.json')).text);assert.ok(data.case.facts.length>0,'The reviewer rehearsal intentionally exposes its fictional case.');
});

test('scripted demo cannot expose private files, parent folders, live APIs or accept cross-origin requests',async t=>{
  const {call}=await demo(t);
  for(const path of ['/.env.local','/../.env.local','/%2e%2e/.env.local','/server.mjs','/api/status','/.git/config','/public-access.json','/README.md'])assert.equal((await call(path)).status,404,path);
  assert.equal((await call('/',{method:'POST'})).status,405);
  assert.equal((await call('/',{headers:{Host:'attacker.example'}})).status,403);
  assert.equal((await call('/',{headers:{Origin:'https://attacker.example'}})).status,403);
  assert.equal((await call('/',{headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
});

test('portable production child environment keeps provider configuration but removes debugging and TLS bypass',()=>{
  const source={NODE_ENV:'development',NODE_OPTIONS:'--inspect',NODE_DEBUG:'http',NODE_DEBUG_NATIVE:'http',NODE_TLS_REJECT_UNAUTHORIZED:'0',FEATHERLESS_API_KEY:'fixture-only-value'};
  const env=productionEnvironment(source);
  assert.equal(env.NODE_ENV,'production');assert.equal(env.FEATHERLESS_API_KEY,'fixture-only-value');
  for(const name of ['NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_TLS_REJECT_UNAUTHORIZED'])assert.equal(env[name],undefined);
  assert.deepEqual(productionEnvironment({node_env:'development',node_options:'--inspect',node_debug:'http',node_tls_reject_unauthorized:'0'}),{NODE_ENV:'production'});
  assert.equal(source.NODE_ENV,'development');
});

test('offline fetch guard rejects an accidental real provider request without calling the network',()=>{
  const preload=new URL('../offline-fetch.mjs',import.meta.url).href;
  const result=spawnSync(process.execPath,['--import',preload,'--input-type=module','-e',"import assert from 'node:assert/strict'; await assert.rejects(fetch('https://provider.example.test/'),/External fetch is disabled/);"],{
    cwd:fileURLToPath(new URL('../../',import.meta.url)),env:productionEnvironment(),encoding:'utf8',timeout:10000,windowsHide:true
  });
  assert.equal(result.error,undefined);assert.equal(result.status,0,result.stderr);
});
