// Exceptional source rendering for a planned, already validated patient draft.
// This does not establish general entailment or replace the normal guards/audit.
// It removes no clauses and invents no connecting text: when needed it renders
// the complete, already-disclosed writer excerpts in their existing order.
export const EVIDENCE_RENDER_VERSION='evidence-render-1.3';
export class EvidenceRenderError extends Error {
 constructor(message){super(`Evidence rendering failed: ${message}.`);this.name='EvidenceRenderError';this.status=502;}
}
const valid=(condition,message)=>{if(!condition)throw new EvidenceRenderError(message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const sentenceSegmenter=new Intl.Segmenter('en',{granularity:'sentence'});
const sentences=text=>[...sentenceSegmenter.segment(text)].map(item=>item.segment.trim()).filter(Boolean);
function normalized(text){
 return text.toLowerCase().replace(/[’‘]/g,"'")
  .replace(/\bcan't\b/g,'cannot').replace(/\bcan not\b/g,'cannot').replace(/\bwon't\b/g,'will not').replace(/\bshan't\b/g,'shall not')
  .replace(/\b(i|you|we|they)'ve\b/g,'$1 have').replace(/\b(you|we|they)'re\b/g,'$1 are').replace(/\bi'm\b/g,'i am')
  .replace(/\b(i|you|he|she|it|we|they)'ll\b/g,'$1 will').replace(/\b(do|does|did|is|are|was|were|has|have|had|could|would|should|must|need|dare)n't\b/g,'$1 not')
  // Ambiguous 's and 'd contractions are deliberately not expanded. Internal
  // punctuation is evidence: quotes bind speaker scope, and numeric hyphens,
  // decimal points, commas and slashes must never collapse to the same tokens.
  // Ignore only terminal sentence punctuation, retaining any closing quotes.
  .replace(/\s+/g,' ').trim().replace(/[.!?]+(?=["'”’»\)\]\}]*$)/u,'');
}
function causalMarkers(sentence){
 const text=sentence.replace(/[’‘]/g,"'");
 const tests=[
  ['because',/\bbecause\b/i],['consequence',/\b(?:therefore|thus|hence|consequently)\b/i],
  ['result',/\b(?:as a result|for that reason|(?:that(?:'s| is)|which is) why)\b/i],
  ['due-to',/\b(?:due to|owing to)\b/i],
  // These are conservative lexical triggers, not a parser or causal proof.
  // Temporal since/as and ordinary uses of make/help can also trigger rendering;
  // only the exact complete-source sentence check below licenses the wording.
  ['since-as',/\b(?:since|as)\b/i],
  ['result-verb',/\bresult(?:s|ed|ing)?\s+(?:in|from)\b/i],
  ['lead-to',/\b(?:lead|leads|led|leading)\s+(?:(?:me|us|you|him|her|them)\s+)?to\b/i],
  ['cause-prompt',/\b(?:cause|causes|caused|causing|prompt|prompts|prompted|prompting)\b/i],
  ['make-help',/\b(?:make|makes|made|making|help|helps|helped|helping)\b/i],
  ['enable-allow',/\b(?:enable|enables|enabled|enabling|allow|allows|allowed|allowing)\b/i],
  ['so',/(?:[,;—–]\s*so\s+(?!much\b|many\b|little\b|few\b|far\b|long\b)|\bso\s+(?:i|we|you|he|she|they|it|this|that|my|our|the|a|an)\b)/i]
 ];
 return tests.filter(([,pattern])=>pattern.test(text)).map(([name])=>name);
}

/**
 * Call only for planned, nonsocial drafts that passed normal output validation.
 * permittedFacts must be the exact writerPermitted excerpts, already checked
 * against canonical sources, scoped by disclosure and formatted by spokenFacts.
 * requiredFactIds are ONLY the disclosed direct-answer plan sources; optional
 * missing-detail context is not mandatory. Missing citations trigger conservative
 * rendering, but citation presence cannot establish semantic answer coverage.
 * Returns null if no change, otherwise {reply,factIds,repair}. The caller must
 * run both its existing factual guards and semantic auditor on the final reply.
 */
export function renderEvidenceIfNeeded({draft,permittedFacts,requiredFactIds=[],maxReplyChars=2000}={}){
 valid(object(draft)&&nonempty(draft.reply),'a validated nonempty draft is required');
 valid(Number.isSafeInteger(maxReplyChars)&&maxReplyChars>=1&&maxReplyChars<=2000,'invalid reply limit');
 valid(Array.isArray(draft.fact_ids)&&draft.fact_ids.length>=1&&draft.fact_ids.length<=4&&new Set(draft.fact_ids).size===draft.fact_ids.length&&draft.fact_ids.every(nonempty),'valid draft evidence IDs required');
 valid(draft.out_of_scope===undefined||draft.out_of_scope===false,'an out-of-scope draft cannot be repaired');
 valid(Array.isArray(permittedFacts)&&permittedFacts.length>=1&&permittedFacts.length<=4&&permittedFacts.every(fact=>object(fact)&&nonempty(fact.id)&&nonempty(fact.statement))&&new Set(permittedFacts.map(fact=>fact.id)).size===permittedFacts.length,'complete unique writer excerpts required');
 valid(draft.fact_ids.every(id=>permittedFacts.some(fact=>fact.id===id)),'draft IDs must belong to the writer excerpts');
 valid(Array.isArray(requiredFactIds)&&requiredFactIds.length<=4&&requiredFactIds.every(nonempty)&&new Set(requiredFactIds).size===requiredFactIds.length,'required direct evidence IDs must be unique and contain at most four IDs');
 valid(requiredFactIds.every(id=>permittedFacts.some(fact=>fact.id===id)),'required direct evidence IDs must belong to the disclosed writer excerpts');
 const missingRequiredFactIds=requiredFactIds.filter(id=>!draft.fact_ids.includes(id));
 const detected=sentences(draft.reply).map(sentence=>({sentence,markers:causalMarkers(sentence)})).filter(item=>item.markers.length);
 const authored=new Set(permittedFacts.flatMap(fact=>sentences(fact.statement).map(normalized)));
 const unlicensed=detected.filter(item=>!authored.has(normalized(item.sentence)));
 if(!unlicensed.length&&!missingRequiredFactIds.length)return null;
 const triggers=[...(unlicensed.length?['unverified-causal-link']:[]),...(missingRequiredFactIds.length?['omitted-direct-source']:[])];
 const reason=[...(unlicensed.length?['A sentence with a possible explanatory link was not an exact normalized authored source sentence.']:[]),...(missingRequiredFactIds.length?['The draft omitted required direct-plan source IDs.']:[])].join(' ');
 const excerpts=permittedFacts.map(fact=>({id:fact.id,statement:fact.statement,...(fact.scope?{scope:fact.scope}:{}),...(fact.timeframe?{timeframe:fact.timeframe}:{})}));
 // Paragraph separation adds no causal or temporal connective, and remains
 // well formed even when an authored brief statement has no final full stop.
 const reply=excerpts.map(fact=>fact.statement.trim()).join('\n\n');
 valid(reply.trim().length>0,'no complete excerpt is available');
 valid(reply.length<=maxReplyChars,'complete excerpt assembly exceeds the reply limit; nothing was truncated');
 return {reply,factIds:excerpts.map(fact=>fact.id),repair:{version:EVIDENCE_RENDER_VERSION,method:'complete-source-excerpts',reason,triggers,requiredFactIds:[...requiredFactIds],missingRequiredFactIds,
  rawDraft:structuredClone(draft),unlicensedCausalSentences:unlicensed.map(item=>({...item,markers:[...item.markers]})),sourceExcerpts:excerpts,quoteAssembly:reply,
  limitation:'Conservative fallback can replace legitimate paraphrases or complete answers with omitted citations. Temporal since/as and ordinary make/help uses can also trigger it. Lexical triggers and citation coverage do not prove causality, factual support, semantic coverage or relevance; ordinary factual guards and the semantic audit are still required.',extraModelCalls:0}};
}
