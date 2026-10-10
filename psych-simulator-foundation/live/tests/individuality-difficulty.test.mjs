import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTick} from 'node:timers/promises';
import {once} from 'node:events';
import {simulateHistory} from '../engine.mjs';
import {patientOptions,patientProfile} from '../patients.mjs';
import {patientIndividuality,personalFacts} from '../individuality.mjs';
import {difficultyOptions,disclosurePlan} from '../interview-style.mjs';
import {answerQuestion,requestPayload} from '../model.mjs';
import {createController} from '../controller.mjs';
import {createApp} from '../server.mjs';
import {baseline,mockProvider,reasoning} from './helpers.mjs';

async function ready(c,id){for(let i=0;i<120;i++){const r=c.preparation(id);if(r.preparation.status==='ready')return r;assert.notEqual(r.preparation.status,'failed');await nextTick();}assert.fail('Preparation not ready');}
const prepare={patientId:'jordan',seed:42,days:28,selection:{mode:'chosen',disorderId:'mdd'}};
const ask=(question,n=0)=>({question,requestId:`difficulty-turn-${n}`,expectedTurn:n});

test('All eight people have distinct citable goals, interests, communication and relationships',()=>{
 const people=patientOptions();assert.equal(people.length,8);
 for(const key of ['goal','interests','communication','relationships','style'])assert.equal(new Set(people.map(p=>patientIndividuality(p.id)[key])).size,8);
 for(const p of people){
  const s=simulateHistory({patientId:p.id,disorderId:'none',days:28});
  for(const f of personalFacts(patientIndividuality(p.id)))assert.deepEqual(s.facts.find(x=>x.id===f.id),f);
  assert.deepEqual(s.initialState.identity.motive.values,patientIndividuality(p.id).priorities);
  assert.deepEqual(s.finalState.identity.motive.values,s.initialState.identity.motive.values);
  assert.ok(Object.isFrozen(s.individuality));assert.throws(()=>s.individuality.goal='changed');
  assert.ok(p.communicationPreview);assert.ok(p.description);
 }
 const changed=patientProfile('jordan');changed.individuality.goal='changed';assert.notEqual(patientProfile('jordan').individuality.goal,'changed');
});

test('People with the same disorder keep different interests, values and expression without diagnostic stereotypes',async()=>{
 const snapshots=['jordan','alex','avery'].map(patientId=>simulateHistory({patientId,disorderId:'mdd',seed:42,days:28}));
 assert.equal(new Set(snapshots.map(s=>s.facts.find(f=>f.id==='P01').response)).size,3);
 assert.equal(new Set(snapshots.map(s=>s.facts.find(f=>f.id==='G01').response)).size,3);
 assert.equal(new Set(snapshots.map(s=>JSON.stringify(s.initialState.identity.motive.values))).size,3);
 const styles=[];
 for(const snapshot of snapshots){
  const provider=mockProvider(r=>{requestPayload(r);if(r.role==='CORTEX')return {kind:'answer',fact_ids:['P02']};});
  const response=await answerQuestion({snapshot,turns:[],question:'What are your usual interests?',provider,difficulty:'standard'});
  assert.equal(response.reply,snapshot.individuality.interests);
  const packet=provider.calls.find(c=>c.role==='LANGUAGE').input;
  styles.push(packet.agentContext.personality.communication);
  assert.ok(!JSON.stringify(packet).includes(snapshot.individuality.relationships));
  assert.ok(!JSON.stringify(packet).includes('Major depressive disorder'));
 }
 assert.equal(new Set(styles).size,3);
 for(const p of patientOptions()){
  const none=simulateHistory({patientId:p.id,disorderId:'none',seed:1,days:1});
  const ordinary=simulateHistory({patientId:p.id,seed:900,days:90});
  assert.deepEqual(none.individuality,ordinary.individuality);
  assert.deepEqual(none.initialState.identity,ordinary.initialState.identity);
 }
});

test('Difficulty changes actual permitted disclosure and never the frozen history or extra call count',async t=>{
 const histories=[],firstStatements=[],counts=[];
 for(const {id:difficulty} of difficultyOptions()){
  const provider=mockProvider(r=>{requestPayload(r);}),c=createController({baseline,provider});t.after(()=>c.close());
  const start=c.prepare({...prepare,difficulty});assert.equal(start.preparation.configuration.difficulty,difficulty);
  const loaded=await ready(c,start.id);assert.equal(loaded.session.brief.difficulty,difficulty);assert.equal(provider.calls.length,0);
  await c.ask(start.id,ask('What brings you here?'));
  const packet=provider.calls.find(x=>x.role==='LANGUAGE').input;counts.push(packet.permittedFacts.length);firstStatements.push(packet.permittedFacts[0].statement);
  assert.equal(provider.calls.length,3);assert.equal(c.read(start.id).usage.session.attemptedCalls,3);
  c.finish(start.id,{reasoning});const review=c.review(start.id);histories.push(review.snapshot);
  assert.equal(review.interviewTraces[0].disclosure.difficulty,difficulty);
  assert.equal(review.interviewTraces[0].disclosure.historyMutation,false);
  assert.equal(c.report(start.id).brief.difficulty,difficulty);
 }
 assert.deepEqual(histories[0],histories[1]);assert.deepEqual(histories[1],histories[2]);
 assert.deepEqual(counts,[2,1,1]);assert.equal(firstStatements[0],firstStatements[1]);assert.notEqual(firstStatements[1],firstStatements[2]);
 assert.equal(firstStatements[2],histories[2].individuality.opening);
});

test('Challenging follow-ups progress through evidence; direct questions and repeat openings are not locked out',async()=>{
 const snapshot=simulateHistory({disorderId:'mdd',days:28});const original=JSON.stringify(snapshot),turns=[];
 const provider=mockProvider(r=>{if(r.role==='CORTEX')return {kind:'answer',fact_ids:['G01']};});
 for(const question of ['What brings you here?','Could you tell me more about that?','Tell me more','What else?']){
  const reply=await answerQuestion({snapshot,turns,question,provider,difficulty:'challenging'});turns.push({...reply,question,kind:'answer'});
 }
 assert.deepEqual(turns.map(t=>t.factIds[0]),['G01','B02','B01','B03']);
 assert.equal(turns[0].reply,snapshot.individuality.opening);
 assert.equal(turns[2].reply,snapshot.facts.find(f=>f.id==='B01').response);
 const repeat=disclosurePlan({snapshot,turns,question:'What brings you here?',factIds:['G01'],difficulty:'challenging'});assert.equal(repeat.openingIsBrief,false);
 const direct=disclosurePlan({snapshot,turns:[],question:'When did this start?',factIds:['B01','B02'],difficulty:'challenging'});assert.deepEqual(direct.factIds,['B01']);
 for(const f of snapshot.facts){const plan=disclosurePlan({snapshot,turns:[],question:`Please explain ${f.label}.`,factIds:[f.id],difficulty:'challenging'});assert.ok(plan.factIds.includes(f.id));}
 assert.equal(JSON.stringify(snapshot),original);
});

test('Fact limits, caregiver and supported-written constraints apply at every difficulty',async()=>{
 for(const difficulty of ['beginner','standard','challenging']){
  const sample=simulateHistory({patientId:'jordan',disorderId:'mdd'});
  const p=disclosurePlan({snapshot:sample,turns:[],question:'Tell me about the course and its effect on your routines.',factIds:['B01','B02','B03','P01'],difficulty});
  assert.equal(p.factIds.length,{beginner:4,standard:2,challenging:1}[difficulty]);
  for(const patientId of ['mika','leo','sam','riley']){
   const snapshot=simulateHistory({patientId,disorderId:['mika','leo'].includes(patientId)?'autism':'selective_mutism',days:90});
   const provider=mockProvider(r=>{requestPayload(r);if(r.role==='CORTEX')return {kind:'answer',fact_ids:['P03']};if(r.role==='LANGUAGE')assert.match(r.instruction,/take precedence/);if(r.role==='AUDITOR')assert.match(r.instruction,/fictional interviewee/);});
   const response=await answerQuestion({snapshot,turns:[],question:'What helps you communicate?',provider,difficulty});
   assert.equal(response.reply,snapshot.individuality.communication);
   const context=provider.calls[1].input.agentContext;
   if(['mika','leo'].includes(patientId)){assert.equal(context.interview.perspective,'caregiver');assert.match(response.reply,/private thoughts|thinking/);}
   else assert.match(context.interview.language,/written/);
  }
 }
});

test('Difficulty is validated before work; retries cannot silently change it, and failures do not advance disclosure',async t=>{
 const provider=mockProvider(),c=createController({baseline,provider});t.after(()=>c.close());
 for(const difficulty of ['expert','',null,2,{}]){
  assert.throws(()=>c.prepare({...prepare,difficulty}),e=>e.status===400);
  assert.throws(()=>c.create({difficulty}),e=>e.status===400);
 }
 const input={...prepare,difficulty:'challenging',requestId:'difficulty-prepare-1'},start=c.prepare(input);
 assert.throws(()=>c.prepare({...input,difficulty:'beginner'},start.id),e=>e.status===409);
 await ready(c,start.id);const result=await c.ask(start.id,ask('What brings you here?'));
 assert.deepEqual(await c.ask(start.id,ask('What brings you here?')),result);assert.equal(provider.calls.length,3);
 let reject=true;
 const failing=mockProvider(r=>r.role==='AUDITOR'&&reject?{supported:false,relevant:true,no_leak:true,unsupported:[]}:undefined),other=createController({baseline,provider:failing});t.after(()=>other.close());
 const next=other.prepare({...prepare,difficulty:'challenging'});await ready(other,next.id);
 await assert.rejects(other.ask(next.id,ask('What brings you here?')),/support check/);assert.equal(other.read(next.id).turns.length,0);
 reject=false;const accepted=await other.ask(next.id,ask('What brings you here?'));
 assert.equal(accepted.turn.reply,patientIndividuality('jordan').opening);
});

test('HTTP session and preparation refresh retain difficulty and reject invalid settings without exposing private person facts',async t=>{
 const {server}=await createApp({provider:mockProvider()});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}`;
 const body={...prepare,difficulty:'challenging',selection:{mode:'random'}};
 const response=await fetch(base+'/api/prepare',{method:'POST',headers:{Origin:base,'X-PsychLab':'1','Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,202);
 const cookie=response.headers.get('set-cookie').split(';')[0];let result;
 for(let i=0;i<100;i++){result=await(await fetch(base+'/api/preparation',{headers:{Cookie:cookie}})).json();if(result.preparation.status==='ready')break;await nextTick();}
 assert.equal(result.preparation.configuration.difficulty,'challenging');assert.equal(result.session.brief.difficulty,'challenging');assert.deepEqual(result.session.brief.selection,{mode:'random'});
 const restored=await(await fetch(base+'/api/session',{headers:{Cookie:cookie}})).json();assert.equal(restored.brief.difficulty,'challenging');
 for(const key of ['individuality','priorities','casePremise'])assert.ok(!JSON.stringify(result).includes(`"${key}"`));
 const status=await(await fetch(base+'/api/status')).json();assert.deepEqual(status.difficulties.map(d=>d.id),['beginner','standard','challenging']);
 assert.ok(status.patients.every(p=>p.communicationPreview));
});

test('Unsupported natural prose is rejected even when a semantic auditor approves it',async()=>{
 const snapshot=simulateHistory({patientId:'alex',disorderId:'mdd'});
 for(const difficulty of ['beginner','standard','challenging']){
  const provider=mockProvider(r=>r.role==='CORTEX'?{kind:'answer',fact_ids:['P02']}:r.role==='LANGUAGE'?{reply:'I enjoy music right now, it makes me relax, and nothing feels real.',fact_ids:['P02'],out_of_scope:false}:undefined);
  await assert.rejects(answerQuestion({snapshot,turns:[],question:'What are your usual interests?',difficulty,provider}),/support|clinical|enjoyment|evidence/i);
 }
});
