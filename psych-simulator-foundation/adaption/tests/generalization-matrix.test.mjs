import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {simulateHistory} from '../../live/engine.mjs';
import {difficultySettings} from '../../live/interview-style.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const matrix = json('../data/grounding-generalization-evaluation.json');
const earlierMatrices = [json('../data/guidance-transfer-evaluation.json'), json('../../../work/natural-conversation-evaluation.json')];
const development = json('../data/source-examples.json');
const normalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

test('Fresh grounding matrix is a distinct 16-case held-out set with two cases for each canonical profile', () => {
  assert.equal(matrix.version, '1.0.0');
  assert.equal(matrix.cases.length, 16);
  assert.equal(new Set(matrix.cases.map(row => row.id)).size, 16);
  assert.equal(new Set(matrix.cases.map(row => normalize(row.question))).size, 16);
  const counts = new Map();
  for (const row of matrix.cases) counts.set(row.fixture.patientId, (counts.get(row.fixture.patientId) ?? 0) + 1);
  assert.deepEqual([...counts.keys()].sort(), ['alex', 'avery', 'jordan', 'leo', 'mika', 'riley', 'robin', 'sam']);
  assert.ok([...counts.values()].every(value => value === 2));
  const earlierQuestions = new Set([...earlierMatrices.flatMap(value => value.cases.map(row => row.question)), ...development.examples.map(row => row.question)].map(normalize));
  for (const row of matrix.cases) assert.ok(!earlierQuestions.has(normalize(row.question)), `${row.id}: repeats an existing evaluation or development question`);
});

test('Every preceding-turn and review evidence ID resolves in its exact frozen fixture', () => {
  for (const row of matrix.cases) {
    const snapshot = simulateHistory(row.fixture);
    const facts = new Map(snapshot.facts.map(fact => [fact.id, fact]));
    assert.equal(difficultySettings(row.fixture.difficulty).id, row.fixture.difficulty);
    assert.equal(snapshot.interviewPerspective, ['mika', 'leo'].includes(row.fixture.patientId) ? 'caregiver' : 'patient');
    assert.ok(row.expectedBehaviors.length >= 2 && row.forbiddenThings.length >= 2, row.id);
    assert.ok(row.sourceReview.basis.length > 30, row.id);
    const references = [...row.sourceReview.relevantFactIds, ...row.precedingTurns.flatMap(turn => turn.factIds)];
    for (const id of references) assert.ok(facts.has(id), `${row.id}: missing canonical ${id}`);
    for (const turn of row.precedingTurns) {
      assert.ok(turn.question.trim() && turn.reply.trim(), `${row.id}: empty preceding turn`);
      assert.equal(turn.kind, 'answer');
      if (turn.interaction === 'social') assert.deepEqual(turn.factIds, [], `${row.id}: social fixture turn must not introduce evidence`);
      else assert.ok(turn.factIds.length > 0, `${row.id}: substantive preceding turn needs canonical evidence`);
    }
    for (const assertion of row.evidenceAssertions) {
      assert.ok(row.sourceReview.relevantFactIds.includes(assertion.factId), `${row.id}: assertion missing review reference`);
      assert.ok(facts.get(assertion.factId)?.response.includes(assertion.includes), `${row.id}: canonical evidence changed for ${assertion.factId}`);
    }
    assert.ok(row.sourceReview.relevantFactIds.length === 0 || row.evidenceAssertions.length > 0, `${row.id}: no evidence drift assertion`);
  }
});

test('Coverage includes varied histories, all difficulty levels and independently scored known/unknown callback distinctions', () => {
  assert.ok(new Set(matrix.cases.map(row => row.fixture.seed)).size >= 8);
  assert.ok(new Set(matrix.cases.map(row => row.fixture.days)).size >= 8);
  assert.deepEqual([...new Set(matrix.cases.map(row => row.fixture.difficulty))].sort(), ['beginner', 'challenging', 'standard']);
  assert.ok(matrix.cases.filter(row => row.tags.includes('multi-turn-callback') && row.precedingTurns.length >= 2).length >= 4);
  assert.ok(matrix.cases.filter(row => row.tags.includes('mental-premise')).length >= 4);
  assert.ok(matrix.cases.some(row => row.tags.includes('ambiguous-question') && row.precedingTurns.length === 0));
  assert.ok(matrix.cases.some(row => row.tags.includes('clear-question') && row.tags.includes('unknown-title')));
  for (const tag of ['style-not-fact', 'sometimes', 'usual-not-event', 'single-past-event', 'wish-not-event', 'multipart-support', 'caregiver']) {
    assert.ok(matrix.cases.some(row => row.tags.includes(tag)), `Missing behavioral coverage: ${tag}`);
  }
  assert.match(matrix.evaluationMethod.review, /no exact-match/i);
  assert.match(matrix.evaluationMethod.hardPass, /blocked ordinary question fails usefulness/i);
});
