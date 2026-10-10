import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimateCallCost,MODEL_PRICES,emptyCost,recordCallCost} from '../pricing.mjs';
import {createLedger,meteredComplete,usageView} from '../usage.mjs';
import {createController} from '../controller.mjs';
import {baseline,mockProvider} from './helpers.mjs';
import {createFeatherless,requestPayload} from '../model.mjs';
const model='Qwen/Qwen2.5-72B-Instruct';
const request={role:'CORTEX'},payload={bytes:100,maxTokens:128};
const meta=(usage,returnedModel=model)=>({requestedModel:model,returnedModel,usage});
const provider=(usage,returnedModel=model)=>({configured:true,model,complete:async()=>({value:{},meta:meta(usage,returnedModel)})});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-12,`${a} != ${b}`);

test('Prices apply separately to input/output tokens; total-only usage cannot produce dollars',()=>{
  const a=estimateCallCost(meta({prompt_tokens:1000,completion_tokens:200,total_tokens:1200}),model);
  near(a.estimatedUsd,0.00045);
  const b=estimateCallCost(meta({total_tokens:1200}),model);
  assert.equal(b.estimatedUsd,null);assert.ok(b.reasons.includes('missing_token_split'));
});

test('Actual returned model decides price and unknown models never inherit a requested price',()=>{
  const a=estimateCallCost(meta({prompt_tokens:1000,completion_tokens:200},'Qwen/Qwen3-30B-A3B-Instruct-2507'),model);
  near(a.estimatedUsd,0.000215);
  const b=estimateCallCost(meta({prompt_tokens:1000,completion_tokens:200},'different/model'),model);
  assert.equal(b.estimatedUsd,null);assert.ok(b.reasons.includes('unknown_model_price'));
});

test('Cached savings require reported cache tokens and a published cache rate',()=>{
  const q='Qwen/Qwen3-32B',usage={prompt_tokens:1000,completion_tokens:200};
  const ordinary=estimateCallCost(meta(usage,q),q);near(ordinary.estimatedUsd,0.0002006);
  assert.match(ordinary.cacheAssumption,/unreported/);
  const cached=estimateCallCost(meta({...usage,prompt_tokens_details:{cached_tokens:500}},q),q);
  near(cached.estimatedUsd,0.0001904);assert.equal(cached.cacheAssumption,null);
  const unknownDiscount=estimateCallCost(meta({...usage,prompt_tokens_details:{cached_tokens:500}}),model);
  near(unknownDiscount.estimatedUsd,0.00045);assert.match(unknownDiscount.cacheAssumption,/no published/);
  const invalid=estimateCallCost(meta({...usage,prompt_tokens_details:{cached_tokens:1500}},q),q);
  assert.equal(invalid.estimatedUsd,null);assert.ok(invalid.reasons.includes('invalid_cache_usage'));
});

test('Malformed or inconsistent usage is unavailable and zero tokens are a real zero estimate',()=>{
  for(const usage of [{prompt_tokens:-1,completion_tokens:3},{prompt_tokens:'1000',completion_tokens:3},
    {prompt_tokens:1000,completion_tokens:3,total_tokens:2000}])assert.equal(estimateCallCost(meta(usage),model).estimatedUsd,null);
  assert.equal(estimateCallCost(meta({prompt_tokens:0,completion_tokens:0,total_tokens:0}),model).estimatedUsd,0);
});

test('Metering separates session/process amounts and snapshots cannot mutate the ledger',async()=>{
  const session=createLedger(60),process=createLedger(300),next=createLedger(60);
  const p=provider({prompt_tokens:1000,completion_tokens:200,total_tokens:1200});
  const result=await meteredComplete(p,request,[session,process],payload);
  near(result.meta.cost.estimatedUsd,0.00045);
  await meteredComplete(p,request,[next,process],payload);
  near(session.cost.estimatedUsd,0.00045);near(next.cost.estimatedUsd,0.00045);near(process.cost.estimatedUsd,0.0009);
  assert.equal(session.reportedPromptTokens,1000);assert.equal(session.reportedCompletionTokens,200);
  const view=usageView(session,process);view.session.cost.models[0].rate.inputUsdPerMillion=999;
  assert.equal(session.cost.models[0].rate.inputUsdPerMillion,.37);
});

test('Known subtotal is marked partial after missing usage, an unknown model, or a connection failure',async()=>{
  const ledger=createLedger(60),p=provider({prompt_tokens:1000,completion_tokens:200});
  await meteredComplete(p,request,[ledger],payload);
  await meteredComplete(provider({total_tokens:250}),request,[ledger],payload);
  await meteredComplete(provider({prompt_tokens:1,completion_tokens:1},'unknown'),request,[ledger],payload);
  await assert.rejects(meteredComplete({...p,complete:async()=>{throw new Error('Connection failed');}},request,[ledger],payload),/Connection/);
  assert.equal(ledger.cost.status,'partial');near(ledger.cost.estimatedUsd,.00045);
  assert.equal(ledger.cost.pricedCalls,1);assert.equal(ledger.cost.unpricedCalls,3);
  assert.equal(ledger.cost.pendingCalls,0);assert.equal(ledger.failedCalls,1);
});

test('Failed local response validation can still report paid usage exactly once',async()=>{
  const ledger=createLedger(60),error=new Error('Invalid JSON');error.meta=meta({prompt_tokens:1000,completion_tokens:200,total_tokens:1200});
  await assert.rejects(meteredComplete({configured:true,model,complete:async()=>{throw error;}},request,[ledger],payload),/Invalid JSON/);
  assert.equal(ledger.attemptedCalls,1);assert.equal(ledger.failedCalls,1);assert.equal(ledger.completedCalls,0);
  assert.equal(ledger.unreportedCalls,0);assert.equal(ledger.reportedTokens,1200);assert.equal(ledger.cost.pricedCalls,1);
  near(ledger.cost.estimatedUsd,.00045);near(error.meta.cost.estimatedUsd,.00045);
});

test('Concurrent reservations mark the estimate incomplete until each request settles',async()=>{
  const ledger=createLedger(2),resolvers=[];
  const p={configured:true,model,complete:()=>new Promise(resolve=>resolvers.push(resolve))};
  const a=meteredComplete(p,request,[ledger],payload),b=meteredComplete(p,request,[ledger],payload);
  assert.equal(ledger.cost.pendingCalls,2);assert.equal(ledger.cost.status,'unavailable');
  await assert.rejects(meteredComplete(p,request,[ledger],payload),/budget/);
  resolvers[0]({meta:meta({prompt_tokens:1000,completion_tokens:200})});await a;
  assert.equal(ledger.cost.status,'partial');assert.equal(ledger.cost.pendingCalls,1);
  resolvers[1]({meta:meta({prompt_tokens:1000,completion_tokens:200})});await b;
  assert.equal(ledger.cost.status,'estimated');assert.equal(ledger.cost.pendingCalls,0);near(ledger.cost.estimatedUsd,.0009);
});

test('Changing a price preserves each request rate; stale or invalid stored prices are visible',()=>{
  const cost=emptyCost(),usage=meta({prompt_tokens:1_000_000,completion_tokens:0});
  const original=estimateCallCost(usage,model,{now:Date.parse('2026-10-08T00:00:00Z')});recordCallCost(cost,original);
  const revised={...MODEL_PRICES[model],inputUsdPerMillion:1,version:'revised',checkedOn:'2026-10-09'};
  const later=estimateCallCost(usage,model,{prices:{[model]:revised},now:Date.parse('2026-10-09T00:00:00Z')});recordCallCost(cost,later);
  near(cost.estimatedUsd,1.37);assert.equal(cost.models.length,2);assert.equal(cost.models[0].rate.inputUsdPerMillion,.37);
  assert.equal(estimateCallCost(usage,model,{now:Date.parse('2026-12-01T00:00:00Z')}).pricingStale,true);
  assert.equal(estimateCallCost(usage,model,{prices:{[model]:{...revised,inputUsdPerMillion:NaN}}}).estimatedUsd,null);
});

test('No calls is zero, wholly unknown usage is unavailable, and unconfigured provider is unmetered',async()=>{
  const ledger=createLedger(60);assert.equal(ledger.cost.status,'no_calls');assert.equal(ledger.cost.estimatedUsd,0);
  await assert.rejects(meteredComplete({configured:false,complete:async()=>{throw new Error('Missing key');}},request,[ledger],payload),/Missing key/);
  assert.equal(ledger.attemptedCalls,0);
  await meteredComplete(provider({}),request,[ledger],payload);
  assert.equal(ledger.cost.estimatedUsd,null);assert.equal(ledger.cost.status,'unavailable');
});

test('Replaying a completed turn returns its original cost without charging another request',async()=>{
  const p=mockProvider(),complete=p.complete;p.model=model;
  p.complete=async request=>({...await complete(request),meta:meta({prompt_tokens:100,completion_tokens:10,total_tokens:110})});
  const c=createController({baseline,provider:p}),{id}=c.create();
  const input={question:'What brings you here?',requestId:'pricing-replay-request-001',expectedTurn:0};
  const first=await c.ask(id,input),again=await c.ask(id,input);
  near(first.usage.session.cost.estimatedUsd,0.000123);
  assert.deepEqual(again,first);assert.equal(p.calls.length,3);
  assert.equal(c.read(id).usage.session.cost.pricedCalls,3);
});

test('Real provider adapter preserves cached usage through the metering boundary',async()=>{
  let calls=0;const q='Qwen/Qwen3-32B';
  const p=createFeatherless({key:'mock-only',model:q,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({model:q,
    usage:{prompt_tokens:1000,completion_tokens:200,total_tokens:1200,prompt_tokens_details:{cached_tokens:500}},
    choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]})};}});
  const ledger=createLedger(60),req={role:'CORTEX',instruction:'test',input:{}};
  const result=await meteredComplete(p,req,[ledger],requestPayload(req));
  assert.equal(calls,1);assert.equal(result.meta.usage.prompt_tokens_details.cached_tokens,500);
  near(result.meta.cost.estimatedUsd,.0001904);near(ledger.cost.estimatedUsd,.0001904);
});

test('Real provider adapter retains billed metadata after each local output rejection without retry',async()=>{
  for(const choice of [{finish_reason:'length',message:{content:'{}'}},{finish_reason:'stop',message:{content:'bad-json'}},
    {finish_reason:'stop',message:{content:'[]'}},null]){
    let calls=0;
    const p=createFeatherless({key:'mock-only',model,fetchImpl:async()=>{calls++;return {ok:true,json:async()=>({model,
      usage:{prompt_tokens:1000,completion_tokens:200,total_tokens:1200},choices:[choice]})};}});
    const ledger=createLedger(60),req={role:'CORTEX',instruction:'test',input:{}};
    await assert.rejects(meteredComplete(p,req,[ledger],requestPayload(req)));
    assert.equal(calls,1);assert.equal(ledger.failedCalls,1);assert.equal(ledger.cost.pricedCalls,1);
    assert.equal(ledger.cost.unpricedCalls,0);near(ledger.cost.estimatedUsd,.00045);
  }
});
