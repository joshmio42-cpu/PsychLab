import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patientOptions} from '../patients.mjs';
import {patientIndividuality,personalFacts,PROFILE_BACKGROUND_VERSION} from '../individuality.mjs';
import {compatibleDisorders} from '../disorders.mjs';
import {simulateHistory,publicBrief} from '../engine.mjs';
import {answerQuestion,requestPayload} from '../model.mjs';
import {ECONOMY} from '../usage.mjs';
import {mockProvider} from './helpers.mjs';

test('Every person has six additional citable background records with explicit temporal scope',()=>{
 const examples=[];
 for(const patient of patientOptions()){
  const person=patientIndividuality(patient.id),facts=personalFacts(person);
  assert.equal(person.profileVersion,PROFILE_BACKGROUND_VERSION);
  assert.deepEqual(facts.map(f=>f.id),Array.from({length:12},(_,i)=>`P${String(i+1).padStart(2,'0')}`));
  for(const fact of facts){
   assert.equal(fact.provenance,'authored-fiction');
   assert.ok(['usual','past','preference','wish'].includes(fact.scope));
   assert.deepEqual(fact.sources,[]); // Fiction is not clinical source evidence.
   assert.ok(fact.response.length>20);
   if(fact.scope==='past')assert.equal(fact.timeframe,'before-simulation');
  }
  const background=facts.slice(6);
  assert.deepEqual(background.map(f=>f.scope),['usual','past','usual','preference','usual','wish']);
  assert.ok(background.every(f=>f.label.length>20&&f.keywords.length>=3&&f.domains.length>0));
  assert.ok(background.every(f=>f.response.length<330),'Keep selected facts brief enough for the economy envelope.');
  assert.match(facts.find(f=>f.id==='P12').response,/not .*already happened|haven.t|not a finished/);
  examples.push(facts.find(f=>f.id==='P08').response);
 }
 assert.equal(new Set(examples).size,8,'Each person needs their own concrete experience, not a shared generic anecdote.');
});

test('All compatible diagnoses, seeds and diary lengths preserve the same authored person',()=>{
 for(const patient of patientOptions()){
  const expected=personalFacts(patientIndividuality(patient.id));
  const choices=['none',...compatibleDisorders(patient.lifeStage).map(d=>d.id)];
  for(const disorderId of choices){
   const snapshot=simulateHistory({patientId:patient.id,disorderId,days:1,seed:7});
   assert.deepEqual(snapshot.facts.filter(f=>/^P\d+$/.test(f.id)),expected,`${patient.id}/${disorderId}`);
  }
  const long=simulateHistory({patientId:patient.id,disorderId:'none',days:90,seed:912});
  assert.deepEqual(long.facts.filter(f=>/^P\d+$/.test(f.id)),expected);
  assert.ok(Object.isFrozen(long.individuality.backgroundFacts));
  assert.ok(Object.isFrozen(long.facts.find(f=>f.id==='P08')));
  assert.throws(()=>long.individuality.backgroundFacts[0].response='Different person');
  assert.ok(!JSON.stringify(publicBrief(long)).includes(expected.find(f=>f.id==='P08').response));
 }
});

test('Profile reads and derived fact arrays cannot mutate the canonical authored background',()=>{
 const person=patientIndividuality('jordan'),before=patientIndividuality('jordan');
 const facts=personalFacts(person);
 facts.find(f=>f.id==='P07').keywords.push('changed');
 facts.find(f=>f.id==='P07').domains.push('changed');
 assert.deepEqual(person,before);
 person.backgroundFacts[0].response='Changed';
 person.backgroundFacts[0].keywords.push('changed');
 assert.deepEqual(patientIndividuality('jordan'),before);
});

test('Child backgrounds keep stage-appropriate situations and observed caregiver perspective',()=>{
 for(const id of ['mika','leo','sam','riley']){
  const text=personalFacts(patientIndividuality(id)).slice(6).map(f=>f.response).join(' ');
  assert.doesNotMatch(text,/work shift|work commitments|household errands|cousin|retire|\b\d+\s*(?:years|months)\s*old/i);
 }
 for(const id of ['mika','leo']){
  const facts=personalFacts(patientIndividuality(id)).slice(6),text=facts.map(f=>f.response).join(' ');
  assert.ok(facts.every(f=>/\bI\b|\bme\b|\bmy\b|\bwe\b/i.test(f.response)));
  assert.doesNotMatch(text,/(?:Mika|Leo|they)\s+(?:thinks?|feels?|worries|believes|knows|wants|loves|hates)\b/i);
  assert.doesNotMatch(text,/I (?:go to preschool|play with my caregiver|draw my house)/i);
  const snapshot=simulateHistory({patientId:id,disorderId:'none',days:7});
  assert.equal(snapshot.interviewPerspective,'caregiver');
 }
 const robin=personalFacts(patientIndividuality('robin')).slice(6).map(f=>f.response).join(' ');
 assert.doesNotMatch(robin,/grandchild|retirement|frail|forgetful|memory loss/i);
});

test('Richer histories preserve intentional unknowns and do not invent health findings',()=>{
 for(const patient of patientOptions()){
  const text=personalFacts(patientIndividuality(patient.id)).slice(6).map(f=>f.response).join(' ');
  assert.doesNotMatch(text,/medication|prescription|diagnos|therapy|suicid|antidepressant|no symptoms|feel great|feel happy|cured|Jamie|\b\d+\b/i);
 }
 const alex=personalFacts(patientIndividuality('alex')).slice(6).map(f=>f.response).join(' ');
 assert.doesNotMatch(alex,/favorite album (?:is|called)|favorite artist (?:is|called)/i);
 const jordan=personalFacts(patientIndividuality('jordan'));
 assert.doesNotMatch(jordan.find(f=>f.id==='P10').response,/because|due to|since I|trauma|anxiety/i);
});

test('A new concrete fact can reach the renderer independently without sending the entire biography',async()=>{
 for(const patient of patientOptions()){
  const snapshot=simulateHistory({patientId:patient.id,disorderId:'none',days:90});
  const provider=mockProvider(request=>{
   const payload=requestPayload(request);assert.ok(payload.bytes<=ECONOMY.maxInputBytes);
   if(request.role==='CORTEX')return {kind:'answer',fact_ids:['P08']};
  });
  const result=await answerQuestion({snapshot,turns:[],question:'Can you give an earlier example of that hobby?',provider});
  assert.deepEqual(result.factIds,['P08']);
  const packet=provider.calls.find(c=>c.role==='LANGUAGE').input;
  assert.ok(packet.permittedFacts.some(f=>f.id==='P08'));
  assert.ok(!JSON.stringify(packet).includes(snapshot.individuality.backgroundFacts.find(f=>f.id==='P12').response));
  assert.ok(provider.calls.length<=3);
 }
});

test('Legacy individuality objects without extra authored details still project their original facts',()=>{
 const person=patientIndividuality('jordan');delete person.backgroundFacts;delete person.profileVersion;
 assert.deepEqual(personalFacts(person).map(f=>f.id),['P01','P02','P03','P04','P05','P06']);
 delete person.smallTalk;
 assert.deepEqual(personalFacts(person).map(f=>f.id),['P01','P02','P03','P04']);
});
