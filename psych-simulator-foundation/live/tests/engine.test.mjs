import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulateHistory,baselineSnapshot,publicBrief} from '../engine.mjs';
import {baseline} from './helpers.mjs';
test('Same seed and schedule reproduce full history, trace and hash',()=>{
  const a=simulateHistory({seed:42}),b=simulateHistory({seed:42});assert.deepEqual(a,b);
  assert.notEqual(a.hash,simulateHistory({seed:43}).hash);assert.equal(a.trace.length,28);
});
test('All allowed seeds keep state bounded and functioning internally consistent',()=>{
  for(const seed of [0,1,42,255,4294967295]){
    const s=simulateHistory({seed,days:90});
    assert.equal(s.functioning.completed+s.functioning.postponed,s.functioning.tasks);
    for(const day of s.symptoms)for(const k of ['tension','moodBurden','energy'])assert.ok(day[k]>=0&&day[k]<=1);
    assert.equal(s.memory.length,90);assert.equal(s.gad7,null);
  }
});
test('Hidden world information is absent from client memories and fact projection',()=>{
  const s=simulateHistory({seed:42});assert.ok(s.events.some(x=>x.kind==='cancelled'));
  assert.ok(s.events.some(x=>x.world.includes('unexpected work shift')));
  assert.ok(!JSON.stringify(s.memory).includes('unexpected work shift'));
  assert.ok(!JSON.stringify(s.facts).includes('unexpected work shift'));
});
test('Frozen snapshots reject nested mutation and preserve source case',()=>{
  const before=structuredClone(baseline),s=baselineSnapshot(baseline),g=simulateHistory();
  assert.throws(()=>s.facts[0].response='new');assert.throws(()=>g.finalState.emotion.tension=1);
  assert.deepEqual(baseline,before);assert.equal(g.classification.status,'No clinical classification or diagnostic thresholds applied');
});
test('Public brief contains no hidden case or psychological state',()=>{
  for(const s of [baselineSnapshot(baseline),simulateHistory()]){
    const b=publicBrief(s);assert.ok(!('facts' in b));assert.ok(!('trace' in b));assert.ok(!('finalState' in b));assert.ok(!JSON.stringify(b).includes('working_formulation'));
  }
});
test('Invalid seeds and time windows reject',()=>{
  for(const seed of [-1,.2,NaN,'42',4294967296])assert.throws(()=>simulateHistory({seed}));
  for(const days of [0,91,1.2,'28'])assert.throws(()=>simulateHistory({days}));
});
