import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildExamples, validateExamples, exportJsonl, serializeArtifacts} from '../build-examples.mjs';
import {simulateHistory} from '../../live/engine.mjs';

test('development corpus covers all eight profiles with 25 distinct authored examples', () => {
  const dataset = buildExamples();
  assert.equal(dataset.examples.length, 25);
  assert.equal(new Set(dataset.examples.map(row => row.id)).size, 25);
  assert.deepEqual(new Set(dataset.examples.map(row => row.patientSetup.patientId)),new Set(['mika','leo','sam','riley','jordan','avery','robin','alex']));
  assert.equal(dataset.examples.filter(row => row.perspective === 'caregiver').length,6);
  assert.equal(new Set(dataset.examples.filter(row => row.patientSetup.disorderId).map(row => row.patientSetup.disorderId)).size,8);
  assert.deepEqual(validateExamples(dataset),[]);
});

test('all source facts and state hashes exactly match frozen canonical patient histories', () => {
  for (const row of buildExamples().examples) {
    const snapshot = simulateHistory(row.patientSetup);
    assert.equal(row.snapshotHash,snapshot.hash,row.id);
    assert.equal(row.perspective,snapshot.interviewPerspective,row.id);
    assert.equal(row.lifeStage,snapshot.lifeStage,row.id);
    for (const fact of row.permittedFacts) assert.equal(fact.response,snapshot.facts.find(item=>item.id===fact.id)?.response,row.id);
    assert.deepEqual(row.supportingFactIds,row.permittedFacts.map(item=>item.id),row.id);
    assert.equal(row.personality.trait,'No measured trait scores. Do not invent a personality type.');
  }
});

test('source verification rejects fabricated fact text, mismatched citations and altered author review', () => {
  const dataset=buildExamples();
  dataset.examples[0].permittedFacts[0].response+=' Mika felt very safe.';
  dataset.examples[1].supportingFactIds=['P12'];
  dataset.examples[2].review.basis='Approved without evidence.';
  const errors=validateExamples(dataset);
  assert.ok(errors.some(text=>text.includes('dev-mika-choices: permitted facts')));
  assert.ok(errors.some(text=>text.includes('dev-mika-private-thoughts: citation list')));
  assert.ok(errors.some(text=>text.includes('dev-mika-earlier-development: tags or source-review')));
});

test('source verification rejects perspective changes, snapshot drift and unreviewed answer changes', () => {
  const dataset=buildExamples();
  dataset.examples[0].perspective='patient';
  dataset.examples[1].snapshotHash='0'.repeat(64);
  dataset.examples[2].reviewedResponse='These problems began seven days ago.';
  const errors=validateExamples(dataset);
  assert.ok(errors.some(text=>text.includes('perspective/life stage mismatch')));
  assert.ok(errors.some(text=>text.includes('canonical snapshot has changed')));
  assert.ok(errors.some(text=>text.includes('without source review')));
});

test('JSONL preserves citation mapping and source context using only the three mapped columns', () => {
  const dataset=buildExamples();
  const records=exportJsonl(dataset).trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(records.length,25);
  records.forEach((record,index)=>{
    const source=dataset.examples[index];
    assert.deepEqual(Object.keys(record),['prompt','completion','context']);
    assert.equal(record.prompt,source.question);
    assert.deepEqual(JSON.parse(record.completion),{reply:source.reviewedResponse,factIds:source.supportingFactIds});
    const context=JSON.parse(record.context);
    assert.equal(context.id,source.id);
    assert.deepEqual(context.permittedFacts,source.permittedFacts);
    assert.deepEqual(context.personality,source.personality);
    assert.deepEqual(context.mentalPremise,source.mentalPremise);
    assert.match(context.boundary,/Only permittedFacts authorize factual claims/);
    assert.ok(!Object.hasOwn(context,'trace'));
    assert.ok(!Object.hasOwn(context,'events'));
    assert.ok(!Object.hasOwn(context,'finalState'));
  });
});

test('cancellation examples cannot expose hidden world scheduling truth', () => {
  const rows=buildExamples().examples.filter(row=>row.teachingTags.includes('cancelled-plan'));
  assert.equal(rows.length,2);
  for(const row of rows) {
    const exported=JSON.stringify(row);
    assert.doesNotMatch(exported,/unexpected work shift|Another person had a scheduling conflict/);
    assert.match(row.reviewedResponse,/wasn’t told why|didn’t know the reason/);
    assert.equal(row.supportingFactIds[0],'E02');
  }
});

test('corpus retains earlier/future distinctions and does not treat hobbies as current enjoyment', () => {
  const rows=buildExamples().examples;
  for(const row of rows.filter(example=>example.teachingTags.includes('future-plan'))) {
    assert.ok(row.permittedFacts.every(fact=>fact.scope==='wish'));
    assert.match(row.reviewedResponse,/haven’t/);
  }
  const oldExamples=rows.filter(row=>row.permittedFacts.some(fact=>fact.scope==='past'));
  assert.ok(oldExamples.length>=3);
  for(const row of oldExamples) assert.ok(row.permittedFacts.filter(fact=>fact.scope==='past').every(fact=>fact.timeframe==='before-simulation'));
  const enjoyment=rows.find(row=>row.id==='dev-jordan-usual-and-current');
  assert.deepEqual(enjoyment.supportingFactIds,['P02','B02']);
  assert.match(enjoyment.reviewedResponse,/less rewarding now/);
});

test('generated artifacts are reproducible and their checked-in copies and hashes match', () => {
  const first=serializeArtifacts();
  const second=serializeArtifacts();
  assert.deepEqual(first,second);
  for(const [file,text] of Object.entries(first)) assert.equal(readFileSync(new URL(`../data/${file}`,import.meta.url),'utf8'),text,file);
  const manifest=JSON.parse(first['manifest.json']);
  for(const [file,entry] of Object.entries(manifest.files)) {
    assert.equal(entry.bytes,Buffer.byteLength(first[file]),file);
    assert.equal(entry.sha256,createHash('sha256').update(first[file]).digest('hex'),file);
  }
});
