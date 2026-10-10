import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createIdentity,activateMotives,chooseAction,learnFromObservation} from '../models/identity.mjs';
import {evidenceBundle,explainRules,parameters} from '../models/registry.mjs';
import {simulateHistory,publicBrief} from '../../live/engine.mjs';

test('Registry mechanisms resolve to findings and original sources, with explicit status',()=>{
  const b=evidenceBundle(),ids=new Set(b.sources.sources.map(s=>s.source_id));
  assert.equal(ids.size,b.sources.sources.length);
  const rules=new Set(b.mechanisms.mechanisms.map(m=>m.rule_id));assert.equal(rules.size,b.mechanisms.mechanisms.length);
  for(const m of b.mechanisms.mechanisms){
    assert.ok(Object.hasOwn(b.evidenceMap.validation_levels,m.implementation_status));
    assert.equal(m.confidence.scientific_probability,null);
    for(const id of m.source_ids){assert.ok(ids.has(id));assert.ok(m.findings.some(f=>f.source_id===id&&f.finding));}
    const explanation=explainRules([m.rule_id])[0];assert.equal(explanation.sources.length,m.source_ids.length);
  }
  for(const entry of b.evidenceMap.behaviors)for(const id of entry.rule_ids)assert.ok(rules.has(id));
  function checkReferences(value){if(!value||typeof value!=='object')return;for(const [key,item] of Object.entries(value)){if(key==='source_ids')for(const id of item)assert.ok(ids.has(id));else checkReferences(item);}}
  checkReferences(b.constructs);assert.throws(()=>explainRules(['missing']));
});
test('Identity keeps unmeasured constructs null and distinguishes state from traits',()=>{
  const i=createIdentity();assert.equal(Object.keys(i.traits.domains).length,5);assert.equal(Object.keys(i.traits.facets).length,15);
  assert.ok(Object.values(i.traits.domains).every(x=>x===null));assert.equal(i.schema.selfWorth,null);
  assert.equal(i.motive.needs.autonomy.satisfaction,null);assert.equal(i.motive.needs.autonomy.frustration,null);
});
test('Observed feedback updates its relationship only; repetition does not create evidence',()=>{
  const initial=createIdentity(),feedback={eventId:'support-1',relationship:'cousin',supportObserved:1};
  const first=learnFromObservation(initial,feedback);
  assert.equal(initial.schema.relationships.cousin.supportExpected,.5);
  assert.equal(first.identity.schema.relationships.cousin.supportExpected,.54);
  assert.equal(first.identity.schema.relationships.friend.supportExpected,.5);
  assert.deepEqual(first.identity.traits,initial.traits);assert.deepEqual(first.identity.motive,initial.motive);
  assert.deepEqual(learnFromObservation(first.identity,feedback).identity,first.identity);
  assert.throws(()=>learnFromObservation(first.identity,{...feedback,supportObserved:0}));
});
test('Negative evidence works, unknown feedback does not become rejection, rates are bounded',()=>{
  const i=createIdentity();
  assert.deepEqual(learnFromObservation(i,{eventId:'unknown',relationship:'friend',supportObserved:null}).identity,i);
  assert.equal(learnFromObservation(i,{eventId:'negative',relationship:'friend',supportObserved:0}).identity.schema.relationships.friend.supportExpected,.46);
  for(const invalid of [-1,NaN,1.1,'1',undefined])assert.throws(()=>learnFromObservation(i,{eventId:'bad',relationship:'cousin',supportObserved:invalid}));
  assert.throws(()=>learnFromObservation(i,{eventId:'bad',relationship:'unknown',supportObserved:1}));
  assert.throws(()=>learnFromObservation(i,{eventId:'bad',relationship:'cousin',supportObserved:1},{learningRate:.9}));
  let current=i;
  for(let n=0;n<300;n++){const old=current;current=learnFromObservation(current,{eventId:`e${n}`,relationship:'cousin',supportObserved:n%2}).identity;const value=current.schema.relationships.cousin.supportExpected;assert.ok(value>=0&&value<=1);assert.ok(Math.abs(value-old.schema.relationships.cousin.supportExpected)<=parameters.learning.maxSingleUpdate+1e-6);}
});
test('Reliability and learning ablation affect updates without altering measured traits',()=>{
  const i=createIdentity(),f={eventId:'a',relationship:'cousin',supportObserved:1};
  assert.equal(learnFromObservation(i,{...f,reliability:.5}).identity.schema.relationships.cousin.supportExpected,.52);
  assert.equal(learnFromObservation(i,f,{learningRate:0}).identity.schema.relationships.cousin.supportExpected,.5);
});
test('Competing goals alter probabilities by event; no unrelated connection bonus on work',()=>{
  const i=createIdentity(),task=activateMotives(i,'task').identity;
  assert.ok(task.motive.activation.reliability>0&&task.motive.activation.recovery>0);
  const base=chooseAction(task,'task',.3,.4);task.motive.values.connection=0;
  assert.equal(chooseAction(activateMotives(task,'task').identity,'task',.3,.4).activeProbability,base.activeProbability);
  task.motive.values.reliability=0;
  assert.ok(chooseAction(activateMotives(task,'task').identity,'task',.3,.4).activeProbability<base.activeProbability);
  assert.deepEqual(i.motive.activation,{});assert.throws(()=>chooseAction(i,'task',.3,.4));
  assert.throws(()=>activateMotives(i,'unknown'));
  const quiet=activateMotives(i,'quiet').identity;assert.ok(quiet.motive.activation.autonomy>0);assert.equal(quiet.motive.activation.connection,undefined);
});
test('History integrates traceable learning and keeps evidence away from public briefs',()=>{
  const s=simulateHistory({seed:42,days:90});assert.equal(s.personalityEvidence.sourceCount,36);
  assert.deepEqual(s.initialState.identity.traits,s.finalState.identity.traits);
  assert.deepEqual(s.initialState.identity.motive.values,s.finalState.identity.motive.values);
  assert.equal(s.finalState.identity.schema.relationships.friend.supportExpected,.5);
  assert.equal(s.finalState.identity.schema.learningLedger.length,s.functioning.supportContacts);
  for(const day of s.trace){const action=day.steps.find(x=>x.agent==='SOCIAL').output;assert.ok(action.variablePaths.length);for(const rule of action.evidence)assert.ok(explainRules([rule.ruleId])[0].mechanism);}
  assert.ok(!JSON.stringify(publicBrief(s)).includes('personalityEvidence'));
  assert.ok(!JSON.stringify(s.facts).includes('supportExpected'));
});
