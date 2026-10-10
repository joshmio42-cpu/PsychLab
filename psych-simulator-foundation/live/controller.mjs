import {randomBytes,randomInt} from 'node:crypto';
import {setImmediate as nextTick} from 'node:timers/promises';
import {baselineSnapshot,simulateHistory,historyPreparation,publicBrief} from './engine.mjs';
import {answerQuestion,requestPayload} from './model.mjs';
import {ECONOMY,BudgetError,createLedger,usageView,meteredComplete} from './usage.mjs';
import {scoreGad7} from '../prototype/dist/core.mjs';
import {evidenceBundle} from '../personality_system/models/registry.mjs';
import {patientOptions} from './patients.mjs';
import {disorderOptions,compatibleDisorders,getDisorder,disorderEvidence} from './disorders.mjs';
import {difficultyOptions,difficultySettings} from './interview-style.mjs';
import {interviewGuide,emptyGuideState,normalizeGuideState,guideWork,isEvidenceTurn} from './interview-guide.mjs';
import {interviewFeedback} from './interview-feedback.mjs';
export class RequestError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export function createController({baseline,provider,now=Date.now,ttlMs=2*60*60*1000,maxSessions=64,sessionCallLimit=ECONOMY.sessionCalls,processCallLimit=ECONOMY.processCalls,exampleGuidance=null}={}){
  const sessions=new Map();
  const processUsage=createLedger(processCallLimit);createLedger(sessionCallLimit);
  function remove(id){const s=sessions.get(id);if(s)s.abort?.abort();sessions.delete(id);}
  function sweep(){for(const [id,s] of sessions)if(now()-s.touched>ttlMs)remove(id);}
  function assertOwner(id,owner='local'){
    sweep();const s=sessions.get(id);
    if(s&&s.owner!==owner){const error=new RequestError('This interview belongs to another signed-in user. Start a new interview.',403);error.clearSessionCookie=true;throw error;}
  }
  function get(id){sweep();const s=sessions.get(id);if(!s)throw new RequestError('Session expired or unavailable. Start a new interview.',401);s.touched=now();if(!s.snapshot)throw new RequestError('History preparation has not finished.',409);return s;}
  function brief(s){const d=difficultySettings(s.difficulty);return {...publicBrief(s.snapshot),difficulty:d.id,difficultyLabel:d.name,difficultyDescription:d.description,...(s.publicHash?{hash:s.publicHash}:{})};}
  function work(s){return guideWork(interviewGuide(s.snapshot),s.guideState,s.turns,{ended:s.ended,target:s.ended?s.snapshot.caseSelection:undefined});}
  function feedback(s){return interviewFeedback({snapshot:s.snapshot,guide:interviewGuide(s.snapshot),state:s.guideState,turns:s.turns,reasoning:s.reasoning,ended:s.ended});}
  function noteFields(t){return typeof t.exerciseNote==='string'&&t.exerciseNote.trim()?{exerciseNote:t.exerciseNote}:{};}
  function publicTurn(t){return {id:t.id,requestId:t.requestId,question:t.question,reply:t.reply,kind:t.kind,interaction:t.interaction,...noteFields(t)};}
  function view(s){return {brief:brief(s),guide:interviewGuide(s.snapshot),guideWork:work(s),...(s.ended?{feedback:feedback(s)}:{}),turns:s.turns.map(publicTurn),assessment:structuredClone(s.assessment),ended:s.ended,paused:s.paused,busy:s.busy,providerReady:provider.configured,model:provider.model,usage:usageView(s.usage,processUsage)};}
  function emptySession(){return {snapshot:null,guideState:emptyGuideState(),turns:[],assessment:null,reasoning:null,ended:false,paused:false,busy:false,touched:now(),requests:new Map(),traces:[],abort:null,usage:createLedger(sessionCallLimit)};}
  function validateProfile({mode='generated',seed=42,days,patientId,difficulty='standard'}={},legacy=false){
    try{difficultySettings(difficulty);}catch{throw new RequestError('Choose Beginner, Standard or Challenging.');}
    if(!['generated','baseline'].includes(mode))throw new RequestError('Unknown case mode.');
    const profile=patientOptions().find(p=>p.id===(patientId??(mode==='baseline'?'alex':'jordan')));
    if(!profile||(mode==='baseline'&&profile.id!=='alex'))throw new RequestError('Choose a patient that matches the case mode.');
    days??=profile.defaultDays;
    if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RequestError('Use an integer seed from 0 to 4294967295.');
    if((mode==='generated'||!legacy)&&(!Number.isInteger(days)||days<1||days>90))throw new RequestError('Simulated days must be a whole number from 1 to 90.');
    return {mode:legacy?mode:'generated',seed,days,patientId:profile.id,difficulty,profile};
  }
  function jobSession(id){sweep();const s=sessions.get(id);if(!s?.preparation)throw new RequestError('No preparation is available for this session.',404);s.touched=now();return s;}
  return {
    status:()=>({providerReady:provider.configured,model:provider.model,patients:patientOptions(),disorders:disorderOptions(),difficulties:difficultyOptions(),promptMode:'economy',processUsage:{...processUsage},scope:'Local private prototype; model and psychological validity unverified'}),
    assertOwner,
    create({mode='generated',seed=42,days,patientId,difficulty='standard'}={},oldId,owner='local'){
      assertOwner(oldId,owner);
      sweep();const input=validateProfile({mode,seed,days,patientId,difficulty},true);days=input.days;const profile=input.profile;
      if(sessions.size>=maxSessions&&!sessions.has(oldId))throw new RequestError('Session capacity reached. Try later.',503);
      const snapshot=mode==='baseline'?baselineSnapshot(baseline):simulateHistory({seed,days,patientId:profile.id});
      if(oldId)remove(oldId);
      const id=randomBytes(32).toString('hex');
      const s={...emptySession(),snapshot,difficulty,owner};
      sessions.set(id,s);return {id,view:view(s)};
    },
    prepare(input={},oldId,owner='local'){
      assertOwner(oldId,owner);
      sweep();const {profile,...configuration}=validateProfile(input);
      const selection=input.selection;
      if(!selection||typeof selection!=='object'||!['chosen','random','none'].includes(selection.mode))throw new RequestError('Choose a disorder, Random or No disorder.');
      if(selection.mode==='chosen'){
        let option;try{option=getDisorder(selection.disorderId);}catch{throw new RequestError('Choose an available disorder.');}
        if(!option||option.id==='none'||!compatibleDisorders(profile.lifeStage).some(p=>p.id===option.id))throw new RequestError('Choose a disorder available for this patient’s life stage.');
        configuration.selection={mode:'chosen',disorderId:option.id};
      }else configuration.selection={mode:selection.mode};
      if(input.requestId!==undefined&&(typeof input.requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(input.requestId)))throw new RequestError('Invalid request identifier.');
      const fingerprint=JSON.stringify(configuration),prior=sessions.get(oldId);
      if(input.requestId&&prior?.preparationRequestId===input.requestId){
        if(prior.preparationFingerprint!==fingerprint)throw new RequestError('Request identifier was reused with different content.',409);
        return {id:oldId,preparation:structuredClone(prior.preparation)};
      }
      if(sessions.size>=maxSessions&&!sessions.has(oldId))throw new RequestError('Session capacity reached. Try later.',503);
      const candidates=compatibleDisorders(profile.lifeStage).filter(p=>p.id!=='none');
      if(selection.mode==='random'&&!candidates.length)throw new RequestError('No random cases are available for this life stage.');
      const disorderId=selection.mode==='chosen'?selection.disorderId:selection.mode==='none'?'none':candidates[randomInt(candidates.length)].id;
      if(oldId)remove(oldId);
      const id=randomBytes(32).toString('hex');
      const s={...emptySession(),owner,difficulty:configuration.difficulty,publicHash:randomBytes(32).toString('hex'),preparationRequestId:input.requestId,preparationFingerprint:fingerprint,
        preparation:{status:'running',phase:'identity',message:'Preparing the patient’s life stage, relationships and personality.',completedDays:0,totalDays:configuration.days,configuration}};
      sessions.set(id,s);
      const steps=historyPreparation({...configuration,disorderId,selectionMode:selection.mode});
      s.preparationTask=(async()=>{
        try{
          await nextTick();
          while(sessions.get(id)===s){
            const step=steps.next();
            if(step.done){s.snapshot=step.value;s.preparation={...s.preparation,status:'ready',phase:'freeze',message:'History is frozen. The interview is ready.',completedDays:configuration.days};return;}
            s.preparation={...s.preparation,...step.value};
            await nextTick();
          }
        }catch{
          if(sessions.get(id)===s)s.preparation={...s.preparation,status:'failed',error:'The history could not be prepared. Please choose the case again and retry.',message:'Preparation stopped.'};
        }finally{steps.return();}
      })();
      return {id,preparation:structuredClone(s.preparation)};
    },
    preparation(id){const s=jobSession(id);return {preparation:structuredClone(s.preparation),...(s.preparation.status==='ready'?{session:view(s)}:{})};},
    cancelPreparation(id){jobSession(id);remove(id);return {cancelled:true};},
    read:id=>view(get(id)),remove,sweep,
    saveGuide(id,{expectedHash,state}={}){
      const s=get(id);
      if(expectedHash!==brief(s).hash)throw new RequestError('These notes belong to a different interview.',409);
      if(s.ended||s.busy)throw new RequestError('Notes cannot be changed while answering or after finishing.',409);
      try{s.guideState=normalizeGuideState(state,interviewGuide(s.snapshot),s.turns);}catch(e){throw new RequestError(e.message);}
      return {guideWork:work(s)};
    },
    async ask(id,{question,requestId,expectedTurn}={}){
      const s=get(id);
      if(typeof question!=='string'||!question.trim()||question.length>1500)throw new RequestError('Enter a question of 1–1500 characters.');
      if(typeof requestId!=='string'||!/^[a-zA-Z0-9-]{8,80}$/.test(requestId))throw new RequestError('Invalid request identifier.');
      const prior=s.requests.get(requestId);
      if(prior){if(prior.question!==question||prior.expectedTurn!==expectedTurn)throw new RequestError('Request identifier was reused with different content.',409);return prior.result;}
      if(s.ended||s.paused)throw new RequestError('This session has ended or is paused. Start a new interview.',409);
      if(s.busy)throw new RequestError('Another answer is still being processed.',409);
      if(expectedTurn!==s.turns.length)throw new RequestError('The conversation changed. Reload its current state before sending.',409);
      if(s.turns.length>=80)throw new RequestError('The 80-turn session limit has been reached. Finish this interview.',409);
      for(const ledger of [s.usage,processUsage])if(ledger.limit-ledger.attemptedCalls<3)throw new BudgetError('Not enough API calls remain for a checked answer. Finish the interview and review usage.');
      s.busy=true;s.abort=new AbortController();const abort=s.abort;
      try{
        const metered={configured:provider.configured,model:provider.model,supportsAnswerPlan:provider.supportsAnswerPlan===true,complete:request=>meteredComplete(provider,request,[s.usage,processUsage],requestPayload(request))};
        const answer=await answerQuestion({snapshot:s.snapshot,turns:s.turns,question:question.trim(),difficulty:s.difficulty,provider:metered,signal:abort.signal,exampleGuidance});
        if(abort.signal.aborted||sessions.get(id)!==s||s.ended)throw new RequestError('Request cancelled; no answer was added.',409);
        const turn={id:`T${s.turns.length+1}`,requestId,question:question.trim(),reply:answer.reply,kind:answer.kind,interaction:answer.interaction??answer.kind,factIds:answer.factIds,domains:answer.domains,sourceIds:answer.sourceIds,...noteFields(answer)};
        s.turns.push(turn);s.traces.push({turnId:turn.id,...answer.trace});s.paused=answer.kind==='safety_pause';
        const result={turn:publicTurn(turn),paused:s.paused,usage:usageView(s.usage,processUsage)};
        s.requests.set(requestId,{question,expectedTurn,result});return result;
      }finally{s.busy=false;s.abort=null;}
    },
    assess(id,{rationale,explained}={}){
      const s=get(id);if(s.busy||s.ended||s.paused)throw new RequestError('Assessment is unavailable while answering, paused or ended.',409);
      if(!s.snapshot.gad7)throw new RequestError('Generated history has no validated or authored GAD-7 responses. No score will be invented.',409);
      if(typeof rationale!=='string'||rationale.trim().length<10||rationale.length>2000||explained!==true)throw new RequestError('Explain the purpose and confirm the timeframe and limits.');
      const g=s.snapshot.gad7;s.assessment={name:'GAD-7',...scoreGad7(g.responses),values:[...g.responses],difficulty:g.difficulty,rationale:rationale.trim(),instruction:g.instruction,items:[...g.items],labels:[...g.response_labels],attribution:g.attribution,simulated:true};return s.assessment;
    },
    finish(id,{reasoning}={}){
      const s=get(id);if(s.busy)throw new RequestError('Wait for the current answer before finishing.',409);
      if(s.ended)return this.report(id);
      if(!s.turns.some(t=>isEvidenceTurn(t)&&t.factIds?.length))throw new RequestError('Obtain at least one supported client answer about their history first.');
      const keys=['hypothesis','support','alternatives','missing','next'];
      if(!reasoning||keys.some(k=>typeof reasoning[k]!=='string'||reasoning[k].trim().length<3||reasoning[k].length>4000))throw new RequestError('Complete all five reasoning fields (3–4000 characters each).');
      s.reasoning=Object.fromEntries(keys.map(k=>[k,reasoning[k].trim()]));s.ended=true;return this.report(id);
    },
    report(id){
      const s=get(id);if(!s.ended)throw new RequestError('Finish the interview first.',409);
      return {title:'Experimental AI interview debrief',brief:brief(s),guideWork:work(s),feedback:feedback(s),model:provider.model,usage:usageView(s.usage,processUsage),
        ...(s.snapshot.caseSelection?{caseAnswer:{name:s.snapshot.caseSelection.name,description:s.snapshot.caseSelection.description,classification:s.snapshot.caseSelection.classification,notes:s.snapshot.casePremise.reviewNotes}}:{}),
        evidence:s.turns.map(t=>({turnId:t.id,question:t.question,quote:t.reply,kind:t.kind,interaction:t.interaction,factIds:[...t.factIds],...noteFields(t)})),
        disclosedDomains:[...new Set(s.turns.flatMap(t=>t.domains))],assessment:s.assessment,reasoning:s.reasoning,
        ratings:['Interview coverage','Communication','Reasoning','Assessment use','Next steps'].map(domain=>({domain,rating:'NR'})),
        limitations:['No automated competence rating.','Generated life dynamics are unvalidated modeling assumptions.','AI support checks can miss errors.','Evidence includes only disclosed conversation.'],
        sourceIds:[...new Set(s.turns.flatMap(t=>t.sourceIds))]};
    },
    review(id){const s=get(id);if(!s.ended)throw new RequestError('The privileged trace is available only after the interview ends.',403);return {snapshot:s.snapshot,interviewTraces:s.traces,...(s.snapshot.mode==='generated'?{personalityEvidence:evidenceBundle()}:{}),...(s.snapshot.casePremise?{caseEvidence:disorderEvidence(s.snapshot.casePremise.sourceIds)}:{}),notice:'Privileged reviewer view. Do not use as a blind learner examination.'};},
    close(){for(const id of sessions.keys())remove(id);}
  };
}
