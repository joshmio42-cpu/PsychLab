import {createHash} from 'node:crypto';
import {createIdentity,activateMotives,chooseAction,learnFromObservation,supportExpectation} from '../personality_system/models/identity.mjs';
import {evidenceVersion,ruleTrace} from '../personality_system/models/registry.mjs';
import {patientProfile,scenario} from './patients.mjs';
import {createDisorderPremise} from './disorders.mjs';
import {personalFacts} from './individuality.mjs';

export const ENGINE_VERSION='life-history-0.5.0';
export const MODEL_NOTICE='Experimental authored simulation rules; not a validated psychological model or diagnostic instrument.';
const clamp=x=>Math.max(0,Math.min(1,x));
const round=x=>Math.round(x*1000)/1000;
export function deepFreeze(value){
  if(value && typeof value==='object'){Object.values(value).forEach(deepFreeze);Object.freeze(value);}
  return value;
}
function randomStream(seed){
  let n=seed>>>0;
  return ()=>{n=(n+0x6D2B79F5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
}
const EVENTS=[
  {kind:'task',observation:'A routine work task needed finishing.',world:'The task had an ordinary deadline.',load:.6,connection:0},
  {kind:'cancelled',observation:'A friend cancelled a planned catch-up without explaining why.',world:'The friend had an unexpected work shift.',load:.35,connection:-.4},
  {kind:'support',observation:'A cousin offered time to listen.',world:'The cousin was available to talk.',load:.1,connection:.65},
  {kind:'quiet',observation:'There was a quiet evening with no scheduled commitments.',world:'No new obligation arose that evening.',load:.05,connection:0}
];

// Each owner returns its own proposed value; the engine alone commits a day.
function physiology(previous,draw){return {energy:round(clamp(previous.energy*.6+.35-draw*.18))};}
function cortex(event,identity,body,memory,profile){
  const recalled=memory.filter(m=>m.kind===event.kind).slice(-2);
  const recallPressure=recalled.reduce((s,m)=>s+m.pressure,0)/(recalled.length||1);
  const pressure=clamp(event.load*.45+identity.traits.threatSensitivity*.2+(1-body.energy)*.15+recallPressure*.1-(event.connection>0?supportExpectation(identity,profile.supportTarget)*.15:0));
  const interpretation=event.kind==='cancelled'?'I do not know why the plan changed. They may be busy; I also wonder whether they wanted to see me.':event.kind==='task'?'I want to do a reliable job, and the deadline feels demanding.':event.kind==='support'?'Talking might help, though I am not sure how much I want to say.':'I have some time free; I could rest or choose one of my usual activities.';
  return {pressure:round(pressure),interpretation:event.interpretation??interpretation,retrievedDays:recalled.map(m=>m.day),uncertainty:event.kind==='cancelled'?'Reason for cancellation unknown':'Interpretation is subjective'};
}
function affect(previous,appraisal){
  const tension=clamp(previous.tension*.6+appraisal.pressure*.4);
  return {tension:round(tension),moodBurden:round(clamp(previous.moodBurden*.9+tension*.1))};
}
function social(event,identity,emotion,draw,profile){return chooseAction(identity,event.kind,emotion.tension,draw,{relationship:event.kind==='support'?profile.supportTarget:event.kind==='cancelled'?profile.planTarget:null});}
function consequence(event,action){
  const texts={work:'I finished the routine work task.',pause:'I postponed the task until the next day.',seek_support:'I talked with my cousin and they listened.',rest:'I took some time to rest.',reschedule:'I asked my friend to find another time; no new date was agreed that day.',withdraw:'I did not reply to the cancellation that day.',sketch:'I spent some time sketching.'};
  return {text:texts[action],taskCompleted:event.kind==='task' && action==='work',taskPostponed:event.kind==='task' && action==='pause',supportReceived:action==='seek_support',recovery:['rest','sketch','seek_support'].includes(action)?.08:0};
}
// The same generator powers synchronous fixtures and cancellable UI preparation.
// Yield points report completed work; they never add artificial loading delays.
export function* historyPreparation({seed=42,days=28,patientId='jordan',disorderId,selectionMode='none'}={}){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Seed must be an integer from 0 to 4294967295.');
  if(!Number.isInteger(days)||days<1||days>90)throw new Error('History must contain 1 to 90 days.');
  const random=randomStream(seed),events=[],memory=[],symptoms=[],trace=[];
  let profile=patientProfile(patientId);
  yield {phase:'identity',message:'Preparing the patient’s life stage, relationships and personality.',completedDays:0,totalDays:days};
  const premise=disorderId?createDisorderPremise({disorderId,profile,days,seed}):null;
  if(premise?.interviewPerspective==='caregiver')profile={...profile,caregiver:true};
  const story=scenario(profile);
  yield {phase:'premise',message:'Connecting earlier history, current experiences and interview perspective.',completedDays:0,totalDays:days};
  const schedule=patientId==='jordan'&&!profile.caregiver?EVENTS:story.events;
  let identity=createIdentity();
  identity.origin=`Authored ${profile.name} profile; shared experimental coefficients, not age-calibrated`;
  identity.motive.values=structuredClone(profile.individuality.priorities);
  identity.schema.relationships=Object.fromEntries([...new Set([profile.supportTarget,profile.planTarget])].map(target=>[target,{supportExpected:.5,observations:0,uncertainty:'Uncalibrated authored prior; no credible interval'}]));
  let body={energy:.7},emotion={tension:.3,moodBurden:.25};
  const initialState=structuredClone({identity,body,emotion});
  const functioning={tasks:0,completed:0,postponed:0,supportContacts:0};
  for(let day=1;day<=days;day++){
    const draws=[random(),random(),random()];
    const event={day,lifeStage:profile.lifeStage,...schedule[Math.floor(draws[0]*schedule.length)]};
    const availablePatterns=premise?.dailyPatterns?.filter(p=>day>=(p.startDay??1)&&day<=(p.endDay??days)&&(!p.cycleDays||(days-day)%p.cycleDays<p.activeCycleDays))??[];
    const pattern=availablePatterns.length?availablePatterns[Math.floor(draws[1]*availablePatterns.length)]:null;
    const before=structuredClone({identity,body,emotion});
    const motivation=activateMotives(identity,event.kind);
    const activeIdentity=motivation.identity;
    const nextBody=physiology(body,draws[1]);
    const appraisal=cortex(event,activeIdentity,nextBody,memory,profile);
    if(pattern)appraisal.authoredExperience={interpretation:pattern.interpretation,functionalImpact:pattern.impact};
    const nextEmotion=affect(emotion,appraisal);
    const action=social(event,activeIdentity,nextEmotion,draws[2],profile);
    const outcome=consequence(event,action.selected);
    if(patientId!=='jordan'||profile.caregiver)outcome.text=story.outcomes[action.selected];
    nextEmotion.tension=round(clamp(nextEmotion.tension-outcome.recovery));
    const experience=profile.caregiver?'I cannot know exactly what they felt.':nextEmotion.tension>.35?'I felt some tension about the situation.':'I felt relatively at ease after that.';
    const nextMemory={eventId:`day-${day}`,day,kind:event.kind,relationship:action.relationship,lifeStage:profile.lifeStage,observation:event.observation,interpretation:appraisal.interpretation,experience,pressure:appraisal.pressure,outcome:outcome.text,
      ...(pattern?{premiseExperience:{label:pattern.label,observation:pattern.observation,interpretation:pattern.interpretation,experience:pattern.experience,impact:pattern.impact}}:{})};
    const learning=learnFromObservation(activeIdentity,{eventId:nextMemory.eventId,relationship:action.relationship,supportObserved:outcome.supportReceived?1:null});
    const nextIdentity=learning.identity;
    for(const n of [nextBody.energy,nextEmotion.tension,nextEmotion.moodBurden,...Object.values(nextIdentity.schema.relationships).map(r=>r.supportExpected)])if(!Number.isFinite(n)||n<0||n>1)throw new Error('Invalid state update.');
    // Commit once validation passes. World truth never overwrites subjective memory.
    body=nextBody;emotion=nextEmotion;identity=nextIdentity;events.push(event);memory.push(nextMemory);
    if(event.kind==='task')functioning.tasks++;
    if(outcome.taskCompleted)functioning.completed++;
    if(outcome.taskPostponed)functioning.postponed++;
    if(outcome.supportReceived)functioning.supportContacts++;
    symptoms.push({day,tension:emotion.tension,moodBurden:emotion.moodBurden,energy:body.energy,status:'Model readouts, not clinical symptom measurements'});
    trace.push({day,ruleVersion:ENGINE_VERSION,before,draws,observation:event.observation,
      steps:[...(pattern?[{agent:'MENTAL_PREMISE',output:{label:pattern.label,impact:pattern.impact,status:'Authored experience and functional impact; no diagnostic score or numerical severity inferred'}}]:[]),{agent:'MOTIVE',output:motivation.trace},{agent:'PHYSIOLOGY',evidence:ruleTrace('R-BODY'),output:body},
        {agent:'MNEMOSYNE',evidence:ruleTrace('R-MEMORY'),output:{retrievedDays:appraisal.retrievedDays}},
        {agent:'CORTEX',evidence:ruleTrace('R-APPRAISAL'),output:appraisal},{agent:'AFFECT',evidence:ruleTrace('R-AFFECT'),output:emotion},
        {agent:'SOCIAL',output:action},{agent:'WORLD',evidence:ruleTrace('R-OUTCOME'),output:outcome},
        {agent:'MNEMOSYNE',evidence:ruleTrace('R-MEMORY'),output:{stored:nextMemory}},
        {agent:'IDENTITY',evidence:[ruleTrace('R-LEARN'),ruleTrace('R-TRAIT-HOLD')],learning:learning.trace,output:identity}],after:structuredClone({identity,body,emotion})});
    yield {phase:'simulation',message:'Relating daily experiences to personality, memory and responses.',completedDays:day,totalDays:days};
  }
  const facts=[
    {id:'G01',label:'Opening and goals',domains:['presenting','goals'],response:`${premise?.opening??story.opening} ${profile.individuality.goal}`,briefResponse:profile.individuality.opening,sources:[]},
    {id:'G02',label:'Background and life stage',domains:['support','goals'],response:story.background,sources:[]},
    {id:'G03',label:'Recorded time window',domains:['timeline','history'],response:`This account covers ${days} recent simulated days within the ${profile.lifeStage.toLowerCase()} stage. It is not a history from birth. ${premise?'Earlier experiences are recorded separately; this recent window does not establish when all difficulties began.':'Earlier developmental and health history is not authored.'}`,sources:[]},
    {id:'G04',label:'Daily routines over the recorded period',domains:['function'],response:profile.caregiver?`I observed ${functioning.tasks} routine activities: ${profile.name} participated with help in ${functioning.completed} and paused ${functioning.postponed}.`:`Over this recorded period I had ${functioning.tasks} tasks involving ${profile.task}: I completed ${functioning.completed} that day and paused ${functioning.postponed}.`,sources:[]},
    ...personalFacts(profile.individuality),
    ...(premise?.baselineFacts??[]).map((f,i)=>({id:`B${String(i+1).padStart(2,'0')}`,label:f.label,domains:f.domains,response:f.response,sources:[]})),
    ...memory.map(m=>({id:`E${String(m.day).padStart(2,'0')}`,label:`Day ${m.day}: ${m.premiseExperience?.label??m.kind}`,domains:m.premiseExperience?['context','function','symptoms']:m.kind==='task'?['function','context']:['context','support'],response:`On simulated day ${m.day}, ${m.observation} ${profile.caregiver?'Caregiver account:':'My interpretation at the time was:'} ${m.interpretation} ${m.outcome} ${m.premiseExperience?[m.premiseExperience.observation,m.premiseExperience.interpretation,m.premiseExperience.experience].filter(Boolean).join(' '):m.experience}`,sources:[]}))
  ];
  yield {phase:'freeze',message:'Checking and freezing the interview history.',completedDays:days,totalDays:days};
  const snapshot={id:`SIM-${patientId}-${seed}-${days}`,version:ENGINE_VERSION,name:profile.name,age:null,lifeStage:profile.lifeStage,patientId,speaker:story.speaker,interviewPerspective:profile.caregiver?'caregiver':'patient',pronouns:'they/them',
    mode:'generated',status:MODEL_NOTICE,referral:`${profile.name} · ${profile.lifeStage}. ${profile.caregiver?'Interview their caregiver about observed routines and play.':'Explore recent routines and changes in plans.'}`,
    background:facts[1].response,affect:profile.caregiver?'Use a caregiver’s observational voice. Do not claim access to the child’s private thoughts.':emotion.tension>.35?'Use a somewhat hesitant, reflective style.':'Use a calm, reflective style.',facts,
    unknowns:[premise?'Details not included in the authored earlier history':'Health and developmental history before this recorded period','Unauthored medication and substance details','Unauthored safety details','Clinical diagnosis','Validated assessment responses'],
    gad7:null,seed,days,individuality:profile.individuality,personalityEvidence:evidenceVersion,initialState,events,memory,symptoms,functioning,trace,finalState:{identity,body,emotion},classification:{status:'No clinical classification or diagnostic thresholds applied'},
    ...(premise?{caseSelection:{mode:selectionMode,id:premise.id,name:premise.name,description:premise.description,classification:premise.classification},casePremise:premise}:{})};
  if(premise?.speaker)snapshot.speaker=premise.speaker;
  if(premise?.interviewPerspective)snapshot.interviewPerspective=premise.interviewPerspective;
  if(premise?.communicationStyle)snapshot.communicationGuidance=premise.communicationStyle;
  const hash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return deepFreeze({...snapshot,hash});
}
export function simulateHistory(options={}){
  const steps=historyPreparation(options);let step;
  do{step=steps.next();}while(!step.done);
  return step.value;
}
export function baselineSnapshot(caseData){
  const copy=structuredClone(caseData);
  copy.lifeStage='Young adult';copy.speaker=copy.name;copy.interviewPerspective='patient';copy.patientId='alex';
  copy.mode='baseline';copy.hash=createHash('sha256').update(JSON.stringify(caseData)).digest('hex');
  return deepFreeze(copy);
}
export function publicBrief(snapshot){
  return {id:snapshot.id,name:snapshot.name,lifeStage:snapshot.lifeStage,speaker:snapshot.speaker,interviewPerspective:snapshot.interviewPerspective,pronouns:snapshot.pronouns,referral:snapshot.referral,
    mode:snapshot.mode,version:snapshot.version,hash:snapshot.hash,
    assessmentAvailable:!!snapshot.gad7,historyDays:snapshot.days??null,
    ...(snapshot.caseSelection?{selection:snapshot.caseSelection.mode==='random'?{mode:'random'}:{mode:snapshot.caseSelection.mode,name:snapshot.caseSelection.name,description:snapshot.caseSelection.description,classification:snapshot.caseSelection.classification}}:{}),
    notice:snapshot.mode==='generated'?MODEL_NOTICE:'Authored fictional case; qualified review pending'};
}
