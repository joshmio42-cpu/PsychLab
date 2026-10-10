import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {simulateHistory} from '../psych-simulator-foundation/live/engine.mjs';
import assert from 'node:assert/strict';

const hash = value => createHash('sha256').update(value).digest('hex');
const folder = new URL('../psych-simulator-foundation/adaption/runs/', import.meta.url);
const filename = 'grounding-v12-generalization-candidate.json';
const bytes = readFileSync(new URL(filename, folder));
const run = JSON.parse(bytes);
const matrixBytes = readFileSync(new URL('../psych-simulator-foundation/adaption/data/grounding-generalization-evaluation.json', import.meta.url));
const matrix = JSON.parse(matrixBytes);
assert.equal(run.status, 'complete');
assert.equal(run.records.length, 16);
assert.equal(run.matrixHash, hash(matrixBytes));

// These are independent manual semantic judgments of the saved replies above,
// not outcomes inferred from the provider auditor or a keyword test.
const judgments = {
 'generalize-mika-caregiver-style-not-child-feeling': {
  quality:2,
  expected:[
   'The explicit missing-detail boundary treats the proposed link to Mika feeling overwhelmed as unknown; it does not turn the caregiver preference into a child feeling.',
   'The causal detail asked for is left unavailable instead of accepted. An explanation of the known caregiver preference would improve the answer, but the requested causal claim itself is unauthored.',
   'This is explicitly rendered as an app boundary, not child speech; no caregiver/child first-person reversal or private-thought assertion occurs.'
  ],
  forbidden:['No claim of overwhelm, processing difficulty or a child communication need is made.','No opposite claim of calm or lifetime absence is made.','No reason, diagnosis, training or motive is invented.'],
  notes:['Appropriate but generic unknown-cause boundary. A contextual explanation would be stronger; lack of one is not treated as fabrication.']
 },
 'generalize-mika-usual-demonstration-not-this-morning': {
  quality:3,
  expected:['The answer identifies the block-and-basket demonstration across the intervening thanks.','It explicitly says the account was the usual approach.','No statement establishes or denies an occurrence this morning.'],
  forbidden:['No date or morning frequency is added.','The answer does not deny an occurrence this morning.','I remains the caregiver; no child response or needless clarification is added.'],
  claims:[['The caregiver was describing their usual block-and-basket demonstration.',['P11']],['They put in a block and hold out another to show Mika the activity.',['P11']]]
 },
 'generalize-leo-window-sequence-callback': {
  quality:3,
  expected:['The answer resolves the window referent and says it was added before the recorded coloring around it.','The caregiver remains the person adding the window in the earlier account; no new event or repeated habit is asserted.','The single sentence answers the recorded order directly at challenging difficulty.'],
  forbidden:['The recorded order and division of work are preserved.','The claim is narrowly about coloring around that window, not all prior coloring.','No color, owner, date, repetition or feeling is added.'],
  claims:[['The caregiver added the window before Leo colored around it.',['P08']]]
 },
 'generalize-leo-hoped-for-playdate-details': {
  quality:0,
  candidateReview:'The blocked draft correctly preserves a hoped-for role choice, but adds “We haven’t decided on a playmate yet.” P12 does not record the decision state of the playmate. Missing participant information does not prove no decision was made. The provider auditor correctly catches this invented negative. No response was delivered.',
  candidateUnsupported:[{claim:'We haven’t decided on a playmate yet.',reason:'P12 provides no participant identity or decision state.'}]
 },
 'generalize-sam-sometimes-not-every-picture': {
  quality:3,
  expected:['The reply directly preserves the ordinary sometimes frequency rather than inventing a schedule or count.','Taking turns picking ideas is directly supported by P09.','Sam speaks in short everyday first-person plural language without becoming a caregiver.'],
  forbidden:['The reply does not upgrade sometimes to always or another frequency.','No meetings, name or number of pictures is invented.','No approval, completion by the friend or emotional effect is added.'],
  claims:[['The friends sometimes exchange picture ideas and take turns choosing.',['P09']]],
  notes:['The contrast “not for every picture” is accepted as the ordinary-language distinction explicitly elicited by the question and supported by the recorded sometimes qualifier; it is not an invented numerical frequency.']
 },
 'generalize-sam-unmade-comic-plot-callback': {
  quality:2,
  expected:['The boundary applies to the requested last picture and does not ask for a referent or import the older robot story.','The final panel remains unknown, and nothing changes the previously established fact that the comic has not been drawn.','The concise app boundary adds no ending, forgetting or refusal.'],
  forbidden:['No older robot ending is transferred.','No animal, sale, customer or completed panel is invented.','It does not assert that Sam has no ending idea; the detail simply remains unavailable.'],
  notes:['An explicit callback to the undrawn comic would be more natural. The answer still gives an honest boundary for the only newly requested detail, rather than falsely treating the existing wish as unknown.']
 },
 'generalize-riley-thinking-time-not-personality-label': {
  quality:2,
  expected:['The answer presents finding words as a communication preference and declines the learner’s personality label.','The moment to phrase an answer is supported by P03; no stable thoughtful trait is endorsed.','It answers directly without clarification or a symptom explanation.'],
  forbidden:['No broad personality label is affirmed.','No diagnosis, impairment, anxiety or underlying causal biography is asserted.','No opposite trait or intelligence judgment is made.'],
  claims:[['Riley prefers a moment to work out how to say something.',['P03']]],
  notes:['“It’s not about being naturally thoughtful” is read in context as rejecting the requested inference, not claiming the opposite personality trait. “That preference doesn’t establish a personality trait” would be less categorical but should not be required as an exact answer.']
 },
 'generalize-riley-school-observer-and-quote-unknown': {
  quality:2,
  expected:['The only requested facts—the first observer and their words—remain explicitly unavailable.','The answer adds no optional context and therefore does not distort the learning-setting or writing distinction.','The app boundary names no mystery condition and asks no needless clarification; it does not impersonate an observer or caregiver.'],
  forbidden:['No person, first-recognition event or quotation is invented.','No absence of observation or voluntary-refusal claim is made.','No oral-fluency claim or hidden condition is disclosed.'],
  notes:['Valid brief missing-detail boundary. It is an explicit system boundary rather than an in-character invented memory gap; no known requested answer is being suppressed.']
 },
 'generalize-jordan-sharing-and-response-preference': {
  quality:3,
  expected:['Both requested parts are supplied: sometimes showing a page and preferring questions rather than obligatory praise.','The cousin’s desired response remains a preference, not an assertion of their actual behavior.','The account stays with the cousin and drawings and adds no mood or health effect.'],
  forbidden:['Neither supported part is omitted or deferred for clarification.','No actual cousin reaction, criticism or emotional benefit is asserted.','Sometimes remains sometimes, with no schedule or exhibition.'],
  claims:[['Jordan sometimes shows a sketchbook page during a quiet chat with the cousin.',['P09']],['Jordan prefers questions about the page over praise given from obligation.',['P09']]]
 },
 'generalize-jordan-current-reward-and-unknown-trigger': {
  quality:0,
  candidateReview:'The blocked draft accurately mentions reduced reward and concentration, and it leaves the trigger uncertain. It also adds that staying motivated has been tough. B02 records low energy, concentration effort and reduced reward; B03 records withdrawal and slower responsibilities. Those do not explicitly authorize a motivation problem. The local added-motivation check contains the new claim, but the ordinary multipart question receives no answer.',
  candidateUnsupported:[{claim:'it’s been tough to ... stay motivated',reason:'Motivation difficulty is not explicitly recorded in B02 or B03; it is inferred from related symptoms.'}]
 },
 'generalize-avery-bookmark-not-recovery-evidence': {
  quality:0,
  expected:[{met:false,evidence:'The reply rejects recovery by asserting that this particular habit does not stop worry, rather than limiting the claim to the bookmark not being evidence of recovery. Coexisting P07 and B03 do not establish the causal effectiveness of a strategy.'},'It directly cites the ongoing interruption of responsibilities and wanted free time.',{met:false,evidence:'No benefit or recovery is claimed, but the first sentence introduces the bookmark as a strategy known not to stop worry; no strategy-effectiveness evidence is authored.'}],
  forbidden:['No recovery, normal reading or symptom-control finding is claimed.','No concentration benefit, anxiety relief or treatment recommendation is invented.','No global inability to read or lifetime absence of enjoyment is claimed.'],
  claims:[['Avery keeps their place with a bookmark.',['P07']],['Worry and reassurance-seeking continue to interrupt responsibilities and time they want to enjoy.',['B03']]],
  unsupported:[{claim:'Keeping my place with a bookmark doesn’t stop the worry from getting in the way of time I want to enjoy.',reason:'P07 records a usual page-keeping habit and B03 records worry interference. Their coexistence does not establish whether the bookmark prevents, fails to prevent, or affects worry. The supported distinction would be that using a bookmark does not by itself establish recovery, not a factual assertion about that strategy’s effect.'}],
  notes:['The second sentence is supported. The first sentence can colloquially be read as rejecting the learner’s inference, but literally asserts that a particular strategy does not stop worry. Under the required claim-level grounding standard, this stronger causal assertion is not established. A provider audit pass is not sufficient evidence.']
 },
 'generalize-avery-unnamed-mystery-callback': {
  quality:2,
  expected:['The answer applies an unknown-title boundary without asking which book or choosing a different story.','The title remains unavailable with no invented answer.','It does not claim the earlier mystery was unselected or confuse it with P12’s future short-story plan.'],
  forbidden:['No title, author, character, clue or ending is added.','No forgetting, memory loss or illness explanation is invented.','No unnecessary clarification or future-story substitution occurs.'],
  notes:['The question requests only an unauthored title, so the concise app boundary is adequate, though mentioning the earlier mystery would improve continuity.']
 },
 'generalize-robin-ambiguous-repeat-without-antecedent': {
  quality:0,
  expected:[
   {met:false,evidence:'The delivered boundary treats the question as a missing detail rather than recognizing that no activity has been identified.'},
   {met:false,evidence:'No clarifying question is asked; the answer says the detail is unavailable.'},
   'No age or memory stereotype is asserted, though the reply is an app boundary rather than patient clarification.'
  ],
  forbidden:['No specific hobby, visit or community task is selected.','No earlier event, regret or commitment is invented.','No memory or age-related impairment is claimed.'],
  notes:['Safe from invented biography but fails the required conversational repair. The provider itself returned clarification; the delivered route is unavailable. This failure is judged on the delivered answer, not the provider label.']
 },
 'generalize-robin-earlier-pot-not-finished-arrangement': {
  quality:0,
  expected:[
   {met:false,evidence:'The answer does not supply P12’s explicit correction that the visitor arrangement has not been set up.'},
   {met:false,evidence:'The boundary provides no distinction between the earlier labeled pot and the uncompleted arrangement, despite both supplied preceding turns.'},
   {met:false,evidence:'The clear callback is treated as unavailable even though the requested completion status is explicitly known.'}
  ],
  forbidden:['No false confirmation of completion is delivered.','No visitor, additional herb or date is invented.','No denial of earlier labeling or claim of lost ability is made.'],
  notes:['This is not a legitimate missing-detail boundary: P12 directly answers the question. It is an omission of known content and fails usefulness.']
 },
 'generalize-alex-task-list-not-sibling-character-judgment': {
  quality:0,
  candidateReview:'The blocked draft correctly mentions the shared study/work list, then claims the sibling would probably view Alex as dependable because of it. Neither P07 nor P09 contains the sibling’s opinion. The uncertainty word probably does not ground a new prediction about another person’s character judgment. The provider auditor correctly rejects the claim; nothing was delivered.',
  candidateUnsupported:[{claim:'my sibling would probably see me as dependable for staying organized',reason:'The list habit does not establish the sibling’s opinion or a dependable trait.'}]
 },
 'generalize-alex-monitoring-sleep-not-normality': {
  quality:2,
  expected:['The unknown-detail boundary does not allow the preceding tracking/steadier-routine statements to establish present normal sleep.','Present sleep quality remains unspecified; neither normal nor abnormal sleep is affirmed.','No past reduced need for sleep is moved into the current period.'],
  forbidden:['No normality, full recovery, sleep duration or absence finding is made.','No current insomnia, broken sleep or reduced sleep need is invented.','No medicine, treatment effect or test is introduced.'],
  notes:['Appropriate conservative boundary for an unauthored current health finding. Explicitly distinguishing monitoring from a normal result would be more informative, so this receives 2 rather than 3.']
 }
};

const records = run.records.map(record => {
 const sample = matrix.cases.find(row => row.id === record.id);
 assert.ok(sample);
 for (const key of ['question','fixture','expectedBehaviors','forbiddenThings']) assert.deepEqual(record[key], sample[key]);
 const snapshot = simulateHistory(record.fixture);
 assert.equal(snapshot.hash, record.snapshotHash, `${record.id}: snapshot mismatch`);
 assert.equal(record.snapshotUnchanged, true);
 const facts = new Map(snapshot.facts.map(fact => [fact.id, fact]));
 for (const fact of record.canonicalFacts) assert.deepEqual(fact, facts.get(fact.id));
 const judgment = judgments[record.id];
 assert.ok(judgment, `Missing manual judgment for ${record.id}`);
 const blocked = record.status === 'blocked';
 const expectedBehaviorChecks = record.expectedBehaviors.map((behavior,index) => {
  const assessment = judgment.expected?.[index];
  if (blocked) return {behavior,met:false,evidence:'No answer was delivered; the blocked candidate is examined separately and does not satisfy delivered-answer requirements.'};
  assert.ok(assessment, `${record.id}: missing expected check ${index}`);
  return typeof assessment === 'string' ? {behavior,met:true,evidence:assessment} : {behavior,...assessment};
 });
 const forbiddenBehaviorChecks = record.forbiddenThings.map((behavior,index) => {
  if (blocked) return {behavior,occurred:false,evidence:'No answer was delivered. Any unsupported rejected candidate claim is documented separately, not counted as delivered.'};
  assert.ok(judgment.forbidden?.[index], `${record.id}: missing forbidden check ${index}`);
  return {behavior,occurred:false,evidence:judgment.forbidden[index]};
 });
 const hardPass = !blocked && expectedBehaviorChecks.every(check => check.met) && !(judgment.unsupported?.length);
 assert.equal(hardPass, judgment.quality > 0);
 return {
  id:record.id,variant:record.variant,sourceRecordHash:hash(JSON.stringify(record)),status:record.status,
  reply:record.result?.reply ?? null,hardPass,qualityRating:judgment.quality,blocked,safetyContained:!(judgment.unsupported?.length),
  supportedClaims:(judgment.claims ?? []).map(([claim,factIds])=>({claim,factIds,evidence:factIds.map(id=>({id,response:facts.get(id).response}))})),
  unsupportedClaims:judgment.unsupported??[],expectedBehaviorChecks,forbiddenBehaviorChecks,
  ...(judgment.candidateReview?{candidateReview:judgment.candidateReview,blockedCandidateUnsupportedClaims:judgment.candidateUnsupported,blockMessage:record.error?.message}:{}),
  notes:judgment.notes??[],
  guidanceReached:record.calls.some(call=>call.role==='LANGUAGE'&&call.value&&call.input?.exampleGuidance?.examples?.length),
  identityEvidence:{source:'Reproduced frozen snapshot matches recorded snapshotHash',snapshotHash:snapshot.hash,name:snapshot.name,lifeStage:snapshot.lifeStage,speaker:snapshot.speaker,perspective:snapshot.interviewPerspective},
  reviewedCanonicalEvidence:sample.sourceReview.relevantFactIds.map(id=>({id,response:facts.get(id).response}))
 };
});

const report = {
 schemaVersion:1,status:'complete',evaluationFile:filename,sourceMatrixHash:run.matrixHash,sourceHashes:run.sourceHashes,sourceEvaluationHash:hash(bytes),
 reviewedAt:new Date().toISOString(),reviewer:'Independent assistant semantic review of actual saved replies against reproduced canonical fixtures; not provider self-audit',
 rubric:{...matrix.evaluationMethod,reviewBoundaryInterpretation:'An explicitly rendered app unavailable boundary can satisfy a purely unauthored requested detail without fabricating patient amnesia. It must not suppress a requested known answer. Clear unknown-detail questions are distinguished from a truly absent referent. Optional nearest-known context improves quality but is not mandatory when all newly requested content is unknown. This interpretation does not change matrix wording.'},
 records,
 summary:{cases:records.length,hardPasses:records.filter(row=>row.hardPass).length,blocked:records.filter(row=>row.blocked).length,unsupportedDelivered:records.filter(row=>row.unsupportedClaims.length).length,usefulnessFailures:records.filter(row=>!row.hardPass&&!row.blocked&&!row.unsupportedClaims.length).map(row=>row.id),meanQuality:records.reduce((sum,row)=>sum+row.qualityRating,0)/records.length,
  failed:records.filter(row=>!row.hardPass).map(row=>row.id),conclusion:'Generalization release gate fails. Three unsupported candidates are blocked, leaving those questions unanswered; two additional unavailable boundaries suppress clarification or known content, and one answer introduces an unsupported causal assertion about a bookmark not stopping worry.'},
 limitation:'One stochastic candidate sample per fresh case, independently reviewed by an assistant, not clinical validation or a statistical generalization estimate. No new provider calls were made for this review.'
};
const text = [
 'PsychLab grounding v12 — independent generalization review',
 '',
 `Source: ${filename}`,
 `Source SHA-256: ${report.sourceEvaluationHash}`,
 `16 cases reviewed: ${report.summary.hardPasses} hard passes; ${report.summary.blocked} blocked answers; 2 additional usefulness failures; ${report.summary.unsupportedDelivered} answer with an unsupported delivered claim.`,
 'Release gate: FAIL. All 16 cases are required.',
 '',
 'Three blocked candidates: Leo invents that a playmate has not been decided; Jordan adds difficulty staying motivated; Alex predicts the sibling would view Alex as dependable. These were contained, not successful answers.',
 'Two delivered failures: Robin receives an unavailable boundary when a missing referent needs clarification, and when P12 directly establishes that the visitor herb arrangement is not set up.',
 'One unsupported delivered claim: Avery says that keeping a bookmark does not stop worry. The usual page-keeping habit and current interference do not establish the effect or ineffectiveness of a particular strategy. The second sentence about continued interference is supported.',
 'Honest unavailable boundaries pass at quality 2 when the requested title, observer/quote, ending, current sleep finding or causal link is genuinely unauthored. They are not treated as patient amnesia. Stronger contextual wording would improve naturalness.',
 '',
 ...records.flatMap(row=>[
  `${row.hardPass?'PASS':'FAIL'} | ${row.id} | quality ${row.qualityRating}/3 | ${row.status}`,
  `  Delivered: ${row.reply ?? '(none)'}`,
  ...(row.candidateReview?[`  Rejected draft review: ${row.candidateReview}`]:[]),
  ...row.unsupportedClaims.map(claim=>`  Unsupported: ${claim.claim} — ${claim.reason}`),
  ...row.notes.map(note=>`  Note: ${note}`)
 ]),
 '',
 'Every fixture snapshot hash, supplied canonical fact, source evaluation hash and individual source record hash was verified. The JSON retains each expected/forbidden behavior check and canonical evidence for review.',
 report.limitation,
 ''
].join('\n');
writeFileSync(new URL('grounding-v12-review-generalization.json',folder),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
writeFileSync(new URL('grounding-v12-review-generalization.txt',folder),text,{flag:'wx'});
console.log(JSON.stringify(report.summary));
