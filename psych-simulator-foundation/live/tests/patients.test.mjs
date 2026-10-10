import {test} from 'node:test';
import assert from 'node:assert/strict';
import {patientOptions,patientProfile} from '../patients.mjs';
import {simulateHistory,publicBrief} from '../engine.mjs';
import {buildAgentContext} from '../agent-context.mjs';
import {createController} from '../controller.mjs';
import {requestPayload} from '../model.mjs';
import {baseline,mockProvider} from './helpers.mjs';

test('Every generated life stage has reproducible, bounded recent history and correct relationships',()=>{
  assert.equal(patientOptions().length,8);
  for(const p of patientOptions().filter(p=>p.mode==='generated')){
    for(const days of [1,7,90]){
      const s=simulateHistory({patientId:p.id,days,seed:42});
      assert.equal(s.name,p.name);assert.equal(s.lifeStage,p.lifeStage);assert.equal(s.age,null);
      assert.equal(s.events.length,days);assert.equal(s.memory.length,days);
      assert.ok(s.events.every(e=>e.lifeStage===p.lifeStage));
      assert.equal(s.hash,simulateHistory({patientId:p.id,days,seed:42}).hash);
      assert.ok(!('age' in publicBrief(s)));
      const profile=patientProfile(p.id);
      assert.deepEqual(Object.keys(s.finalState.identity.schema.relationships).sort(),[...new Set([profile.supportTarget,profile.planTarget])].sort());
      assert.ok(s.memory.every(m=>!m.relationship||[profile.supportTarget,profile.planTarget].includes(m.relationship)));
    }
    const short=simulateHistory({patientId:p.id,days:7}),long=simulateHistory({patientId:p.id,days:28});
    assert.deepEqual(long.memory.slice(0,7),short.memory);assert.notEqual(short.hash,long.hash);
  }
});
test('Children receive authored child situations, and caregivers do not report private child thoughts',()=>{
  for(const id of ['mika','leo','sam','riley']){
    const s=simulateHistory({patientId:id,days:90});
    const facts=JSON.stringify(s.facts);
    assert.doesNotMatch(facts,/work task|work shift|household errands|cousin|26 years/i);
    if(['mika','leo'].includes(id)){
      assert.equal(s.interviewPerspective,'caregiver');assert.match(s.speaker,/caregiver/);
      assert.ok(s.memory.every(m=>m.experience==='I cannot know exactly what they felt.'));
      const context=buildAgentContext(s,s.facts.map(f=>f.id)).context;
      assert.deepEqual(context.personality.schema,[]);
      assert.match(context.personality.motive,/do not infer/);
      assert.match(context.mentalPremise.social,/I means the caregiver/);
    }
  }
  assert.match(JSON.stringify(simulateHistory({patientId:'riley',days:90}).facts),/school group project/);
  assert.match(JSON.stringify(simulateHistory({patientId:'robin',days:90}).facts),/community activity/);
});
test('Controller exposes all profiles, uses stage defaults, validates IDs and preserves Alex',()=>{
  const provider=mockProvider(),c=createController({baseline,provider});
  assert.equal(c.status().patients.length,8);
  assert.equal(c.create({patientId:'mika'}).view.brief.historyDays,7);
  assert.equal(c.create({patientId:'leo'}).view.brief.historyDays,14);
  assert.equal(c.create({patientId:'riley',days:53}).view.brief.historyDays,53);
  assert.equal(c.create().view.brief.name,'Jordan');
  const alex=c.create({mode:'baseline',patientId:'alex'}).view.brief;
  assert.equal(alex.name,baseline.name);assert.equal(alex.assessmentAvailable,true);assert.equal(alex.historyDays,null);
  const generatedAlex=c.create({patientId:'alex'}).view.brief;
  assert.equal(generatedAlex.name,'Alex');assert.equal(generatedAlex.assessmentAvailable,false);assert.equal(generatedAlex.historyDays,28);
  for(const input of [{patientId:'unknown'},{mode:'baseline',patientId:'mika'},{patientId:'mika',days:91}])assert.throws(()=>c.create(input),e=>e.status===400);
  assert.equal(provider.calls.length,0);c.close();
});
test('Caregiver perspective reaches renderer and auditor without extra calls or exceeding economy cap',async()=>{
  const provider=mockProvider(req=>{
    requestPayload(req);
    if(req.role==='LANGUAGE'){
      assert.match(req.instruction,/I refers to the caregiver/);
      assert.equal(req.input.agentContext.interview.lifeStage,'Toddler');
      assert.equal(req.input.agentContext.interview.speaker,"Mika's caregiver");
      assert.doesNotMatch(JSON.stringify(req.input),/supportExpected|threatSensitivity/);
    }
    if(req.role==='AUDITOR')assert.match(req.instruction,/Never speak as the child/);
  });
  const c=createController({baseline,provider}),{id}=c.create({patientId:'mika',days:90});
  const result=await c.ask(id,{question:'What brings you here?',requestId:'patient-stage-test',expectedTurn:0});
  assert.match(result.turn.reply,/Mika's caregiver/);assert.equal(provider.calls.length,3);c.close();
});
