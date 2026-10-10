// Conservative repair of a router's missing/unclear classification. This is
// retrieval from the current snapshot, not an independent semantic truth model.
// A keyword match alone never supplies a requested name, cause or time course.
export const QUESTION_RESOLUTION_VERSION='question-resolution-1.3.0';
const normalize=text=>String(text??'').toLowerCase().replace(/[’‘]/g,"'");
const STOP=new Set(('a an the and or but if then that this these those it its itself i me my mine we us our you your yourself he him his she her they them their who whose what which when where why how is are was were be been being do does did done have has had can could would will should may might to of for from in on at by with as into about before after again really just very more much many any some all each every both not no yes thinking think regarding tell say mean part detail thing things something someone person people question answer please describe give example specific concrete earlier history usual usually now current currently lately recent recently today months month days day time times long often own themselves together also other another during getting going make makes made happen happened happens'.split(' ')));
const ROOTS=new Map([
 ['draw','drawing'],['draws','drawing'],['drawn','drawing'],['drawings','drawing'],['drew','drawing'],['picture','drawing'],['pictures','drawing'],['sketch','drawing'],['sketching','drawing'],['sketches','drawing'],
 ['choice','choice'],['choices','choice'],['choose','choice'],['chooses','choice'],['choosing','choice'],['decide','choice'],['deciding','choice'],
 ['helps','help'],['helping','help'],['helped','help'],['assistance','help'],['support','help'],['supports','help'],
 ['wants','want'],['wanted','want'],['prefer','preference'],['prefers','preference'],['preferred','preference'],['preferences','preference'],
 ['planning','plan'],['plans','plan'],['planned','plan'],['tasks','task'],['steps','step'],['shifts','shift'],['commitments','commitment'],
 ['studying','study'],['studies','study'],['books','book'],['songs','song'],['albums','album'],['gardens','garden'],['gardening','garden'],['plants','plant'],
 ['started','start'],['starting','start'],['playlists','playlist'],['organize','sort'],['organise','sort'],['organizing','sort'],['organising','sort'],['sorting','sort'],['sorts','sort'],
 ['hobbies','hobby'],['interests','interest'],['medicines','medicine'],['medication','medicine'],['medications','medicine'],['doses','dose'],
 ['routines','routine'],['thoughts','thought'],['feelings','feeling'],['names','name'],['titles','title']
]);
const tokens=text=>[...new Set((normalize(text).match(/[a-z]+/g)??[]).filter(word=>!STOP.has(word)&&word.length>2).map(word=>ROOTS.get(word)??word))];
const sourceText=fact=>String(fact.statement??fact.response??'');
const indexText=fact=>`${fact.label??''} ${(fact.keywords??[]).join(' ')} ${sourceText(fact)}`;
const unavailable=()=>({kind:'unavailable',fact_ids:[],rule:'The question names a clear topic, but the requested detail is not sufficiently supported by the current patient record.'});
const REFERENCE_WORDS=new Set('feel feeling felt like help want preference happen happening happened event situation issue problem place point idea reason behind message letter last next meant explain explanation refer referring same way repeat repeating approach handle try use change differently different identical alternative once'.split(' '));
const COMPLETION_WORDS=new Set('so already ready yet finish finished complete completed completion done fully finally successfully set built carried put happen happened prepare prepared look see viewing shown show up out together'.split(' '));
const openingQuestion=q=>/\bwhat (?:brings|brought) you (?:here|in)\b/.test(q)||/\bwhy (?:are you here|did you come (?:here|in|today))\b/.test(q)||/\bwhat would you like (?:us )?to (?:talk about|discuss)\b/.test(q);

// Binding a reference is different from answering it. The active source may
// describe an unfinished object or omit its title; restricting retrieval to it
// must not manufacture the missing requested detail from an older similar item.
const REFERENCE_HEAD_WORDS=new Set('is was were are does did do has had have can could would should will may might means mean happen happened happens feel felt feels help helped helps work worked works take took takes look looked looks seem seemed seems the a an same it its this that these those then'.split(' '));
const REFERENT_EQUIVALENTS=new Map([
 ['books','book'],['novel','book'],['novels','book'],['mystery','book'],['mysteries','book'],['memoir','book'],['memoirs','book'],['textbook','book'],['textbooks','book'],
 ['photograph','photo'],['photographs','photo'],['photos','photo'],['movie','film'],['movies','film'],['films','film'],['comics','comic'],
 ['tracks','song'],['track','song'],['songs','song']
]);
const referentWords=text=>new Set(tokens(text).map(word=>REFERENT_EQUIVALENTS.get(word)??word));
const REFERENCE_PREFIX_WORDS=new Set('name title called named mean meaning feel felt feeling feelings look seem help cause caused result outcome end ending start finish written wrote said say'.split(' '));

/**
 * Return a single high-confidence canonical antecedent ID, or null when the
 * question may switch subjects or the source-level reference is ambiguous.
 * The caller may restrict the planning catalog to this source. Do not use this
 * result as proof that its requested property, cause or private view is known.
 * lastFactIds must come from the existing substantive-turn ledger; social turns
 * do not replace that ledger. Recalled IDs are only useful for a named referent.
 */
export function anaphoricSourceIds({question,facts=[],conversation={}}={}){
 if(typeof question!=='string'||!Array.isArray(facts))return null;
 const q=normalize(question).trim();
 if(!q||q.length>300||!/\b(?:it|its|that|this|those|these|then)\b/.test(q))return null;
 // Leave comparisons, multiple questions, changed periods and explicit new
 // subjects to unrestricted routing. An attribute such as "last page" alone
 // is not a switch to a different episode or object.
 if(/\b(?:and|or|versus|unlike|compared?|instead|rather|whereas|between|another|different|other|older|earlier|previous|prior|former|original)\b/.test(q))return null;
 if(/\b(?:switch(?:ing)?|chang(?:e|ing)) (?:the )?(?:topic|subject)\b|\b(?:as for|moving on|going back|back to)\b/.test(q))return null;
 if(/\b(?:day\s*\d+|\d{4}|yesterday|last (?:week|month|year)|before (?:this|the) (?:diary|period|interview))\b/.test(q))return null;
 if(/\b(?:your|my|our)\b/.test(q))return null;
 const firstReference=q.search(/\b(?:it|its|that|this|those|these|then)\b/);
 // An independent named subject before the reference ("Does caffeine affect
 // it?") introduces a relation with another topic, not a simple follow-up.
 if(tokens(q.slice(0,firstReference)).some(word=>!REFERENCE_PREFIX_WORDS.has(word)))return null;
 // A newly named person or title can change the referent. This helper does not
 // try to resolve proper names, quoted titles, or two independently posed asks.
 const body=question.trim().replace(/^\S+\s*/, '');
 if(/\b[A-Z][a-z]+\b|["“”]/.test(body)||/[?]\s*\S/.test(q))return null;
 if(!/^(?:what|which|who|where|when|why|how|is|are|was|were|does|do|did|has|have|had|can|could|would|will|should|tell|describe|so)\b/.test(q))return null;
 const byId=new Map(facts.filter(fact=>fact&&typeof fact.id==='string'&&sourceText(fact).trim()).map(fact=>[fact.id,fact]));
 const active=[...new Set(conversation.lastFactIds??[])].map(id=>byId.get(id)).filter(Boolean);
 const recalled=[...new Set(conversation.recalledFactIds??[])].map(id=>byId.get(id)).filter(Boolean);
 // Named demonstratives ("that object") can select one of multiple prior
 // sources. Pronouns ("its ending") do not name an antecedent and require an
 // already unique active source; their requested attribute need not be known.
 const named=[...q.matchAll(/\b(?:that|this|those|these)\s+([a-z]+)/g)]
   .map(match=>match[1]).filter(word=>!REFERENCE_HEAD_WORDS.has(word));
 if(named.length>1)return null;
 if(named.length===1){
   const head=[...referentWords(named[0])];
   if(head.length!==1)return null;
   const matches=items=>items.filter(fact=>referentWords(indexText(fact)).has(head[0]));
   const current=matches(active);
   if(current.length===1)return [current[0].id];
   if(current.length>1)return null;
   const earlier=matches(recalled);
   return earlier.length===1?[earlier[0].id]:null;
 }
 return active.length===1?[active[0].id]:null;
}

function unfinishedCallback(question,facts,conversation){
 if(!/\b(?:that|this|it|those|these)\b/.test(question)||!/\b(?:ready|finished|complete[ds]?|done|set up|built|happened|carried out|put together|prepared)\b/.test(question))return null;
 const last=new Set(conversation.lastFactIds??[]),topic=tokens(question).filter(word=>!COMPLETION_WORDS.has(word));
 if(!topic.length)return null;
 const matches=facts.filter(fact=>last.has(fact.id)&&fact.scope==='wish').filter(fact=>{
  const source=normalize(sourceText(fact));
  const explicitlyUnfinished=/\b(?:haven't|hasn't|have not|has not|not)\s+(?:\w+\s+){0,3}(?:set\s+(?:\w+\s+){0,2}up|put\s+(?:\w+\s+){0,2}together|finished|completed|carried out|built|drawn|prepared|happened)\b/.test(source);
  if(!explicitlyUnfinished)return false;
  const actual=new Set(tokens(source));
  return topic.filter(word=>actual.has(word)).length/topic.length>=.75;
 });
 // A unique, named last source is enough to correct a completion premise;
 // never merge a finished earlier anecdote with an unfinished later wish.
 return matches.length===1?matches[0]:null;
}

function demand(question){
 const q=normalize(question);
 return {
  reason:/\b(?:why|how come|reason|cause[ds]?)\b/.test(q),
  duration:/\b(?:how long|how many (?:days|weeks|months|years)|since when|when did.+(?:start|begin)|duration)\b/.test(q),
  current:/\b(?:now|currently|today|lately|these days|right now|still|recently)\b/.test(q),
  specific:/\b(?:name|named|title|titled|dose|dosage|milligrams?|mg|address|employer|school name)\b/.test(q),
  preference:/\b(?:want|prefer|would.+like|wish|let .+ (?:decide|choose|try))\b/.test(q),
  interests:/\b(?:hobb(?:y|ies)|interests|free time)\b/.test(q),
  communication:/\b(?:communication|explain|explaining|express|expressing)\b/.test(q)||/\b(?:ask|question|questions)\b.*\b(?:help|prefer|easier|best|one at a time)\b/.test(q),
  opening:openingQuestion(q),
  clinical:/\b(?:symptoms?|low mood|loss of interest|lost interest|sleep|energy|hospital|medicine|medication|dose|panic|anxi\w*|depress\w*|suicid\w*|voices|mood)\b/.test(q)
 };
}

function candidates(question,facts,{inheritedTopic=[]}={}){
 const q=normalize(question),d=demand(q),own=tokens(q),anchors=[...new Set([...own,...inheritedTopic])];
 return facts.flatMap(fact=>{
  const source=normalize(sourceText(fact)),label=normalize(fact.label),index=normalize(indexText(fact));
  if(!source.trim())return [];
  // The timeline of the generated diary is not an illness onset record.
  if(d.duration&&(!/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|several|few)\s+(?:days?|weeks?|months?|years?)\b/.test(source)||/simulated days|not a history from birth/.test(source)))return [];
  if(d.reason&&!d.opening&&!/\b(?:because|reason|why|so that|that's why|that is why|became|started.+(?:with|because))\b/.test(index))return [];
  if(d.current&&(fact.scope==='past'||fact.timeframe==='before-simulation'||['usual','wish','preference'].includes(fact.scope)||/^(?:before (?:this|the) diary|during that past period)\b/.test(source)))return [];
  if(d.clinical&&fact.scope)return [];
  // These exact details require an explicit field/topic, not proximity to the
  // relative, hospital or hobby that the detail belongs to.
  if(d.specific){
   const details=own.filter(x=>['name','title','dose','dosage','address','employer'].includes(x));
   if(details.some(term=>!tokens(label).includes(term)))return [];
  }
  const indexed=new Set(tokens(index)),spoken=new Set(tokens(source));
  const matched=anchors.filter(word=>indexed.has(word));
  const matches=matched.length,coverage=anchors.length?matches/anchors.length:0;
  const hobbyIntent=(d.interests||(/\bwhat do you usually do\b/.test(q)&&anchors.length===1&&spoken.has(anchors[0])))&&/usual interests and hobbies/.test(label)&&!d.reason&&!d.duration&&!d.current&&!d.clinical;
  const communicationIntent=d.communication&&/communication preferences/.test(label)&&!d.reason&&!d.specific;
  const openingIntent=d.opening&&/\bopening\b/.test(label);
  const preferenceIntent=d.preference&&fact.scope==='preference'&&matched.some(word=>!['want','preference','help'].includes(word));
  // Concrete qualifiers must be covered; a list habit does not establish
  // study enrolment or shift work, even when several generic words overlap.
  const concrete=anchors.filter(word=>!['want','preference','help','plan','task','routine','start','list','interest','hobby','practical'].includes(word));
  const concreteCoverage=concrete.length?concrete.filter(word=>indexed.has(word)).length/concrete.length:1;
  if(!hobbyIntent&&!communicationIntent&&!openingIntent&&(!(matches>=2&&coverage>=.6)||concreteCoverage<.75))return [];
  if(d.preference&&!preferenceIntent&&!/\b(?:want|prefer|would like|wish|let|choose)\b/.test(source))return [];
  const score=matches+matched.filter(word=>spoken.has(word)).length+coverage+(preferenceIntent?2:0)+(hobbyIntent||communicationIntent||openingIntent?5:0);
  return [{fact,score}];
 }).sort((a,b)=>b.score-a.score||a.fact.id.localeCompare(b.fact.id));
}

export function isUnresolvedActionReference(question,facts=[],conversation={}){
 const q=normalize(question).trim(),anchors=tokens(q);
 return /\b(?:do|doing|try|handle|repeat|approach|use|change)\s+(?:it|that|this)\b/.test(q)&&anchors.every(word=>REFERENCE_WORDS.has(word))&&!facts.some(f=>conversation.lastFactIds?.includes(f.id));
}
export function resolveQuestionRoute({route,question,facts=[],conversation={}}){
 if(!['clarification','unavailable'].includes(route?.kind))return route;
 const q=normalize(question).trim();
 // Keep unanchored references with the model/context router. This module must
 // not transform "What happened then?" into a new, unrelated diary topic.
 const anchors=tokens(q);
 if(isUnresolvedActionReference(question,facts,conversation))return route.kind==='clarification'?route:{kind:'clarification',fact_ids:[],rule:'The action reference has no earlier substantive source to identify what is being discussed.'};
 const callback=unfinishedCallback(q,facts,conversation);
 if(callback)return {kind:'answer',fact_ids:[callback.id],rule:'Correct the completion premise using the explicit not-yet-completed statement in the last named canonical source; preserve it as a wish and do not merge an earlier completed anecdote.'};
 if(!anchors.length||/^(?:why|why is that|how come|what about (?:that|it|them)|which one|what happened (?:then|next)|how (?:did|does) that (?:feel|work)|how did that make you feel|what (?:do|did) you mean by that)[?!.\s]*$/.test(q))return route;
 if(/\b(?:that|this|it|them|he|him|his|she|her|their)\b/.test(q)&&anchors.every(word=>REFERENCE_WORDS.has(word)))return route;
 if(!/\b(?:what|which|whose|who|when|where|why|how|do|does|did|is|are|was|were|can|could|would|will|have|has|tell|describe)\b/.test(q))return route;
 const selected=candidates(q,facts);
 if(selected.length)return {kind:'answer',fact_ids:[selected[0].fact.id],rule:'Use only the current patient source matching the named topic and requested kind of detail; do not affirm premises absent from that source.'};
 // Independent question clauses may have an answerable part. Share only
 // content words that actually appear in that part's source; never carry the
 // unsupported first clause into an affirmative answer.
 const clauses=q.split(/[,;]?\s+and\s+(?=(?:what|which|whose|who|when|where|why|how|do|does|did|would|could|can|have|has|is|are)\b)/);
 if(clauses.length>1){
  // A second preference question can refer back to a named activity ("when
  // someone helps with your drawing ... what would you want them to do?").
  // Restrict that repair to explicit preference facts sharing the activity.
  const named=tokens(clauses[0]);
  for(const clause of clauses.slice(1)){
   if(!demand(clause).preference)continue;
   const options=facts.filter(f=>f.scope==='preference').flatMap(f=>{
    const activity=named.filter(word=>tokens(indexText(f)).includes(word)&&!['help','want','preference','plan','task'].includes(word));
    return activity.length?candidates(clause,[f],{inheritedTopic:activity}):[];
   }).sort((a,b)=>b.score-a.score);
   if(options.length)return {kind:'answer',fact_ids:[options[0].fact.id],rule:'Answer the recorded preference about the named activity only; the origin or other unsupported part remains unavailable.'};
  }
  for(const clause of clauses){
   const own=candidates(clause,facts);
   if(own.length)return {kind:'answer',fact_ids:[own[0].fact.id],rule:'Answer only the independently supported part of the multipart question. Other requested details are unavailable; do not agree with or explain their premises.'};
  }
 }
 // A named but absent detail is missing information, not unclear wording.
 return unavailable();
}
