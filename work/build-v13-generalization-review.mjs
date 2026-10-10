import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {simulateHistory} from '../psych-simulator-foundation/live/engine.mjs';

const runs=new URL('../psych-simulator-foundation/adaption/runs/',import.meta.url);
const evaluationFile='grounding-v13-generalization-candidate.json';
const bytes=await readFile(new URL(evaluationFile,runs));
const evaluation=JSON.parse(bytes);
const matrixBytes=await readFile(new URL('../psych-simulator-foundation/adaption/data/grounding-generalization-evaluation.json',import.meta.url));
const matrix=JSON.parse(matrixBytes);
const previous=JSON.parse(await readFile(new URL('grounding-v12-review-generalization.json',runs)));
const hash=value=>createHash('sha256').update(value).digest('hex');
const invariant=(truth,message)=>{if(!truth)throw new Error(message);};
invariant(evaluation.status==='complete'&&evaluation.records.length===16,'Incomplete evaluation');
invariant(hash(matrixBytes)===evaluation.matrixHash,'Matrix differs from evaluation');
const manual=new Map();
const put=(index,data)=>manual.set(matrix.cases[index].id,data);
put(0,{
 quality:3,
 claims:[['The caregiver prefers to share observations one at a time.',['P03']],['The caregiver cannot directly know what Mika is thinking.',['P03']]],
 expected:['The preference is attributed to the caregiver, while Mika\'s thoughts remain inaccessible.','The answer substitutes the recorded caregiver preference for the proposed overwhelm inference; it does not confirm that Mika feels overwhelmed.','The first-person speaker is the caregiver, and the private-thought limitation is explicit.'],
 forbidden:['No overwhelm, processing difficulty or child communication need is asserted.','No opposite claim about calmness or never being overwhelmed is made.','The stated preference is P03; no diagnosis, training history or unrecorded motive is introduced.'],
 notes:['A direct supported explanation improves on the prior generic boundary without claiming to know the child\'s emotional state.']
});
put(2,{
 quality:2,
 claims:[['The caregiver added the window before the recorded coloring around it.',['P08']]],
 expected:['The window referent is resolved and the recorded coloring around it is placed afterward.','This remains the earlier drawing event with the caregiver adding the window; it does not claim the caregiver drew the house.','Two short sentences answer the sequence directly; the repeated order is slightly redundant but the known answer is not withheld.'],
 forbidden:['The window-then-coloring order is preserved and no whole-house authorship is claimed.','The negative is limited to starting the recorded coloring around that window; it does not assert that Leo had never colored anything earlier.','No color, owner, date, repeated routine or feeling is added.'],
 notes:['The first sentence is scoped to coloring around the added window, so it does not make the prohibited global claim about all earlier coloring. The second sentence repeats the same information, keeping quality at acceptable rather than strong.']
});
put(3,{
 blockedKind:'unsupported-candidate',
 candidateReview:'The draft invents a decision state: “We haven\'t decided on Leo\'s role or which playmate will come yet.” P12 says Leo is to choose a role at the start of a hoped-for playdate and that the plan has not been carried out. It does not establish whether a playmate has been selected or a role discussed. The auditor correctly blocks the invented negative, but the supported plan receives no delivered answer.',
 rejectedClaims:[{claim:"We haven't decided on Leo's role or which playmate will come yet.",reason:'The canonical wish contains no finding about decisions already made, especially the playmate decision. Absence of participant information is not evidence of an undecided participant.'}]
});
put(4,{
 quality:3,
 claims:[['Sam and the friend sometimes exchange picture ideas, rather than doing this for every picture.',['P09']],['They take turns choosing an idea.',['P09']]],
 expected:['The reply directly uses the recorded sometimes frequency and does not ask for clarification.','Taking turns picking ideas is an ordinary paraphrase of the recorded shared-picture activity.','The wording is short and ordinary, with Sam as the first-person speaker.'],
 forbidden:['Sometimes is retained; every-picture frequency is rejected rather than introduced.','No meeting frequency, friend name or picture count is invented.','No approval, drawing completion or emotional benefit is added.'],
 notes:[]
});
put(6,{
 blockedKind:'local-guard-false-positive',
 candidateReview:'The draft accurately states Riley\'s communication preference and says “It doesn’t mean I’m naturally thoughtful.” In this question-answer context, that sentence rejects the inference from a phrasing preference to a character label; it does not assert either that Riley is thoughtful or that Riley is not thoughtful. The unsupported-personality-trait guard therefore blocks an otherwise relevant supported draft. The case still fails because no answer is delivered.',
 rejectedClaims:[],
 notes:['This uses the same epistemic-inference interpretation as the v12 review of Riley\'s “It\'s not about being naturally thoughtful” reply. A blocked acceptable draft does not count as a delivered pass.']
});
put(8,{
 quality:3,
 claims:[['Jordan sometimes shows a sketchbook page during a quiet chat with the cousin.',['P09']],['Jordan prefers questions about the page over the cousin feeling obliged to praise it.',['P09']]],
 expected:['The reply supplies both requested details: the sketchbook page and the preferred response.','The cousin\'s response stays a preference; no actual recurring response is asserted.','The content is Jordan\'s cousin and drawings without a mood or health effect.'],
 forbidden:['Neither part is omitted, and no clarification is requested.','No always/never behavior, criticism or reassurance effect is attributed to the cousin.','Sometimes remains sometimes; no scheduled meeting, every-chat habit or exhibition is invented.'],
 notes:[]
});
put(9,{
 quality:3,
 claims:[['Jordan usually sketches ordinary things and keeps drawings in a notebook.',['P02']],['Usually enjoyed activities currently feel less rewarding.',['B02']]],
 expected:['The usual sketching activity is linked to the current reduction in reward from usually enjoyed activities.','The response answers the known part and leaves the trigger uncertain through “I\'m not sure what started the change.”','No onset or duration is supplied, and the short diary is not substituted for the longer course.'],
 forbidden:['No cancellation, criticism, trauma, work pressure, biological explanation or treatment effect is proposed as a cause.','The reply describes reduced reward, not impossibility, total absence of reward or a mood-improving effect.','No condition name or hidden-label causal claim is given.'],
 notes:['The brief uncertainty statement is treated as an honest limitation for an unauthored cause, consistently with v12\'s assessment of the earlier Jordan draft. It does not invent amnesia, refusal or a clinical reason for not knowing.']
});
put(10,{
 blockedKind:'unsupported-candidate',
 candidateReview:'The second sentence is supported by B03, but “Keeping my place with a bookmark doesn’t stop the worry” is an unrecorded negative causal-effect claim. P07 says what the bookmark is for; B03 says worry interferes. Their coexistence does not establish a tested causal effect or absence of effect of the bookmark. The local negative-coping-effect guard correctly contains this claim, but the ordinary question remains unanswered.',
 rejectedClaims:[{claim:'Keeping my place with a bookmark doesn’t stop the worry from getting in the way of time I want to enjoy.',reason:'The facts authorize bookmark use and ongoing interference separately; they do not authorize a claim about the bookmark\'s efficacy, positive or negative.'}],
 notes:['Same verdict as v12 for the substantively identical delivered negative-coping assertion. V13 blocks it, improving containment while still failing usefulness.']
});
put(12,{
 quality:3,claims:[],
 expected:['The brief clarification recognizes that no prior activity establishes what “it” refers to.','The response requests the missing referent rather than selecting an activity or inventing prior conversation.','The wording is ordinary and does not attribute the missing referent to age, memory or confusion.'],
 forbidden:['No gardening, visit or community event is selected as a referent.','No earlier mistake, success, regret or future commitment is invented.','No cognitive, age-related or memory explanation is introduced.'],
 notes:['This case genuinely lacks an antecedent, so clarification is the required useful action. It is distinct from the purely unknown-detail cases that can use the app unavailable boundary.']
});
put(13,{
 blockedKind:'provider-format-failure',
 candidateReview:'CORTEX selected P12 and LANGUAGE was given the known unfinished-arrangement fact, but the provider returned invalid JSON. No parseable writer draft or final answer is present in the saved evidence. It is not possible to assess the missing draft for unsupported content. This is a delivery failure and does not establish factual hallucination.',
 rejectedClaims:[],
 notes:['No retry was made. The provider-format failure must remain in this complete run rather than being replaced by a passing replay.']
});
put(14,{
 blockedKind:'unsupported-candidate',
 candidateReview:'The draft correctly describes Alex\'s combined task list but adds “so my sibling might see that as dependable.” The sibling\'s view and the causal connection to the list are not recorded in P07 or P09. “Might” does not make that invented attributed opinion a supported patient fact. The auditor correctly rejects it, leaving the ordinary question unanswered.',
 rejectedClaims:[{claim:'so my sibling might see that as dependable',reason:'The sibling\'s unrecorded character judgment and its reason are inferred from the task-list habit.'}]
});

const records=[];
for(const [index,record] of evaluation.records.entries()){
 const sample=matrix.cases[index];
 invariant(sample.id===record.id,'Case order mismatch');
 invariant(JSON.stringify(record.expectedBehaviors)===JSON.stringify(sample.expectedBehaviors),'Expected behavior drift');
 invariant(JSON.stringify(record.forbiddenThings)===JSON.stringify(sample.forbiddenThings),'Forbidden behavior drift');
 const snapshot=simulateHistory({seed:42,days:sample.fixture.days??28,...sample.fixture});
 invariant(snapshot.hash===record.snapshotHash,'Frozen fixture mismatch: '+record.id);
 for(const fact of record.canonicalFacts){
  invariant(JSON.stringify(snapshot.facts.find(f=>f.id===fact.id))===JSON.stringify(fact),'Canonical fact mismatch: '+record.id+'/'+fact.id);
 }
 const evidenceIds=new Set([...(sample.sourceReview?.relevantFactIds??[]),...record.canonicalFacts.map(f=>f.id)]);
 const reviewedCanonicalEvidence=[...evidenceIds].map(id=>{const f=snapshot.facts.find(f=>f.id===id);invariant(f,'Unknown evidence '+id);return{id:f.id,response:f.response};});
 const identityEvidence={source:'Reproduced frozen snapshot matches recorded snapshotHash',snapshotHash:snapshot.hash,name:snapshot.name,lifeStage:snapshot.lifeStage,speaker:snapshot.speaker,perspective:snapshot.interviewPerspective};
 const data=manual.get(record.id);
 const common={id:record.id,variant:record.variant,sourceRecordHash:hash(JSON.stringify(record)),canonicalFactsHash:hash(JSON.stringify(record.canonicalFacts)),reproducedSnapshotFactsHash:hash(JSON.stringify(snapshot.facts)),status:record.status,reply:record.result?.reply??null,guidanceReached:record.calls.some(c=>c.input?.exampleGuidance?.examples?.length),identityEvidence,reviewedCanonicalEvidence,reviewedCanonicalEvidenceHash:hash(JSON.stringify(reviewedCanonicalEvidence))};
 if(record.status==='blocked'){
  invariant(data?.blockedKind,'Missing blocked review');
  records.push({...common,hardPass:false,qualityRating:0,blocked:true,safetyContained:true,supportedClaims:[],unsupportedClaims:[],
   expectedBehaviorChecks:sample.expectedBehaviors.map(behavior=>({behavior,met:false,evidence:'No answer was delivered; the rejected candidate is reviewed separately and cannot satisfy delivered-answer requirements.'})),
   forbiddenBehaviorChecks:sample.forbiddenThings.map(behavior=>({behavior,occurred:false,evidence:'No answer was delivered. Rejected candidate claims, where assessable, are documented separately.'})),
   blockedKind:data.blockedKind,candidateReview:data.candidateReview,blockedCandidateUnsupportedClaims:data.rejectedClaims,blockMessage:record.error.message,notes:data.notes??[]});
 }else if(data){
  records.push({...common,hardPass:true,qualityRating:data.quality,blocked:false,safetyContained:true,
   supportedClaims:data.claims.map(([claim,factIds])=>({claim,factIds,evidence:factIds.map(id=>({id,response:snapshot.facts.find(f=>f.id===id).response}))})),unsupportedClaims:[],
   expectedBehaviorChecks:sample.expectedBehaviors.map((behavior,i)=>({behavior,met:true,evidence:data.expected[i]})),
   forbiddenBehaviorChecks:sample.forbiddenThings.map((behavior,i)=>({behavior,occurred:false,evidence:data.forbidden[i]})),notes:data.notes});
 }else{
  const prior=previous.records.find(r=>r.id===record.id);
  invariant(prior?.reply===record.result.reply&&prior.hardPass,'Manual review missing for changed answer '+record.id);
  records.push({...prior,...common,notes:[...prior.notes,'The delivered wording is identical to v12 and has been rechecked against this run\'s reproduced canonical facts; the same boundary interpretation and score are retained.']});
 }
}
const failed=records.filter(r=>!r.hardPass).map(r=>r.id);
const report={schemaVersion:1,status:'complete',evaluationFile,sourceMatrixHash:evaluation.matrixHash,sourceHashes:evaluation.sourceHashes,sourceEvaluationHash:hash(bytes),promptVersion:evaluation.promptVersion,
 reviewedAt:new Date().toISOString(),reviewer:'Independent assistant semantic review of saved v13 replies against reproduced canonical fixtures; not provider self-audit',
 rubric:previous.rubric,evaluationRole:'Regression: these original 16 cases have already informed fixes after the v12 run and cannot now establish fresh held-out generalization.',
 canonicalFactsHash:hash(JSON.stringify(evaluation.records.map(r=>({id:r.id,canonicalFacts:r.canonicalFacts})))),
 canonicalFactsHashDefinition:'SHA-256 of JSON.stringify(records.map(({id,canonicalFacts})=>({id,canonicalFacts}))) in saved evaluation order. Per-record canonicalFactsHash hashes the exact saved canonicalFacts array; reproducedSnapshotFactsHash hashes all facts in the reproduced fixture.',
 records,summary:{cases:16,hardPasses:records.filter(r=>r.hardPass).length,blocked:records.filter(r=>r.blocked).length,unsupportedDelivered:records.filter(r=>r.unsupportedClaims.length).length,
  blockedUnsupportedCandidates:records.filter(r=>r.blockedCandidateUnsupportedClaims?.length).length,localGuardFalsePositives:records.filter(r=>r.blockedKind==='local-guard-false-positive').map(r=>r.id),providerFormatFailures:records.filter(r=>r.blockedKind==='provider-format-failure').map(r=>r.id),usefulnessFailures:failed,
  meanQuality:records.reduce((s,r)=>s+r.qualityRating,0)/16,failed,allSnapshotsReproduced:true,allSnapshotsUnchanged:evaluation.records.every(r=>r.snapshotUnchanged),guidanceReachedCases:records.filter(r=>r.guidanceReached).length,
  calls:evaluation.usage.attemptedCalls,reportedTokens:evaluation.usage.reportedTokens,unreportedCalls:evaluation.usage.unreportedCalls,estimatedUsd:evaluation.usage.cost.estimatedUsd,
  conclusion:'Regression gate fails: 11 of 16 pass, with no unsupported delivered claims. Five ordinary questions remain unanswered: three unsupported drafts were correctly contained, one acceptable draft was falsely blocked by the personality guard, and one provider JSON failure prevented a parseable answer.'},
 limitation:'One stochastic candidate sample per regression case, reviewed by an assistant. This is neither a fresh held-out generalization estimate nor clinical validation. Original v13 runtime hashes are preserved even if the current runtime has since changed. No provider calls or runtime edits were made for this review.'};
const json=JSON.stringify(report,null,2)+'\n';
await writeFile(new URL('grounding-v13-review-generalization.json',runs),json,{flag:'wx'});
const lines=['PsychLab v13 regression review — original 16 generalization cases','',report.evaluationRole,'',`Evaluation: ${evaluationFile}`,`Evaluation SHA-256: ${report.sourceEvaluationHash}`,`Matrix SHA-256: ${report.sourceMatrixHash}`,`Canonical facts SHA-256: ${report.canonicalFactsHash}`,`Recorded prompt: ${report.promptVersion}`,'',report.summary.conclusion,`Quality: ${records.reduce((s,r)=>s+r.qualityRating,0)}/48; mean ${report.summary.meanQuality}.`,`All 16 snapshots reproduced and remained unchanged. Guidance reached ${report.summary.guidanceReachedCases} cases.`,`Usage: ${report.summary.calls} calls; ${report.summary.reportedTokens} reported tokens; ${report.summary.unreportedCalls} unknown-usage calls; USD ${report.summary.estimatedUsd.toFixed(8)} estimate from published rates, not a verified bill.`,'','The same v12 interpretation is retained: a purely unauthored requested detail can use the app unavailable boundary; known requested content must not be suppressed; a missing referent calls for clarification.',''];
for(const r of records){lines.push(`${r.hardPass?'PASS':'FAIL'} ${r.id} — quality ${r.qualityRating}/3`,r.reply??`No delivered answer: ${r.blockMessage}`,...(r.candidateReview?[r.candidateReview]:[]),...r.notes,'');}
lines.push(report.limitation,'');
await writeFile(new URL('grounding-v13-review-generalization.txt',runs),lines.join('\n'),{flag:'wx'});
console.log(JSON.stringify({summary:report.summary,reviewHash:hash(json),sourceEvaluationHash:report.sourceEvaluationHash,canonicalFactsHash:report.canonicalFactsHash},null,2));
