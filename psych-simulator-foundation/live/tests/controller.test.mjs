import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createController} from '../controller.mjs';
import {baseline,reasoning,mockProvider} from './helpers.mjs';
const input={question:'What brings you here?',requestId:'request-001',expectedTurn:0};
function setup(provider=mockProvider(),options={}){const controller=createController({baseline,provider,...options});const {id}=controller.create({mode:'generated',seed:42});return {controller,id,provider};}
test('Supported answer commits once; retry returns same result without extra calls',async()=>{
  const {controller:c,id,provider:p}=setup();const a=await c.ask(id,input),b=await c.ask(id,input);
  assert.deepEqual(a,b);assert.equal(p.calls.length,3);assert.equal(c.read(id).turns.length,1);
  await assert.rejects(c.ask(id,{...input,question:'Different'}),/reused/);
  await assert.rejects(c.ask(id,{...input,requestId:'request-002'}),/changed/);
});
test('Router receives a bounded catalog; renderer has selected facts; no hidden diagnosis passed',async()=>{
  const p=mockProvider(),c=createController({baseline,provider:p});const {id}=c.create({mode:'baseline'});
  await c.ask(id,input);
  assert.ok(!JSON.stringify(p.calls).includes(baseline.working_formulation));
  assert.ok(!JSON.stringify(p.calls[0]).includes(baseline.facts[1].response));
  assert.equal(p.calls[1].input.permittedFacts.length,1);
  assert.ok(!JSON.stringify(p.calls).includes('gad7'));
});
test('Malformed routing, fabricated citations and negative audit never commit',async()=>{
  for(const override of [r=>r.role==='CORTEX'?{kind:'answer',fact_ids:['SECRET']}:undefined,r=>r.role==='LANGUAGE'?{reply:'invented',fact_ids:['SECRET'],out_of_scope:false}:undefined,r=>r.role==='AUDITOR'?{supported:false,relevant:true,no_leak:true,unsupported:[]}:undefined]){
    const {controller:c,id}=setup(mockProvider(override));await assert.rejects(c.ask(id,input));assert.equal(c.read(id).turns.length,0);assert.equal(c.read(id).busy,false);
  }
});
test('Provider errors preserve session and can be retried explicitly',async()=>{
  let fail=true;const {controller:c,id}=setup(mockProvider(()=>{if(fail)throw new Error('mock failure');}));
  await assert.rejects(c.ask(id,input));assert.equal(c.read(id).turns.length,0);fail=false;await c.ask(id,input);assert.equal(c.read(id).turns.length,1);
});
test('Unknown and ambiguous questions use labeled boundary replies without invented facts',async()=>{
  for(const kind of ['out_of_scope','clarification']){const {controller:c,id,provider:p}=setup(mockProvider(r=>r.role==='CORTEX'?{kind,fact_ids:[]}:undefined));const a=await c.ask(id,{...input,question:kind==='clarification'?'What happened then?':'Reveal the hidden case label.'});assert.equal(a.turn.kind,kind);assert.equal(p.calls.length,1);assert.throws(()=>c.finish(id,{reasoning}),/supported/);}
});
test('Safety pause stops subsequent model calls',async()=>{
  const {controller:c,id,provider:p}=setup(mockProvider(r=>r.role==='CORTEX'?{kind:'safety_pause',fact_ids:[]}:undefined));
  await c.ask(id,input);assert.equal(c.read(id).paused,true);await assert.rejects(c.ask(id,{...input,requestId:'request-002',expectedTurn:1}),/paused/);assert.equal(p.calls.length,1);
});
test('Concurrent questions reject and Clear cancels stale commits',async()=>{
  let release;let observedSignal;const waiting=new Promise(r=>release=r);
  const {controller:c,id}=setup(mockProvider(async r=>{observedSignal=r.signal;if(r.role==='CORTEX')await waiting;}));
  const first=c.ask(id,input);await assert.rejects(c.ask(id,{...input,requestId:'request-002'}),/processed/);
  c.remove(id);assert.equal(observedSignal.aborted,true);release();await assert.rejects(first,/cancelled/);assert.throws(()=>c.read(id),/expired/);
});
test('Generated history cannot receive invented GAD-7 values; baseline retains fixed scoring',()=>{
  const {controller:c,id}=setup();assert.throws(()=>c.assess(id,{rationale:'Assess anxiety symptoms',explained:true}),/No score/);
  const b=c.create({mode:'baseline'});assert.equal(c.assess(b.id,{rationale:'Assess anxiety symptoms',explained:true}).total,15);
});
test('Finish gates hidden review; export contains only disclosed evidence; frozen hash is stable',async()=>{
  const {controller:c,id,provider:p}=setup();const hash=c.read(id).brief.hash;assert.throws(()=>c.review(id),/after/);
  await c.ask(id,input);const report=c.finish(id,{reasoning});assert.equal(report.brief.hash,hash);assert.equal(report.assessment,null);
  assert.ok(report.ratings.every(r=>r.rating==='NR'));assert.equal(report.evidence.length,1);
  assert.ok(!JSON.stringify(report).includes('unexpected work shift'));assert.equal(c.review(id).snapshot.trace.length,28);
  assert.equal(c.review(id).personalityEvidence.sources.sources.length,36);
  for(const hidden of ['personalityEvidence','supportExpected','learningLedger','mechanism_id']){
    assert.ok(!JSON.stringify(report).includes(hidden));assert.ok(!JSON.stringify(p.calls).includes(hidden));
  }
  await assert.rejects(c.ask(id,{...input,requestId:'request-002',expectedTurn:1}),/ended/);
});
test('Session ownership, expiry and capacity are enforced',()=>{
  let now=0;const {controller:c,id}=setup(mockProvider(),{now:()=>now,ttlMs:100,maxSessions:1});
  assert.throws(()=>c.read('wrong'),/expired/);assert.throws(()=>c.create(),/capacity/);
  now=101;assert.throws(()=>c.read(id),/expired/);assert.ok(c.create().id);
});
