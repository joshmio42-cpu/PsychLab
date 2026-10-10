import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptationConfig,parsePilot,quoteSummary,requireRunGate,sha256} from '../config.mjs';

function pilotRows(){return Array.from({length:25},(_,index)=>({
  prompt:`Fictional interviewer question ${index+1}?`,
  context:JSON.stringify({id:`example-${index+1}`,permittedFacts:[{id:'P01',text:'The fictional person likes drawing.'}]}),
  completion:JSON.stringify({reply:'I like drawing.',factIds:['P01']})
}));}
const encode=rows=>Buffer.from(rows.map(row=>JSON.stringify(row)).join('\n')+'\n');
const now=Date.parse('2026-10-09T12:00:00Z');
function gateFixture(){
  const config=adaptationConfig('one-pilot-only');
  const bytes=encode(pilotRows());
  return {config,bytes,state:{datasetId:'pilot-id',dataHash:sha256(bytes),quote:{credits:1,minutes:2,checkedAt:new Date(now).toISOString(),configHash:sha256(JSON.stringify(config))}}};
}

test('pilot config caps rows and preserves prompt without augmentation or web grounding',()=>{
  const config=adaptationConfig('persisted-id');
  assert.equal(config.job_specification.max_rows,25);
  assert.equal(config.job_specification.idempotency_key,'persisted-id');
  assert.deepEqual(config.recipe_specification.recipes,{prompt_rephrase:false,deduplication:false,reasoning_traces:false});
  assert.equal(config.language_expansion,null);
  assert.equal(config.brand_controls.hallucination_mitigation,false);
  assert.equal(config.training_type,'instruction_dataset');
  assert.deepEqual(config.column_mapping,{prompt:'prompt',completion:'completion',context:['context']});
});

test('exactly 25 fictional JSONL examples with unique IDs and valid citations are accepted',()=>{
  const rows=pilotRows();
  assert.deepEqual(parsePilot(encode(rows)),rows);
  assert.deepEqual(parsePilot(Buffer.from(encode(rows).toString().replaceAll('\n','\r\n'))),rows);
});

test('pilot rejects invalid count, oversized data, columns, duplicate IDs and missing facts',()=>{
  const cases=[Buffer.from('not JSON'),encode(pilotRows().slice(1))];
  let rows=pilotRows();rows[0].extra='unapproved field';cases.push(encode(rows));
  rows=pilotRows();rows[0].context=rows[1].context;cases.push(encode(rows));
  rows=pilotRows();rows[0].completion=JSON.stringify({reply:'Unsupported',factIds:['UNKNOWN']});cases.push(encode(rows));
  rows=pilotRows();rows[0].prompt='x'.repeat(1001);cases.push(encode(rows));
  rows=pilotRows();rows[0].context='invalid';cases.push(encode(rows));
  rows=pilotRows();rows[0].completion=JSON.stringify({reply:7,factIds:[]});cases.push(encode(rows));
  rows=pilotRows();rows[0].context=JSON.stringify({id:'oversized',permittedFacts:[{id:'P01',text:'x'.repeat(250001)}]});cases.push(encode(rows));
  for(const bytes of cases)assert.throws(()=>parsePilot(bytes));
});

test('wire quote must explicitly be estimate-only, text-only, finite and nonnegative',()=>{
  const valid={estimate:true,run_id:null,estimatedCreditsConsumed:1,estimatedMinutes:2,multimodalPricingApplied:false};
  assert.deepEqual(quoteSummary(valid),{credits:1,minutes:2,estimateOnly:true});
  for(const changed of [{estimate:false},{run_id:'already-running'},{estimatedCreditsConsumed:-1},{estimatedCreditsConsumed:NaN},{estimatedCreditsConsumed:'1'},{estimatedMinutes:Infinity},{estimatedMinutes:-1},{multimodalPricingApplied:true},{multimodalPricingApplied:undefined}]) {
    assert.throws(()=>quoteSummary({...valid,...changed}));
  }
});

test('paid run gate accepts only matching fresh quote and sufficient explicit ceiling',()=>{
  const {state,config,bytes}=gateFixture();
  assert.doesNotThrow(()=>requireRunGate(state,config,bytes,1,now));
  for(const ceiling of [undefined,NaN,Infinity,-1,0,'1'])assert.throws(()=>requireRunGate(state,config,bytes,ceiling,now));
  assert.throws(()=>requireRunGate({...state,quote:null},config,bytes,1,now));
  assert.throws(()=>requireRunGate(state,{...config,training_type:'preference_pairs'},bytes,1,now));
  assert.throws(()=>requireRunGate(state,config,Buffer.concat([bytes,Buffer.from(' ')]),1,now));
});

test('paid run gate rejects old, future and invalid timestamps plus repeated launch attempts',()=>{
  const {state,config,bytes}=gateFixture();
  for(const checkedAt of [new Date(now-24*60*60*1000-1).toISOString(),new Date(now+1).toISOString(),'invalid']) {
    assert.throws(()=>requireRunGate({...state,quote:{...state.quote,checkedAt}},config,bytes,1,now));
  }
  assert.throws(()=>requireRunGate({...state,runAttemptedAt:new Date(now).toISOString()},config,bytes,1,now));
});

test('paid run gate rejects corrupted quote values instead of treating missing credits as zero',()=>{
  const {state,config,bytes}=gateFixture();
  for(const credits of [undefined,NaN,-1,'1']) {
    assert.throws(()=>requireRunGate({...state,quote:{...state.quote,credits}},config,bytes,1,now));
  }
});
