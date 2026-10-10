import {readFile,stat} from 'node:fs/promises';

// Offline-reviewed examples are optional expression demonstrations. They never
// become this patient's evidence, and this module makes no network requests.
export const EXAMPLE_GUIDANCE_VERSION='example-guidance-1';
export const EXAMPLE_GUIDANCE_MAX_BYTES=1600;
export const EXAMPLE_GUIDANCE_INSTRUCTION=' Optional exampleGuidance contains separate fictional demonstrations, not this patient or evidence. Never transfer example facts, wording, names or EX_ source IDs into the current answer. Only current permittedFacts/citedFacts authorize claims. Example style must not override current perspective, personality, uncertainty or timeline.';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const string=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max;
const id=value=>string(value,80)&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
const sourceId=value=>typeof value==='string'&&/^EX_[A-Za-z0-9_-]{1,60}$/.test(value);
const unique=values=>new Set(values).size===values.length;
const timestamp=value=>string(value,40)&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
const requireValid=(condition,message)=>{if(!condition)throw new TypeError(`Invalid example guidance: ${message}.`);};
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
function review(value,pack=false){
  requireValid(object(value)&&string(value.reviewedBy,120)&&timestamp(value.reviewedAt),'review record');
  requireValid(pack?id(value.sourceRunId):value.status==='approved','review approval or source run');
  return {reviewedBy:value.reviewedBy,reviewedAt:value.reviewedAt,...(pack?{sourceRunId:value.sourceRunId}:{status:'approved'})};
}
export function validateExampleGuidancePack(value){
  requireValid(object(value)&&value.schemaVersion===1&&value.status==='approved'&&id(value.id)&&id(value.version),'approved pack header');
  const reviewed=review(value.review,true);
  requireValid(Array.isArray(value.examples)&&value.examples.length>0&&value.examples.length<=100,'example count');
  const examples=value.examples.map(sample=>{
    requireValid(object(sample)&&id(sample.id),'example identity');
    requireValid(['patient','caregiver'].includes(sample.perspective),'speaker perspective');
    requireValid(sample.lifeStage===undefined||string(sample.lifeStage,60),'life stage');
    requireValid(Array.isArray(sample.tags)&&sample.tags.length>0&&sample.tags.length<=12&&sample.tags.every(tag=>string(tag,40))&&unique(sample.tags),'teaching tags');
    requireValid(string(sample.question,400)&&string(sample.reply,400),'question and reply');
    requireValid(Array.isArray(sample.sourceFacts)&&sample.sourceFacts.length>0&&sample.sourceFacts.length<=4&&sample.sourceFacts.every(fact=>object(fact)&&sourceId(fact.id)&&string(fact.statement,400)),'example source facts');
    const ids=sample.sourceFacts.map(fact=>fact.id);
    requireValid(unique(ids)&&Array.isArray(sample.factIds)&&sample.factIds.length>0&&sample.factIds.length<=4&&unique(sample.factIds)&&sample.factIds.every(ref=>ids.includes(ref)),'source references');
    requireValid(object(sample.audit)&&sample.audit.supported===true&&sample.audit.relevant===true&&sample.audit.no_leak===true&&Array.isArray(sample.audit.unsupported)&&sample.audit.unsupported.length===0,'reviewed support result');
    const style=sample.style;
    requireValid(style===undefined||(object(style)&&Object.keys(style).every(key=>['personality','mentalPremise'].includes(key))&&Object.values(style).every(text=>string(text,200))),'expression style');
    return {id:sample.id,tags:[...sample.tags],perspective:sample.perspective,...(sample.lifeStage?{lifeStage:sample.lifeStage}:{}),
      sourceFacts:sample.sourceFacts.map(({id,statement})=>({id,statement})),question:sample.question,reply:sample.reply,factIds:[...sample.factIds],
      ...(style?{style:{...style}}:{}),audit:{unsupported:[],supported:true,relevant:true,no_leak:true},review:review(sample.review)};
  });
  requireValid(unique(examples.map(sample=>sample.id)),'unique example identities');
  return freeze({schemaVersion:1,id:value.id,version:value.version,status:'approved',review:reviewed,examples});
}
export async function loadExampleGuidancePack(path){
  if(typeof path!=='string'||!path.trim())return null;
  try{
    const info=await stat(path);
    if(!info.isFile()||info.size>256000)return null;
    const contents=await readFile(path,'utf8');
    if(Buffer.byteLength(contents,'utf8')>256000)return null;
    return validateExampleGuidancePack(JSON.parse(contents));
  }catch{return null;}
}
const stop=new Set('the and are was were for with that this have has had what when where which who how why you your their they them about does can could would should into from only been do did any all not'.split(' '));
const words=text=>new Set((String(text??'').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)??[]).filter(word=>!stop.has(word)));
const byteLength=value=>Buffer.byteLength(JSON.stringify(value),'utf8');
export function selectExampleGuidance(pack,{role,question,snapshot,topics=[]}={}){
  if(!pack||!['LANGUAGE','AUDITOR'].includes(role))return null;
  // Even dependency-injected candidates must pass the same review/schema gate.
  let approved;try{approved=validateExampleGuidancePack(pack);}catch{return null;}
  const perspective=snapshot?.interviewPerspective??'patient',name=String(snapshot?.name??'').trim().toLowerCase();
  const queryWords=words([question,...topics].join(' '));
  const ranked=approved.examples.filter(sample=>sample.perspective===perspective&&(!sample.lifeStage||sample.lifeStage===snapshot?.lifeStage))
    .filter(sample=>!name||![sample.question,sample.reply,...sample.sourceFacts.map(fact=>fact.statement)].some(text=>words(text).has(name)))
    .map((sample,index)=>({sample,index,score:[...words(sample.tags.join(' '))].filter(word=>queryWords.has(word)).length}))
    .filter(item=>item.score>0).sort((a,b)=>b.score-a.score||a.index-b.index);
  const payload={purpose:'Separate fictional demonstrations; never current patient evidence.',examples:[]},exampleIds=[];
  for(const {sample} of ranked){
    const example=role==='LANGUAGE'?{question:sample.question,sourceFacts:sample.sourceFacts,...(sample.style?{expressionOnly:sample.style}:{}),answer:{reply:sample.reply,fact_ids:sample.factIds}}:
      {question:sample.question,citedFacts:sample.sourceFacts.filter(fact=>sample.factIds.includes(fact.id)),candidate:sample.reply,result:sample.audit};
    const candidate={...payload,examples:[...payload.examples,example]};
    if(byteLength(candidate)>EXAMPLE_GUIDANCE_MAX_BYTES)continue;
    payload.examples.push(example);exampleIds.push(sample.id);
    if(payload.examples.length===2)break;
  }
  return payload.examples.length?{payload,trace:{version:EXAMPLE_GUIDANCE_VERSION,packId:approved.id,packVersion:approved.version,exampleIds,inputBytes:byteLength(payload),extraModelCalls:0}}:null;
}
