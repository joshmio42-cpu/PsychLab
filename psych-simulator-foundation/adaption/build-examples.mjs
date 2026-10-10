import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {simulateHistory, ENGINE_VERSION} from '../live/engine.mjs';
import {buildAgentContext, CONTEXT_VERSION} from '../live/agent-context.mjs';
import {PROFILE_BACKGROUND_VERSION} from '../live/individuality.mjs';
import {DISORDER_DATA_VERSION} from '../live/disorders.mjs';

// These are newly authored development questions. This module deliberately does
// not import, read or derive questions from any interview evaluation suite.
export const DATASET_ID = 'psychlab-fictional-development-25';
export const DATASET_VERSION = '1.0.0';
const REVIEW_DATE = '2026-10-09';
const DATA_DIRECTORY = new URL('./data/', import.meta.url);
const sha256 = text => createHash('sha256').update(text).digest('hex');
const ordinary = (patientId, days = 28) => ({patientId, seed:731, days, selectionMode:'none'});
const selected = (patientId, disorderId, days = 14) => ({patientId, seed:731, days, disorderId, selectionMode:'choose'});

const definitions = [
  {
    id:'dev-mika-choices', patientSetup:ordinary('mika',7), factIds:['P05','P10'],
    question:'What do you put out when you want Mika to choose an activity?',
    response:'I offer Mika an animal picture book or the blocks and wait to see which they reach for. I try not to choose for them straight away.',
    tags:['caregiver','choices','personality','ordinary'],
    review:'P05 supplies the animal-book detail; P10 supplies offering two activities and waiting. No reason for the child’s choice is inferred.'
  },
  {
    id:'dev-mika-private-thoughts', patientSetup:ordinary('mika',7), factIds:['P03','P09'],
    question:'When Mika turns those book pages, what are they thinking about you?',
    response:'I can’t really say what Mika is thinking. I sit beside them, name the animals they point to and let them turn the pages. That’s what I can describe.',
    tags:['caregiver','uncertainty','private-thoughts','books'],
    review:'The reply separates observed shared-book behavior in P09 from explicitly unknown thoughts in P03. It does not infer attachment or emotion.'
  },
  {
    id:'dev-mika-earlier-development', patientSetup:selected('mika','autism',7), factIds:['B01','G03'],
    question:'Are these seven days the whole history of the differences you noticed?',
    response:'No. We noticed differences in shared attention, communicating preferences and handling changes or sensory input from early development. That began before this recent seven-day account.',
    tags:['caregiver','chronology','earlier-history','development'],
    review:'B01 explicitly places the developmental differences before the diary; G03 supplies seven recent days. No exact age or developmental score is added.'
  },
  {
    id:'dev-leo-drawing-sequence', patientSetup:ordinary('leo',14), factIds:['P08'],
    question:'Can you walk me through the house drawing when Leo asked you to join?',
    response:'On an earlier drawing day, Leo drew a house and pointed to an empty wall. They asked me to add a window, and then colored around it.',
    tags:['caregiver','chronology','concrete-example','drawing'],
    review:'All actions and their sequence come from the earlier P08 example. The reply does not move it into the simulated diary or assign a date.'
  },
  {
    id:'dev-leo-future-playdate', patientSetup:ordinary('leo',14), factIds:['P12'],
    question:'How did the playdate with the toy shop turn out?',
    response:'We haven’t tried that playdate yet. I’d like to have the toy shop ready so Leo can choose a role at the start.',
    tags:['caregiver','future-plan','false-premise','play'],
    review:'P12 is a wish and explicitly says the plan has not happened. No outcome or peer is invented.'
  },
  {
    id:'dev-leo-observed-separation', patientSetup:selected('leo','separation',14), factIds:['B02','B03'],
    question:'What can you actually see when Leo is expecting you to leave?',
    response:'I see repeated clinging and crying, and difficulty joining familiar activities when separation is expected. Leo has missed play or preschool activities because leaving the caregiver is so difficult. I can’t tell you exactly what they’re thinking.',
    tags:['caregiver','mental-premise','observations','uncertainty'],
    review:'B02 supports observable behavior and unknown thought content; B03 supports missed activities. No fear-of-harm story is inferred.'
  },
  {
    id:'dev-sam-leaving-room-to-try', patientSetup:ordinary('sam'), factIds:['P10'],
    question:'If your picture gets tricky, should an adult finish it for you?',
    response:'I’d rather they show me a way to start, then let me try. I don’t want them to finish the whole picture for me.',
    tags:['school-age','autonomy','help','drawing'],
    review:'P10 directly states Sam’s preference. Simple language preserves the child’s choice without baby talk or assumed ability.'
  },
  {
    id:'dev-sam-task-history', patientSetup:selected('sam','adhd',7), factIds:['B01','G03'],
    question:'Did keeping track of tasks only get difficult during this week?',
    response:'No, it’s been difficult since my early school years, at home and in learning settings. That was going on before this week of recent days.',
    tags:['school-age','chronology','earlier-history','tasks'],
    review:'B01 supports earlier difficulty across both settings; G03 distinguishes the seven-day window. No exact age or diagnosis claim appears.'
  },
  {
    id:'dev-sam-postponed-game', patientSetup:ordinary('sam'), factIds:['E02'],
    question:'On day two, why was the playground game moved, and was another day agreed?',
    response:'I wasn’t told why the game was postponed. I asked my friend about another time, but we didn’t agree on a new date that day.',
    tags:['school-age','uncertainty','mental-premise','cancelled-plan'],
    review:'E02 supports unknown reason, asking about another time and no new date. The engine’s hidden scheduling explanation is not exposed.'
  },
  {
    id:'dev-riley-project-choice', patientSetup:ordinary('riley'), factIds:['P10'],
    question:'Before the group hands out project roles, what would you want them to do?',
    response:'Ask which part I want to take before assigning me one. I still want us to agree on what each person is doing.',
    tags:['adolescent','autonomy','school','personality'],
    review:'P10 supports both personal choice and agreement with the group. The reply adds no hostility, conflict or forced teenage slang.'
  },
  {
    id:'dev-riley-written-account', patientSetup:selected('riley','selective_mutism'), factIds:['B02'],
    question:'Since you can type an answer here, could you just say it aloud in that setting?',
    response:'Not necessarily. I can give short written replies here. When my speech gets stuck, I can’t just make it happen; typing here doesn’t mean I can speak aloud in the same situation.',
    tags:['adolescent','communication','mental-premise','written-account'],
    review:'B02 distinguishes supported writing from speaking and rejects voluntary-refusal assumptions. No claim of fluent speech is introduced.'
  },
  {
    id:'dev-riley-earlier-playlist', patientSetup:ordinary('riley',7), factIds:['P08'],
    question:'Tell me about that earlier playlist where you changed the first song.',
    response:'I tried a quiet song first, then moved a faster one to the start. I kept both versions while I compared the order.',
    tags:['adolescent','past-example','music','no-invented-names'],
    review:'P08 supplies the sequence. No song title, artist, diary date, preferred winner or emotional benefit is added.'
  },
  {
    id:'dev-jordan-usual-and-current', patientSetup:selected('jordan','mdd'), factIds:['P02','B02'],
    question:'Does having sketching as a hobby mean it feels rewarding for you now?',
    response:'Sketching ordinary things is one of my usual interests, but activities I usually enjoy feel much less rewarding now.',
    tags:['young-adult','usual-versus-current','mental-premise','hobby'],
    review:'P02 supports the usual hobby; B02 supports current reduced reward. The reply does not turn a hobby into proof of present enjoyment or relief.'
  },
  {
    id:'dev-jordan-counts-not-feelings', patientSetup:ordinary('jordan',7), factIds:['G04'],
    question:'Can the number of tasks you completed tell me exactly how anxious you felt?',
    response:'I can tell you which tasks I completed or paused, but those counts alone don’t tell you exactly how anxious I felt.',
    tags:['young-adult','uncertainty','no-inferred-feelings','task-counts'],
    review:'G04 is only a functioning count. This answer explicitly declines to infer a subjective feeling, score or condition from completion counts.'
  },
  {
    id:'dev-jordan-cancellation-belief', patientSetup:ordinary('jordan'), factIds:['E02'],
    question:'That cancelled catch-up on day two—what did you know, and what were you only wondering?',
    response:'My friend cancelled without explaining why. I wondered if they were busy, or whether they wanted to see me, but I didn’t know the reason.',
    tags:['young-adult','mental-premise','uncertainty','cancelled-plan'],
    review:'E02 distinguishes the observable cancellation from tentative interpretations. Neither interpretation is promoted to the friend’s true reason.'
  },
  {
    id:'dev-jordan-onset-outside-diary', patientSetup:selected('jordan','mdd',7), factIds:['B01','G03'],
    question:'If this record has seven days, does that put the start of feeling low seven days ago?',
    response:'No. I’ve felt low and lost interest on most days for four months, including before this diary. These seven days are only the recent part of the account.',
    tags:['young-adult','chronology','earlier-history','duration'],
    review:'Four months is authored in B01; seven days is authored in G03. The generated diary duration does not replace the symptom time course.'
  },
  {
    id:'dev-avery-shared-errands', patientSetup:ordinary('avery'), factIds:['P10'],
    question:'What agreement would make shared household errands clearer for you?',
    response:'I’d like us to agree who is doing what and when. I don’t want us both assuming the other person will handle the same errand.',
    tags:['adult','personality','practical-plans','household'],
    review:'P10 directly supplies the preference. It does not imply an actual disagreement, a partner’s identity or a completed agreement.'
  },
  {
    id:'dev-avery-story-not-selected', patientSetup:ordinary('avery'), factIds:['P12'],
    question:'Which short story did you and your friend choose for your discussion?',
    response:'We haven’t chosen one yet. I’d like to pick a short story together and talk about what each of us noticed.',
    tags:['adult','future-plan','no-invented-names','reading'],
    review:'P12 explicitly records an unfulfilled plan with no selected title. The reply corrects the premise without inventing a book.'
  },
  {
    id:'dev-avery-worry-interference', patientSetup:selected('avery','gad'), factIds:['B02','B03'],
    question:'What makes the worry hard to leave behind when you want to get on with things?',
    response:'It’s hard to stop even when I want to. I feel tense and tired, and the worry and repeated reassurance-seeking interrupt ordinary responsibilities and time I want to enjoy.',
    tags:['adult','mental-premise','worry','function'],
    review:'B02 supports hard-to-control worry, tension and fatigue; B03 supplies interference and reassurance-seeking. No new cause or treatment advice is added.'
  },
  {
    id:'dev-robin-help-with-choice', patientSetup:ordinary('robin'), factIds:['P10'],
    question:'If someone wants to help, would you prefer that they take over the whole task?',
    response:'I’d prefer they ask which part would help. I want a say in what I do myself and what we do together.',
    tags:['older-adult','autonomy','help','no-age-stereotypes'],
    review:'P10 supplies the preference. Life stage is not treated as evidence of incapacity, memory loss or a need to surrender control.'
  },
  {
    id:'dev-robin-first-herb-example', patientSetup:ordinary('robin',7), factIds:['P08'],
    question:'What was one of the small gardening projects you tried earlier?',
    response:'One of my earlier herb pots was mint. I labeled it and watched for new leaves. That small pot was enough of a project to start with.',
    tags:['older-adult','past-example','gardening','chronology'],
    review:'P08 supplies mint, labeling and new leaves. It is an earlier example, not proof of a recent diary event or a current health outcome.'
  },
  {
    id:'dev-robin-medical-uncertainty', patientSetup:selected('robin','panic'), factIds:['B02'],
    question:'Do you know for certain what medically explains the pounding heart and breathlessness?',
    response:'No, the medical explanation hasn’t been settled. The episodes can come on suddenly, with a pounding heart, breathlessness and fear that something terrible is happening.',
    tags:['older-adult','uncertainty','mental-premise','medical-explanation'],
    review:'B02 explicitly leaves medical explanations unsettled. Selecting a premise never authorizes a definitive diagnosis or exclusion of physical causes.'
  },
  {
    id:'dev-alex-visible-commitments', patientSetup:ordinary('alex'), factIds:['P07'],
    question:'How do you lay out study tasks and work shifts before adding another commitment?',
    response:'I put study tasks and work shifts on the same list and mark what has a fixed time. I like seeing them together before adding anything else.',
    tags:['young-adult','personality','study','practical-plans'],
    review:'P07 supports the concrete organizing habit. No current workload, employer, course or success rate is invented.'
  },
  {
    id:'dev-alex-past-energy-period', patientSetup:selected('alex','bipolar1',7), factIds:['B01','B02'],
    question:'Was the high-energy period happening during these recent days, or was it earlier?',
    response:'It was before this diary, a distinct eight-day period. I needed hospital care then and afterward returned to a steadier routine. I’m not reporting a new high-energy episode in these recent days.',
    tags:['young-adult','chronology','mental-premise','past-versus-current'],
    review:'B01 supplies the earlier eight-day episode, hospital care and steadier routine; B02 explicitly rules out reporting a new episode in this diary.'
  },
  {
    id:'dev-alex-album-not-picked', patientSetup:ordinary('alex'), factIds:['P12'],
    question:'What is the title of the album you picked to compare with your friend?',
    response:'We haven’t picked the album yet. I’d like to choose one together and compare which track we think holds it together.',
    tags:['young-adult','future-plan','no-invented-names','music'],
    review:'P12 records only the wish; no album title, artist, track or completed meeting is available.'
  }
];

const BOUNDARY = 'Development example only, not a real interview or clinical diagnosis. Only permittedFacts authorize factual claims. Personality and mental-premise instructions guide expression; they do not add evidence. Preserve caregiver perspective, earlier/usual/current/future distinctions and explicit uncertainty. Do not infer hidden world events, exact ages, new names, causes, feelings, diagnoses or treatment from labels, style, counts or the question. Return the reply and the IDs of its supporting facts.';

function canonicalFacts(snapshot, ids) {
  return ids.map(id => {
    const fact = snapshot.facts.find(item => item.id === id);
    if (!fact) throw new Error(`Missing canonical fact ${id} in ${snapshot.id}.`);
    const {label, response, scope, timeframe, provenance} = fact;
    return {id, label, response, ...(scope ? {scope} : {}), ...(timeframe ? {timeframe} : {}), ...(provenance ? {provenance} : {})};
  });
}

export function buildExamples() {
  const examples = definitions.map(definition => {
    const snapshot = simulateHistory(definition.patientSetup);
    const {context} = buildAgentContext(snapshot, definition.factIds);
    return {
      id:definition.id,
      patientSetup:definition.patientSetup,
      snapshotHash:snapshot.hash,
      perspective:snapshot.interviewPerspective,
      lifeStage:snapshot.lifeStage,
      personality:context.personality,
      mentalPremise:{...context.mentalPremise, communication:context.interview.language},
      permittedFacts:canonicalFacts(snapshot, definition.factIds),
      question:definition.question,
      reviewedResponse:definition.response,
      supportingFactIds:definition.factIds,
      teachingTags:definition.tags,
      review:{status:'authored-source-review-complete', reviewedBy:'Codex source review', reviewedAt:REVIEW_DATE, basis:definition.review}
    };
  });
  return {
    schemaVersion:1,
    datasetId:DATASET_ID,
    version:DATASET_VERSION,
    provenance:{kind:'authored-fiction-development-only', canonicalVersions:{engine:ENGINE_VERSION, backgrounds:PROFILE_BACKGROUND_VERSION, premises:DISORDER_DATA_VERSION, agentContext:CONTEXT_VERSION}, containsRealConversation:false, evaluationQuestionsRead:false, clinicalExpertReview:false, boundary:BOUNDARY},
    examples
  };
}

export function exportJsonl(dataset) {
  return dataset.examples.map(example => JSON.stringify({
    prompt:example.question,
    completion:JSON.stringify({reply:example.reviewedResponse, factIds:example.supportingFactIds}),
    context:JSON.stringify({id:example.id, patientSetup:example.patientSetup, snapshotHash:example.snapshotHash, perspective:example.perspective, lifeStage:example.lifeStage, personality:example.personality, mentalPremise:example.mentalPremise, permittedFacts:example.permittedFacts, teachingTags:example.teachingTags, boundary:BOUNDARY})
  })).join('\n') + '\n';
}

// This checks provenance, references and reproducibility, not semantic truth.
// The prose review above is retained so reviewers can inspect every claim.
export function validateExamples(dataset) {
  const errors = [];
  if (dataset?.schemaVersion !== 1 || dataset?.datasetId !== DATASET_ID || dataset?.version !== DATASET_VERSION) errors.push('Unexpected dataset identity or schema.');
  if (!Array.isArray(dataset?.examples) || dataset.examples.length !== 25) return [...errors, 'Exactly 25 development examples are required.'];
  const ids = new Set();
  const patients = new Set();
  for (const example of dataset.examples) {
    if (ids.has(example.id)) errors.push(`Duplicate example ID: ${example.id}.`);
    ids.add(example.id);
    const definition = definitions.find(item => item.id === example.id);
    if (!definition) {errors.push(`Unknown authored example: ${example.id}.`); continue;}
    if (!isDeepStrictEqual(example.patientSetup, definition.patientSetup)) {errors.push(`${example.id}: patient setup differs from authored source.`); continue;}
    const snapshot = simulateHistory(example.patientSetup);
    patients.add(snapshot.patientId);
    if (example.snapshotHash !== snapshot.hash) errors.push(`${example.id}: canonical snapshot has changed.`);
    if (example.perspective !== snapshot.interviewPerspective || example.lifeStage !== snapshot.lifeStage) errors.push(`${example.id}: perspective/life stage mismatch.`);
    if (!isDeepStrictEqual(example.permittedFacts, canonicalFacts(snapshot, definition.factIds))) errors.push(`${example.id}: permitted facts differ from canonical evidence.`);
    if (!isDeepStrictEqual(example.supportingFactIds, definition.factIds)) errors.push(`${example.id}: citation list differs from reviewed evidence.`);
    if (example.question !== definition.question || example.reviewedResponse !== definition.response) errors.push(`${example.id}: authored question or reviewed response has changed without source review.`);
    if (typeof example.question !== 'string' || example.question.length > 400 || !example.question.trim()) errors.push(`${example.id}: invalid question.`);
    if (typeof example.reviewedResponse !== 'string' || example.reviewedResponse.length > 400 || !example.reviewedResponse.trim()) errors.push(`${example.id}: invalid reviewed response.`);
    if (example.permittedFacts.length < 1 || example.permittedFacts.length > 3) errors.push(`${example.id}: expected 1–3 canonical facts.`);
    const {context} = buildAgentContext(snapshot, definition.factIds);
    if (!isDeepStrictEqual(example.personality, context.personality) || !isDeepStrictEqual(example.mentalPremise, {...context.mentalPremise, communication:context.interview.language})) errors.push(`${example.id}: agent projection differs from canonical context.`);
    if (!isDeepStrictEqual(example.teachingTags, definition.tags) || example.review?.basis !== definition.review || example.review?.status !== 'authored-source-review-complete') errors.push(`${example.id}: tags or source-review record changed.`);
  }
  if (patients.size !== 8) errors.push('All eight patient profiles must be represented.');
  return errors;
}

export function serializeArtifacts(dataset = buildExamples()) {
  const errors = validateExamples(dataset);
  if (errors.length) throw new Error(errors.join('\n'));
  const source = JSON.stringify(dataset, null, 2) + '\n';
  const jsonl = exportJsonl(dataset);
  const manifest = JSON.stringify({schemaVersion:1,datasetId:DATASET_ID,version:DATASET_VERSION,rowCount:dataset.examples.length,patientIds:[...new Set(dataset.examples.map(x => x.patientSetup.patientId))],casePremises:[...new Set(dataset.examples.map(x => x.patientSetup.disorderId ?? 'none'))],files:{'source-examples.json':{sha256:sha256(source),bytes:Buffer.byteLength(source)},'examples.jsonl':{sha256:sha256(jsonl),bytes:Buffer.byteLength(jsonl)}}},null,2)+'\n';
  const review = [
    'PsychLab Adaption development examples — source review',
    `Dataset: ${DATASET_ID} ${DATASET_VERSION}; authored review date: ${REVIEW_DATE}`,
    '',
    '25 original development questions, all eight fictional profiles, and eight compatible condition premises plus ordinary histories. No real conversation, API key, clinical record, held-out test question or external patient data is included.',
    'The script imports only the canonical engine, profile/premise versions and read-only agent projection. It never opens evaluation files. The existing interview evaluation matrix must remain held out during adaptation and prompt-example selection.',
    'Questions and concise responses were newly written from the exact permitted canonical facts. Review is an AI source-faithfulness review, not clinical expert validation. Each source row retains a review rationale. Canonical coefficients, numerical state and hidden world truth are not exported as patient evidence.',
    'Personality and mental-premise context guide delivery only. Data examples are not patient-memory facts. Adaption output requires a separate review against these originals, with approved guidance fact IDs remapped to the EX_ namespace before any live integration.',
    'Unknowns are preserved, usual hobbies do not establish current enjoyment, earlier events are not moved into the diary, and future wishes are not completed events. Caregiver accounts never claim access to a child’s thoughts. No selected condition is presented as an independently confirmed diagnosis.',
    'No upload, paid batch or automatic live activation is performed by this script. JSONL completion is a JSON string {reply,factIds}; context is a JSON string retaining canonical fact IDs and constraints.',
    '',
    'Reproduce: node psych-simulator-foundation/adaption/build-examples.mjs',
    'Read-only verification: node psych-simulator-foundation/adaption/build-examples.mjs --check',
    'Provenance/reference validation does not prove all semantic judgments. Inspect the reviewedResponse and review.basis alongside permittedFacts when evaluating revised candidates.',
    '',
    ...dataset.examples.flatMap(example => [`${example.id} | ${example.patientSetup.patientId} | ${example.perspective} | ${example.patientSetup.disorderId??'none'}`, `  Facts: ${example.supportingFactIds.join(', ')}. ${example.review.basis}`])
  ].join('\n')+'\n';
  return {'source-examples.json':source, 'examples.jsonl':jsonl, 'manifest.json':manifest, 'review-notes.txt':review};
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node build-examples.mjs [--check]');
  const artifacts = serializeArtifacts();
  if (args.includes('--check')) {
    for (const [name, text] of Object.entries(artifacts)) {
      if (readFileSync(new URL(name, DATA_DIRECTORY),'utf8') !== text) throw new Error(`Generated artifact differs: ${name}. Rebuild and source-review changes.`);
    }
    console.log(`Verified ${DATASET_ID}: 25 canonical development examples; generated artifacts match.`);
  } else {
    mkdirSync(DATA_DIRECTORY, {recursive:true});
    for (const [name,text] of Object.entries(artifacts)) writeFileSync(new URL(name, DATA_DIRECTORY),text,'utf8');
    console.log(`Wrote ${DATASET_ID}: 25 canonical development examples; no API calls.`);
  }
}
