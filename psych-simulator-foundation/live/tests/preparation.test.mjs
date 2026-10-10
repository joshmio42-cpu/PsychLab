import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setImmediate as nextTick} from 'node:timers/promises';
import {createController} from '../controller.mjs';
import {createApp} from '../server.mjs';
import {answerQuestion,questionCatalog,requestPayload} from '../model.mjs';
import {buildAgentContext} from '../agent-context.mjs';
import {simulateHistory,publicBrief} from '../engine.mjs';
import {disorderOptions,compatibleDisorders} from '../disorders.mjs';
import {patientOptions} from '../patients.mjs';
import {baseline,mockProvider,reasoning} from './helpers.mjs';

const defaultInput={mode:'generated',patientId:'jordan',seed:42,days:28,selection:{mode:'chosen',disorderId:'mdd'}};
const request={question:'What brings you here?',requestId:'preparation-answer-001',expectedTurn:0};
async function ready(controller,id,seen=[]){
  const deadline=Date.now()+5000;
  while(Date.now()<deadline){
    const result=controller.preparation(id);seen.push(structuredClone(result.preparation));
    if(result.preparation.status==='failed')assert.fail(result.preparation.error??result.preparation.message);
    if(result.preparation.status==='ready')return result;
    await nextTick();
  }
  assert.fail('Local preparation did not complete within five seconds.');
}
function setup(t,options={}){
  const provider=mockProvider(),controller=createController({baseline,provider,...options});
  t.after(()=>controller.close());return {controller,provider};
}
function assertPrivate(value){
  const raw=JSON.stringify(value);
  for(const key of ['baselineFacts','dailyPatterns','working_formulation','sourceIds','source_ids','personalityEvidence','supportExpected','threatSensitivity','learningLedger','reviewNotes'])assert.ok(!raw.includes(`"${key}"`),`${key} escaped into a public response`);
}

test('Preparation runs locally before interview, reports bounded progress, and never calls the provider',async t=>{
  const {controller:c,provider}=setup(t);
  const start=c.prepare(defaultInput);assert.equal(start.preparation.status,'running');assert.equal(start.preparation.completedDays,0);
  assert.throws(()=>c.read(start.id),e=>e.status===409);await assert.rejects(c.ask(start.id,request),e=>e.status===409);
  const seen=[];const completed=await ready(c,start.id,seen);
  assert.equal(completed.preparation.completedDays,28);assert.equal(completed.preparation.totalDays,28);
  assert.equal(completed.session.brief.historyDays,28);assert.equal(completed.session.brief.name,'Jordan');
  assert.equal(completed.session.turns.length,0);assert.equal(completed.session.usage.session.attemptedCalls,0);
  assert.equal(provider.calls.length,0);
  let prior=0;for(const p of seen){assert.ok(p.completedDays>=prior);assert.ok(p.completedDays<=p.totalDays);assert.equal(typeof p.phase,'string');assert.equal(typeof p.message,'string');prior=p.completedDays;}
  assertPrivate(completed);assert.throws(()=>c.review(start.id),e=>e.status===403);
  assert.equal(c.read(start.id).brief.hash,completed.session.brief.hash);
});

test('Preparation cancellation prevents stale commits and permits a deliberate fresh preparation',async t=>{
  const {controller:c,provider}=setup(t);
  const first=c.prepare({...defaultInput,days:90});c.cancelPreparation(first.id);
  await nextTick();assert.throws(()=>c.preparation(first.id));assert.throws(()=>c.read(first.id));
  const second=c.prepare({...defaultInput,seed:7,selection:{mode:'none'}});
  const result=await ready(c,second.id);assert.equal(result.session.brief.historyDays,28);
  assert.notEqual(second.id,first.id);assert.equal(provider.calls.length,0);
});

test('Preparation retry identifiers preserve one job and replacing a job prevents the old commit',async t=>{
  const {controller:c,provider}=setup(t);const input={...defaultInput,selection:{mode:'random'},requestId:'preparation-retry-001'};
  const first=c.prepare(input);const retry=c.prepare(input,first.id);assert.equal(retry.id,first.id);
  assert.throws(()=>c.prepare({...input,seed:7},first.id),e=>e.status===409);
  const finished=await ready(c,first.id);const finishedRetry=c.prepare(input,first.id);assert.equal(finishedRetry.id,first.id);assert.equal(c.preparation(first.id).session.brief.hash,finished.session.brief.hash);
  const replaced=c.prepare({...defaultInput,days:90},first.id);
  const newest=c.prepare({...defaultInput,seed:17,days:7,selection:{mode:'none'}},replaced.id);
  const done=await ready(c,newest.id);assert.equal(done.session.brief.historyDays,7);
  assert.throws(()=>c.read(replaced.id));assert.throws(()=>c.preparation(replaced.id));assert.throws(()=>c.read(first.id));assert.equal(provider.calls.length,0);
});

test('Only cookie owners can poll or cancel preparation; write routes retain origin checks',async t=>{
  const provider=mockProvider(),{server}=await createApp({provider});server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}`;
  const call=(path,method='GET',body,cookie='',origin=base)=>fetch(base+path,{method,headers:{Origin:origin,'X-PsychLab':'1','Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await call('/api/prepare','POST',defaultInput,'','https://foreign.example')).status,403);
  const response=await call('/api/prepare','POST',defaultInput);assert.equal(response.status,202);
  const setCookie=response.headers.get('set-cookie');assert.match(setCookie,/HttpOnly; SameSite=Strict/);const cookie=setCookie.split(';')[0];
  const initial=await response.json();assert.equal(initial.preparation.status,'running');assertPrivate(initial);
  for(const owner of ['', 'psychlab_session=not-the-owner']){
    assert.ok([401,404].includes((await call('/api/preparation','GET',undefined,owner)).status));
    assert.ok([401,404].includes((await call('/api/preparation/cancel','POST',{},owner)).status));
  }
  assert.equal((await call('/api/preparation/cancel','POST',{},cookie,'https://foreign.example')).status,403);
  let result;for(let n=0;n<100;n++){
    const poll=await call('/api/preparation','GET',undefined,cookie);assert.equal(poll.status,200);result=await poll.json();assertPrivate(result);
    if(result.preparation.status==='ready')break;await nextTick();
  }
  assert.equal(result.preparation.status,'ready');assert.equal(result.session.brief.name,'Jordan');assert.equal(provider.calls.length,0);
  for(const path of ['/disorders.mjs','/data/disorder-catalogue.json','/data/disorder-cases.json','/research/mental-disorder-selection-2026-10-08/02-Disorder-catalogue.json'])assert.equal((await call(path)).status,404);
});

test('Invalid selection and incompatible stages fail before spending or starting a history',t=>{
  const {controller:c,provider}=setup(t);
  for(const patch of [
    {selection:{mode:'chosen',disorderId:'does-not-exist'}},
    {selection:{mode:'unknown'}},
    {selection:{mode:'chosen'}},
    {patientId:'mika',selection:{mode:'chosen',disorderId:'alcohol'}},
    {days:0},{days:91},{seed:-1},{patientId:'unknown'}
  ])assert.throws(()=>c.prepare({...defaultInput,...patch}),e=>e.status===400,JSON.stringify(patch));
  assert.equal(provider.calls.length,0);
});

test('Preparation reserves capacity, expires, and stops pending work on close',async t=>{
  let now=0;const {controller:c,provider}=setup(t,{maxSessions:1,now:()=>now,ttlMs:100});
  const first=c.prepare(defaultInput);assert.throws(()=>c.prepare(defaultInput),e=>e.status===503);
  now=101;c.sweep();assert.throws(()=>c.preparation(first.id));await nextTick();assert.throws(()=>c.read(first.id));
  const second=c.prepare(defaultInput);c.close();await nextTick();assert.throws(()=>c.preparation(second.id));assert.throws(()=>c.read(second.id));assert.equal(provider.calls.length,0);
});

test('Disorder histories reach the checked answer agents without adding preparation calls',async t=>{
  const provider=mockProvider(req=>{requestPayload(req);});const c=createController({baseline,provider});t.after(()=>c.close());
  const start=c.prepare({...defaultInput,days:90});const done=await ready(c,start.id);const hash=done.session.brief.hash;
  await c.ask(start.id,request);assert.equal(provider.calls.length,3);
  const language=provider.calls.find(x=>x.role==='LANGUAGE');assert.ok(language.input.permittedFacts.length>0);assert.ok(language.input.agentContext.personality);assert.ok(language.input.agentContext.mentalPremise);
  assert.doesNotMatch(JSON.stringify(provider.calls),/Major depressive disorder|"disorderId"|"sourceIds"|"source_ids"/i);
  const report=c.finish(start.id,{reasoning});assert.equal(report.brief.hash,hash);assert.equal(c.read(start.id).brief.hash,hash);
  const trace=c.review(start.id);assert.ok(trace.snapshot.facts.some(f=>/month|week|year/.test(f.response)));assert.equal(trace.interviewTraces[0].agents.extraModelCalls,0);
});

test('Mystery mode conceals its answer in progress, session and prompts until completed debrief',async t=>{
  const {controller:c,provider}=setup(t);const initial=c.prepare({...defaultInput,selection:{mode:'random'}});
  const progress=[];const completed=await ready(c,initial.id,progress);
  assert.deepEqual(completed.session.brief.selection,{mode:'random'});
  assert.throws(()=>c.report(initial.id),e=>e.status===409);assert.throws(()=>c.review(initial.id),e=>e.status===403);
  await c.ask(initial.id,request);const before=c.read(initial.id);const report=c.finish(initial.id,{reasoning});
  const snapshot=c.review(initial.id).snapshot;assert.equal(snapshot.caseSelection.mode,'random');
  assert.ok(compatibleDisorders(snapshot.lifeStage).some(d=>d.id===snapshot.caseSelection.id));
  // The same complete hypothesis menu is available for every mystery case;
  // selecting a target must not change its guide or disclose an answer elsewhere.
  assert.deepEqual(before.guide.hypothesisOptions.filter(x=>!['defer','none'].includes(x.id)).map(x=>x.id),compatibleDisorders(snapshot.lifeStage).filter(x=>x.id!=='none').map(x=>x.id));
  assert.equal(before.guideWork.review.comparison,null);
  const publicBefore=JSON.stringify([initial.preparation,progress,completed,before],(key,value)=>key==='hypothesisOptions'?undefined:value);
  assert.ok(!publicBefore.includes(snapshot.caseSelection.name));assert.ok(!publicBefore.includes(snapshot.caseSelection.description));
  assertPrivate(completed);assertPrivate(before);
  const prompts=JSON.stringify(provider.calls);assert.ok(!prompts.includes(snapshot.caseSelection.name));
  assert.ok(!prompts.includes('caseSelection'));assert.ok(!prompts.includes('casePremise'));
  assert.equal(report.caseAnswer.name,snapshot.caseSelection.name);
  assert.notEqual(completed.session.brief.hash,snapshot.hash,'Public hash must not permit a deterministic seed/case lookup to spoil a mystery case.');
});

test('No-disorder and every patient preparation retain their chosen stage and day window',async t=>{
  const {controller:c,provider}=setup(t);
  for(const p of c.status().patients){
    const start=c.prepare({mode:p.mode,patientId:p.id,seed:123,days:7,selection:{mode:'none'}});const done=await ready(c,start.id);
    assert.equal(done.session.brief.name,p.name);assert.equal(done.session.brief.lifeStage,p.lifeStage);assert.equal(done.session.brief.historyDays,7);
    assert.equal(done.session.brief.selection.mode,'none');assert.equal(done.session.brief.assessmentAvailable,false);
    c.remove(start.id);
  }
  assert.equal(provider.calls.length,0);
});

test('Every listed disorder produces an authored, stage-compatible frozen history instead of only a label',()=>{
  const options=disorderOptions().filter(d=>!['no_disorder','none'].includes(d.id));
  assert.equal(options.length,67);
  assert.equal(new Set(options.map(d=>d.id)).size,options.length);
  const represented=new Set();
  for(const p of patientOptions().filter(p=>p.mode==='generated')){
    for(const d of compatibleDisorders(p.lifeStage)){
      if(['no_disorder','none'].includes(d.id))continue;represented.add(d.id);
      for(const days of [1,90]){
        const s=simulateHistory({patientId:p.id,seed:42,days,disorderId:d.id,selectionMode:'chosen'});
        assert.equal(s.caseSelection.id,d.id);assert.equal(s.lifeStage,p.lifeStage);assert.equal(s.memory.length,days);
        assert.ok(s.casePremise.baselineFacts.length>=2,`${d.id} needs longitudinal authored facts`);
        assert.ok(s.casePremise.dailyPatterns.length>0,`${d.id} needs recent-life patterns`);
        assert.ok(s.facts.length>days+4,`${d.id} should add citable evidence to the base history`);
        assert.ok(s.facts.some(f=>s.casePremise.baselineFacts.some(premise=>premise.response===f.response)),`${d.id} baseline facts must reach interviewer retrieval`);
        assert.ok(!JSON.stringify(s.facts).includes(d.name),`${d.id} facts must not disclose the case label`);
        assertPrivate(publicBrief(s));assert.equal(s.gad7,null);
        assert.ok(Object.isFrozen(s.casePremise));
      }
    }
  }
  assert.equal(represented.size,67,'Each catalogue disorder needs at least one selectable patient profile.');
});

test('Recent symptom windows preserve earlier history and do not extend acute or cyclic episodes to every diary day',()=>{
  for(const [disorderId,count] of [['acute_stress',14],['adjustment',60],['brief_psychotic',7],['delirium',3]]){
    const s=simulateHistory({disorderId,selectionMode:'chosen',days:90});
    assert.equal(s.memory.filter(m=>m.premiseExperience).length,count,`${disorderId} recent window`);
  }
  const pmdd=simulateHistory({disorderId:'pmdd',selectionMode:'chosen',days:90});
  for(const m of pmdd.memory)assert.equal(!!m.premiseExperience,(90-m.day)%28<7,`Cyclic pattern on day ${m.day}`);
  const brief=simulateHistory({disorderId:'brief_psychotic',selectionMode:'chosen',days:1});
  assert.equal(brief.memory.filter(m=>m.premiseExperience).length,0,'Resolved past episode must not reappear today.');
  const one=simulateHistory({disorderId:'gad',selectionMode:'chosen',days:1});const ninety=simulateHistory({disorderId:'gad',selectionMode:'chosen',days:90});
  assert.deepEqual(one.casePremise.baselineFacts,ninety.casePremise.baselineFacts);
  assert.doesNotMatch(one.facts.find(f=>f.id==='G03').response,/Earlier developmental and health history is not authored/);
});

test('Supported written and caregiver accounts keep their communication constraints in agent prompts',async()=>{
  for(const patientId of ['sam','riley']){
    const snapshot=simulateHistory({patientId,disorderId:'selective_mutism',selectionMode:'chosen'});
    const context=buildAgentContext(snapshot,['B01']).context;
    assert.match(context.interview.language,/written/i);
    const provider=mockProvider(req=>requestPayload(req)&&undefined);
    await answerQuestion({snapshot,turns:[],question:'What would you like me to understand?',provider});
    assert.match(provider.calls.find(x=>x.role==='LANGUAGE').input.agentContext.interview.language,/written/i);
  }
  const caregiver=simulateHistory({patientId:'mika',disorderId:'autism',selectionMode:'chosen'});
  assert.equal(caregiver.interviewPerspective,'caregiver');assert.ok(caregiver.facts.some(f=>/private thoughts/.test(f.response)));
  assert.match(buildAgentContext(caregiver,['B02']).context.mentalPremise.social,/I means the caregiver/);
});

test('Chosen case is reproducible, varies with seed, and preserves independently authored personality',()=>{
  const options={patientId:'riley',disorderId:'social_anxiety',selectionMode:'chosen',days:28,seed:42};
  const a=simulateHistory(options),b=simulateHistory(options),different=simulateHistory({...options,seed:43});
  assert.equal(a.hash,b.hash);assert.deepEqual(a.memory,b.memory);assert.notEqual(a.hash,different.hash);assert.notDeepEqual(a.memory,different.memory);
  const ordinary=simulateHistory({...options,disorderId:'none',selectionMode:'none'});
  assert.deepEqual(a.initialState.identity,ordinary.initialState.identity,'A diagnosis selection must not replace the patient’s personality.');
  assert.notDeepEqual(a.facts,ordinary.facts);assert.notDeepEqual(a.memory,ordinary.memory);
});

test('All authored cases fit the economy envelope with four retrieved facts and a full recent log',async()=>{
  for(const d of disorderOptions().filter(d=>d.id!=='none')){
    const p=patientOptions().find(p=>p.mode==='generated'&&d.stages.includes(p.lifeStage));
    const snapshot=simulateHistory({patientId:p.id,disorderId:d.id,selectionMode:'chosen',days:90,seed:42});
    const provider=mockProvider(req=>{
      requestPayload(req);
      if(req.role==='CORTEX')return {kind:'answer',fact_ids:['B01','B02','B03','E90']};
    });
    const turns=Array.from({length:4},()=>({question:'Could you describe how that affected an ordinary day?',reply:'I can describe the experience from the recorded history. '.repeat(6)}));
    await answerQuestion({snapshot,turns,difficulty:'beginner',question:'How long has this been happening, and what was an example on day 90?',provider});
    assert.equal(provider.calls.length,3);assert.ok(!JSON.stringify(provider.calls).includes(d.name),`${d.id} case label in model input`);
    const permitted=provider.calls.find(x=>x.role==='LANGUAGE').input.permittedFacts;assert.equal(permitted.length,4);
  }
});

test('Bounded diary retrieval still supports an explicit question about the earliest simulated day',async()=>{
  const snapshot=simulateHistory({disorderId:'gad',selectionMode:'chosen',days:90});
  const question='What happened on day 1?';const catalog=questionCatalog(snapshot.facts,question);
  assert.ok(catalog.some(f=>f.id==='E01'));assert.ok(catalog.some(f=>f.id==='B01'));assert.ok(catalog.filter(f=>/^E/.test(f.id)).length<=12);
  const provider=mockProvider(req=>{requestPayload(req);if(req.role==='CORTEX')return {kind:'answer',fact_ids:['E01']};});
  const response=await answerQuestion({snapshot,turns:[],question,provider});assert.deepEqual(response.factIds,['E01']);assert.match(response.reply,/day 1,/);
  const permitted=provider.calls[1].input.permittedFacts[0].statement,event=snapshot.memory.find(m=>m.day===1);
  assert.equal(response.reply,permitted);
  assert.match(permitted,/day 1,/);
  assert.ok(permitted.includes(event.observation));assert.ok(permitted.includes(event.interpretation));assert.ok(permitted.includes(event.outcome));
  assert.doesNotMatch(permitted,/simulated day|My interpretation at the time was:/);
});

test('Mystery diagnostic labels are rejected even if a model falsely cites a supported opening',async()=>{
  for(const [disorderId,label] of [['mdd','major depressive disorder'],['adhd','ADHD'],['autism','autistic'],['gad','generalized anxiety']]){
    const snapshot=simulateHistory({disorderId,selectionMode:'random'});
    const provider=mockProvider(req=>req.role==='LANGUAGE'?{reply:`I have ${label}.`,fact_ids:['G01'],out_of_scope:false}:undefined);
    await assert.rejects(answerQuestion({snapshot,turns:[],question:'What brings you here?',provider}),/diagnostic label/);
    assert.equal(provider.calls.length,2,'Reject a disclosed case label before another paid audit call.');
  }
});
