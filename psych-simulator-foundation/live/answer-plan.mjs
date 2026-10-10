// A plan separates questions answered by this record from missing details before
// the AI writes patient speech. These checks establish provenance and coverage,
// not semantic entailment: the independent answer audit is still required.
export const ANSWER_PLAN_VERSION='answer-plan-2.3';
export const ANSWER_PLAN_INSTRUCTION=' Return {"kind":"plan","parts":[...]}, with NO top-level fact_ids. Use 1–4 parts partitioning the whole question into exact copied spans in order; omit no words. Each part is {"request":"exact question span","status":"supported|unrecorded","sources":[{"id":"source ID","quote":"exact source quotation"}]}. Supported means the requested detail is answerable, not that its premise is true. A recorded correction, sequence or explicitly unfinished plan is supported. Sources must establish the answer, not merely the same topic; use 1–4 quotes, retaining negation and qualifiers. input.maxFacts is the disclosure budget. Choose minimum complete bundles; all sources in a part are mandatory. Omit optional background/examples, never necessary sources or qualifiers. Keep usual-activity/current-enjoyment pairs. Preserve every request; later supported parts may be deferred. Never mark known information unrecorded to fit. Unrecorded needs sources:[]; include contextSources:[{"id":"source ID","quote":"exact quotation"}] (at most 2) when relevant recorded context helps explain the gap. Context does NOT answer the missing detail. Use at most 4 distinct source IDs across all parts. Quote complete source sentences exactly. Missing causes, decisions or other people’s views do not establish ignorance, indecision or denial. The app derives routing and citations from these quotes. Boundary kinds omit parts. Never write patient speech.';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const statement=fact=>fact?.statement??fact?.response;
const unique=values=>new Set(values).size===values.length;
const onlyKeys=(value,keys)=>Object.keys(value).every(key=>keys.includes(key));
const gapAllowed=value=>/^[\p{P}\p{Z}\s]*$/u.test(value);
// Preserve omitted connectors or a short introductory frame by attaching the
// original words to the following request. Never fill a missing question clause.
const connectorGap=value=>/^[\p{P}\p{Z}\s]*(?:and|or)[\p{P}\p{Z}\s]*$/iu.test(value);
const introductoryGap=value=>/^\s*(?:for|about|regarding|in relation to)\b[^,:—?;!\r\n]*[,:—]\s*$/iu.test(value)&&! /\b(?:what|why|who|which|how|when|where)\b|\b(?:do|does|did|is|are|was|were|can|could|would|will|should|have|has|had)\s+(?:you|it|that|they|we|he|she)\b/iu.test(value);
const sentenceSegments=new Intl.Segmenter('en',{granularity:'sentence'});
function completeQuotation(text,quote){
  const start=text.indexOf(quote),end=start+quote.length;
  const included=[...sentenceSegments.segment(text)].filter(part=>part.index<end&&part.index+part.segment.length>start);
  return included.map(part=>part.segment).join('').trim();
}
const boundaryKinds=new Set(['social','clarification','out_of_scope','safety_pause']);
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
export class AnswerPlanError extends Error {
  constructor(message){super(`Invalid answer plan: ${message}.`);this.name='AnswerPlanError';this.status=502;}
}
const requireValid=(condition,message)=>{if(!condition)throw new AnswerPlanError(message);};
// Direct answers consume the disclosure allowance before optional context for a
// missing value, even when that missing-value request comes first in the question.
const plannedIds=parts=>[...new Set([
  ...parts.flatMap(part=>part.sources.map(source=>source.id)),
  ...parts.flatMap(part=>part.contextSources.map(source=>source.id))
])];

/**
 * Validate a provider route using complete canonical statements, not catalog
 * labels. Exact spans prevent fabricated quotations and silently dropped words;
 * they cannot prove that a quotation answers its associated question.
 * allowUnplanned is an explicit compatibility seam for legacy test providers.
 */
export function validateAnswerPlan(route,{question,facts=[],allowUnplanned=false}={}){
  requireValid(object(route),'route object required');
  requireValid(text(question)&&question.length<=1500,'question must contain 1–1500 characters');
  if(boundaryKinds.has(route.kind)){
    requireValid(route.parts===undefined||(Array.isArray(route.parts)&&route.parts.length===0),'boundary route cannot carry answer parts');
    return freeze({version:ANSWER_PLAN_VERSION,state:'boundary',question,parts:[],factIds:[]});
  }
  requireValid(['plan','answer','unavailable'].includes(route.kind),'unsupported route kind');
  const derived=route.kind==='plan';
  if(derived)requireValid(!Object.hasOwn(route,'fact_ids'),'plan routes derive IDs locally; do not repeat them');
  if(route.parts===undefined){
    requireValid(allowUnplanned,'parts required for a real provider response');
    requireValid(Array.isArray(route.fact_ids)&&route.fact_ids.length<=4&&unique(route.fact_ids)&&route.fact_ids.every(text),'legacy references');
    const ids=new Set(facts.map(fact=>fact.id));
    requireValid(route.fact_ids.every(id=>ids.has(id)),'legacy references must be canonical');
    return freeze({version:ANSWER_PLAN_VERSION,state:'unplanned',question,parts:[],factIds:[...route.fact_ids],limitation:'Legacy compatibility; request-part coverage and evidence were not planned.'});
  }
  requireValid(Array.isArray(route.parts)&&route.parts.length>=1&&route.parts.length<=4,'one to four parts required');
  requireValid(Array.isArray(facts)&&facts.every(fact=>object(fact)&&text(fact.id)&&text(statement(fact)))&&unique(facts.map(fact=>fact.id)),'unique canonical facts with complete statements required');
  const canonical=new Map(facts.map(fact=>[fact.id,fact]));
  function sources(value,{minimum=0,maximum=4}={}){
    requireValid(Array.isArray(value)&&value.length>=minimum&&value.length<=maximum,'source count');
    const seen=new Set();
    return value.map(source=>{
      requireValid(object(source)&&onlyKeys(source,['id','quote'])&&text(source.id)&&text(source.quote)&&source.quote.length<=1500,'source must contain only an ID and quotation');
      const fact=canonical.get(source.id);
      requireValid(fact&&statement(fact).includes(source.quote),'quotation must exactly occur in its canonical source');
      const key=JSON.stringify([source.id,source.quote]);
      requireValid(!seen.has(key),'duplicate source quotation');seen.add(key);
      return {id:source.id,quote:completeQuotation(statement(fact),source.quote),...(fact.scope?{scope:fact.scope}:{}),...(fact.timeframe?{timeframe:fact.timeframe}:{})};
    });
  }
  let cursor=0;
  const parts=route.parts.map(part=>{
    requireValid(object(part)&&onlyKeys(part,['request','status','sources','contextSources']),'part fields');
    requireValid(text(part.request)&&['supported','unrecorded'].includes(part.status),'part request and status');
    const found=question.indexOf(part.request,cursor),gap=question.slice(cursor,found);
    const framing=found>=cursor&&(connectorGap(gap)||(cursor===0&&introductoryGap(gap)));
    requireValid(found>=cursor&&(gapAllowed(gap)||framing),'request spans must be exact, ordered, nonoverlapping and cover every question word');
    const start=framing?cursor:found,request=question.slice(start,found+part.request.length);
    cursor=found+part.request.length;
    const direct=sources(part.sources,{minimum:part.status==='supported'?1:0,maximum:part.status==='supported'?4:0});
    requireValid(part.status==='unrecorded'||part.contextSources===undefined,'supported parts cannot add separate context');
    const context=sources(part.contextSources??[],{maximum:2});
    return {request,start,end:cursor,status:part.status,sources:direct,contextSources:context};
  });
  requireValid(gapAllowed(question.slice(cursor)),'request parts must cover the final question words');
  const factIds=plannedIds(parts);
  requireValid(factIds.length<=4,'at most four canonical source IDs');
  if(!derived){
    requireValid(Array.isArray(route.fact_ids)&&route.fact_ids.length===factIds.length&&unique(route.fact_ids)&&route.fact_ids.every(id=>factIds.includes(id)),'route IDs must equal the planned evidence IDs');
    requireValid(route.kind===(factIds.length?'answer':'unavailable'),'route kind must agree with available direct or contextual evidence');
  }
  return freeze({version:ANSWER_PLAN_VERSION,state:'planned',kind:factIds.length?'answer':'unavailable',question,parts,factIds});
}

// Lexical anchoring supplies a recorded activity, never a new enjoyment claim.
// No synonym expansion or general stemming: singular/plural spelling is the
// only word transformation, and short/ambiguous s endings are left unchanged.
const interestStopWords=new Set('a an the i me my mine we us our you your he him his she her they them their it its this that these those what which who how when where why do does did is are was were be been being have has had can could would will should still now lately recently today usual usually normal normally familiar ordinary activity activities interest interests hobby hobbies pastime pastimes thing things something anything enjoy enjoys enjoyed enjoying enjoyment like likes liked feel feels felt feeling rewarding enjoyable satisfying much less more very quite little sometimes often always never and or but with without for from into about after before at in on of to as not no so then keep keeps put puts get gets make makes take takes'.split(' '));
const singularWord=word=>word.length>4&&/ies$/.test(word)?word.slice(0,-3)+'y':word.length>4&&/s$/.test(word)&&!/(?:ss|us|is)$/.test(word)?word.slice(0,-1):word;
const activityWords=value=>new Set((value.toLowerCase().match(/\p{L}+/gu)??[]).filter(word=>!interestStopWords.has(word)).map(singularWord));
const interestTopic=fact=>fact.scope==='usual'&&/\b(?:interests?|hobb(?:y|ies)|pastimes?)\b/i.test([fact.label,fact.topic,...(Array.isArray(fact.keywords)?fact.keywords:[])].filter(text).join(' '));
const asksCurrentEnjoyment=request=>/\b(?:enjoy|enjoying|enjoyment|rewarding|enjoyable|satisfying|pleasure|feel|feels|feeling)\b/i.test(request)||(/\bfelt\b/i.test(request)&&/\b(?:now|currently|lately|recently|these days)\b/i.test(request));
function currentGeneralEnjoyment(source){
  if(/^(?:past|wish|preference|usual)$/i.test(source.scope??'')||/before[- ]simulation|\bpast\b/i.test(source.timeframe??''))return false;
  // Intentionally narrow present-tense predicates. A prior experience, future
  // hope or a generic topic label does not supply a current enjoyment claim.
  const subject='(?:(?:my|our|their|his|her)\\s+)?(?:usual|normal|familiar)\\s+(?:activities|interests|hobbies|pastimes)|(?:the\\s+)?(?:activities|things|hobbies|interests|pastimes)\\s+(?:(?:that|which)\\s+)?(?:I|we|he|she|they)\\s+(?:usually|normally)\\s+(?:enjoy|enjoys|like|likes)';
  const predicate='(?:(?:still|now)\\s+)?(?:feel|feels|seem|seems|are|is|have become|has become)\\s+(?:(?:much|far|slightly|less|more|not|very|quite|still|no longer|a little|a bit)\\s+)*(?:rewarding|enjoyable|satisfying)';
  return [...sentenceSegments.segment(source.quote)].some(({segment})=>new RegExp(`^\\s*(?:${subject})\\s+${predicate}[.!?]?\\s*$`,'i').test(segment));
}
const wireParts=parts=>parts.map(part=>({request:part.request,status:part.status,sources:part.sources.map(({id,quote})=>({id,quote})),...(part.status==='unrecorded'?{contextSources:part.contextSources.map(({id,quote})=>({id,quote}))}:{})}));

/**
 * Add an exact usual-interest anchor only to a supported, explicitly current
 * general enjoyment claim whose request names an activity in one unique hobby
 * source. Both sources then become required for that part under disclosure.
 * This is bounded evidence selection, not semantic entailment or a new claim.
 * Call after validation and before disclosure; pass the canonical source pool.
 */
export function anchorUsualInterestSources(plan,{facts=[]}={}){
  requireValid(object(plan)&&plan.version===ANSWER_PLAN_VERSION&&['planned','unplanned','boundary'].includes(plan.state),'validated plan required');
  if(plan.state!=='planned')return plan;
  // Recheck provenance against the supplied pool, including existing context.
  const checked=validateAnswerPlan({kind:'plan',parts:wireParts(plan.parts)},{question:plan.question,facts});
  const parts=checked.parts.map(part=>({...part,sources:part.sources.map(source=>({...source})),contextSources:part.contextSources.map(source=>({...source}))}));
  let changed=false;
  for(let index=0;index<parts.length;index++){
    const part=parts[index];
    if(part.status!=='supported'||part.sources.length>=4||!part.sources.some(currentGeneralEnjoyment)||!asksCurrentEnjoyment(part.request))continue;
    const named=activityWords(part.request);
    const candidates=facts.filter(fact=>interestTopic(fact)&&statement(fact).length<=1500&&[...activityWords(statement(fact))].some(word=>named.has(word)));
    if(candidates.length!==1)continue;
    const anchor=candidates[0],quote=statement(anchor);
    if(part.sources.some(source=>source.id===anchor.id&&source.quote===quote))continue;
    const directIds=new Set(parts.flatMap(item=>item.sources.map(source=>source.id)));directIds.add(anchor.id);
    if(directIds.size>4)continue; // Never discard a supported source to make room.
    part.sources.push({id:anchor.id,quote,...(anchor.scope?{scope:anchor.scope}:{}),...(anchor.timeframe?{timeframe:anchor.timeframe}:{})});
    changed=true;
  }
  if(!changed)return plan;
  const retained=new Set(parts.flatMap(part=>part.sources.map(source=>source.id)));
  // Only optional missing-detail context can yield to the required source pair.
  for(const part of parts)part.contextSources=part.contextSources.filter(source=>{
    if(retained.has(source.id))return true;
    if(retained.size>=4)return false;
    retained.add(source.id);return true;
  });
  return validateAnswerPlan({kind:'plan',parts:wireParts(parts)},{question:plan.question,facts});
}

/**
 * Supply allowedFacts in canonical wording AFTER disclosure restrictions (and
 * brief-opening substitution), BEFORE presentation-only spokenFacts rewrites.
 * A supported request losing any required quote is withheld as a whole. It is
 * never relabeled unrecorded. Unknown question text never enters writerRequests.
 */
export function projectAnswerPlan(plan,{allowedFacts=[],preferredContextIds=[]}={}){
  requireValid(object(plan)&&plan.version===ANSWER_PLAN_VERSION&&['planned','unplanned','boundary'].includes(plan.state),'validated plan required');
  requireValid(Array.isArray(allowedFacts)&&allowedFacts.every(fact=>object(fact)&&text(fact.id)&&text(statement(fact)))&&unique(allowedFacts.map(fact=>fact.id)),'unique allowed canonical facts required');
  const allowed=new Map(allowedFacts.map(fact=>[fact.id,statement(fact)]));
  if(plan.state!=='planned')return freeze({version:ANSWER_PLAN_VERSION,state:plan.state,writerRequests:[],factIds:plan.factIds.filter(id=>allowed.has(id)),unrecordedParts:[],withheldParts:[],exerciseNote:null,requiresWriter:plan.state==='unplanned'&&plan.factIds.some(id=>allowed.has(id)),...(plan.limitation?{limitation:plan.limitation}:{})});
  const writerRequests=[],unrecordedParts=[],withheldParts=[];
  const available=source=>allowed.has(source.id)&&allowed.get(source.id).includes(source.quote);
  for(const part of plan.parts){
    if(part.status==='supported'){
      if(part.sources.every(available))writerRequests.push({kind:'answer',request:part.request,sources:part.sources.map(source=>({...source}))});
      else withheldParts.push({request:part.request,reason:'Supporting evidence is outside this turn’s disclosure.',factIds:[...new Set(part.sources.map(source=>source.id))]});
    }else{
      unrecordedParts.push(part.request);
      // Missing values need one useful anchor, not a recap of nearby topics.
      // Prefer the active reference when the planner included it as context.
      const eligible=part.contextSources.filter(available);
      const context=[...eligible].sort((a,b)=>Number(preferredContextIds.includes(b.id))-Number(preferredContextIds.includes(a.id))).slice(0,1);
      if(context.length)writerRequests.push({kind:'context',request:'Briefly describe this recorded context.',sources:context.map(source=>({...source}))});
      if(eligible.length<part.contextSources.length)withheldParts.push({request:part.request,reason:'Some recorded context is outside this turn’s disclosure.',factIds:[...new Set(part.contextSources.filter(source=>!available(source)).map(source=>source.id))]});
    }
  }
  const factIds=[...new Set([...writerRequests.filter(part=>part.kind==='answer'),...writerRequests.filter(part=>part.kind==='context')].flatMap(part=>part.sources.map(source=>source.id)))];
  const exerciseNote=unrecordedParts.length?`Not recorded for this interview: ${unrecordedParts.map(request=>`“${request}”`).join('; ')}`:null;
  return freeze({version:ANSWER_PLAN_VERSION,state:'planned',writerRequests,factIds,unrecordedParts,withheldParts,exerciseNote,requiresWriter:writerRequests.length>0});
}
