import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {setImmediate as nextTick} from 'node:timers/promises';
import {interviewGuide,guideProfiles,emptyGuideState,normalizeGuideState,reviewGuide,guideWork,GUIDE_VERSION} from '../interview-guide.mjs';
import {createController} from '../controller.mjs';
import {createApp} from '../server.mjs';
import {simulateHistory} from '../engine.mjs';
import {disorderOptions,compatibleDisorders} from '../disorders.mjs';
import {patientOptions} from '../patients.mjs';
import {baseline,mockProvider,reasoning} from './helpers.mjs';

const defaultInput={patientId:'jordan',seed:42,days:2,selection:{mode:'chosen',disorderId:'mdd'}};
const request={question:'What brings you here?',requestId:'guide-answer-001',expectedTurn:0};
const snapshot=(disorderId='mdd',selectionMode='chosen',patientId='jordan')=>simulateHistory({patientId,disorderId,selectionMode,seed:42,days:2});
const answered=[{id:'T1',kind:'answer',question:'How long?',reply:'This began months ago.'}];
const note=(status='supported',turnId='T1',text='The patient described a change; its meaning still needs clarification.')=>({status,turnId,note:text});
function stateFor(guide,{hypothesisId='defer',all=false,...extra}={}){
 return {...emptyGuideState(),hypothesisId,alternatives:'Other explanations remain possible.',nextStep:'Clarify the duration and seek relevant records.',...(all?{items:Object.fromEntries(guide.checklist.map(x=>[x.id,note()]))}:{}),...extra};
}
async function ready(c,id){
 const deadline=Date.now()+5000;
 while(Date.now()<deadline){
  const result=c.preparation(id);
  assert.notEqual(result.preparation.status,'failed',result.preparation.error);
  if(result.preparation.status==='ready')return result.session;
  await nextTick();
 }
 assert.fail('History did not finish locally.');
}
function setup(t,override){
 const provider=mockProvider(override),controller=createController({baseline,provider});
 t.after(()=>controller.close());return {provider,controller};
}
async function prepared(t,input=defaultInput,override){
 const pair=setup(t,override),started=pair.controller.prepare(input);
 return {...pair,id:started.id,view:await ready(pair.controller,started.id)};
}
function assertNoClinicalScores(value){
 for(const [key,child] of Object.entries(value??{})){
  assert.ok(!/^(diagnosis|diagnosticProbability|probability|confidence|severityScore|clinicalScore|safetyClearance)$/i.test(key),key);
  if(child&&typeof child==='object')assertNoClinicalScores(child);
 }
}

test('guidance covers all 67 named catalogue options and all 59 young-adult options exactly',()=>{
 const profiles=guideProfiles(),catalogue=disorderOptions().filter(d=>d.id!=='none');
 assert.equal(catalogue.length,67);
 assert.equal(profiles.length,67);
 assert.deepEqual(profiles.map(p=>p.id).sort(),catalogue.map(d=>d.id).sort());
 assert.equal(compatibleDisorders('Young adult').filter(d=>d.id!=='none').length,59);
 assert.equal(new Set(profiles.map(p=>p.id)).size,67);
 for(const profile of profiles){
  assert.equal(profile.name,catalogue.find(d=>d.id===profile.id).name);
  assert.ok(profile.checklist.length>=4&&profile.checklist.length<=6,profile.id);
  assert.equal(new Set(profile.checklist.map(x=>x.id)).size,profile.checklist.length,profile.id);
  assert.ok(profile.checklist.every(x=>/^[a-z][a-z0-9_]*$/.test(x.id)&&x.label&&x.question),profile.id);
  assert.ok(profile.course&&profile.cautions&&profile.differentials.length>=2,profile.id);
  for(const key of ['name','purpose','interpretation','url'])assert.ok(profile.test[key],profile.id+'/'+key);
  assert.ok(profile.sources.length&&profile.sources.every(x=>x.title&&x.url.startsWith('https://')),profile.id);
  assertNoClinicalScores(profile);
 }
});

test('every selectable case gets its own focused guide plus general inquiry checkpoints',()=>{
 const represented=new Set();
 for(const patient of patientOptions()){
  for(const disorder of compatibleDisorders(patient.lifeStage).filter(x=>x.id!=='none')){
   const guide=interviewGuide(snapshot(disorder.id,'chosen',patient.id));
   represented.add(disorder.id);
   assert.equal(guide.id,disorder.id);
   assert.equal(guide.name,disorder.name);
   assert.equal(guide.version,GUIDE_VERSION);
   for(const id of ['goals','function','context','safety','strengths'])assert.ok(guide.checklist.some(x=>x.id==='common_'+id));
   assert.ok(guide.checklist.some(x=>x.id.startsWith('focus_')));
   assert.equal(new Set(guide.checklist.map(x=>x.id)).size,guide.checklist.length);
   assert.deepEqual(guide.hypothesisOptions.filter(x=>!['none','defer'].includes(x.id)).map(x=>x.id),compatibleDisorders(patient.lifeStage).filter(x=>x.id!=='none').map(x=>x.id));
  }
 }
 assert.equal(represented.size,67);
});

test('random guides are fully invariant to hidden target for the same profile, including sources and hypotheses',()=>{
 const patient='jordan',conditions=compatibleDisorders('Young adult').filter(x=>x.id!=='none');
 const reference=interviewGuide(snapshot(conditions[0].id,'random',patient));
 const workReference=guideWork(reference,emptyGuideState(),[]);
 for(const condition of conditions){
  const hidden=snapshot(condition.id,'random',patient),guide=interviewGuide(hidden);
  assert.deepEqual(guide,reference,condition.id+' changed blind guidance');
  assert.deepEqual(guideWork(guide,emptyGuideState(),[],{ended:false,target:hidden.caseSelection}),workReference,condition.id+' leaked via guideWork');
 }
 assert.equal(reference.id,'general');
 assert.equal(reference.name,'Broad interview guide');
 assert.equal(workReference.review.comparison,null);
 assert.equal(reference.hypothesisOptions.length,61);
});

test('no-disorder mode uses a broad standard review without diagnosing normal variation',()=>{
 const none=interviewGuide(snapshot('none','none')),random=interviewGuide(snapshot('mdd','random'));
 assert.equal(none.id,'general');assert.equal(none.name,'Everyday functioning review');
 assert.deepEqual(none.checklist,random.checklist);
 assert.deepEqual(none.test,random.test);
 assert.equal(none.hypothesisOptions.at(-1).name,'No disorder established');
 assert.match(none.cautions,/unknown, not absent/);
 assert.equal(guideWork(none,emptyGuideState(),[]).review.comparison,null);
});

test('caregiver/adolescent guidance preserves respondent and age limits',()=>{
 const caregiver=interviewGuide(snapshot('autism','chosen','mika'));
 assert.match(caregiver.perspective,/caregiver/);
 assert.ok(caregiver.checklist.every(x=>x.question.includes('From your observations of Mika')));
 assert.match(caregiver.ageNote,/Confirm exact age/);
 const adolescent=patientOptions().find(x=>x.lifeStage==='Adolescent');
 assert.ok(adolescent);
 const guide=interviewGuide(snapshot('none','none',adolescent.id));
 assert.match(guide.perspective,/privacy and safeguarding/);
});

test('guide/profile projections cannot mutate later sessions',()=>{
 const guide=interviewGuide(snapshot());
 guide.checklist[0].question='Corrupt';guide.sources.length=0;guide.test.name='Fake';guide.hypothesisOptions.length=0;
 const profiles=guideProfiles();profiles[0].checklist.length=0;
 const fresh=interviewGuide(snapshot());
 assert.notEqual(fresh.checklist[0].question,'Corrupt');
 assert.ok(fresh.sources.length&&fresh.hypothesisOptions.length);
 assert.notEqual(fresh.test.name,'Fake');
 assert.ok(guideProfiles()[0].checklist.length>=4);
});

test('state validation rejects foreign checkpoint/hypothesis/turn IDs and non-answer evidence',()=>{
 const guide=interviewGuide(snapshot()),id=guide.checklist[0].id,valid=stateFor(guide);
 assert.throws(()=>normalizeGuideState({...valid,items:{foreign:note()}},guide,answered),/different interview/);
 assert.throws(()=>normalizeGuideState({...valid,hypothesisId:'not-a-disorder'},guide,answered),/available/);
 assert.throws(()=>normalizeGuideState({...valid,items:{[id]:note('supported','T99')}},guide,answered),/answered turn/);
 for(const kind of ['refusal','safety_pause','out_of_scope'])assert.throws(()=>normalizeGuideState({...valid,items:{[id]:note()}},guide,[{id:'T1',kind}]),/answered turn/);
 const toddler=interviewGuide(snapshot('autism','chosen','mika'));
 assert.throws(()=>normalizeGuideState({...stateFor(toddler),hypothesisId:'alcohol'},toddler,answered),/available/);
});

test('state validation rejects malformed values and excessive notes instead of accepting client-made results',()=>{
 const guide=interviewGuide(snapshot()),id=guide.checklist[0].id,valid=stateFor(guide);
 for(const value of [null,[],1,'notes'])assert.throws(()=>normalizeGuideState(value,guide,answered));
 for(const items of [null,[],1])assert.throws(()=>normalizeGuideState({...valid,items},guide,answered));
 for(const entry of [null,{status:'diagnosed',turnId:'T1',note:'yes'},{status:'supported',turnId:1,note:'yes'},note('supported','T1','x'.repeat(1001))]){
  assert.throws(()=>normalizeGuideState({...valid,items:{[id]:entry}},guide,answered));
 }
 for(const key of ['alternatives','nextStep'])for(const value of [null,[],5,'x'.repeat(2001)])assert.throws(()=>normalizeGuideState({...valid,[key]:value},guide,answered));
 const normalized=normalizeGuideState({...valid,items:{[id]:note('supported','T1','  observed change  ')},reviewed:'true',diagnosis:'certain',comparison:{target:'secret'}},guide,answered);
 assert.equal(normalized.items[id].note,'observed change');
 assert.equal(normalized.reviewed,false);
 assert.ok(!('diagnosis' in normalized));assert.ok(!('comparison' in normalized));
 assert.equal(normalized.items[guide.checklist[1].id].status,'unasked');
});

test('review identifies missing, uncertain, unsupported and counterevidence without a clinical score',()=>{
 const guide=interviewGuide(snapshot()),ids=guide.checklist.map(x=>x.id);
 const state=stateFor(guide,{items:{[ids[0]]:note('absent'),[ids[1]]:note('uncertain','T1',''),[ids[2]]:note('supported','')},alternatives:'',nextStep:''});
 const review=reviewGuide(guide,state,answered,{target:snapshot().caseSelection});
 assert.equal(review.documented,3);
 assert.equal(review.unasked.length,guide.checklist.length-3);
 assert.equal(review.unclear.length,1);assert.equal(review.unlinked.length,2);
 assert.deepEqual(review.counterEvidence,[guide.checklist[0].label]);
 assert.equal(review.comparison,null);
 assert.ok(review.gaps.some(x=>/alternative/.test(x)));
 assert.ok(review.gaps.some(x=>/next question/.test(x)));
 assert.match(review.limitation,/not their clinical correctness/);
 assertNoClinicalScores(review);
 const noAccount=reviewGuide(guide,state,[]);
 assert.ok(noAccount.gaps.some(x=>/patient or caregiver/.test(x)));
});

test('complete structural notes remain explicitly inconclusive and cannot claim diagnosis or safety',()=>{
 const guide=interviewGuide(snapshot()),state=stateFor(guide,{all:true,hypothesisId:'mdd'});
 const review=reviewGuide(guide,state,answered);
 assert.deepEqual(review.gaps,[]);
 assert.equal(review.documented,guide.checklist.length);
 assert.match(review.summary,/Review its meaning/);
 assert.match(review.limitation,/no diagnosis, probability, severity score or safety clearance/);
 assert.equal(review.comparison,null);
 assertNoClinicalScores(review);
});

test('comparison only appears after finish and distinguishes target matching from diagnostic correctness',()=>{
 const hidden=snapshot('mdd','random'),guide=interviewGuide(hidden);
 for(const hypothesisId of ['mdd','gad','defer','none']){
  const state=stateFor(guide,{hypothesisId});
  assert.equal(reviewGuide(guide,state,answered,{ended:false,target:hidden.caseSelection}).comparison,null);
  const comparison=reviewGuide(guide,state,answered,{ended:true,target:hidden.caseSelection}).comparison;
  assert.equal(comparison.target,hidden.caseSelection.name);
  assert.equal(comparison.match,hypothesisId==='defer'?null:hypothesisId==='mdd');
  assert.match(comparison.message,/does not establish|not clinical ground truth|actually established/);
 }
 const none=snapshot('none','none'),noneGuide=interviewGuide(none);
 assert.equal(reviewGuide(noneGuide,stateFor(noneGuide,{hypothesisId:'none'}),answered,{ended:true,target:none.caseSelection}).comparison.match,true);
});

test('saved notes persist in session/report without provider calls, altered history or mutable projections',async t=>{
 const {controller:c,provider,id,view}=await prepared(t);
 const state=stateFor(view.guide,{hypothesisId:'mdd',alternatives:'PRIVATE-INTERVIEWER-NOTE-DO-NOT-SEND: Other explanations remain possible.'});
 const beforeHash=view.brief.hash;
 const original=c.saveGuide(id,{expectedHash:beforeHash,state});
 assert.equal(provider.calls.length,0);
 assert.deepEqual(c.read(id).guideWork,original.guideWork);
 await c.ask(id,request);assert.equal(provider.calls.length,3);
 assert.ok(!JSON.stringify(provider.calls).includes('PRIVATE-INTERVIEWER-NOTE-DO-NOT-SEND'));
 const current=c.read(id),first=current.guide.checklist[0].id;
 state.items[first]=note('supported','T1','Opening gives a starting point; more history is needed.');
 state.reviewed=true;
 const saved=c.saveGuide(id,{expectedHash:beforeHash,state});
 assert.equal(provider.calls.length,3);
 assert.equal(c.read(id).usage.session.attemptedCalls,3);
 assert.equal(c.read(id).brief.hash,beforeHash);
 state.items[first].note='Mutated caller';
 saved.guideWork.state.items[first].note='Mutated response';
 assert.match(c.read(id).guideWork.state.items[first].note,/Opening gives/);
 const report=c.finish(id,{reasoning});
 assert.match(report.guideWork.state.items[first].note,/Opening gives/);
 assert.equal(report.guideWork.review.comparison.match,true);
 assert.equal(report.brief.hash,beforeHash);
 assert.equal(c.read(id).guideWork.review.comparison.target,report.caseAnswer.name);
 assert.deepEqual(c.report(id).guideWork,report.guideWork);
 assert.deepEqual(c.review(id).snapshot,snapshot('mdd','chosen'),'Recording/reviewing notes must not rewrite the frozen case.');
 assert.equal(provider.calls.length,3);
 assert.throws(()=>c.saveGuide(id,{expectedHash:beforeHash,state}),e=>e.status===409);
});

test('rejected updates are atomic and inherited fields cannot replace actual evidence entries',()=>{
 const guide=interviewGuide(snapshot()),first=guide.checklist[0].id;
 const inherited=Object.create({[first]:note()});
 const normalized=normalizeGuideState(stateFor(guide,{items:inherited}),guide,answered);
 assert.equal(normalized.items[first].status,'unasked');
 const proto=JSON.parse('{"__proto__":{"status":"supported","turnId":"T1","note":"fake"}}');
 assert.throws(()=>normalizeGuideState(stateFor(guide,{items:proto}),guide,answered),/different interview/);
 assert.equal({}.status,undefined);
});

test('a late invalid field cannot partially overwrite saved session notes',async t=>{
 const {controller:c,id,view}=await prepared(t);
 const saved=c.saveGuide(id,{expectedHash:view.brief.hash,state:stateFor(view.guide)});
 const invalid=stateFor(view.guide,{hypothesisId:'mdd',nextStep:'x'.repeat(2001)});
 assert.throws(()=>c.saveGuide(id,{expectedHash:view.brief.hash,state:invalid}),e=>e.status===400);
 assert.deepEqual(c.read(id).guideWork,saved.guideWork);
});

test('wrong history hash, replacement and unrelated session cannot attach notes',async t=>{
 const {controller:c,provider,id,view}=await prepared(t),state=stateFor(view.guide);
 assert.throws(()=>c.saveGuide(id,{expectedHash:'wrong',state}),e=>e.status===409);
 assert.throws(()=>c.saveGuide('not-the-owner',{expectedHash:view.brief.hash,state}),e=>e.status===401);
 const second=c.prepare(defaultInput);const secondView=await ready(c,second.id);
 assert.notEqual(view.brief.hash,secondView.brief.hash);
 assert.throws(()=>c.saveGuide(second.id,{expectedHash:view.brief.hash,state}),e=>e.status===409);
 assert.equal(c.read(second.id).guideWork.state.hypothesisId,'defer');
 const replacement=c.prepare({...defaultInput,selection:{mode:'none'}},id);await ready(c,replacement.id);
 assert.throws(()=>c.saveGuide(id,{expectedHash:view.brief.hash,state}),e=>e.status===401);
 assert.equal(provider.calls.length,0);
});

test('notes cannot change while an answer is pending',async t=>{
 let started,release;
 const entered=new Promise(resolve=>{started=resolve;}),waiting=new Promise(resolve=>{release=resolve;});
 const {controller:c,id,view}=await prepared(t,defaultInput,async request=>{
  if(request.role==='CORTEX'){started();await waiting;}
 });
 const pending=c.ask(id,request);
 await entered;
 try{
  assert.throws(()=>c.saveGuide(id,{expectedHash:view.brief.hash,state:stateFor(view.guide)}),e=>e.status===409);
 }finally{release();}
 await pending;
});

test('HTTP guide route requires ownership, origin and valid evidence; refresh/debrief persist it without added model calls',async t=>{
 const provider=mockProvider(),{server}=await createApp({provider});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>{server.closeAllConnections();server.close();});
 const base='http://127.0.0.1:'+server.address().port;
 const call=(path,method='GET',body,cookie='',extra={})=>fetch(base+path,{method,headers:{Origin:base,'Content-Type':'application/json','X-PsychLab':'1',Cookie:cookie,...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const created=await call('/api/prepare','POST',{...defaultInput,selection:{mode:'random'}});
 assert.equal(created.status,202);
 const cookie=created.headers.get('set-cookie').split(';')[0];
 let view;
 for(let n=0;n<100;n++){
  const response=await call('/api/preparation','GET',undefined,cookie),data=await response.json();
  if(data.preparation.status==='ready'){view=data.session;break;}
  await nextTick();
 }
 assert.ok(view);assert.equal(view.guideWork.review.comparison,null);
 const payload={expectedHash:view.brief.hash,state:stateFor(view.guide)};
 assert.equal((await call('/api/guide','POST',payload)).status,401);
 assert.equal((await call('/api/guide','POST',payload,'psychlab_session=unknown')).status,401);
 assert.equal((await call('/api/guide','POST',payload,cookie,{Origin:'https://foreign.example'})).status,403);
 assert.equal((await call('/api/guide','POST',payload,cookie,{'X-PsychLab':''})).status,403);
 assert.equal((await call('/api/guide','POST',{...payload,expectedHash:'wrong'},cookie)).status,409);
 const first=view.guide.checklist[0].id;
 assert.equal((await call('/api/guide','POST',{...payload,state:{...payload.state,items:{[first]:note('supported','T99')}}},cookie)).status,400);
 assert.equal((await call('/api/guide','POST',payload,cookie)).status,200);
 assert.equal(provider.calls.length,0);
 const refresh=await (await call('/api/session','GET',undefined,cookie)).json();
 assert.deepEqual(refresh.guideWork.state.alternatives,payload.state.alternatives);
 assert.equal(refresh.guideWork.review.comparison,null);
 assert.equal((await call('/api/report','GET',undefined,cookie)).status,409);
 assert.equal((await call('/api/review','GET',undefined,cookie)).status,403);
 for(const path of ['/interview-guide.mjs','/data/interview-guidance.json','/data/interview-standard.json'])assert.equal((await call(path)).status,404);
 assert.equal((await call('/api/turn','POST',request,cookie)).status,200);
 payload.state.items[first]=note();
 assert.equal((await call('/api/guide','POST',payload,cookie)).status,200);
 assert.equal(provider.calls.length,3);
 const finished=await call('/api/finish','POST',{reasoning},cookie);
 assert.equal(finished.status,200);
 const report=await finished.json();
 assert.equal(report.guideWork.review.comparison.target,report.caseAnswer.name);
 assert.deepEqual((await (await call('/api/report','GET',undefined,cookie)).json()).guideWork,report.guideWork);
 assert.equal((await call('/api/guide','POST',payload,cookie)).status,409);
 assert.equal(provider.calls.length,3);
});
