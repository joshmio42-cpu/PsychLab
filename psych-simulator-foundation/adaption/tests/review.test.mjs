import test from 'node:test';
import assert from 'node:assert/strict';
import {buildExamples,exportJsonl} from '../build-examples.mjs';
import {prepareReview,parseCompletion,digest,REVIEW_CHECKS} from '../prepare-review.mjs';
import {compilePack,anonymize} from '../compile-pack.mjs';
import {validateExampleGuidancePack} from '../../live/example-guidance.mjs';

// Synthetic provider-shaped fixtures only. These unchanged baseline answers are
// not represented as outputs from a real Adaption job or evidence of improvement.
const source=buildExamples(),sourceText=JSON.stringify(source,null,2)+'\n';
const createdAt='2026-10-09T07:20:00.000Z';
function fixture(change=records=>records){
  const records=source.examples.map(row=>({original_prompt:row.question,original_completion:JSON.stringify({reply:row.reviewedResponse,factIds:row.supportingFactIds}),enhanced_prompt:row.question,enhanced_completion:JSON.stringify({reply:row.reviewedResponse,factIds:row.supportingFactIds}),unknown_provider_context:{doNotTrust:'This extra field is retained, not interpreted.'}}));
  const outputText=change(records).map(record=>JSON.stringify(record)).join('\n')+'\n';
  const runState={datasetId:'fixture-dataset',runId:'fixture-run',dataHash:digest(exportJsonl(source)),remote:{status:'succeeded'},download:{sha256:digest(outputText),partial:false}};
  return {sourceText,outputText,runState};
}
function reviewed(inputs,reject=[]){
  const review=prepareReview({...inputs,createdAt});
  for(const row of review.entries)row.decision={status:reject.includes(row.sourceId)?'rejected':'approved',reviewedBy:'Fixture reviewer',reviewedAt:createdAt,rationale:'Synthetic fixture decision for gate testing; not a real output approval.',checks:Object.fromEntries(REVIEW_CHECKS.map(key=>[key,true])),reviewedHashes:structuredClone(row.hashes),additionalTags:[],factExcerpts:{}};
  return review;
}

test('preparation keeps provider bytes and unknown columns without granting automatic approval',()=>{
  const inputs=fixture(),review=prepareReview({...inputs,createdAt});
  assert.equal(review.structural.valid,true);
  assert.equal(review.structural.compilationEligible,true);
  assert.equal(review.entries.length,25);
  assert.equal(review.entries[0].rawLine,inputs.outputText.split('\n')[0]);
  assert.deepEqual(review.entries[0].rawRecord.unknown_provider_context,{doNotTrust:'This extra field is retained, not interpreted.'});
  assert.ok(review.entries.every(row=>row.decision.status==='pending'&&row.decision.reviewedHashes===null));
  assert.throws(()=>compilePack({...inputs,review}),/still pending/);
});

test('verified mapped-column export supports an explicitly unchanged null enhanced prompt and exact contexts',()=>{
  const uploads=new Map(exportJsonl(source).trim().split('\n').map(line=>{const row=JSON.parse(line);return [row.prompt,row];}));
  const inputs=fixture(records=>records.map(record=>({prompt:record.original_prompt,completion:record.original_completion,enhanced_prompt:null,enhanced_completion:record.enhanced_completion,context:uploads.get(record.original_prompt).context,original_context:uploads.get(record.original_prompt).context})));
  const review=prepareReview({...inputs,createdAt});
  assert.equal(review.structural.valid,true);
  for(const row of review.entries){
    assert.equal(row.candidate.question,row.canonical.question);
    assert.deepEqual(row.sourceColumns,{originalQuestion:'prompt',originalCompletion:'completion',candidateQuestion:'prompt',questionUnchanged:true,verifiedContext:['context','original_context']});
    assert.match(row.notes.join(' '),/no question rephrasing/);
  }
});

test('conflicting mapped aliases and changed original contexts block batch provenance',()=>{
  const context=JSON.parse(exportJsonl(source).trim().split('\n')[0]).context;
  for(const change of [
    records=>{records[0].prompt='A conflicting question';return records;},
    records=>{records[0].completion='A conflicting completion';return records;},
    records=>{records[0].context=context+' ';return records;},
    records=>{records[0].original_context=context.replace('caregiver','patient');return records;}
  ]){
    const inputs=fixture(change),review=prepareReview({...inputs,createdAt});
    assert.equal(review.structural.compilationEligible,false);
    assert.ok(review.entries[0].blockingIssues.length>0);
  }
});

test('agreeing original and mapped aliases pass, but absent enhanced prompt is not silently repaired',()=>{
  const agreeing=fixture(records=>records.map(record=>({...record,prompt:record.original_prompt,completion:record.original_completion})));
  assert.equal(prepareReview({...agreeing,createdAt}).structural.valid,true);
  const missing=fixture(records=>{delete records[0].enhanced_prompt;return records;});
  const review=prepareReview({...missing,createdAt});
  assert.equal(review.structural.valid,false);
  assert.equal(review.structural.compilationEligible,true);
  assert.equal(review.entries[0].candidate,null);
});

test('compiled pack uses only explicit semantic approvals with pinned evidence and isolated fact IDs',()=>{
  const inputs=fixture(),review=reviewed(inputs,['dev-jordan-counts-not-feelings']);
  review.entries.find(row=>row.sourceId==='dev-leo-observed-separation').decision.additionalTags=['separation','leave'];
  const {pack,report}=compilePack({...inputs,review,compiledAt:createdAt});
  assert.equal(validateExampleGuidancePack(pack).examples.length,24);
  assert.equal(report.rejectedCount,1);
  assert.equal(report.activated,false);
  for(const row of pack.examples){
    assert.ok(row.factIds.every(id=>id.startsWith('EX_')));
    assert.ok(row.sourceFacts.every(fact=>fact.id.startsWith('EX_')));
    assert.doesNotMatch([row.question,row.reply,...row.sourceFacts.map(fact=>fact.statement)].join(' '),/\bMika\b|\bLeo\b|\bSam\b|\bRiley\b|\bJordan\b|\bAvery\b|\bRobin\b|\bAlex\b/i);
  }
  const transformed=report.transforms.find(row=>row.id==='dev-mika-choices');
  assert.match(transformed.reply.original,/Mika/);
  assert.match(transformed.reply.compiled,/the child/);
  assert.ok(transformed.reply.replacements.length>0);
  assert.match(report.notice,/must not be described as unchanged Adaption output/);
});

test('malformed candidate JSON cannot be repaired or approved but can be individually rejected',()=>{
  const inputs=fixture(records=>{records[0].enhanced_completion='```json\n{"reply":"Hi","factIds":["P05"]}\n```';return records;});
  const review=reviewed(inputs);
  assert.equal(review.structural.valid,false);
  assert.equal(review.structural.compilationEligible,true);
  assert.equal(review.entries[0].candidate,null);
  assert.throws(()=>compilePack({...inputs,review}),/cannot be approved/);
  review.entries[0].decision.status='rejected';
  const result=compilePack({...inputs,review,compiledAt:createdAt});
  assert.equal(result.pack.examples.length,24);
  assert.equal(result.report.rejected[0].id,'dev-mika-choices');
});

test('completion schema rejects unknown keys, unsupported IDs and invalid reply types',()=>{
  assert.throws(()=>parseCompletion(JSON.stringify({reply:'hello',factIds:['P05'],extra:true})),/exactly reply/);
  assert.throws(()=>parseCompletion(JSON.stringify({reply:4,factIds:['P05']})),/exactly reply/);
  const inputs=fixture(records=>{records[0].enhanced_completion=JSON.stringify({reply:'An unsupported detail.',factIds:['B99']});return records;});
  const review=reviewed(inputs);
  assert.match(review.entries[0].issues.join(' '),/outside the permitted/);
  assert.throws(()=>compilePack({...inputs,review}),/cannot be approved/);
});

test('duplicate, unmatched and missing original questions block the entire compilation',()=>{
  for(const change of [records=>{records[1]=records[0];return records;},records=>{records[0].original_prompt='An unseen question';return records;},records=>records.slice(1)]){
    const inputs=fixture(change),review=reviewed(inputs);
    assert.equal(review.structural.compilationEligible,false);
    assert.throws(()=>compilePack({...inputs,review}),/identity or provenance ambiguity/);
  }
});

test('original completion corruption blocks batch while absent original completion is explicitly noted',()=>{
  const mismatch=fixture(records=>{records[0].original_completion='changed';return records;});
  assert.equal(prepareReview({...mismatch,createdAt}).structural.compilationEligible,false);
  const omitted=fixture(records=>{delete records[0].original_completion;return records;});
  const review=prepareReview({...omitted,createdAt});
  assert.equal(review.structural.compilationEligible,true);
  assert.match(review.entries[0].notes.join(' '),/omitted original_completion/);
});

test('raw-output, upload, partial-run and review tampering cannot bypass provenance checks',()=>{
  for(const mutate of [inputs=>inputs.runState.download.sha256='0'.repeat(64),inputs=>inputs.runState.dataHash='0'.repeat(64),inputs=>inputs.runState.download.partial=true,inputs=>inputs.runState.remote.status='failed']){
    const inputs=fixture();mutate(inputs);
    const review=reviewed(inputs);
    assert.equal(review.structural.compilationEligible,false);
    assert.throws(()=>compilePack({...inputs,review}),/identity or provenance ambiguity/);
  }
  const inputs=fixture(),review=reviewed(inputs);
  review.entries[0].candidate.reply='A different answer';
  assert.throws(()=>compilePack({...inputs,review}),/Only decision fields may be edited/);
});

test('each semantic approval requires all checks and exact source/candidate/run/output pins',()=>{
  const inputs=fixture(),badCheck=reviewed(inputs);
  badCheck.entries[0].decision.checks.uncertainty=false;
  assert.throws(()=>compilePack({...inputs,review:badCheck}),/every semantic check/);
  const badPins=reviewed(inputs);badPins.entries[0].decision.reviewedHashes.candidate='0'.repeat(64);
  assert.throws(()=>compilePack({...inputs,review:badPins}),/not pinned/);
  const noReviewer=reviewed(inputs);noReviewer.entries[0].decision.reviewedBy='';
  assert.throws(()=>compilePack({...inputs,review:noReviewer}),/reviewer/);
});

test('fact excerpts require exact source text and remain disclosed in transformation report',()=>{
  const inputs=fixture(),bad=reviewed(inputs);
  bad.entries[0].decision.factExcerpts.P05='Mika loves every game.';
  assert.throws(()=>compilePack({...inputs,review:bad}),/exact contiguous substring/);
  const good=reviewed(inputs);
  good.entries[0].decision.factExcerpts.P05=source.examples[0].permittedFacts[0].response;
  const result=compilePack({...inputs,review:good,compiledAt:createdAt});
  assert.equal(result.report.transforms[0].facts[0].reviewedExcerpt,source.examples[0].permittedFacts[0].response);
});

test('anonymization is explicit and preserves possessions and unrelated words',()=>{
  assert.deepEqual(anonymize('Mika’s blocks and Leo\'s crayons.','caregiver'),{value:'the child’s blocks and the child\'s crayons.',replacements:[{from:'Mika',to:'the child'},{from:'Leo',to:'the child'}]});
  assert.equal(anonymize('Jordan discusses a samovar.','patient').value,'the patient discusses a samovar.');
});

test('no accepted candidates means no empty guidance pack',()=>{
  const inputs=fixture(),review=reviewed(inputs,source.examples.map(row=>row.id));
  assert.throws(()=>compilePack({...inputs,review}),/No semantically approved examples/);
});
