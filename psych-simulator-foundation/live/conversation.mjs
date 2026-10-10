// Conversation policy changes expression, not the patient's frozen biography.
// See research/natural-conversation-2026-10-08 for the empirical rationale.
export const CONVERSATION_VERSION='conversation-1.1.0';
const STOP_WORDS=new Set('the and that this what when where how have has had did does can could would you your with from about earlier before again tell please remember said mentioned was were been into then those these them they their'.split(' '));
export function factRelevance(fact,question){
  const words=new Set((question.toLowerCase().match(/[a-z]{3,}/g)??[]).filter(w=>!STOP_WORDS.has(w)));
  const tokens=new Set(`${fact.label} ${fact.response} ${(fact.keywords??[]).join(' ')}`.toLowerCase().match(/[a-z]{3,}/g)??[]);
  const day=/^E\d+$/.test(fact.id)?Number(fact.id.slice(1)):null;
  const requestedDays=[...question.matchAll(/\b(?:day|days)\s*(\d{1,2})\b/gi)].map(m=>Number(m[1]));
  return (day!==null&&requestedDays.includes(day)?1000:0)+[...words].filter(w=>tokens.has(w)).length;
}
export function conversationContext(turns,facts,question=''){
  const allowed=new Set(facts.map(f=>f.id));
  const recent=turns.slice(-6);
  const substantive=turns.filter(t=>t.kind==='answer'&&t.interaction!=='social'&&t.factIds?.some(id=>allowed.has(id)));
  const lastSubstantive=substantive.at(-1);
  // Rebuild from server-owned source IDs, never from generated patient prose.
  // One ID means its source was referenced, not that every clause was spoken.
  const disclosedFactIds=[...new Set(substantive.flatMap(t=>t.factIds).filter(id=>allowed.has(id)))];
  const recalledFactIds=facts.filter(f=>disclosedFactIds.includes(f.id)).map(f=>({id:f.id,score:factRelevance(f,question)}))
    .filter(f=>f.score>0).sort((a,b)=>b.score-a.score).slice(0,6).map(f=>f.id);
  return {version:CONVERSATION_VERSION,turn:turns.length+1,
    lastFactIds:(lastSubstantive?.factIds??[]).filter(id=>allowed.has(id)),
    recentlyUsedFactIds:[...new Set(recent.flatMap(t=>t.factIds??[]))].filter(id=>allowed.has(id)),
    lastQuestion:lastSubstantive?.question?.slice(0,500)??null,
    disclosedFactIds,recalledFactIds,
    rule:'Source IDs remember earlier topics across the whole interview; a referenced source does not mean every detail in it was spoken. Recalled IDs match the current question. Use canonical facts as evidence, never earlier generated prose. Follow the current thread; acknowledgments do not request another summary.'};
}

const canonical=text=>text.toLowerCase().replace(/[’‘]/g,"'").replace(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/g,x=>String(['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'].indexOf(x)));
// Closed, non-factual acknowledgments can be checked locally. More complex social
// replies still require the semantic auditor; this never approves case evidence.
export function localSocialCheck(question,reply){
  const q=canonical(question).trim(),a=canonical(reply).replace(/[.!?,]/g,'').trim();
  const acknowledgment=/^(?:thanks|thank you|you're welcome|you are welcome|okay thanks|ok thanks|okay|ok)$/.test(a);
  const praise=/^(?:that(?:'s| is| sounds)|sounds) (?:cool|nice|sweet|good|great|interesting)[.!\s]*$/.test(q);
  const thanks=/^(?:thanks|thank you)(?: for [^?!]+)?[.!\s]*$/.test(q);
  const space=/^(?:take your time[.!\s]*)?(?:no rush[.!\s]*)?$/.test(q)&&q.length>0;
  if(acknowledgment&&(praise||thanks||space))return true;
  return /^(?:hey|hi|hello)[.!\s]*$/.test(q)&&/^(?:hey|hi|hello)$/.test(a);
}
const SENSITIVE=[
  /\b(?:suicid\w*|kill myself|end my life|hurt myself|self[- ]harm)\b/i,
  /\b(?:medicat\w*|prescri\w*|antidepress\w*|sertraline|fluoxetine|lithium|pills?|tablets?)\b/i,
  /\b(?:alcohol|cannabis|cocaine|heroin|opioids?|nicotine|vaping|drunk|withdrawal)\b/i,
  /\b(?:hallucinat\w*|hearing voices|hear voices|voices in my head)\b/i,
  /\b(?:nothing feels real|things (?:feel|seem) unreal|outside my body|detached from (?:myself|my body))\b/i,
  /\b(?:diagnos\w*|bipolar|schizophren\w*|PTSD|CPTSD|ADHD|autis\w*|OCD|borderline personality|personality disorder)\b/i,
  /\b(?:hospitali[sz]\w*|seizures?|overdos\w*)\b/i
];
// Narrow independent checks for consequential inventions; the semantic auditor
// still checks ordinary paraphrases, negation, relevance and omitted qualifiers.
export function assertGroundedReply(reply,citedFacts,{social=false,speaker='',question=''}={}){
  const evidence=citedFacts.map(f=>f.statement??f.response??'').join(' '),a=canonical(reply),b=canonical(evidence);
  for(const pattern of SENSITIVE)if(pattern.test(reply)&&!pattern.test(evidence))throw new Error('Unsupported clinical claim.');
  // Standalone "one" can be a pronoun ("a particular one"), not a quantity.
  const numbers=[...(reply.match(/\b\d+(?:\.\d+)?\b/g)??[]),...[...a.matchAll(/\b(\d+)\s+(?:days?|weeks?|months?|years?|hours?|times?|siblings?|children|pills?|tablets?)\b/g)].map(m=>m[1])];
  const known=new Set(b.match(/\b\d+(?:\.\d+)?\b/g)??[]);
  if(numbers.some(n=>!known.has(n)))throw new Error('Unsupported number or duration.');
  const durations=a.match(/\b(?:\d+|several|few|many)\s+(?:days?|weeks?|months?|years?|hours?)\b/g)??[];
  if(durations.some(d=>!b.includes(d)))throw new Error('Changed time course.');
  const clinical=citedFacts.some(f=>/^[BEF]\d+$/.test(f.id));
  for(const match of clinical?a.matchAll(/\b(?:every day|all the time|constantly|never|always)\b/g):[]){
    // A correction such as "not every day—most days" rejects the absolute.
    const prefix=a.slice(0,match.index);
    const negated=/\b(?:not|isn't|wasn't|don't|doesn't)\s+(?:quite\s+)?$/.test(prefix);
    if(!negated&&!b.includes(match[0]))throw new Error('Unsupported frequency.');
  }
  const onlyInterests=citedFacts.length>0&&citedFacts.every(f=>/^P0[256]$/.test(f.id));
  if(onlyInterests&&/\b(?:still|now|these days|lately|recently|today)\b/i.test(question)&&/\b(?:enjoy|love|happy|great|relax|feel better|calm)\w*\b/i.test(question)&&/^(?:yes|yeah|yep|it does|it still does|definitely|absolutely)\b/i.test(reply.trim()))throw new Error('Usual interests do not establish current enjoyment.');
  if(onlyInterests&&/\b(?:right now|these days|lately|recently|today)\b/i.test(reply)&&/\b(?:enjoy|love|happy|relax|feel better|calm)\w*\b/i.test(reply)&&!/(?:right now|these days|lately|recently|today)/i.test(evidence))throw new Error('Usual interests do not establish current enjoyment.');
  if(/\b(?:permitted facts|fact[_ ]ids?|authored case|recorded statements|simulation seed|system prompt|agentContext)\b/i.test(reply))throw new Error('Internal wording leaked into patient speech.');
  if(social){
    if(/\b(?:how can i help|let me know if|anything else i can|assist you|happy to help)\b/i.test(reply))throw new Error('Social response adopted an assistant role.');
    // Social turns can greet/acknowledge/repair, but cannot fill in a medical answer.
    if(/\b(?:i (?:am|feel|'m) (?:fine|good|great|okay|ok|better|well|happy|sad|anxious|depressed)|i (?:have|had|take|took|suffer|slept|went|work|live)|i'm (?:fine|good|great|okay|ok|better|well|happy|sad|anxious|depressed))\b/i.test(a))throw new Error('Social response invented a personal state or history.');
    if(/\bi(?:'m|'ve been| am| feel| felt| have been| was)\s+(?:(?:pretty|quite|really|generally|doing)\s+)*(?:fine|good|great|okay|ok|better|well|happy|sad|anxious|depressed)\b/i.test(a)||/\b(?:things|life) (?:are|have been|is|has been) (?:good|fine|okay|great|better)\b/i.test(a))throw new Error('Social response invented a personal state or history.');
    if(reply.length>400)throw new Error('Social reply is too long.');
  }
  return true;
}

export function spokenFacts(facts){
  // Remove presentation scaffolding, while retaining the actual relative day,
  // subjective attribution, event and outcome. Never use the hidden world cause.
  return facts.map(f=>({...f,response:f.response
    .replace(/On simulated day (\d+),\s*/g,'On day $1, ')
    .replace(/My interpretation at the time was:\s*/g,'')
    .replace(/Caregiver account:\s*/g,'')
    .replace(/Over this recorded period/gi,'Over that time')}));
}
