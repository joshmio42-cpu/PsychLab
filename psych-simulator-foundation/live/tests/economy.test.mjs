import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildAgentContext,compactHistory} from '../agent-context.mjs';
import {requestPayload,createFeatherless} from '../model.mjs';
import {ECONOMY,createLedger,meteredComplete} from '../usage.mjs';
import {simulateHistory} from '../engine.mjs';
import {createController} from '../controller.mjs';
import {baseline,mockProvider,reasoning} from './helpers.mjs';
const input={question:'What brings you here?',requestId:'economy-request-001',expectedTurn:0};
test('Personality and mental premise projection contains selected subjective memories only',()=>{
  const s=simulateHistory(),m=s.memory.find(x=>x.kind==='cancelled'),id=`E${String(m.day).padStart(2,'0')}`;
  const p=buildAgentContext(s,[id]);
  assert.deepEqual(p.context.mentalPremise.mnemosyne,[{factId:id,interpretation:m.interpretation}]);
  assert.deepEqual(p.trace.relationshipTargets,['friend']);assert.equal(p.trace.extraModelCalls,0);
  assert.ok(p.context.personality.motive.includes('connection'));assert.ok(p.context.personality.trait.includes('No measured'));
  for(const hidden of ['unexpected work shift','threatSensitivity','supportExpected','learningLedger','source_ids'])assert.ok(!JSON.stringify(p.context).includes(hidden));
  const opening=buildAgentContext(s,['G01']);assert.equal(opening.context.mentalPremise.mnemosyne.length,0);assert.equal(opening.context.personality.schema.length,0);
});
test('Expression context responds to scoped schema changes without exposing scores or changing history',()=>{
  const s=structuredClone(simulateHistory()),m=s.memory.find(x=>x.kind==='support'),id=`E${String(m.day).padStart(2,'0')}`;
  const original=JSON.stringify(s);buildAgentContext(s,[id]);assert.equal(JSON.stringify(s),original);
  s.finalState.identity.schema.relationships.cousin.supportExpected=.9;
  const a=buildAgentContext(s,[id]).context;s.finalState.identity.schema.relationships.cousin.supportExpected=.1;
  const b=buildAgentContext(s,[id]).context;assert.notDeepEqual(a.personality.schema,b.personality.schema);
  assert.equal(buildAgentContext({affect:'calm'},[]).context.personality.schema.length,0);
});
test('History is bounded and keeps complete recent exchanges, including Unicode',()=>{
  const turns=Array.from({length:20},(_,i)=>({question:`q${i}`,reply:'answer'}));
  assert.equal(compactHistory(turns).length,4);assert.equal(compactHistory(turns)[0].question,'q16');
  assert.equal(compactHistory([{question:'好'.repeat(1000),reply:'x'}]).length,0);
  assert.ok(Buffer.byteLength(JSON.stringify(compactHistory(turns)), 'utf8')<=2400);
});
test('Every role has a small completion cap and oversized prompts never reach the provider',async()=>{
  for(const [role,max] of Object.entries(ECONOMY.outputTokens))assert.equal(requestPayload({role,instruction:'test',input:{}}).maxTokens,max);
  let calls=0;const provider=createFeatherless({key:'mock',model:'mock',fetchImpl:()=>{calls++;}});
  await assert.rejects(provider.complete({role:'LANGUAGE',instruction:'test',input:{large:'x'.repeat(13000)}}),/prompt limit/);assert.equal(calls,0);
});
test('Connected agents use three calls, quota blocks the next turn, retries are free',async()=>{
  const p=mockProvider(),c=createController({baseline,provider:p,sessionCallLimit:3});const {id}=c.create();
  assert.equal(c.read(id).usage.session.attemptedCalls,0);
  const a=await c.ask(id,input);assert.equal(p.calls.length,3);assert.ok(p.calls[1].input.agentContext);
  assert.equal(a.usage.session.attemptedCalls,3);assert.deepEqual(await c.ask(id,input),a);assert.equal(p.calls.length,3);
  await assert.rejects(c.ask(id,{...input,requestId:'economy-request-002',expectedTurn:1}),/remain/);assert.equal(p.calls.length,3);
  c.finish(id,{reasoning});assert.equal(c.review(id).interviewTraces[0].agents.extraModelCalls,0);
});
test('Failed attempts count, missing usage is unknown, and Clear cannot reset process budget',async()=>{
  const p=mockProvider(()=>{throw new Error('network failure');}),c=createController({baseline,provider:p,sessionCallLimit:6,processCallLimit:3});
  const {id}=c.create();await assert.rejects(c.ask(id,input),/network/);
  const u=c.read(id).usage;assert.equal(u.session.failedCalls,1);assert.equal(u.session.unreportedCalls,1);assert.equal(u.session.reportedTokens,0);
  c.remove(id);const next=c.create();await assert.rejects(c.ask(next.id,input),/remain/);assert.equal(p.calls.length,1);
});
test('Shared ledger reserves synchronously across concurrent calls and reports actual usage',async()=>{
  const ledger=createLedger(1);let release;const wait=new Promise(r=>release=r);
  const p={configured:true,complete:async()=>{await wait;return {meta:{usage:{total_tokens:123}}};}};
  const request={role:'CORTEX',instruction:'test',input:{}},payload=requestPayload(request);
  const first=meteredComplete(p,request,[ledger],payload);
  await assert.rejects(meteredComplete(p,request,[ledger],payload),/budget/);release();await first;
  assert.equal(ledger.attemptedCalls,1);assert.equal(ledger.reportedTokens,123);assert.equal(ledger.unreportedCalls,0);
});
