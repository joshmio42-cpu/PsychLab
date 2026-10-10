import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as nextTick} from 'node:timers/promises';
import {createController} from '../controller.mjs';
import {interviewGuide,emptyGuideState,guideProfiles} from '../interview-guide.mjs';
import {FOCUSED_SOURCE_MAP,checkpointSources,interviewFeedback} from '../interview-feedback.mjs';
import {simulateHistory,baselineSnapshot} from '../engine.mjs';
import {patientOptions} from '../patients.mjs';
import {compatibleDisorders} from '../disorders.mjs';
import {baseline,mockProvider,reasoning} from './helpers.mjs';

const snapshot=(disorderId='mdd',selectionMode='chosen',patientId='jordan')=>simulateHistory({disorderId,selectionMode,patientId,days:2});
const turn=(id,factIds,extras={})=>({id,kind:'answer',interaction:'answer',factIds,question:'What changed?',reply:'The answer that was actually displayed.',...extras});
const review=(s,turns,state=emptyGuideState(),options={})=>interviewFeedback({snapshot:s,guide:interviewGuide(s),turns,state,reasoning,ended:true,...options});

test('all 67 focused guides have explicit authored source maps with valid checkpoints and fact IDs',()=>{
 const profiles=guideProfiles();assert.equal(profiles.length,67);
 assert.deepEqual(Object.keys(FOCUSED_SOURCE_MAP).sort(),profiles.map(p=>p.id).sort());
 for(const p of profiles){
  assert.deepEqual(Object.keys(FOCUSED_SOURCE_MAP[p.id]).sort(),p.checklist.map(c=>c.id).sort(),p.id);
  const patient=patientOptions().find(x=>compatibleDisorders(x.lifeStage).some(d=>d.id===p.id)),s=snapshot(p.id,'chosen',patient.id);
  for(const ids of Object.values(FOCUSED_SOURCE_MAP[p.id]))for(const id of ids)assert.ok(s.facts.some(f=>f.id===id),p.id+' '+id);
  const result=review(s,[]);assert.equal(result.usefulQuestions.length,0);
  assert.equal(result.unknowns.length,interviewGuide(s).checklist.length);
 }
});

test('only actual source IDs produce question highlights; repeats, invented IDs and social turns gain none',()=>{
 const s=snapshot(),turns=[turn('T1',[],{interaction:'social',reply:'Hello.'}),turn('T2',['B01'],{question:'When did this start?',reply:'About four months ago.'}),turn('T3',['B01']),turn('T4',['B02']),turn('T5',['B03'],{interaction:'unavailable'}),turn('T6',['FAKE'])];
 const result=review(s,turns);
 assert.deepEqual(result.usefulQuestions.map(x=>x.turnId),['T2','T4']);
 assert.equal(result.usefulQuestions[0].question,'When did this start?');assert.equal(result.usefulQuestions[0].reply,'About four months ago.');
 assert.deepEqual(result.usefulQuestions[0].sources,[{id:'B01',label:'Earlier course and onset'}]);
 assert.ok(result.usefulQuestions[0].checkpointLeads.some(x=>x.id==='focus_episode_course'));
 assert.ok(result.unknowns.some(x=>x.checkpointId==='focus_impact'));
 assert.ok(result.unknowns.some(x=>x.checkpointId==='focus_episode_course'&&/not recorded/.test(x.reason)),'Source paragraph alone must not imply whole checkpoint established');
});

test('a long confident note linked to a hobby cannot support mood, course, or safety',()=>{
 const s=snapshot(),state=emptyGuideState();
 for(const id of ['focus_mood_interest','focus_episode_course','focus_safety'])state.items[id]={status:'supported',turnId:'T1',note:'Definitely confirmed. '.repeat(30)};
 const result=review(s,[turn('T1',['P05'])],state,{reasoning:{...reasoning,support:'T1 proves my diagnosis beyond any doubt.'}});
 assert.equal(result.evidenceGaps.filter(x=>/no source mapped/.test(x.issue)).length,3);
 assert.deepEqual(result.conclusionReview.supportingTurnIds,['T1']);
 assert.match(result.conclusionReview.status,/not been graded/);
 assert.ok(result.unknowns.some(x=>x.checkpointId==='focus_safety'&&/No authored source/.test(x.reason)));
 assert.ok(!JSON.stringify(result).includes('diagnosisCorrect'));
});

test('source-linked notes stay qualified, uncertain stays open, absent is never inferred from omission',()=>{
 const s=snapshot(),state=emptyGuideState();state.items.focus_episode_course={status:'supported',turnId:'T1',note:'The answer dates the change to four months.'};state.items.focus_associated={status:'uncertain',turnId:'T2',note:'Sleep was described; remaining features need clarification.'};state.items.focus_safety={status:'absent',turnId:'T1',note:'Nothing mentioned.'};
 const result=review(s,[turn('T1',['B01']),turn('T2',['B02'])],state,{reasoning:{...reasoning,support:'T1 dates onset; T2 describes broken sleep.'}});
 assert.ok(!result.evidenceGaps.some(x=>x.checkpointId==='focus_episode_course'));
 assert.ok(result.unknowns.some(x=>x.checkpointId==='focus_associated'&&/unclear/.test(x.reason)));
 assert.ok(result.evidenceGaps.some(x=>x.checkpointId==='focus_safety'&&/does not prove absence/.test(x.issue)));
 assert.deepEqual(result.conclusionReview.supportingTurnIds,['T1','T2']);assert.match(result.limitations[0],/compound checkpoint/);
});

test('free-text conclusion links are traceability only and invalid/social references are flagged',()=>{
 const s=snapshot(),turns=[turn('T1',['B01']),turn('T2',[],{interaction:'social'})];
 const missing=review(s,turns,emptyGuideState(),{reasoning:{...reasoning,support:'This long explanation is certainly correct. '.repeat(50)}});
 assert.ok(missing.conclusionReview.gaps.some(x=>/names no interview turns/.test(x)));
 const linked=review(s,turns,emptyGuideState(),{reasoning:{...reasoning,support:'T1 supports onset. T2 and T99 establish everything else.'}});
 assert.deepEqual(linked.conclusionReview.supportingTurnIds,['T1']);assert.ok(linked.conclusionReview.gaps.some(x=>/T2, T99 do not identify factual/.test(x)));
 assert.match(linked.conclusionReview.status,/not confirmation/);
});

test('caregiver, no-disorder and legacy authored cases retain suitable source boundaries',()=>{
 const child=snapshot('autism','chosen','mika'),childResult=review(child,[turn('T1',['B01'])]);
 assert.match(childResult.perspective,/caregiver/);assert.match(childResult.perspective,/private experience/);
 const comm=childResult.unknowns.find(x=>x.checkpointId==='focus_sensory');assert.match(comm.question,/From your observations of Mika/);
 const none=snapshot('none','none'),noneResult=review(none,[turn('T1',['P05'])]);
 assert.equal(noneResult.usefulQuestions[0].checkpointLeads.length,0,'A hobby does not establish current enjoyment or clinical negatives');
 assert.ok(noneResult.unknowns.some(x=>x.checkpointId==='safety'));assert.ok(noneResult.unknowns.some(x=>x.checkpointId==='mood'));
 const authored=baselineSnapshot(baseline),maps=checkpointSources(authored,interviewGuide(authored));assert.deepEqual(maps.safety,['F15']);assert.deepEqual(maps.course,['F02']);
});

test('post-interview feedback cannot disclose a mystery case before finishing',()=>{
 for(const id of ['mdd','bpd','gad'])assert.equal(review(snapshot(id,'random'),[],emptyGuideState(),{ended:false}),null);
});

test('controller finish, refresh and report persist actual evidence feedback with zero extra model calls',async t=>{
 const provider=mockProvider(r=>r.role==='CORTEX'?{kind:'answer',fact_ids:['B01']}:undefined),c=createController({baseline,provider});t.after(()=>c.close());
 const {id}=c.prepare({patientId:'jordan',days:2,seed:42,selection:{mode:'random'}});
 let current;
 for(let i=0;i<100;i++){const p=c.preparation(id);if(p.preparation.status==='ready'){current=p.session;break;}await nextTick();}
 assert.ok(current);assert.ok(!Object.hasOwn(current,'feedback'));
 await c.ask(id,{question:'When did this begin?',requestId:'feedback-turn-001',expectedTurn:0});
 assert.ok(!Object.hasOwn(c.read(id),'feedback'));
 const before=provider.calls.length,hash=current.brief.hash,result=c.finish(id,{reasoning:{...reasoning,support:'T1 gives an onset account.'}});
 assert.equal(provider.calls.length,before);assert.equal(before,3);assert.equal(result.brief.hash,hash);
 assert.equal(result.feedback.usefulQuestions[0].question,'When did this begin?');
 assert.deepEqual(result.feedback,c.read(id).feedback);assert.deepEqual(result.feedback,c.report(id).feedback);
 assert.deepEqual(result.feedback.conclusionReview.supportingTurnIds,['T1']);
 result.feedback.usefulQuestions.length=0;assert.equal(c.report(id).feedback.usefulQuestions.length,1,'Caller mutation must not alter regenerated report');
});
