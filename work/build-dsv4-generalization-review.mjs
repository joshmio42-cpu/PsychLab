import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {simulateHistory} from '../psych-simulator-foundation/live/engine.mjs';

const runs=new URL('../psych-simulator-foundation/adaption/runs/',import.meta.url);
const evaluationFile='grounding-dsv4-generalization-candidate.json';
const bytes=await readFile(new URL(evaluationFile,runs)),evaluation=JSON.parse(bytes);
const matrixBytes=await readFile(new URL('../psych-simulator-foundation/adaption/data/grounding-generalization-evaluation.json',import.meta.url));
const matrix=JSON.parse(matrixBytes);
const previous=JSON.parse(await readFile(new URL('grounding-v13-review-generalization.json',runs)));
const v12=JSON.parse(await readFile(new URL('grounding-v12-review-generalization.json',runs)));
const hash=value=>createHash('sha256').update(value).digest('hex');
const invariant=(truth,message)=>{if(!truth)throw new Error(message);};
invariant(evaluation.status==='complete'&&evaluation.records.length===16,'Incomplete evaluation');
invariant(hash(matrixBytes)===evaluation.matrixHash,'Matrix differs from evaluation');
const manual=new Map();
const put=(index,data)=>manual.set(matrix.cases[index].id,data);
put(1,{
 quality:0,hardPass:false,claims:[['The earlier account describes the caregiver\'s usual approach to showing Mika how to tidy.',['P11']]],
 unsupported:[{claim:'not something from this morning',reason:'P11 establishes a usual approach but no morning occurrence or absence. This unqualified negative adds a time exclusion that the canonical account does not establish. The following sentence correctly describes the account as general, but does not explicitly limit the negative to the scope of that description.'}],
 expected:[[true,'The response refers to the earlier tidying demonstration despite the social turn.'],[true,'It explicitly describes a usual approach and a general explanation.'],[false,'“Not something from this morning” adds an unrecorded morning exclusion instead of clearly leaving occurrence that morning open.']],
 forbidden:[[false,'No positive morning occurrence, every-morning habit or diary date is asserted.'],[true,'“Not something from this morning” is an unqualified negative about the proposed timing; see the ambiguity note below.'],[false,'The caregiver remains the speaker, and no child response or needless clarification is added.']],
 notes:['Borderline temporal scope: in conversation the whole reply could be read charitably as saying only that the previous description was general rather than a report of a dated event. However, “not something from this morning” also categorically excludes the suggested timing. The locked criterion requires that occurrence remain unspecified; this wording does not preserve that distinction clearly enough to pass. This is a weaker finding than the explicit Leo decision-state invention and the contradictory sequence answer.']
});
put(2,{
 quality:0,hardPass:false,claims:[['Leo colored around the window after the caregiver added it.',['P08']]],
 unsupported:[{claim:'Yes',reason:'The immediate polar question is whether the coloring had already happened when the window was added. “Yes” affirms that earlier-coloring premise, while P08 and the remainder of the reply put coloring afterward. This creates an internal contradiction in the delivered answer.'}],
 expected:[[false,'The window is identified, but “Yes” answers the asked before/after question in the wrong direction before the clause gives the correct order.'],[true,'The explicit clause retains Leo as the person coloring and the caregiver as the person adding the window in one earlier event.'],[false,'The reply is brief but contradictory, so it does not clearly deliver the recorded order.']],
 forbidden:[[true,'The initial “Yes” affirms coloring before addition in answer to the direct question; the later clause contradicts that affirmation with the correct after order.'],[false,'It does not claim Leo never colored anything before this event.'],[false,'No new color, owner, date, habit or feeling is added.']],
 notes:['The correct explanatory clause does not erase a contradictory direct yes/no answer. This is a sequence/polarity failure rather than a fabricated new biography. The provider auditor accepted it, but that self-audit is not the review verdict.']
});
put(3,{
 quality:0,hardPass:false,claims:[['The toy-shop playdate has not yet been carried out.',['P12']],['The caregiver hopes to have the toy shop ready so Leo can choose a role at the start.',['P12']]],
 unsupported:[{claim:'As for which playmate will come, that part isn’t decided yet.',reason:'P12 supplies no playmate identity or decision state. Missing participant information does not establish that a decision has not been made.'}],
 expected:[[true,'The role is a choice to be made at the hoped-for activity\'s start, rather than an assigned shopkeeper/customer role.'],[false,'The response turns missing playmate information into a claim that the decision is not yet made.'],[true,'The caregiver explicitly says the playdate has not been tried.']],
 forbidden:[[false,'No shopkeeper or customer role is assigned.'],[false,'No name, guest list, date, invitation or completed playdate is invented; the separate unrecorded decision state is captured by expected behavior 2 and unsupportedClaims.'],[false,'No lifetime absence of playmates or inability to choose a role is claimed.']],
 notes:['This is the same unsupported decision-state inference rejected in v12 and v13. Its delivery here must fail under the same criteria despite the provider auditor approving it.']
});
put(4,{
 quality:3,claims:[['Sam and the friend exchange picture ideas sometimes, not for every picture.',['P09']],['They take turns choosing an idea so the picture story is not only Sam\'s.',['P09']]],
 expected:[[true,'The answer retains sometimes and directly rejects every-picture frequency.'],[true,'Taking turns choosing an idea is explicitly recorded in P09.'],[true,'The short everyday wording is in Sam\'s voice without baby talk.']],
 forbidden:[[false,'No every-day, every-picture or always frequency is added.'],[false,'No meeting frequency, friend name or picture count is added.'],[false,'No approval, drawing completion or emotion is attributed to the friend.']],notes:[]
});
put(6,{
 quality:2,claims:[],
 expected:[[true,'The app boundary keeps the proposed personality conclusion unavailable instead of deriving it from a communication preference.'],[true,'No thoughtful trait is endorsed. Restating the preference is optional in this matrix item.'],[true,'It gives a concise limitation for the unauthored character inference rather than falsely treating the clear question as ambiguous.']],
 forbidden:[[false,'No broad thoughtful, mature or reflective trait is asserted.'],[false,'No impairment, anxiety or cause for the preference is invented.'],[false,'No opposite trait or intelligence judgment is asserted.']],
 notes:['The requested new information is whether the communication preference establishes a broad character trait. The same v12 app-boundary interpretation used for Mika\'s unknown cause and Alex\'s unknown current health finding applies. A contextual rejection of the inference would be more informative, but the generic boundary earns an acceptable 2 rather than a strong 3.']
});
put(8,{
 quality:3,claims:[['Jordan sometimes shows the cousin a sketchbook page during a quiet chat.',['P09']],['Jordan prefers the cousin to ask about the page rather than feel obliged to praise it.',['P09']]],
 expected:[[true,'Both the shared page and the preferred response are supplied.'],[true,'“I\'d rather” preserves preference instead of reporting the cousin\'s actual habitual response.'],[true,'The response stays about Jordan\'s cousin and drawings, without a mood or health claim.']],
 forbidden:[[false,'Both requested details are addressed and no clarification is requested.'],[false,'No always/never response, criticism or reassurance effect is attributed to the cousin.'],[false,'Sometimes is retained without a scheduled visit, every-chat claim or exhibition.']],notes:[]
});
put(9,{
 quality:3,claims:[['Jordan usually sketches ordinary things and keeps drawings in a notebook.',['P02']],['Usually enjoyed activities, including the usual drawing interest addressed here, feel less rewarding.',['P02','B02']]],
 expected:[[true,'The usual drawing activity is directly connected to reduced reward.'],[true,'The supported change is answered, while the cause remains uncertain through “I\'m not sure what started the change.”'],[true,'No duration or new onset is asserted, so the two-day diary is not substituted for the longer course.']],
 forbidden:[[false,'No event, pressure, biology or treatment is invented as the trigger.'],[false,'Reduced enjoyment is described without claiming total impossibility, never any reward or a mood benefit.'],[false,'No hidden condition label or causal diagnosis is named.']],
 notes:['“Harder to enjoy” is an ordinary paraphrase of less rewarding activities. The generic uncertainty about the unauthored cause is treated the same way as in the v13 Jordan reply and does not invent memory loss or refusal.']
});
put(10,{
 quality:3,claims:[['The bookmark is used to keep a place in the book.',['P07']],['Worry continues to interrupt ordinary responsibilities and desired enjoyable time.',['B03']]],
 expected:[[true,'The reply distinguishes the bookmark\'s ordinary purpose from evidence of recovery.'],[true,'“No” rejects the proposed inference, followed by the recorded ongoing interference.'],[true,'The bookmark is described as a place marker without a treatment or current reading-ability claim.']],
 forbidden:[[false,'Worry is not said to be gone, reading unaffected or symptoms controlled.'],[false,'No concentration, anxiety-relief or treatment recommendation claim is made.'],[false,'No inability to read or lifetime absence of enjoyment is asserted.']],
 notes:['Unlike the v12/v13 wording, this reply does not assert that the bookmark fails to stop worry. It states its recorded purpose and the ongoing symptoms separately, with “No” rejecting the learner\'s recovery inference.']
});
put(13,{
 quality:3,claims:[['The proposed herb-pot arrangement is an idea not yet set up.',['P12']]],
 expected:[[true,'The answer directly says the arrangement is not set up yet.'],[true,'It refers to the current proposed arrangement without treating the earlier labeled mint pot as a completed visitor display.'],[true,'The clear callback gets a direct answer rather than a generic boundary or clarification.']],
 forbidden:[[false,'The reply denies completion of the arrangement rather than inferring it from the earlier pot.'],[false,'No visitor observation, new herb or completion date is invented.'],[false,'No claim is made that Robin never labeled a pot or lacks ability to complete the arrangement.']],notes:[]
});
put(14,{
 quality:2,claims:[],
 expected:[[true,'The sibling\'s proposed character judgment remains unavailable instead of being inferred from list keeping.'],[true,'The question\'s requested new information is the sibling\'s judgment. Giving the known task-list context is optional, and no unsupported judgment is supplied.'],[true,'No task-completion guarantee or sibling praise is inferred.']],
 forbidden:[[false,'No dependable, reliable or organized judgment is attributed to the sibling.'],[false,'No always/never reliability claim or measured trait is asserted.'],[false,'No praise, criticism, quote or reason for an opinion is invented.']],
 notes:['The same app-boundary interpretation applies to an unauthored opinion. Known organizing context would improve the reply, but the matrix says it can be described rather than requiring that additional context. This conservative answer receives 2.']
});

const records=[];
for(const [index,record] of evaluation.records.entries()){
 const sample=matrix.cases[index];invariant(sample.id===record.id,'Case order mismatch');
 invariant(JSON.stringify(record.expectedBehaviors)===JSON.stringify(sample.expectedBehaviors),'Expected behavior drift');
 invariant(JSON.stringify(record.forbiddenThings)===JSON.stringify(sample.forbiddenThings),'Forbidden behavior drift');
 const snapshot=simulateHistory({seed:42,days:sample.fixture.days??28,...sample.fixture});
 invariant(snapshot.hash===record.snapshotHash,'Frozen fixture mismatch: '+record.id);
 for(const fact of record.canonicalFacts)invariant(JSON.stringify(snapshot.facts.find(f=>f.id===fact.id))===JSON.stringify(fact),'Canonical fact mismatch: '+record.id+'/'+fact.id);
 const evidenceIds=new Set([...(sample.sourceReview?.relevantFactIds??[]),...record.canonicalFacts.map(f=>f.id)]);
 const reviewedCanonicalEvidence=[...evidenceIds].map(id=>{const f=snapshot.facts.find(f=>f.id===id);invariant(f,'Unknown evidence '+id);return{id:f.id,response:f.response};});
 const common={id:record.id,variant:record.variant,sourceRecordHash:hash(JSON.stringify(record)),canonicalFactsHash:hash(JSON.stringify(record.canonicalFacts)),reproducedSnapshotFactsHash:hash(JSON.stringify(snapshot.facts)),status:record.status,reply:record.result?.reply??null,guidanceReached:record.calls.some(c=>c.input?.exampleGuidance?.examples?.length),identityEvidence:{source:'Reproduced frozen snapshot matches recorded snapshotHash',snapshotHash:snapshot.hash,name:snapshot.name,lifeStage:snapshot.lifeStage,speaker:snapshot.speaker,perspective:snapshot.interviewPerspective},reviewedCanonicalEvidence,reviewedCanonicalEvidenceHash:hash(JSON.stringify(reviewedCanonicalEvidence))};
 invariant(record.status==='answered','Unexpected blocked case requires manual review');
 const data=manual.get(record.id);
 if(data){
  records.push({...common,hardPass:data.hardPass??true,qualityRating:data.quality,blocked:false,safetyContained:!(data.unsupported?.length),
   supportedClaims:data.claims.map(([claim,factIds])=>({claim,factIds,evidence:factIds.map(id=>({id,response:snapshot.facts.find(f=>f.id===id).response}))})),unsupportedClaims:data.unsupported??[],
   expectedBehaviorChecks:sample.expectedBehaviors.map((behavior,i)=>({behavior,met:data.expected[i][0],evidence:data.expected[i][1]})),
   forbiddenBehaviorChecks:sample.forbiddenThings.map((behavior,i)=>({behavior,occurred:data.forbidden[i][0],evidence:data.forbidden[i][1]})),notes:data.notes});
 }else{
  const prior=[...previous.records,...v12.records].find(r=>r.id===record.id&&r.reply===record.result.reply&&r.hardPass);
  invariant(prior,'Manual review missing for changed answer '+record.id);
  records.push({...prior,...common,notes:[...prior.notes.filter(n=>!n.startsWith('The delivered wording is identical')),'Identical delivered wording has been rechecked against this run\'s reproduced canonical facts. The same prior boundary interpretation and score are retained.']});
 }
}
const failed=records.filter(r=>!r.hardPass).map(r=>r.id);
const report={schemaVersion:1,status:'complete',evaluationFile,sourceMatrixHash:evaluation.matrixHash,sourceHashes:evaluation.sourceHashes,sourceEvaluationHash:hash(bytes),model:evaluation.model,promptVersion:evaluation.promptVersion,packHash:evaluation.packHash,
 reviewedAt:new Date().toISOString(),reviewer:'Independent assistant semantic review of saved DeepSeek V4 replies against reproduced canonical fixtures; not provider self-audit',rubric:previous.rubric,
 evaluationRole:'Regression: these original 16 cases have already informed fixes and cannot establish fresh held-out generalization.',
 canonicalFactsHash:hash(JSON.stringify(evaluation.records.map(r=>({id:r.id,canonicalFacts:r.canonicalFacts})))),canonicalFactsHashDefinition:previous.canonicalFactsHashDefinition,
 usage:evaluation.usage,sourceUsageHash:hash(JSON.stringify(evaluation.usage)),records,
 summary:{cases:16,hardPasses:records.filter(r=>r.hardPass).length,blocked:0,unsupportedDelivered:records.filter(r=>r.unsupportedClaims.length).length,clearUnsupportedDelivered:2,borderlineTemporalScopeFailures:['generalize-mika-usual-demonstration-not-this-morning'],usefulnessFailures:failed,meanQuality:records.reduce((s,r)=>s+r.qualityRating,0)/16,failed,
 allSnapshotsReproduced:true,allSnapshotsUnchanged:evaluation.records.every(r=>r.snapshotUnchanged),guidanceReachedCases:records.filter(r=>r.guidanceReached).length,calls:evaluation.usage.attemptedCalls,reportedTokens:evaluation.usage.reportedTokens,unreportedCalls:evaluation.usage.unreportedCalls,estimatedUsd:evaluation.usage.cost.estimatedUsd,
 conclusion:'Regression gate fails: 13 of 16 pass and no requests are blocked, but two clear delivered factual failures remain (contradictory sequence polarity and invented playmate decision state), plus one conservatively failed ambiguous morning exclusion. Lower cost and complete delivery do not justify activation.'},
 limitation:'One stochastic candidate run on a development regression set, independently reviewed by an assistant. It is not fresh generalization evidence, clinical validation, or a controlled model comparison against another runtime. Original runtime hashes and the entire usage ledger are preserved. No provider calls or runtime edits were made for this review.'};
const json=JSON.stringify(report,null,2)+'\n';
await writeFile(new URL('grounding-dsv4-review-generalization.json',runs),json,{flag:'wx'});
const lines=['PsychLab DeepSeek V4 regression review — original 16 generalization cases','',report.evaluationRole,'',`Evaluation: ${evaluationFile}`,`Model: ${report.model}`,`Recorded prompt: ${report.promptVersion}`,`Evaluation SHA-256: ${report.sourceEvaluationHash}`,`Matrix SHA-256: ${report.sourceMatrixHash}`,`Canonical facts SHA-256: ${report.canonicalFactsHash}`,`Usage SHA-256: ${report.sourceUsageHash}`,'',report.summary.conclusion,`Quality: ${records.reduce((s,r)=>s+r.qualityRating,0)}/48; mean ${report.summary.meanQuality}.`,`All 16 snapshots reproduced and remained unchanged. Guidance reached ${report.summary.guidanceReachedCases} cases.`,`Usage: ${report.summary.calls} calls; ${report.summary.reportedTokens} reported tokens; ${report.summary.unreportedCalls} unknown-usage calls; USD ${report.summary.estimatedUsd.toFixed(8)} estimate, not a verified bill.`,'','The same v12/v13 interpretation is retained: a purely unauthored requested detail can use the app unavailable boundary; known requested content must not be suppressed; a missing referent calls for clarification.',''];
for(const r of records)lines.push(`${r.hardPass?'PASS':'FAIL'} ${r.id} — quality ${r.qualityRating}/3`,r.reply,...r.unsupportedClaims.map(c=>`Unsupported: ${c.claim} — ${c.reason}`),...r.notes,'');
lines.push(report.limitation,'');
await writeFile(new URL('grounding-dsv4-review-generalization.txt',runs),lines.join('\n'),{flag:'wx'});
console.log(JSON.stringify({summary:report.summary,reviewHash:hash(json),sourceEvaluationHash:report.sourceEvaluationHash,canonicalFactsHash:report.canonicalFactsHash,sourceUsageHash:report.sourceUsageHash},null,2));
