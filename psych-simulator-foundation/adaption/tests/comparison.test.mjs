import test from 'node:test';
import assert from 'node:assert/strict';
import {compareResults,comparisonArtifacts,comparisonMatrices} from '../compare-results.mjs';
import {sha256} from '../config.mjs';

const files=['model.mjs','answer-plan.mjs','evidence-render.mjs','interview-style.mjs','example-guidance.mjs','prompt-context.mjs','conversation.mjs','question-resolution.mjs','agent-context.mjs','factual-support.mjs','usage.mjs','pricing.mjs'];
const sourceHashes=Object.fromEntries(files.map(file=>[file,sha256('fixture '+file)]));
function run(variant,{transfer=false}={}){
 const records=Array.from({length:transfer?8:36},(_,index)=>({id:`${transfer?'transfer':'case'}-${index}`,variant,status:'answered',snapshotHash:sha256(`snapshot-${index}`),snapshotUnchanged:true,
  question:`Question ${index}?`,fixture:{patientId:'jordan',days:28},precedingTurns:[],expectedBehaviors:['Give the supported detail.'],forbiddenThings:['Invent new facts.'],
  result:{reply:'The recorded detail.',kind:'answer'},calls:variant==='candidate'?[{role:'LANGUAGE',input:{exampleGuidance:{examples:[{question:'Another fictional question?',answer:{reply:'An example.'}}]}},value:{reply:'The recorded detail.'}}]:[]}));
 return {status:'complete',cases:records.length,model:'fixture-model',sourceHashes:structuredClone(sourceHashes),matrixHash:sha256(transfer?'transfer-matrix':'main-matrix'),packHash:variant==='baseline'?null:sha256('reviewed pack'),records,usage:{unreportedCalls:0,cost:{status:'estimated',estimatedUsd:variant==='baseline'?0.03:0.033}}};
}
function review(evaluation){return {status:'complete',sourceMatrixHash:evaluation.matrixHash,sourceHashes:structuredClone(evaluation.sourceHashes),records:evaluation.records.map((record,index)=>({
 id:record.id,variant:record.variant,status:record.status,sourceRecordHash:sha256(JSON.stringify(record)),hardPass:true,qualityRating:record.variant==='candidate'&&index===0?3:2,blocked:false,unsupportedClaims:[],
 expectedBehaviorChecks:record.expectedBehaviors.map(behavior=>({behavior,met:true,evidence:'The supported detail appears.'})),forbiddenBehaviorChecks:record.forbiddenThings.map(behavior=>({behavior,occurred:false}))}))};}
function fixture(){const baseline=run('baseline'),candidate=run('candidate'),transfer=run('candidate',{transfer:true});return [baseline,candidate,review(baseline),review(candidate),transfer,review(transfer)];}
const compare=values=>compareResults(...values);
function refresh(values,runIndex,reviewIndex){const evaluation=values[runIndex],verdict=values[reviewIndex];verdict.sourceMatrixHash=evaluation.matrixHash;verdict.sourceHashes=structuredClone(evaluation.sourceHashes);for(const record of evaluation.records){const row=verdict.records.find(row=>row.id===record.id);if(row)row.sourceRecordHash=sha256(JSON.stringify(record));}}
function failedVerdict(verdict,{blocked=false,unsupported=false}={}){verdict.hardPass=false;verdict.qualityRating=0;verdict.blocked=blocked;verdict.status=blocked?'blocked':'answered';verdict.unsupportedClaims=unsupported?[{claim:'Invented detail.',reason:'Missing from evidence.'}]:[];}

test('Activation requires all gates, 36 matched answers, 8 separate transfer checks, and real hash matches',()=>{
 const values=fixture(),decision=compare(values);
 assert.equal(decision.activate,true);assert.ok(Object.values(decision.gates).every(Boolean));
 assert.equal(decision.baseline.cases,36);assert.equal(decision.transfer.cases,8);assert.deepEqual(decision.improvements,['case-0']);
 assert.equal(decision.guidedCalls,36);assert.equal(decision.costRatio,1.1);
 // Object key order is immaterial to runtime hash equality.
 values[1].sourceHashes=Object.fromEntries(Object.entries(values[1].sourceHashes).reverse());
 assert.equal(compare(values).activate,true);
});

test('Missing, duplicate or incomplete evaluation/review rows cannot shrink the required evaluation',()=>{
 const changes=[v=>{v[4].records=[];v[4].cases=0;v[5].records=[];},v=>{v[0].records.pop();v[0].cases--;v[2].records.pop();},v=>v[1].status='running',v=>v[3].status='partial',
  v=>v[1].records[1]=structuredClone(v[1].records[0]),v=>v[3].records[1]=structuredClone(v[3].records[0]),v=>v[3].records.pop()];
 for(const change of changes){const values=fixture();change(values);assert.throws(()=>compare(values));}
});

test('Model, matrix, runtime, review and candidate pack mismatches reject instead of passing a gate',()=>{
 const changes=[v=>v[1].model='different',v=>v[4].model='different',v=>{v[1].matrixHash=sha256('different');refresh(v,1,3);},v=>{v[4].sourceHashes['model.mjs']=sha256('different');refresh(v,4,5);},
  v=>v[3].sourceHashes['model.mjs']=sha256('different'),v=>v[3].sourceMatrixHash=sha256('different'),v=>v[1].sourceHashes={},v=>v[1].packHash=null,v=>v[4].packHash=sha256('different'),v=>v[0].packHash=sha256('not baseline')];
 for(const change of changes){const values=fixture();change(values);assert.throws(()=>compare(values));}
});

test('Record hashes bind reviews to exact saved replies; case inputs, snapshots and variants also must agree',()=>{
 const values=fixture();values[1].records[0].result.reply='Changed after review';assert.throws(()=>compare(values),/exact saved answer/);
 for(const change of [r=>r.snapshotHash=sha256('different'),r=>r.question='Different question?',r=>r.fixture.days=90,r=>r.expectedBehaviors[0]='A different expectation',r=>r.variant='baseline']){
  const v=fixture();change(v[1].records[0]);refresh(v,1,3);assert.throws(()=>compare(v));
 }
 const shared=fixture();shared[4].matrixHash=shared[1].matrixHash;refresh(shared,4,5);assert.throws(()=>compare(shared),/distinct/);
});

test('Blocked replies and contradictory semantic reviews cannot masquerade as hard passes',()=>{
 const changes=[v=>{v[1].records[0].status='blocked';refresh(v,1,3);},v=>v[3].records[0].blocked=true,v=>v[3].records[0].unsupportedClaims=['An unsupported claim.'],
  v=>v[3].records[0].qualityRating=0,v=>v[3].records[0].qualityRating=4,v=>v[3].records[0].expectedBehaviorChecks=[],v=>v[3].records[0].expectedBehaviorChecks[0].met=false,v=>v[3].records[0].forbiddenBehaviorChecks[0].occurred=true];
 for(const change of changes){const values=fixture();change(values);assert.throws(()=>compare(values));}
 const values=fixture();values[1].records[1].status='blocked';failedVerdict(values[3].records[1],{blocked:true});refresh(values,1,3);
 const decision=compare(values);assert.equal(decision.activate,false);assert.equal(decision.candidate.blocked,1);assert.equal(decision.gates.noHardRegressions,false);
});

test('Unsupported delivery, lost hard passes, quality decline and failed transfer checks prevent activation',()=>{
 const unsupported=fixture();failedVerdict(unsupported[3].records[2],{unsupported:true});const u=compare(unsupported);assert.equal(u.activate,false);assert.equal(u.gates.noUnsupportedDeliveredClaims,false);
 const quality=fixture();quality[3].records[1].qualityRating=1;quality[3].records[2].qualityRating=1;const q=compare(quality);assert.equal(q.activate,false);assert.equal(q.gates.noAverageQualityDecrease,false);
 const transfer=fixture();failedVerdict(transfer[5].records[0],{unsupported:true});const t=compare(transfer);assert.equal(t.activate,false);assert.equal(t.gates.transferChecksPass,false);
 const noImprovement=fixture();noImprovement[3].records[0].qualityRating=2;assert.equal(compare(noImprovement).gates.atLeastOneImprovedCase,false);
});

test('Costs must be complete, finite and nonnegative; the 20 percent ceiling is inclusive',()=>{
 const exact=fixture();exact[1].usage.cost.estimatedUsd=0.036;assert.equal(compare(exact).gates.manageableTokenCost,true);
 const changes=[v=>v[1].usage.cost.estimatedUsd=0.036001,v=>v[1].usage.cost.estimatedUsd=-1,v=>v[1].usage.cost.estimatedUsd=NaN,v=>v[1].usage.cost.estimatedUsd=Infinity,v=>v[1].usage.cost.estimatedUsd='0.03',v=>v[0].usage.cost.estimatedUsd=0,v=>v[1].usage.unreportedCalls=1,v=>v[1].usage.cost.status='partial',v=>delete v[1].usage];
 for(const change of changes){const values=fixture();change(values);const result=compare(values);assert.equal(result.activate,false);assert.equal(result.gates.manageableTokenCost,false);}
});

test('Snapshot mutation and examples that never reached an answering model fail release gates',()=>{
 const changed=fixture();changed[1].records[0].snapshotUnchanged=false;refresh(changed,1,3);assert.equal(compare(changed).gates.sameFrozenHistory,false);
 for(const change of [r=>r.calls=[],r=>r.calls[0].input.exampleGuidance={},r=>delete r.calls[0].value,r=>r.calls[0].role='CORTEX']){
  const values=fixture();values[1].records.forEach(change);refresh(values,1,3);const result=compare(values);assert.equal(result.activate,false);assert.equal(result.gates.examplesActuallyUsed,false);
 }
});

function freshFixture(){
 const values=fixture(),generalization=run('candidate');
 generalization.records=generalization.records.slice(0,16).map((record,index)=>({...record,id:`fresh-${index}`,question:`Fresh generalization question ${index}?`}));
 generalization.cases=16;generalization.matrixHash=sha256('fresh generalization matrix');
 values.push({requireGeneralization:true,generalization,generalizationReview:review(generalization)});
 return values;
}
const rereviewFresh=values=>{values[6].generalizationReview=review(values[6].generalization);};

test('New comparison labels use versioned reviews and all fresh gate artifacts; pilot paths stay unchanged',()=>{
 assert.deepEqual(comparisonArtifacts('pilot-25'),{baseline:'pilot-25-baseline.json',candidate:'pilot-25-candidate.json',baselineReview:'review-baseline.json',candidateReview:'review-candidate.json',transfer:'pilot-25-transfer-candidate.json',transferReview:'review-transfer.json'});
 const paths=comparisonArtifacts('grounding-v2');
 assert.equal(paths.baselineReview,'grounding-v2-review-baseline.json');
 assert.equal(paths.candidateReview,'grounding-v2-review-candidate.json');
 assert.equal(paths.transferReview,'grounding-v2-review-transfer.json');
 assert.equal(paths.generalization,'grounding-v2-generalization-candidate.json');
 assert.equal(paths.generalizationReview,'grounding-v2-review-generalization.json');
 for(const bad of ['../outside','A label','',null])assert.throws(()=>comparisonArtifacts(bad));
});

test('A required fresh gate cannot be omitted or shrunk, while the six-argument API stays usable',()=>{
 assert.equal(compare(fixture()).activate,true);
 const absent=fixture();absent.push({requireGeneralization:true});assert.throws(()=>compare(absent),/fresh 16-case/);
 const full=freshFixture(),decision=compare(full);
 assert.equal(decision.activate,true);assert.equal(decision.generalization.cases,16);
 assert.equal(decision.generalization.guidedLanguageCalls,16);
 assert.equal(decision.gates.generalizationChecksPass,true);assert.equal(decision.gates.generalizationExamplesActuallyUsed,true);
 for(const change of [v=>delete v[6].generalizationReview,v=>v[6].generalization.records.pop(),v=>v[6].generalization.status='partial',v=>v[6].generalizationReview.status='pending',v=>v[6].generalization.cases=15]){
  const values=freshFixture();change(values);assert.throws(()=>compare(values));
 }
});

test('Matched source files cannot conceal a different answer-planning setting',()=>{
 const values=releaseFixture();
 const all=[values[0],values[1],values[4],values[6].regression,values[6].generalization];
 all.forEach(run=>run.answerPlanning=true);values[6].requireAnswerPlanning=true;
 assert.equal(compare(values).answerPlanning,true);
 for(const run of all){run.answerPlanning=false;assert.throws(()=>compare(values),/same answer-planning setting/);run.answerPlanning=true;}
 all.forEach(run=>run.answerPlanning=false);
 assert.throws(()=>compare(values),/requires answer planning enabled/);
 const legacy=fixture();assert.equal(compare(legacy).answerPlanning,false);
 legacy[1].answerPlanning='false';assert.throws(()=>compare(legacy),/answer-planning setting/);
});

test('Fresh gates bind reviews to exact records, runtime, model and pack, including the route resolver',()=>{
 for(const change of [
  v=>v[6].generalization.records[0].result.reply='Changed answer',
  v=>v[6].generalization.model='different-model',
  v=>v[6].generalization.packHash=sha256('different-pack'),
  v=>{v[6].generalization.sourceHashes['question-resolution.mjs']=sha256('old routing');rereviewFresh(v);},
  v=>{delete v[6].generalization.sourceHashes['question-resolution.mjs'];rereviewFresh(v);},
  v=>v[6].generalizationReview.sourceMatrixHash=sha256('different matrix'),
  v=>v[6].generalizationReview.records[0].sourceRecordHash=sha256('different record')
 ]){const values=freshFixture();change(values);assert.throws(()=>compare(values));}
});

test('Fresh cases cannot reuse a matrix, case ID or question under a new ID',()=>{
 for(const change of [
  v=>v[6].generalization.matrixHash=v[1].matrixHash,
  v=>v[6].generalization.matrixHash=v[4].matrixHash,
  v=>v[6].generalization.records[0].id=v[0].records[0].id,
  v=>v[6].generalization.records[0].id=v[4].records[0].id,
  v=>v[6].generalization.records[0].question=v[0].records[0].question,
  v=>v[6].generalization.records[0].question=v[4].records[0].question.toUpperCase().replace('?','!!'),
  v=>v[6].generalization.records[0].question=v[6].generalization.records[1].question,
  v=>v[6].generalization.records[0].question=''
 ]){const values=freshFixture();change(values);rereviewFresh(values);assert.throws(()=>compare(values),/distinct fresh/);}
});

test('Every fresh case must pass independent semantic review without unsupported delivery',()=>{
 for(const options of [{},{unsupported:true},{blocked:true}]){
  const values=freshFixture(),fresh=values[6];
  if(options.blocked){fresh.generalization.records[0].status='blocked';rereviewFresh(values);}
  failedVerdict(fresh.generalizationReview.records[0],options);
  const decision=compare(values);
  assert.equal(decision.activate,false);assert.equal(decision.gates.generalizationChecksPass,false);
  assert.deepEqual(decision.generalization.failed,['fresh-0']);
 }
 const mutation=freshFixture();mutation[6].generalization.records[0].snapshotUnchanged=false;rereviewFresh(mutation);
 assert.equal(compare(mutation).gates.sameFrozenHistory,false);
});

test('Fresh examples must reach a completed LANGUAGE answer, not only a router, audit or missing-detail boundary',()=>{
 for(const change of [
  r=>r.calls=[],r=>r.calls[0].role='CORTEX',r=>r.calls[0].role='AUDITOR',r=>delete r.calls[0].value,
  r=>r.calls[0].input.exampleGuidance.examples=[],r=>r.result.kind='unavailable'
 ]){
  const values=freshFixture();values[6].generalization.records.forEach(change);rereviewFresh(values);
  const decision=compare(values);assert.equal(decision.activate,false);assert.equal(decision.gates.generalizationExamplesActuallyUsed,false);
 }
});

function releaseFixture(){
 const values=freshFixture(),regression=run('candidate');
 regression.records=regression.records.slice(0,16).map((record,index)=>({...record,id:`regression-${index}`,question:`Earlier grounding regression question ${index}?`}));
 regression.cases=16;regression.matrixHash=sha256('retained grounding regression matrix');
 Object.assign(values[6],{requireRegression:true,regression,regressionReview:review(regression)});
 return values;
}
const rereviewRegression=values=>{values[6].regressionReview=review(values[6].regression);};

test('Release artifact routing retains the old grounding set and binds fresh generalization to v2 without reading either matrix',()=>{
 const paths=comparisonArtifacts('release-candidate-1');
 assert.equal(Object.keys(paths).length,10);
 assert.equal(paths.regression,'release-candidate-1-regression-candidate.json');
 assert.equal(paths.regressionReview,'release-candidate-1-review-regression.json');
 assert.equal(paths.generalization,'release-candidate-1-generalization-candidate.json');
 assert.deepEqual(comparisonMatrices('release-candidate-1'),[
  {path:'../../work/natural-conversation-evaluation.json',runs:['baseline','candidate']},
  {path:'./data/guidance-transfer-evaluation.json',runs:['transfer']},
  {path:'./data/grounding-generalization-evaluation.json',runs:['regression']},
  {path:'./data/release-generalization-v2.json',runs:['generalization']}
 ]);
 assert.equal(comparisonArtifacts('grounding-v2').regression,undefined);
 assert.deepEqual(comparisonMatrices('grounding-v2').at(-1),{path:'./data/grounding-generalization-evaluation.json',runs:['generalization']});
 assert.equal(comparisonMatrices('pilot-25').length,2);
 assert.throws(()=>comparisonMatrices('../release-escape'),/Invalid label/);
});

test('The release comparison requires all 36 baseline, 36 candidate, 8 transfer, 16 regression and 16 fresh cases',()=>{
 const decision=compare(releaseFixture());
 assert.equal(decision.activate,true);
 assert.deepEqual([decision.baseline.cases,decision.candidate.cases,decision.transfer.cases,decision.regression.cases,decision.generalization.cases],[36,36,8,16,16]);
 assert.equal(decision.gates.regressionChecksPass,true);assert.equal(decision.gates.regressionExamplesActuallyUsed,true);
 assert.equal(decision.regression.guidedLanguageCalls,16);
 const absent=freshFixture();absent[6].requireRegression=true;assert.throws(()=>compare(absent),/retained 16-case/);
 for(const change of [
  v=>delete v[6].regression,
  v=>delete v[6].regressionReview,
  v=>v[6].regression.records.pop(),
  v=>v[6].regressionReview.records.pop(),
  v=>v[6].regression.cases=15,
  v=>v[6].regression.status='running',
  v=>v[6].regressionReview.status='partial',
  v=>v[6].regression.records[1]=structuredClone(v[6].regression.records[0]),
  v=>v[6].regressionReview.records[1]=structuredClone(v[6].regressionReview.records[0])
 ]){const values=releaseFixture();change(values);assert.throws(()=>compare(values));}
 // Supplement sets are also validated when present without a requirement flag.
 const optional=releaseFixture();optional[6].requireRegression=false;assert.equal(compare(optional).regression.cases,16);
 const old=freshFixture();assert.equal(compare(old).regression,undefined);assert.equal(compare(fixture()).activate,true);
});

test('Regression reviews bind exact records, matrix, model, candidate pack and all current runtime hashes',()=>{
 for(const change of [
  v=>v[6].regression.records[0].result.reply='Post-review edit',
  v=>v[6].regressionReview.records[0].sourceRecordHash=sha256('not this record'),
  v=>v[6].regressionReview.sourceMatrixHash=sha256('wrong matrix'),
  v=>v[6].regression.model='old-model',
  v=>v[6].regression.packHash=sha256('other examples'),
  v=>{v[6].regression.sourceHashes['answer-plan.mjs']=sha256('old answer plan');rereviewRegression(v);},
  v=>{v[6].regression.sourceHashes['interview-style.mjs']=sha256('old disclosure policy');rereviewRegression(v);},
  v=>{delete v[6].regression.sourceHashes['answer-plan.mjs'];rereviewRegression(v);},
  v=>{delete v[6].regression.sourceHashes['interview-style.mjs'];rereviewRegression(v);}
 ]){const values=releaseFixture();change(values);assert.throws(()=>compare(values));}
 for(const file of ['answer-plan.mjs','interview-style.mjs']){
  // Even the legacy six-argument shape must bind these parts of its recorded runtime.
  const values=fixture();delete values[0].sourceHashes[file];refresh(values,0,2);assert.throws(()=>compare(values),/hashes/);
  const fresh=releaseFixture();fresh[6].generalization.sourceHashes[file]=sha256('stale runtime');rereviewFresh(fresh);assert.throws(()=>compare(fresh),/same model, runtime/);
 }
});

test('Retained regression and fresh release sets cannot share matrices, IDs or normalized questions with each other or main and transfer',()=>{
 for(const change of [
  v=>v[6].regression.matrixHash=v[1].matrixHash,
  v=>v[6].regression.matrixHash=v[4].matrixHash,
  v=>v[6].regression.matrixHash=v[6].generalization.matrixHash,
  v=>v[6].regression.records[0].id=v[0].records[0].id,
  v=>v[6].regression.records[0].id=v[4].records[0].id,
  v=>v[6].regression.records[0].id=v[6].generalization.records[0].id,
  v=>v[6].regression.records[0].question=v[0].records[0].question,
  v=>v[6].regression.records[0].question=v[4].records[0].question,
  v=>v[6].regression.records[0].question=v[6].generalization.records[0].question.toUpperCase().replace('?','!!'),
  v=>v[6].regression.records[0].question=v[6].regression.records[1].question,
  v=>v[6].regression.records[0].question=''
 ]){const values=releaseFixture();change(values);rereviewRegression(values);assert.throws(()=>compare(values),/distinct/);}
 for(const change of [
  v=>v[6].generalization.matrixHash=v[6].regression.matrixHash,
  v=>v[6].generalization.records[0].id=v[6].regression.records[0].id,
  v=>v[6].generalization.records[0].question=v[6].regression.records[0].question.toUpperCase()
 ]){const values=releaseFixture();change(values);rereviewFresh(values);assert.throws(()=>compare(values),/distinct fresh/);}
});

test('Every retained regression case must be useful, supported and delivered; no fresh success can mask its failure',()=>{
 for(const failure of [{},{unsupported:true},{blocked:true}]){
  const values=releaseFixture(),options=values[6];
  if(failure.blocked){options.regression.records[0].status='blocked';rereviewRegression(values);}
  failedVerdict(options.regressionReview.records[0],failure);
  const decision=compare(values);assert.equal(decision.activate,false);
  assert.equal(decision.gates.generalizationChecksPass,true);assert.equal(decision.gates.regressionChecksPass,false);
  assert.deepEqual(decision.regression.failed,['regression-0']);
 }
 for(const set of ['regression','generalization']){
  const values=releaseFixture();values[6][`${set}Review`].records[0].qualityRating=1;
  const decision=compare(values);assert.equal(decision.activate,false);assert.equal(decision.gates[`${set}ChecksPass`],false);
 }
 const mutation=releaseFixture();mutation[6].regression.records[0].snapshotUnchanged=false;rereviewRegression(mutation);
 assert.equal(compare(mutation).gates.sameFrozenHistory,false);
});

test('Retained regression examples must reach a completed grounded LANGUAGE answer independently of fresh guidance use',()=>{
 for(const change of [
  r=>r.calls=[],r=>r.calls[0].role='CORTEX',r=>r.calls[0].role='AUDITOR',r=>delete r.calls[0].value,
  r=>r.calls[0].input.exampleGuidance.examples=[],r=>r.result.kind='unavailable'
 ]){
  const values=releaseFixture();values[6].regression.records.forEach(change);rereviewRegression(values);
  const decision=compare(values);assert.equal(decision.activate,false);assert.equal(decision.gates.regressionExamplesActuallyUsed,false);
  assert.equal(decision.gates.generalizationExamplesActuallyUsed,true);
 }
 const unsuccessful=releaseFixture();
 unsuccessful[6].regression.records.forEach((row,index)=>{if(index>0)row.calls=[];});rereviewRegression(unsuccessful);
 failedVerdict(unsuccessful[6].regressionReview.records[0],{unsupported:true});
 assert.equal(compare(unsuccessful).gates.regressionExamplesActuallyUsed,false);
});
