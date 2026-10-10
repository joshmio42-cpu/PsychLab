// Precision backstops for observed embellishments, not a general entailment test.
// Keep the semantic auditor: this bounded vocabulary cannot recognize every new
// object, relation, negation error, cause, name, or temporal implication.
export const FACTUAL_SUPPORT_VERSION='factual-support-1.3.2';
const norm=text=>String(text??'').toLowerCase().replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim();
const textOf=fact=>fact.statement??fact.response??'';
const any=(patterns,text)=>patterns.some(pattern=>pattern.test(text));

// These are meaning families, so natural synonyms do not require exact wording.
// The last three expressions are deliberately specific to additional motives
// observed in live replies; mere topic overlap is not support for them.
const EXTRA_CLAIMS=[
 {code:'added-enjoyment',patterns:[/\b(?:fun|enjoyable|exciting|excited|delightful|entertaining|amusing|pleasurable)\b/],support:[/\b(?:fun|enjoy\w*|exciti\w*|excited|delight\w*|entertain\w*|amus\w*|pleasur\w*|rewarding)\b/]},
 {code:'added-interest',patterns:[/\b(?:interesting|fascinating|intriguing|curious|curiosity|interested)\b/],support:[/\b(?:interest\w*|fascinat\w*|intrigu\w*|curious|curiosity)\b/]},
 {code:'added-soothing-effect',patterns:[/\b(?:relax\w*|sooth\w*|calms? me|calming|peaceful|peace of mind|feel (?:more )?at peace|clear(?:s|ing)? my (?:head|mind))\b/],support:[/\b(?:relax\w*|sooth\w*|calm\w*|peace\w*|clear(?:s|ing)? my (?:head|mind))\b/]},
 {code:'added-distraction-effect',patterns:[/\b(?:distract\w*|takes? my mind off|escape from my|forget (?:about )?my (?:worries|problems))\b/],support:[/\b(?:distract\w*|takes? my mind off|escape from my|forget (?:about )?my (?:worries|problems))\b/]},
 {code:'added-motivation',patterns:[/\b(?:motivat\w*|lack (?:of )?drive|no drive|can't be bothered|cannot be bothered|don't feel like (?:doing|starting|trying))\b/],support:[/\b(?:motivat\w*|lack (?:of )?drive|no drive|can't be bothered|cannot be bothered|don't feel like (?:doing|starting|trying))\b/]},
 {code:'added-narrative-meaning',patterns:[/\b(?:tells? (?:me )?a story|tell stories|storytelling|narrative|deeper meaning|emotional journey)\b/],support:[/\b(?:stor(?:y|ies)|storytelling|narrative|deeper meaning|emotional journey)\b/]},
 {code:'added-shape-motive',patterns:[/\b(?:interesting|fascinating|intriguing|appealing) (?:shapes?|forms?|outlines?)\b/],support:[/\b(?:interesting|fascinating|intriguing|appealing) (?:shapes?|forms?|outlines?)\b/,/\b(?:shapes?|forms?|outlines?)\s+(?:(?:are|were|was|look|seem|feel|felt)\s+)?(?:interesting|fascinating|intriguing|appealing)\b/]},
 {code:'added-safety-effect',patterns:[/\b(?:feel(?:s|ing)? (?:more )?(?:safe|secure)|gives? me (?:a sense of )?security)\b/],support:[/\b(?:feel(?:s|ing)? (?:more )?(?:safe|secure)|gives? me (?:a sense of )?security)\b/]},
 {code:'added-coping-efficacy',patterns:[/\b(?:keeps?|makes?|helps?|lets?|allows?|enables?)\b[^.!?;]{0,50}\b(?:manageable|easier|organized|organised|cope|coping|manage|on top of things)\b/,/\b(?:that way|so)\s+i\s+(?:can\s+)?(?:stay|keep)\s+on top of things\b/],support:[/\b(?:keeps?|makes?|helps?|lets?|allows?|enables?)\b[^.!?;]{0,50}\b(?:manageable|easier|organized|organised|cope|coping|manage|on top of things)\b/,/\b(?:is|are|feels?)\s+(?:much\s+)?easier\s+to\s+(?:plan|organize|organise|manage|handle|do)\b/]}
];
const RECENT=/\b(?:today|yesterday|last night|this morning|this afternoon|this evening|this week|recently|lately|these days|during (?:this|the) (?:diary|simulation))\b/g;
const OBSERVED_ACTION=/\b(?:i|we|they|he|she)(?:'ve|'d|'s)?\s+(?:(?:have|has|had)\s+)?(?:(?:recently|lately|already|just)\s+)?(?:made|created|finished|completed|arranged|picked|chosen|bought|visited|drew|sketched|listened|compared|read|put|wrote|watched|played)\b/;
const WISH_ACTION=/\b(?:(?:i|we|they|he|she)(?:'ve|'s| have| has| had)?\s+(?:already\s+)?|already\s+)(?:made|created|finished|completed|arranged|picked|chosen|bought|visited|drew|sketched|listened|compared|read|put|wrote|watched|played)\b/;
const INTENTION=/\b(?:would|could|might|want|wish|hope|plan|intend|like to|haven't|hasn't|hadn't|not yet|not (?:made|done|finished|chosen|picked))\b/;
const NEGATED_TIME=/\b(?:not|wasn't|isn't|didn't|hasn't|haven't|rather than|instead of)\s+(?:just\s+)?$/;
const HEALTH_TOPIC=/\b(?:overwhelm\w*|stress\w*|getting on top of you|mood|depress\w*|anxious|anxiety|panic|hopeless|sleep|sleeping|energy|tired|exhaust\w*|appetite|symptoms?|suicid\w*|self[- ]harm|feel(?:ing)? (?:good|fine|okay|well|better|worse))\b/;
const CURRENT_QUESTION=/\b(?:now|today|these days|lately|recently|at all|still|currently)\b|^(?:have|has|are|is|do|does)\b/;
const HABIT_METHOD_QUESTION=/\b(?:usually|generally|typically)\s+(?:do|use|start|approach|write|plan|organize|organise|handle)\b/;
const HEALTH_SHORT_ANSWER=/^(?:(?:well|honestly|actually)[,\s]+)?(?:not really|not at all|not much|not particularly|no|nope|yes|yeah|yep|definitely|absolutely)\b/;
const HEALTH_DIRECT_ANSWER=/\b(?:i(?:'m| am| feel)\s+(?:(?:not|very|really)\s+)?(?:fine|okay|ok|well|better|worse|stressed|overwhelmed|anxious|depressed|tired|exhausted)|i (?:don't|do not)\s+(?:feel\s+)?(?:stressed|overwhelmed|anxious|depressed)|i (?:have|haven't had|don't have)\s+(?:no\s+)?(?:symptoms|trouble sleeping|sleep problems))\b/;
const CHRONOLOGY=[
 {pattern:/\b(?:the )?(?:next day|following day|day after(?:ward)?s?)\b/g,support:/\b(?:next day|following day|day after(?:ward)?s?)\b/},
 {pattern:/\b(?:the )?(?:next morning|following morning)\b/g,support:/\b(?:next morning|following morning)\b/}
];
const CONTENT_STOP=new Set('about after before could would should things thing first second there their other another ordinary earlier usual really right which while place still start started doing later during around'.split(' '));
const tokens=text=>new Set((norm(text).match(/[a-z]{4,}/g)??[]).filter(w=>!CONTENT_STOP.has(w)));
const clauses=text=>text.split(/(?<=[.!?;])\s+|\s+but\s+|\s+whereas\s+/i);

// These checks deliberately operate on propositions, not a bag containing every
// cited word. A preference for thoughtful questions does not assert a thoughtful
// personality; "usually" in a sleep fact cannot strengthen occasional painting.
// This is still a bounded English backstop. The semantic auditor must check
// predicates, actors and implications outside these lexical families.
const TRAIT_FAMILIES=[
 'thoughtful|reflective|introspective', 'low[- ]key|easygoing|easy-going|laid[- ]back',
 'quiet|reserved|introverted', 'outgoing|extroverted|sociable',
 'organized|organised|methodical', 'kind|caring|considerate|compassionate',
 'reliable|dependable', 'independent|self-reliant', 'creative|artistic',
 'curious|inquisitive', 'patient|even-tempered', 'shy|timid', 'direct|blunt'
];
const TRAIT_MODIFIERS='(?:(?:a|an|very|really|pretty|quite|rather|fairly|kind of|sort of|usually|generally|typically|always|mostly|naturally|not|particularly|especially)\\s+)*';
const TRAIT_HEAD="\\bi(?:'m| am| tend to be| consider myself| see myself as| would describe myself as|'d describe myself as|'d call myself|(?:'ve| have) (?:always |usually )?been)\\s+";
const LOCAL_TRAIT_CONTEXT=/\b(?:today|right now|at the moment|this (?:morning|afternoon|evening)|when|while|during|with|about|at|in)\b/;
const traitClaims=text=>TRAIT_FAMILIES.flatMap((family,index)=>{
 const pattern=new RegExp(`${TRAIT_HEAD}${TRAIT_MODIFIERS}(${family})\\b`,'g');
 return [...text.matchAll(pattern)].filter(match=>{
  // Denying a logical inference is not asserting the trait or its opposite.
  // Keep this clause-local so a later independent assertion still needs facts.
  const prefix=text.slice(0,match.index).split(/[.!?;,]/).at(-1);
  if(/\b(?:doesn't|does not|didn't|did not|wouldn't|would not|cannot|can't)\s+(?:necessarily\s+)?(?:mean|prove|establish|imply)\s+(?:that\s+)?$/.test(prefix))return false;
  const suffix=text.slice(match.index+match[0].length);
  // "Kind of unsure" and the healthcare role "a patient" are not traits.
  return !(match[1]==='kind'&&/^\s+of\b/.test(suffix))&&!(match[1]==='patient'&&/\b(?:a|an) patient$/.test(match[0])&&!/^\s+(?:person|type)\b/.test(suffix));
 }).map(match=>{
  const context=text.slice(match.index+match[0].length).split(/[.!?;,]/)[0];
  return {family:index,negative:/\bnot\b/.test(match[0]),span:match[0],context,
   // A context-bound observation cannot establish a general character trait.
   bounded:LOCAL_TRAIT_CONTEXT.test(context)};
 });
});
const claimClauses=text=>clauses(norm(text)).flatMap(part=>part.split(/,?\s+and\s+(?=(?:i|we|they|he|she|it)(?:\b|')|(?:sometimes|occasionally|usually|often|always)\b)/));
const CLAIM_STOP=new Set(('a an the i me my mine we us our you your he she they them their it its is am are be been being have has had do does did on in of to for from by with as at and or so if when then than that this these those can could would should will just also before after earlier once usual usually generally typically often sometimes occasionally always mostly every all time day days most now not no want wants prefer prefers like likes enjoy enjoys love loves thing things really pretty much someone person start started').split(' '));
const WORD_FAMILIES=[
 /^(?:draw|draws|drawing|drawings|drew|drawn|sketch|sketches|sketching|sketched|picture|pictures)$/,
 /^(?:idea|ideas|suggest|suggests|suggesting|suggested|suggestion|suggestions)$/,
 /^(?:plan|plans|planning|planned)$/,
 /^(?:song|songs|track|tracks)$/,
 /^(?:choose|chooses|choosing|chose|chosen|choice|choices|pick|picks|picking|picked)$/,
 /^(?:talk|talks|talking|talked|chat|chats|chatting|chatted)$/,
 /^(?:write|writes|writing|wrote|written)$/,
 /^(?:help|helps|helping|helped|assistance)$/,
 /^(?:change|changes|changing|changed)$/
];
function claimTokens(text){
 return new Set((text.match(/[a-z]+/g)??[]).filter(w=>w.length>2&&!CLAIM_STOP.has(w)).map(word=>{
  const family=WORD_FAMILIES.findIndex(pattern=>pattern.test(word));
  return family>=0?`family${family}`:word.replace(/(?:ing|ed|s)$/,'');
 }));
}
function relatedClaims(clause,units){
 const wanted=claimTokens(clause);
 const scored=units.map(unit=>({unit,score:[...wanted].filter(word=>unit.words.has(word)).length}));
 const maximum=Math.max(0,...scored.map(x=>x.score));
 // Choosing the closest proposition keeps a specific earlier detail separate
 // from a broad usual hobby, while avoiding a catch-all lexical entailment test.
 return maximum?scored.filter(x=>x.score===maximum).map(x=>x.unit):[];
}
const NEGATIVE_EFFECT=/\b(doesn't|does not|didn't|did not|don't|do not|hasn't|has not|haven't|have not|can't|cannot|couldn't|could not|won't|will not)\s+(?:really\s+|necessarily\s+)?(help(?:ed)?|stop(?:ped)?|reduc(?:e|ed)|eas(?:e|ed)|reliev(?:e|ed)|prevent(?:ed)?|improv(?:e|ed)|chang(?:e|ed)|fix(?:ed)?|resolv(?:e|ed))\b/g;
const EFFECT_TARGET=/\b(?:worr\w*|anxi\w*|panic|stress\w*|distress\w*|mood|depress\w*|sleep\w*|tired\w*|fatigue|energy|concentrat\w*|pain|headaches?|symptoms?|cope|coping)\b/;
const effectFamily=verb=>/^(?:reduce|reduced|ease|eased|relieve|relieved)$/.test(verb)?'alleviate':['help','stop','prevent','improv','chang','fix','resolv'].find(root=>verb.startsWith(root));
const ACTION_WRAPPERS=/\b(?:use|uses|using|used|keep|keeps|keeping|kept|take|takes|taking|took|tried|try|trying|slow|slowly|quiet|quietly|gentle|gently|regular|regularly|usual|usually|daily)\b/g;
function negativeEffects(text,{scope}={}){
 const parts=claimClauses(text),effects=[];
 for(let index=0;index<parts.length;index++){
  const clause=parts[index];
  for(const match of clause.matchAll(NEGATIVE_EFFECT)){
   let action=clause.slice(0,match.index).trim();
   const outcome=clause.slice(match.index+match[0].length);
   // Negating evidence ("doesn't establish/prove recovery") is not negating
   // efficacy. A bare person's "I don't stop" is an action, not a coping result.
   if(!EFFECT_TARGET.test(outcome))continue;
   if(/^(?:it|that|this)$/.test(action))action=parts[index-1]??'';
   const actionWords=claimTokens(action.replace(ACTION_WRAPPERS,''));
   const outcomeWords=claimTokens([...outcome.matchAll(new RegExp(EFFECT_TARGET.source,'g'))].map(item=>item[0]).join(' '));
   if(!actionWords.size)continue;
   effects.push({span:clause,action:actionWords,outcome:outcomeWords,effect:effectFamily(match[2]),past:scope==='past'||/^(?:did|could)/.test(match[1])});
  }
 }
 return effects;
}
function negativeEffectIssues(candidate,citedFacts){
 const evidence=citedFacts.flatMap(fact=>negativeEffects(textOf(fact),fact));
 const overlaps=(left,right)=>[...left].some(word=>right.has(word));
 return negativeEffects(candidate).filter(claim=>!evidence.some(source=>
  source.effect===claim.effect&&(!source.past||claim.past)&&overlaps(source.action,claim.action)&&overlaps(source.outcome,claim.outcome)
 )).map(claim=>({code:'unsupported-negative-coping-effect',span:claim.span}));
}
const FREQUENCIES=[
 {rank:4,pattern:/\b(?:always|constantly|all the time|without fail|every (?:day|time|night))\b/g},
 {rank:3,pattern:/\b(?:usually|generally|typically|normally|most (?:days|times)|as a rule)\b/g},
 {rank:2,pattern:/\b(?:often|frequently|regularly)\b/g},
 {rank:1,pattern:/\b(?:sometimes|occasionally|at times|now and then|every now and then)\b/g}
];
function frequencyClaims(text){
 return FREQUENCIES.flatMap(({rank,pattern})=>[...text.matchAll(pattern)].filter(match=>{
  const prefix=text.slice(0,match.index);
  return !/\b(?:not|isn't|aren't|don't|doesn't|never|cannot say|can't say|wouldn't say)\s+(?:necessarily\s+|quite\s+)?$/.test(prefix)&&
    !/\b(?:isn't|aren't|is not|are not)\s+(?:just\s+|only\s+)?(?:my|your|his|her|their|our)\s+(?:[a-z'-]+\s+){1,4}$/.test(prefix);
 }).map(match=>({rank,span:match[0]})));
}
const PREFERENCE_CLAIM=/\bi\s+(?:like|enjoy|love|prefer)\s+|\b(?:my|our)\s+(?:preference|favorite|favourite)\b/;
const MODAL_PREFERENCE=/\b(?:prefer|prefers|want|wants|wish|wishes|hope|hopes|would|could|might)\b|\b(?:i|we|they|he|she)'d\b/;
const POTENTIAL_OR_PAST=/\b(?:would|could|might|used to|once)\b|\b(?:i|we|they|he|she)'d\b/;
const ROUTINE_ACTION=/\b(?:i|we|they|he|she)\s+(?:(?:usually|generally|typically|often|always|just)\s+)?(?:use|keep|offer|show|take|ask|choose|check|put|write|make|go|draw|paint|cook|read|listen|pick|share|send|give|tell|bring|start|visit)\b/;
function propositionIssues(candidate,citedFacts){
 const issues=[];
 const units=citedFacts.flatMap(fact=>claimClauses(textOf(fact)).map(text=>({text,fact,words:claimTokens(text)})));
 const traits=units.flatMap(unit=>traitClaims(unit.text));
 for(const trait of traitClaims(candidate)){
  if(!traits.some(source=>source.family===trait.family&&source.negative===trait.negative&&(!source.bounded||(trait.bounded&&norm(source.context)===norm(trait.context)))))issues.push({code:'unsupported-personality-trait',span:trait.span});
 }
 for(const clause of claimClauses(candidate)){
  const associated=relatedClaims(clause,units);
  if(!associated.length||associated.some(unit=>unit.text.includes(clause)))continue;
  const sourceFrequency=unit=>{
   const explicit=frequencyClaims(unit.text);
   // An explicit qualifier takes precedence over usual-scope metadata.
   return explicit.length?Math.max(...explicit.map(x=>x.rank)):unit.fact.scope==='usual'&&!MODAL_PREFERENCE.test(unit.text)?3:0;
  };
  for(const frequency of frequencyClaims(clause)){
   if(frequency.rank<=1)continue;
   if(associated.every(unit=>sourceFrequency(unit)<frequency.rank)&&associated.some(unit=>frequencyClaims(unit.text).length||['past','preference','wish'].includes(unit.fact.scope)))issues.push({code:'inflated-frequency',span:frequency.span});
  }
  if(PREFERENCE_CLAIM.test(clause)&&!POTENTIAL_OR_PAST.test(clause)&&associated.every(unit=>unit.fact.scope==='past'||unit.fact.scope==='wish'))issues.push({code:'event-as-general-preference',span:clause});
  if(ROUTINE_ACTION.test(clause)&&!MODAL_PREFERENCE.test(clause)&&associated.every(unit=>['preference','wish'].includes(unit.fact.scope)&&MODAL_PREFERENCE.test(unit.text)))issues.push({code:'preference-as-established-routine',span:clause});
 }
 return issues;
}

function namedAdditions(reply,evidence,knownNames){
 const issues=[];
 const known=norm(`${evidence} ${knownNames.join(' ')}`);
 const names=[
  /\b(?:[Mm]y|[Oo]ur|[Tt]heir|[Hh]is|[Hh]er|[Tt]he)\s+(?:cousin|friend|sibling|sister|brother|mother|father|mom|mum|dad|parent|caregiver|neighbor|neighbour|teacher|therapist|doctor)\s+(?:(?:is\s+)?(?:named|called)\s+)?([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+)?)/gu,
  /\b(?:[Nn]ame is|[Nn]amed|[Cc]alled|[Tt]itled)\s+["“]?([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+){0,3})/gu,
  /\b([\p{Lu}][\p{L}'’-]+(?:\s+[\p{Lu}][\p{L}'’-]+)?)\s+is\s+(?:my|our)\s+(?:cousin|friend|sibling|sister|brother|mother|father|parent|caregiver|neighbor|neighbour|teacher|therapist|doctor)\b/gu
 ];
 for(const pattern of names)for(const match of reply.matchAll(pattern)){
  const name=norm(match[1]);
  if(!known.includes(name))issues.push({code:'unsupported-name',span:match[1]});
 }
 return issues;
}

export function factualSupportIssues(reply,citedFacts,{speaker='',patientName='',question=''}={}){
 const sourceTexts=citedFacts.map(textOf),evidence=sourceTexts.join(' '),candidate=norm(reply),known=norm(evidence);
 const issues=[...namedAdditions(reply,evidence,[speaker,patientName].filter(Boolean)),...propositionIssues(candidate,citedFacts),...negativeEffectIssues(candidate,citedFacts)];
 const onlyUsualHobbies=citedFacts.length>0&&citedFacts.every(f=>/^P0[25]$/.test(f.id)&&(!f.scope||f.scope==='usual'));
 for(const rule of EXTRA_CLAIMS){
  for(const pattern of rule.patterns)for(const match of candidate.matchAll(new RegExp(pattern.source,pattern.flags.includes('g')?pattern.flags:pattern.flags+'g'))){
   // "What I do for fun" is an idiomatic hobby category, not a new claim that
   // a specific interaction felt enjoyable. Other occurrences still need support.
   if(rule.code==='added-enjoyment'&&match[0]==='fun'&&onlyUsualHobbies&&/\bfor\s+$/.test(candidate.slice(0,match.index)))continue;
   if(!any(rule.support,known))issues.push({code:rule.code,span:match[0]});
  }
 }
 const personal=citedFacts.filter(f=>/^P\d+$/.test(f.id));
 const earlier=personal.filter(f=>f.timeframe==='before-simulation'||f.scope==='past');
 const onlyPersonal=personal.length>0&&personal.length===citedFacts.length;
 const onlyWishes=onlyPersonal&&personal.every(f=>f.scope==='wish');
 const countsOnly=citedFacts.length>0&&citedFacts.every(f=>f.id==='G04');
 if(countsOnly){
  const implication=/\b(?:struggl\w*|trouble|overwhelm\w*|stress\w*|difficult\w*|had to|needed to|(?:wasn't|weren't|not) able to)\b/g;
  for(const match of candidate.matchAll(implication))if(!known.includes(match[0]))issues.push({code:'outcomes-as-distress-or-necessity',span:match[0]});
 }
 const onlyBackground=onlyPersonal&&personal.every(f=>['usual','wish','preference','past'].includes(f.scope)||(!f.scope&&/^P\d+$/.test(f.id)));
 const asked=norm(question);
 // A usual strategy or a preference is not evidence of present health or its
 // absence. This is a bounded question/answer-form check, not symptom diagnosis.
 if(onlyBackground&&HEALTH_TOPIC.test(asked)&&CURRENT_QUESTION.test(asked)&&(!HABIT_METHOD_QUESTION.test(asked)||HEALTH_DIRECT_ANSWER.test(candidate))&&(HEALTH_SHORT_ANSWER.test(candidate)||HEALTH_DIRECT_ANSWER.test(candidate)))issues.push({code:'background-as-current-health-answer',span:candidate.split(/[.!?]/)[0]});
 for(const marker of CHRONOLOGY)for(const match of candidate.matchAll(marker.pattern)){
  if(!marker.support.test(known)&&!NEGATED_TIME.test(candidate.slice(0,match.index)))issues.push({code:'invented-relative-chronology',span:match[0]});
 }
 for(const clause of clauses(candidate)){
  const timeMatches=[...clause.matchAll(RECENT)].filter(m=>!NEGATED_TIME.test(clause.slice(0,m.index)));
  if(timeMatches.length&&OBSERVED_ACTION.test(clause)){
   const unsupported=timeMatches.filter(m=>!known.includes(m[0]));
   if(unsupported.length&&onlyPersonal)issues.push({code:'background-recast-as-recent-event',span:unsupported[0][0]});
   else if(unsupported.length&&earlier.length){
    // A clinical source alongside a personal memory cannot move that memory
    // into the present. Check words unique to the earlier personal source.
    const otherTokens=tokens(citedFacts.filter(f=>!earlier.includes(f)).map(textOf).join(' '));
    const replyTokens=tokens(clause);
    if(earlier.some(f=>[...tokens(textOf(f))].filter(w=>!otherTokens.has(w)).some(w=>replyTokens.has(w))))issues.push({code:'earlier-memory-recast-as-recent',span:unsupported[0][0]});
   }
  }
  if(onlyWishes&&WISH_ACTION.test(clause)&&!INTENTION.test(clause))issues.push({code:'wish-recast-as-completed-event',span:clause});
 }
 return [...new Map(issues.map(x=>[`${x.code}:${x.span}`,x])).values()];
}

export function assertFactualSupport(reply,citedFacts,options={}){
 const issues=factualSupportIssues(reply,citedFacts,options);
 if(issues.length){const error=new Error(`Unsupported factual detail (${issues[0].code}).`);error.name='FactualSupportError';error.issues=issues;throw error;}
 return true;
}
