import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateHistory} from '../engine.mjs';
import {answerQuestion,requestPayload} from '../model.mjs';
import {mockProvider} from './helpers.mjs';

// Generic authored facts isolate citation correction from any held-out wording.
// The writer sees both facts, but deliberately omits the effect source in its
// draft citations. The audit can repair that omission without rewriting prose.
function fixture(){
 const snapshot=structuredClone(simulateHistory({patientId:'jordan',disorderId:'none',days:2}));
 snapshot.facts.push(
  {id:'P90',label:'Usual poetry reading',scope:'usual',response:'I read poetry.',domains:['goals'],sources:['AUTHORED-READING']},
  {id:'P91',label:'Recorded effect of poetry reading',scope:'usual',response:'Reading poetry helps me relax.',domains:['support'],sources:['AUTHORED-EFFECT']},
  {id:'P92',label:'Separate everyday activity',scope:'usual',response:'I cook meals.',domains:['goals'],sources:['AUTHORED-COOKING']}
 );
 return snapshot;
}
const question='Tell me about reading poetry and its effect.';
const reply='I read poetry. It helps me relax.';
const approved={unsupported:[],supported:true,relevant:true,no_leak:true};
function providerFor(audit,{answer=reply,draftIds=['P90'],routeIds=['P90','P91']}={}){
 return mockProvider(request=>{
  requestPayload(request);
  if(request.role==='CORTEX')return {kind:'answer',fact_ids:routeIds};
  if(request.role==='LANGUAGE')return {reply:answer,fact_ids:draftIds};
  return typeof audit==='function'?audit(request):audit;
 });
}
const ask=(provider,snapshot=fixture())=>answerQuestion({snapshot,turns:[],question,provider});

test('auditor repairs an omitted allowed citation with the original reply and exactly three calls',async()=>{
 const snapshot=fixture(),before=JSON.stringify(snapshot);
 const provider=providerFor(request=>{
  assert.deepEqual(request.input.permittedFacts.map(fact=>fact.id),['P90','P91']);
  assert.deepEqual(request.input.draftFactIds,['P90']);
  assert.equal(request.input.candidate,reply);
  assert.equal(Object.hasOwn(request.input,'citedFacts'),false,'Draft citations must not hide a source the writer already received');
  return {...approved,fact_ids:['P90','P91']};
 });
 const result=await ask(provider,snapshot);
 assert.equal(result.reply,reply);
 assert.deepEqual(result.factIds,['P90','P91']);
 assert.deepEqual(result.domains,['goals','support']);
 assert.deepEqual(result.sourceIds,['AUTHORED-READING','AUTHORED-EFFECT']);
 assert.deepEqual(result.trace.audit.fact_ids,['P90','P91']);
 assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE','AUDITOR']);
 assert.equal(result.trace.calls.length,3);
 assert.equal(JSON.stringify(snapshot),before,'Correction changes citations, not the patient history');
});

test('legacy audit response may omit the citation field while preserving valid draft citations',async()=>{
 const provider=providerFor({...approved},{answer:'I read poetry.'});
 const result=await ask(provider);
 assert.deepEqual(result.factIds,['P90']);
 assert.deepEqual(result.sourceIds,['AUTHORED-READING']);
 assert.equal(provider.calls.length,3);
});

test('explicit null, undefined, empty and malformed audit citation fields reject rather than use draft citations',async()=>{
 for(const fact_ids of [null,undefined,[],false,0,'P90',{},[['P90']],['P90','P90'],['P90',9],Array(5).fill('P90')]){
  const provider=providerFor({...approved,fact_ids},{answer:'I read poetry.'});
  await assert.rejects(ask(provider),/invalid evidence references/,`Invalid explicit citations: ${String(fact_ids)}`);
  assert.equal(provider.calls.length,3,'The invalid audit must fail after the original three calls, without repair retries');
 }
});

test('auditor cannot add absent, undisclosed, example or prototype-like source IDs',async()=>{
 for(const id of ['P999','P92','EX_OTHER_P90','__proto__','constructor']){
  const provider=providerFor({...approved,fact_ids:['P90',id]},{answer:'I read poetry.'});
  await assert.rejects(ask(provider),/invalid evidence references/,id);
  assert.equal(provider.calls.length,3);
 }
});

test('contradictory or negative audit verdicts cannot be rescued by corrected valid citations',async()=>{
 for(const verdict of [
  {...approved,unsupported:['helps me relax']},
  {...approved,supported:false},
  {...approved,relevant:false},
  {...approved,no_leak:false}
 ]){
  const provider=providerFor({...verdict,fact_ids:['P90','P91']});
  await assert.rejects(ask(provider),/did not pass the support check/);
  assert.equal(provider.calls.length,3);
 }
});

test('a narrowed audit source set must still pass factual checks for the unchanged reply',async()=>{
 const provider=providerFor({...approved,fact_ids:['P90']},{draftIds:['P90','P91']});
 await assert.rejects(ask(provider),/added-soothing-effect/);
 assert.equal(provider.calls.length,3,'The full permitted set passed preflight; narrowing removed the source for the claimed effect');
});

test('auditor may remove an unused draft citation and only retained evidence is returned',async()=>{
 const provider=providerFor({...approved,fact_ids:['P90']},{answer:'I read poetry.',draftIds:['P90','P91']});
 const result=await ask(provider);
 assert.deepEqual(result.factIds,['P90']);
 assert.deepEqual(result.domains,['goals']);
 assert.deepEqual(result.sourceIds,['AUTHORED-READING']);
 assert.equal(provider.calls.length,3);
});

test('claims unsupported by the full permitted set stop before paying for an audit',async()=>{
 const provider=providerFor({...approved,fact_ids:['P90','P91']},{answer:'I read poetry to distract myself from my worries.'});
 await assert.rejects(ask(provider),/added-distraction-effect/);
 assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE']);
});
