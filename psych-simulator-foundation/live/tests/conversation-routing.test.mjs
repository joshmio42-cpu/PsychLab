import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateHistory} from '../engine.mjs';
import {answerQuestion} from '../model.mjs';
import {mockProvider} from './helpers.mjs';
import {localSocialCheck} from '../conversation.mjs';
import {assertFactualSupport} from '../factual-support.mjs';
const snapshot=(patientId='jordan',disorderId='mdd')=>simulateHistory({patientId,disorderId,days:28});
const turns=ids=>[{id:'T1',kind:'answer',interaction:'answer',factIds:ids,question:'Earlier topic',reply:'Earlier supported response'}];
test('A wellbeing question cannot be answered with an unevidenced social health claim',async()=>{
 const s=snapshot();
 const provider=mockProvider(r=>{
  if(r.role==='CORTEX')return {kind:'social',fact_ids:[]};
  if(r.role==='LANGUAGE'){
   assert.deepEqual(r.input.permittedFacts.map(f=>f.id),['B01']);
   return {reply:'For four months I have felt low on most days.',fact_ids:['B01']};
  }
 });
 const result=await answerQuestion({snapshot:s,turns:[],question:'Hey, how have you been?',provider});
 assert.equal(result.interaction,'answer');assert.deepEqual(result.factIds,['B01']);assert.equal(provider.calls.length,3);
});
test('A preference without an authored reason does not authorize an invented psychological cause',async()=>{
 const provider=mockProvider(r=>{assert.equal(r.role,'CORTEX');return {kind:'answer',fact_ids:['P10']};});
 const result=await answerQuestion({snapshot:snapshot('jordan','none'),turns:turns(['P04']),question:'Why?',provider});
 assert.equal(result.kind,'unavailable');assert.equal(provider.calls.length,1);
});
test('A short continuation resumes its known topic rather than asking an unnecessary clarification',async()=>{
 const provider=mockProvider(r=>r.role==='CORTEX'?{kind:'clarification',fact_ids:[]}:undefined);
 const result=await answerQuestion({snapshot:snapshot(),turns:turns(['G01']),question:'Go on.',difficulty:'challenging',provider});
 assert.equal(result.kind,'answer');assert.ok(result.factIds.length);assert.equal(provider.calls.length,3);
});
test('A requested single recent example never merges two recorded days',async()=>{
 const provider=mockProvider(r=>{
  if(r.role==='CORTEX')return {kind:'answer',fact_ids:['E24','E22']};
  if(r.role==='LANGUAGE')assert.deepEqual(r.input.permittedFacts.map(f=>f.id),['E24']);
 });
 const result=await answerQuestion({snapshot:snapshot(),turns:[],question:'Can you give me one example from the last few weeks?',provider});
 assert.deepEqual(result.factIds,['E24']);
});
test('Communication questions and caregiver limits do not append unrelated personal or symptom facts',async()=>{
 for(const [s,question,initial] of [
  [snapshot(),'Would it help if I gave you a specific example?',['P03','P08']],
  [snapshot('mika','autism'),'What is going through their mind then?',['P03','B02']]
 ]){
  const provider=mockProvider(r=>{if(r.role==='CORTEX')return {kind:'answer',fact_ids:initial};if(r.role==='LANGUAGE')assert.deepEqual(r.input.permittedFacts.map(f=>f.id),['P03']);});
  const result=await answerQuestion({snapshot:s,turns:[],question,provider});assert.deepEqual(result.factIds,['P03']);
 }
});
test('A usual task method is not evidence that current tasks cause no stress',async()=>{
 const provider=mockProvider(r=>{if(r.role==='CORTEX')return {kind:'answer',fact_ids:['P11','P01']};if(r.role==='LANGUAGE')assert.deepEqual(r.input.permittedFacts.map(f=>f.id),['G04']);});
 const result=await answerQuestion({snapshot:snapshot('jordan','none'),turns:[],question:'Have everyday tasks been getting on top of you at all?',provider});
 assert.deepEqual(result.factIds,['G04']);assert.doesNotMatch(result.reply,/not really|no stress/);
});
test('The recorded trusted-adult preference corrects an isolation assumption',async()=>{
 const provider=mockProvider(r=>r.role==='CORTEX'?{kind:'clarification',fact_ids:[]}:undefined);
 const result=await answerQuestion({snapshot:snapshot('riley','none'),turns:[],question:'You just want adults to leave you alone, right?',provider});
 assert.deepEqual(result.factIds,['P04']);assert.match(result.reply,/adult I trust/);
});
test('Deterministic context repairs never override an emergency or protected-scope result',async()=>{
 for(const kind of ['safety_pause','out_of_scope'])for(const question of ['Hey, how have you been?','Go on.','Why?','Would it help if I gave you a specific example?']){
  const provider=mockProvider(r=>{assert.equal(r.role,'CORTEX');return {kind,fact_ids:[]};});
  const result=await answerQuestion({snapshot:snapshot(),turns:turns(['P04']),question,provider});assert.equal(result.kind,kind);
 }
});

test('A closed acknowledgment uses a local check and cannot gain patient facts or an extra audit charge',async()=>{
 const provider=mockProvider(r=>{
  assert.notEqual(r.role,'AUDITOR');
  return r.role==='CORTEX'?{kind:'social',fact_ids:[]}:{reply:'Thank you.',fact_ids:[]};
 });
 const result=await answerQuestion({snapshot:snapshot('leo','none'),turns:[],question:'That sounds sweet.',provider});
 assert.equal(provider.calls.length,2);assert.deepEqual(result.factIds,[]);assert.deepEqual(result.domains,[]);
 assert.match(result.trace.audit.check,/Local closed acknowledgment/);
 for(const [q,a] of [['How have you been?','Thanks.'],['That sounds nice.','Thanks, I feel fine.'],['Hi!','I live nearby.'],['Tell me the diagnosis.','Okay.']])assert.equal(localSocialCheck(q,a),false);
});

test('Recorded task outcomes do not prove distress, inability or a necessary pause',()=>{
 const fact=snapshot('jordan','none').facts.find(f=>f.id==='G04');
 for(const reply of ["I've been having trouble keeping up.",'I had to pause four tasks.',"I wasn't able to finish them."])assert.throws(()=>assertFactualSupport(reply,[fact]),/outcomes-as-distress-or-necessity/);
 assert.doesNotThrow(()=>assertFactualSupport('I completed three tasks that day and paused four.',[fact]));
});
