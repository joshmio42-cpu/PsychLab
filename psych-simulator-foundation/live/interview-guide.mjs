import {readFileSync} from 'node:fs';
import {compatibleDisorders} from './disorders.mjs';

const read=name=>JSON.parse(readFileSync(new URL(`./data/${name}`,import.meta.url),'utf8'));
const PROFILES=read('interview-guidance.json');
const GENERAL=read('interview-standard.json');
export const GUIDE_VERSION='interview-guide-1.0.1';
export const guideProfiles=()=>structuredClone(PROFILES);
const COMMON=['goals','function','context','safety','strengths'];
const STATES=['unasked','supported','absent','uncertain'];

// Select public educational content by mode before touching a mystery premise.
// Neither the hidden label nor target-specific sources reach a mystery guide.
export function interviewGuide(snapshot){
  const selection=snapshot.caseSelection;
  const mode=selection?.mode??'standard';
  const focused=mode==='chosen'?PROFILES.find(p=>p.id===selection.id):null;
  if(mode==='chosen'&&!focused)throw new Error('Interview guidance missing for selected case.');
  const source=structuredClone(focused??GENERAL);
  const checklist=focused?[...source.checklist.map(x=>({...x,id:`focus_${x.id}`})),...GENERAL.checklist.filter(x=>COMMON.includes(x.id)).map(x=>({...x,id:`common_${x.id}`}))]:source.checklist;
  const caregiver=snapshot.interviewPerspective==='caregiver';
  if(caregiver)for(const item of checklist)item.question=`From your observations of ${snapshot.name}, what can you tell me about ${item.label.toLowerCase()}? Please include an example and when you first noticed it.`;
  return {...source,version:GUIDE_VERSION,mode,
    name:focused?source.name:mode==='none'?'Everyday functioning review':'Broad interview guide',
    checklist,
    sources:[...new Map([...source.sources,...(focused?GENERAL.sources:[])].map(s=>[s.url,s])).values()],
    perspective:caregiver?'Ask the caregiver for observations and distinguish them from the child’s own account. Seek developmental, school and clinical records where relevant.':snapshot.lifeStage==='Adolescent'?'Adapt language for the young person; distinguish their own account from caregiver information and consider privacy and safeguarding.':'Use the person’s own account; seek other perspectives with consent where helpful.',
    ageNote:`Life stage: ${snapshot.lifeStage}. Confirm exact age and respondent requirements before choosing a standardized measure. These original prompts are not that measure.`,
    hypothesisOptions:[{id:'defer',name:'Defer — more information needed'},...compatibleDisorders(snapshot.lifeStage).filter(x=>x.id!=='none').map(x=>({id:x.id,name:x.name})),{id:'none',name:'No disorder established'}]
  };
}

export function emptyGuideState(){return {items:{},hypothesisId:'defer',alternatives:'',nextStep:'',reviewed:false};}
// Legacy public archives did not carry interaction or private source IDs.
// New social/missing-detail replies are conversation, not case evidence.
export function isEvidenceTurn(turn){
  return turn.kind==='answer'&&(!turn.interaction||turn.interaction==='answer')&&(!Array.isArray(turn.factIds)||turn.factIds.length>0);
}
export function normalizeGuideState(input,guide,turns){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid interview notes.');
  if(!guide.hypothesisOptions.some(x=>x.id===input.hypothesisId))throw new Error('Choose an available provisional impression.');
  const items={};
  if(!input.items||typeof input.items!=='object'||Array.isArray(input.items))throw new Error('Invalid checklist.');
  const allowed=new Set(guide.checklist.map(x=>x.id));
  if(Object.keys(input.items).some(id=>!allowed.has(id)))throw new Error('The checklist belongs to a different interview.');
  for(const item of guide.checklist){
    const entry=Object.hasOwn(input.items,item.id)?input.items[item.id]:{status:'unasked',turnId:'',note:''};
    if(!entry||!STATES.includes(entry.status)||typeof entry.note!=='string'||entry.note.length>1000||typeof entry.turnId!=='string')throw new Error('Invalid checklist evidence.');
    if(entry.turnId&&!turns.some(t=>t.id===entry.turnId&&isEvidenceTurn(t)))throw new Error('Link evidence to an answered turn containing patient history in this interview.');
    items[item.id]={status:entry.status,turnId:entry.turnId,note:entry.note.trim()};
  }
  for(const key of ['alternatives','nextStep'])if(typeof input[key]!=='string'||input[key].length>2000)throw new Error('Keep each reasoning note within 2,000 characters.');
  return {items,hypothesisId:input.hypothesisId,alternatives:input.alternatives.trim(),nextStep:input.nextStep.trim(),reviewed:input.reviewed===true};
}

export function reviewGuide(guide,state,turns,{ended=false,target}={}){
  const unasked=[],unclear=[],unlinked=[],counterEvidence=[];
  for(const item of guide.checklist){
    const e=state.items[item.id]??{status:'unasked'};
    if(e.status==='unasked'){unasked.push(item.label);continue;}
    if(e.status==='uncertain')unclear.push(item.label);
    if(!e.note?.trim()||!turns.some(t=>t.id===e.turnId&&isEvidenceTurn(t)))unlinked.push(item.label);
    if(e.status==='absent'&&item.id.startsWith('focus_'))counterEvidence.push(item.label);
  }
  const gaps=[];
  if(unasked.length)gaps.push(`${unasked.length} checkpoints have not been explored.`);
  if(unclear.length)gaps.push(`${unclear.length} checkpoints remain unclear; record what would clarify them.`);
  if(unlinked.length)gaps.push(`${unlinked.length} entries need both an interview reference and an explanatory note.`);
  if(state.alternatives.length<8)gaps.push('Explain at least one alternative or why ordinary variation fits better.');
  if(state.nextStep.length<8)gaps.push('Describe the next question, collateral record or assessment you need.');
  if(!turns.some(isEvidenceTurn))gaps.push('Obtain the patient or caregiver’s account before evaluating a hypothesis.');
  const hypothesis=guide.hypothesisOptions.find(x=>x.id===state.hypothesisId)?.name??'Defer';
  let comparison=null;
  if(ended&&target){
    comparison={target:target.name,hypothesis,match:state.hypothesisId==='defer'?null:state.hypothesisId===target.id,
      message:state.hypothesisId==='defer'?'You deferred a conclusion. Compare the teaching premise with what was actually established.':state.hypothesisId===target.id?'Your label matches the authored teaching case. This does not establish that diagnostic requirements were demonstrated.':'Your label differs from the authored teaching case. Review both the supporting evidence and remaining uncertainty; the case label is not clinical ground truth.'};
  }
  return {hypothesis,documented:guide.checklist.length-unasked.length,total:guide.checklist.length,
    summary:gaps.length?'Further inquiry or evidence is needed.':'Each checkpoint has evidence recorded. Review its meaning, the course and alternative explanations before drawing a conclusion.',
    gaps,unasked,unclear,unlinked,counterEvidence,comparison,
    limitation:'This checks the structure of your notes, not their clinical correctness. Linked statements can still be misinterpreted. It gives no diagnosis, probability, severity score or safety clearance.'};
}

export function guideWork(guide,state,turns,options={}){
  return {version:GUIDE_VERSION,title:guide.name,checklist:guide.checklist.map(x=>({id:x.id,label:x.label})),state:structuredClone(state),review:reviewGuide(guide,state,turns,options)};
}
