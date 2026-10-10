import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {startSession,askTopic,administer,finish} from '../prototype/dist/core.mjs';
import {planInterviewTurn,observationView,observe,analyze,auditTurn} from '../prototype/dist/agents.mjs';
const c=JSON.parse(await readFile(new URL('../data/case-a01.json',import.meta.url),'utf8'));
test('Every authored topic passes the agent loop with exact text and ordered trace',()=>{
  const s=startSession(c);
  for(const f of c.facts){assert.equal(askTopic(s,c,f.id).reply,f.response);}
  assert.equal(s.agentTraces.length,c.facts.length);
  assert.deepEqual(s.agentTraces[0].steps.map(x=>x.agent),['IDENTITY','MNEMOSYNE','CORTEX','AFFECT','SOCIAL','EVIDENCE','AUDITOR']);
});
test('Planning cannot mutate the session or the authored case',()=>{
  const s=startSession(c),before=structuredClone(s),caseBefore=structuredClone(c);
  const p=planInterviewTurn(s,c,'F01');p.trace.steps[0].output.profile='changed';p.turn.domains.push('changed');
  assert.deepEqual(s,before);assert.deepEqual(c,caseBefore);
});
test('Rejected topic and mismatched case preserve all state',()=>{
  const s=startSession(c),before=structuredClone(s);
  assert.throws(()=>askTopic(s,c,'unknown'));
  assert.throws(()=>askTopic(s,{...c,version:'other'},'F01'));
  assert.deepEqual(s,before);
});
test('Memory retrieves only prior disclosures of the selected topic',()=>{
  const s=startSession(c);askTopic(s,c,'F01');askTopic(s,c,'F02');askTopic(s,c,'F01');
  assert.deepEqual(s.agentTraces[2].steps[1].output.retrieved,[{turnId:'T1',quote:c.facts[0].response}]);
  assert.equal(analyze(observationView(s)).repeatedQuestions,1);
});
test('Observer allowlist excludes hidden state, unasked facts and assessment',()=>{
  const s=startSession(c);askTopic(s,c,'F01');
  s.hidden='SECRET';s.agentTraces.push({secret:'SECRET'});
  const v=observationView(s);
  assert.deepEqual(Object.keys(v),['turns','assessment']);
  assert.deepEqual(Object.keys(v.turns[0]),['id','question','reply']);
  assert.equal(v.assessment,null);assert.equal(observe(v).evidence.length,1);
  assert.ok(!JSON.stringify(v).includes('SECRET'));
  assert.ok(!JSON.stringify(v).includes(c.working_formulation));
  v.turns[0].reply='changed';assert.equal(s.turns[0].reply,c.facts[0].response);
  administer(s,c,'Explore symptoms alongside the interview',true);
  assert.equal(observe(observationView(s)).assessment.total,15);
});
test('Hidden diagnostic labels cannot change selected speech',()=>{
  const changed={...c,working_formulation:'FORCE DIFFERENT BEHAVIOR',diagnosis:'another label'};
  assert.deepEqual(planInterviewTurn(startSession(c),c,'F01'),planInterviewTurn(startSession(changed),changed,'F01'));
});
test('Auditor rejects fabricated speech, references, domains and IDs',()=>{
  const {turn}=planInterviewTurn(startSession(c),c,'F01');
  for(const patch of [{reply:'invented'},{factIds:['F02']},{domains:['safety']},{id:'T99'}]){
    assert.throws(()=>auditTurn({...turn,...patch},c.facts[0],'T1'));
  }
});
test('Replay is deterministic; renderer only receives permitted speech',()=>{
  const a=startSession(c),b=startSession(c);
  for(const id of ['F01','F05','F01']){askTopic(a,c,id);askTopic(b,c,id);}
  assert.deepEqual(a,b);
  assert.deepEqual(a.agentTraces[0].rendererInput,{speech:c.facts[0].response});
});
test('Completed session cannot acquire another agent trace; reset starts empty',()=>{
  const s=startSession(c);askTopic(s,c,'F01');
  finish(s,{hypothesis:'uncertain',support:'opening',alternatives:'unknown',missing:'history',next:'explore'});
  const before=structuredClone(s);assert.throws(()=>askTopic(s,c,'F02'));assert.deepEqual(s,before);
  assert.deepEqual(startSession(c).agentTraces,[]);
});
