import test from 'node:test';
import assert from 'node:assert/strict';
import {API_ROOT, AdaptionError, createAdaption, storageTransfer, validateStorageURL} from '../client.mjs';

const key='test-private-key-never-display';
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'Content-Type':'application/json'}});

test('authentication check uses the fixed official host and returns no dataset/account content',async()=>{
  const calls=[];
  const client=createAdaption({key:` ${key} `,fetchImpl:async(...args)=>{calls.push(args);return json({datasets:[{name:'private account dataset'}]});}});
  const result=await client.check();
  assert.equal(result.authenticated,true);
  assert.equal(result.endpoint,API_ROOT);
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],'https://api.prod.adaptionlabs.ai/api/v1/datasets?limit=1');
  assert.equal(calls[0][1].headers.Authorization,`Bearer ${key}`);
  assert.equal(calls[0][1].redirect,'error');
  assert.ok(calls[0][1].signal instanceof AbortSignal);
  assert.ok(!JSON.stringify(result).includes(key));
  assert.ok(!JSON.stringify(result).includes('private account'));
});

test('missing keys and non-dataset or traversal paths are rejected before fetch',async()=>{
  for(const missing of [null,'','   ',7]) {
    assert.throws(()=>createAdaption({key:missing}),AdaptionError);
  }
  let calls=0;
  const client=createAdaption({key,fetchImpl:async()=>{calls++;return json({});}});
  for(const path of ['https://example.com','//example.com','/datasets/../autoscientist','/datasets#secret','/autoscientist','/datasets-other']) {
    await assert.rejects(client.request(path),AdaptionError);
  }
  assert.equal(calls,0);
});

test('HTTP authentication, rate-limit and server failures do not echo bodies or retry',async()=>{
  for(const status of [401,403,429,500]) {
    let calls=0;
    const client=createAdaption({key,fetchImpl:async()=>{calls++;return new Response(`secret ${key} signed url account data`,{status});}});
    await assert.rejects(client.request('/datasets'),error=>{
      assert.ok(error instanceof AdaptionError);
      assert.equal(error.status,status);
      assert.ok(!String(error).includes(key));
      assert.ok(!String(error).includes('signed url'));
      return true;
    });
    assert.equal(calls,1);
  }
});

test('transport/redirect and JSON parse failures are redacted without retries',async()=>{
  for(const response of ['throw','invalid-json']) {
    let calls=0;
    const client=createAdaption({key,fetchImpl:async()=>{
      calls++;
      if(response==='throw')throw new Error(`redirect rejected: ${key}`);
      return new Response(`bad JSON ${key}`);
    }});
    await assert.rejects(client.request('/datasets',{method:'POST',body:{source:{name:'fiction.jsonl'}}}),error=>error instanceof AdaptionError&&!String(error).includes(key));
    assert.equal(calls,1);
  }
  await assert.rejects(createAdaption({key,fetchImpl:async()=>json({notDatasets:[]})}).check(),AdaptionError);
});

test('signed S3 upload sends bytes with no Adaption authorization and refuses redirects',async()=>{
  const signed='https://example-bucket.s3.us-east-1.amazonaws.com/fiction.jsonl?X-Amz-Signature=test-signature';
  const payload=Buffer.from('fictional dataset');
  let calls=0;
  const result=await storageTransfer(signed,{method:'PUT',body:payload,fetchImpl:async(url,options)=>{
    calls++;
    assert.equal(url,signed);
    assert.equal(options.method,'PUT');
    assert.equal(options.body,payload);
    assert.equal(options.redirect,'error');
    assert.equal(options.headers,undefined);
    return new Response(null,{status:200});
  }});
  assert.equal(result,null);
  assert.equal(calls,1);
});

test('storage rejects non-S3 AWS, internal, credentialed and lookalike destinations',()=>{
  for(const value of ['http://s3.amazonaws.com/a','https://localhost/a','https://127.0.0.1/a','https://s3.amazonaws.com.evil.test/a','https://user:password@s3.amazonaws.com/a','https://s3.amazonaws.com:8443/a','https://internal.us-east-1.elb.amazonaws.com/a']) {
    assert.throws(()=>validateStorageURL(value),AdaptionError,value);
  }
});

test('storage transport and HTTP failures redact signed URLs and do not retry',async()=>{
  const signed='https://s3.amazonaws.com/example/a?X-Amz-Signature=private-signed-value';
  for(const status of [null,403]) {
    let calls=0;
    await assert.rejects(storageTransfer(signed,{fetchImpl:async()=>{
      calls++;
      if(status===null)throw new Error(signed);
      return new Response(signed,{status});
    }}),error=>error instanceof AdaptionError&&!String(error).includes('private-signed-value'));
    assert.equal(calls,1);
  }
});

test('dataset download is bounded by declared and streamed sizes',async()=>{
  const client=createAdaption({key,fetchImpl:async()=>new Response('small',{headers:{'Content-Length':String(6*1024*1024)}})});
  await assert.rejects(client.request('/datasets/pilot/download?fileFormat=jsonl',{binary:true}),/size limit/);
  const streamed=createAdaption({key,fetchImpl:async()=>new Response(Buffer.alloc(5*1024*1024+1))});
  await assert.rejects(streamed.request('/datasets/pilot/download?fileFormat=jsonl',{binary:true}),/size limit/);
  const okay=createAdaption({key,fetchImpl:async()=>new Response('{"row":"fiction"}\n')});
  assert.equal((await okay.request('/datasets/pilot/download?fileFormat=jsonl',{binary:true})).toString(),'{"row":"fiction"}\n');
});

test('mid-stream transport failures cannot leak a key or signed storage URL',async()=>{
  const response=()=>({ok:true,headers:new Headers(),body:{async *[Symbol.asyncIterator](){throw new Error(`transport details ${key} X-Amz-Signature=private`);}}});
  const client=createAdaption({key,fetchImpl:async()=>response()});
  await assert.rejects(client.request('/datasets/pilot/download?fileFormat=jsonl',{binary:true}),error=>error instanceof AdaptionError&&!String(error).includes(key)&&!String(error).includes('X-Amz-Signature'));
  await assert.rejects(storageTransfer('https://s3.amazonaws.com/example/a',{fetchImpl:async()=>response()}),error=>error instanceof AdaptionError&&!String(error).includes(key));
});
