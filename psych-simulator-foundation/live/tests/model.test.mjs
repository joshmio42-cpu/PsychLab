import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createFeatherless} from '../model.mjs';
test('Missing credentials do not make a network call',async()=>{
  let calls=0;const p=createFeatherless({key:'',model:'',fetchImpl:()=>{calls++;}});assert.equal(p.configured,false);await assert.rejects(p.complete({role:'test',input:{},instruction:''}),/not configured/);assert.equal(calls,0);
});
test('Provider contract uses fixed endpoint, server key and usage metadata',async()=>{
  const p=createFeatherless({key:'mock-key',model:'mock-model',fetchImpl:async(url,options)=>{
    assert.equal(url,'https://api.featherless.ai/v1/chat/completions');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer mock-key');assert.equal(JSON.parse(options.body).model,'mock-model');assert.equal(JSON.parse(options.body).max_tokens,128);
    return {ok:true,json:async()=>({model:'returned-mock',choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}],usage:{total_tokens:12}})};
  }});const r=await p.complete({role:'test',instruction:'test',input:{}});assert.deepEqual(r.value,{ok:true});assert.equal(r.meta.usage.total_tokens,12);assert.equal(r.meta.returnedModel,'returned-mock');assert.ok(!JSON.stringify(r).includes('mock-key'));
});
test('Truncation, malformed JSON and HTTP failure reject without fallback',async()=>{
  for(const res of [{ok:false,status:429},{ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'{}'}}]})},{ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'not-json'}}]})}]){
    const p=createFeatherless({key:'mock',model:'mock',fetchImpl:async()=>res});await assert.rejects(p.complete({role:'test',instruction:'',input:{}}));
  }
});

test('Provider uses nonzero samplers, prompt JSON and explicit supported reasoning controls',async()=>{
  for(const model of ['Qwen/Qwen3-32B','Qwen/Qwen2.5-72B-Instruct','Qwen/Qwen3-Next-80B-A3B-Instruct','deepseek-ai/DeepSeek-V4-Flash-0731','deepseek-ai/DeepSeek-V4.1-Flash'])for(const role of ['CORTEX','LANGUAGE','AUDITOR']){
    let calls=0;
    const provider=createFeatherless({key:'mock-key',model,fetchImpl:async(url,options)=>{
      calls++;
      const body=JSON.parse(options.body);
      assert.equal(body.model,model);
      assert.equal(body.temperature,0.1);
      assert.equal(Object.hasOwn(body,'response_format'),false,'Avoid the malformed stream observed with forced JSON mode.');
      if(model.startsWith('Qwen/Qwen3-'))assert.equal(body.chat_template_kwargs?.enable_thinking,false);
      else if(/^deepseek-ai\/DeepSeek-V4(?:\.1)?-/.test(model))assert.deepEqual(body.chat_template_kwargs,{thinking:false});
      else assert.equal(Object.hasOwn(body,'chat_template_kwargs'),false);
      return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]})};
    }});
    await provider.complete({role,instruction:'Return JSON.',input:{question:'Hello.'}});
    assert.equal(calls,1);
  }
});

test('Malformed output, HTTP failures and transport failures never trigger automatic retry or model fallback',async()=>{
  for(const failure of ['json','truncated','rate-limit','transport']){
    let calls=0;
    const provider=createFeatherless({key:'mock-key',model:'Qwen/Qwen2.5-72B-Instruct',fetchImpl:async(url,options)=>{
      calls++;
      assert.equal(JSON.parse(options.body).model,'Qwen/Qwen2.5-72B-Instruct');
      if(failure==='transport')throw new Error('Mock connection failure.');
      if(failure==='rate-limit')return {ok:false,status:429};
      return {ok:true,json:async()=>({choices:[{finish_reason:failure==='truncated'?'length':'stop',message:{content:failure==='json'?'!!!!':'{}'}}]})};
    }});
    await assert.rejects(provider.complete({role:'LANGUAGE',instruction:'Return JSON.',input:{question:'Hello.'}}));
    assert.equal(calls,1);
  }
});
