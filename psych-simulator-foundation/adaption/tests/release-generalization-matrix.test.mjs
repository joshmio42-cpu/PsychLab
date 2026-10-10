import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {simulateHistory} from '../../live/engine.mjs';
import {difficultySettings} from '../../live/interview-style.mjs';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const matrix = read('../data/release-generalization-v2.json');
const normalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const allQuestions = row => [row.question, ...row.precedingTurns.map(turn => turn.question)];

test('Release v2 has sixteen independent cases, exactly two per profile and explicit behavioral rubrics', () => {
  assert.equal(matrix.schemaVersion, 1);
  assert.equal(matrix.cases.length, 16);
  assert.equal(new Set(matrix.cases.map(row => row.id)).size, 16);
  assert.equal(new Set(matrix.cases.map(row => normalize(row.question))).size, 16);
  const counts = new Map();
  for (const row of matrix.cases) {
    counts.set(row.fixture.patientId, (counts.get(row.fixture.patientId) ?? 0) + 1);
    assert.ok(row.expectedBehaviors.length >= 2 && row.forbiddenThings.length >= 2, row.id);
    assert.ok(row.expectedBehaviors.every(value => typeof value === 'string' && value.length > 20), row.id);
    assert.ok(row.forbiddenThings.every(value => typeof value === 'string' && value.length > 20), row.id);
    assert.ok(!Object.hasOwn(row, 'expectedAnswer'), `${row.id}: use semantic review, not target wording`);
  }
  assert.deepEqual([...counts.keys()].sort(), ['alex', 'avery', 'jordan', 'leo', 'mika', 'riley', 'robin', 'sam']);
  assert.ok([...counts.values()].every(count => count === 2));
});

test('Release fixtures reproduce frozen canonical evidence and all preceding-turn sources resolve', () => {
  for (const row of matrix.cases) {
    const snapshot = simulateHistory(row.fixture);
    const before = JSON.stringify(snapshot);
    const facts = new Map(snapshot.facts.map(fact => [fact.id, fact]));
    assert.equal(difficultySettings(row.fixture.difficulty).id, row.fixture.difficulty);
    assert.equal(snapshot.hash, row.sourceReview.snapshotHash, `${row.id}: frozen fixture drift`);
    assert.equal(snapshot.interviewPerspective, ['mika', 'leo'].includes(row.fixture.patientId) ? 'caregiver' : 'patient');
    assert.ok(Object.isFrozen(snapshot) && Object.isFrozen(snapshot.facts));
    assert.ok(snapshot.facts.every(Object.isFrozen));
    assert.throws(() => { snapshot.facts[0].response = 'changed'; }, TypeError);
    assert.throws(() => { snapshot.memory.push({}); }, TypeError);
    assert.equal(JSON.stringify(snapshot), before, `${row.id}: source mutation`);
    assert.equal(simulateHistory(row.fixture).hash, snapshot.hash, `${row.id}: nondeterministic fixture`);
    assert.ok(row.sourceReview.basis.length > 40, row.id);
    const references = [...new Set([...row.sourceReview.relevantFactIds, ...row.precedingTurns.flatMap(turn => turn.factIds)])];
    for (const id of references) assert.ok(facts.has(id), `${row.id}: unresolved canonical ID ${id}`);
    for (const turn of row.precedingTurns) {
      assert.equal(turn.kind, 'answer');
      assert.ok(turn.question.trim() && turn.reply.trim() && turn.factIds.length > 0, row.id);
      assert.ok(turn.factIds.every(id => row.sourceReview.relevantFactIds.includes(id)), `${row.id}: preceding source absent from review`);
    }
    assert.deepEqual(row.evidenceAssertions.map(item => item.factId).sort(), [...row.sourceReview.relevantFactIds].sort());
    for (const item of row.evidenceAssertions) {
      assert.equal(facts.get(item.factId).response, item.response, `${row.id}: canonical fact ${item.factId} changed`);
      assert.equal(facts.get(item.factId).scope ?? null, item.scope, `${row.id}: source scope changed`);
      assert.equal(facts.get(item.factId).timeframe ?? null, item.timeframe, `${row.id}: source timeframe changed`);
    }
  }
});

test('Release coverage varies seeds, windows, difficulty and meaningful known/unknown boundaries', () => {
  assert.equal(new Set(matrix.cases.map(row => row.fixture.seed)).size, 16);
  assert.equal(new Set(matrix.cases.map(row => row.fixture.days)).size, 16);
  assert.deepEqual([...new Set(matrix.cases.map(row => row.fixture.difficulty))].sort(), ['beginner', 'challenging', 'standard']);
  assert.ok(matrix.cases.filter(row => row.precedingTurns.length >= 2).length >= 4);
  assert.ok(matrix.cases.filter(row => row.tags.includes('clear-unknown')).length >= 4);
  assert.ok(matrix.cases.filter(row => row.tags.includes('known-answer')).length >= 8);
  for (const tag of ['caregiver', 'chronology', 'frequency', 'current-vs-past', 'wish-not-event', 'unknown-title', 'mental-premise', 'single-past-event', 'usual-not-event']) {
    assert.ok(matrix.cases.some(row => row.tags.includes(tag)), `Missing ${tag} coverage`);
  }
});

// Prior text is read by this post-authoring disjointness check only. Failure output
// identifies the new case and source bucket; it never includes older questions.
test('Release questions do not duplicate older 36/8/16 matrices or training questions', () => {
  const older = [
    ['36-case', read('../../../work/natural-conversation-evaluation.json'), 36],
    ['8-case', read('../data/guidance-transfer-evaluation.json'), 8],
    ['16-case', read('../data/grounding-generalization-evaluation.json'), 16]
  ];
  const sets = [];
  for (const [label, data, count] of older) {
    assert.equal(data.cases.length, count, `${label}: reference count changed`);
    sets.push([label, new Set(data.cases.flatMap(row => [row.question, ...(row.precedingTurns ?? []).map(turn => turn.question)]).filter(Boolean).map(normalize))]);
  }
  const trainingStrings = new Set();
  const visit = value => {
    if (typeof value === 'string') {
      trainingStrings.add(normalize(value));
      if (/^\s*[\[{]/.test(value)) { try { visit(JSON.parse(value)); } catch {} }
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(read('../data/source-examples.json'));
  const jsonl = new URL('../data/examples.jsonl', import.meta.url);
  if (existsSync(jsonl)) for (const line of readFileSync(jsonl, 'utf8').split(/\r?\n/).filter(value => value.trim())) visit(JSON.parse(line));
  sets.push(['training', trainingStrings]);
  for (const row of matrix.cases) for (const question of allQuestions(row)) for (const [label, questions] of sets) {
    assert.ok(!questions.has(normalize(question)), `${row.id}: normalized question duplicate in ${label}`);
  }
});
