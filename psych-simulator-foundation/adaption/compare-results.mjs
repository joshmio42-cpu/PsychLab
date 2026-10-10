import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {sha256} from './config.mjs';

const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const runtimeFiles=['model.mjs','answer-plan.mjs','evidence-render.mjs','interview-style.mjs','example-guidance.mjs','prompt-context.mjs','conversation.mjs','question-resolution.mjs','agent-context.mjs','factual-support.mjs','usage.mjs','pricing.mjs'];
const validHashes=value=>value&&typeof value==='object'&&!Array.isArray(value)&&runtimeFiles.every(file=>hash(value[file]))&&Object.values(value).every(hash);
const uniqueIds=records=>records.every(r=>typeof r.id==='string'&&r.id.length>0)&&new Set(records.map(r=>r.id)).size===records.length;
function reviewed(evalRun,review,{variant,cases}){
 if(evalRun?.status!=='complete'||review?.status!=='complete'||!Array.isArray(evalRun.records)||!Array.isArray(review.records)||evalRun.cases!==cases||evalRun.records.length!==cases||review.records.length!==cases)throw new Error('Evaluation and independent review must both be complete, with the required case count.');
 if(!uniqueIds(evalRun.records)||!uniqueIds(review.records))throw new Error('Evaluation and review case IDs must be unique.');
 if(!hash(evalRun.matrixHash)||!validHashes(evalRun.sourceHashes)||!isDeepStrictEqual(review.sourceHashes,evalRun.sourceHashes))throw new Error('Review runtime source hashes mismatch or are invalid.');
 if(review.sourceMatrixHash!==evalRun.matrixHash)throw new Error('Review matrix hash mismatch.');
 return evalRun.records.map(record=>{
  if(record.variant!==variant||!['answered','blocked'].includes(record.status)||!hash(record.snapshotHash))throw new Error('Invalid evaluation variant, status or snapshot hash.');
  const verdict=review.records.find(r=>r.id===record.id&&r.variant===record.variant);
  if(!verdict||verdict.sourceRecordHash!==sha256(JSON.stringify(record)))throw new Error('Review does not match the exact saved answer.');
  if(typeof verdict.hardPass!=='boolean'||!Number.isInteger(verdict.qualityRating)||verdict.qualityRating<0||verdict.qualityRating>3||!Array.isArray(verdict.unsupportedClaims))throw new Error('Incomplete semantic review.');
  if(!Array.isArray(verdict.expectedBehaviorChecks)||!Array.isArray(verdict.forbiddenBehaviorChecks)||!Array.isArray(record.expectedBehaviors)||!Array.isArray(record.forbiddenThings)||verdict.expectedBehaviorChecks.length!==record.expectedBehaviors.length||verdict.forbiddenBehaviorChecks.length!==record.forbiddenThings.length||verdict.expectedBehaviorChecks.some((check,index)=>check.behavior!==record.expectedBehaviors[index]||typeof check.met!=='boolean')||verdict.forbiddenBehaviorChecks.some((check,index)=>check.behavior!==record.forbiddenThings[index]||typeof check.occurred!=='boolean'))throw new Error('Semantic review must assess every required and forbidden behavior.');
  if(verdict.hardPass&&(verdict.expectedBehaviorChecks.some(check=>!check.met)||verdict.forbiddenBehaviorChecks.some(check=>check.occurred)))throw new Error('Hard pass contradicts the behavioral checks.');
  if(verdict.status!==record.status||verdict.blocked!==(record.status==='blocked')||(!verdict.hardPass&&verdict.qualityRating!==0)||(verdict.hardPass&&(verdict.qualityRating===0||verdict.unsupportedClaims.length))||(verdict.blocked&&(verdict.hardPass||verdict.unsupportedClaims.length)))throw new Error('Semantic verdict contradicts the delivered or blocked status.');
  return {...verdict,source:record};
 });
}
export function compareResults(baseline,candidate,baselineReview,candidateReview,transfer,transferReview,{generalization,generalizationReview,requireGeneralization=false,regression,regressionReview,requireRegression=false,requireAnswerPlanning=false}={}){
 const b=reviewed(baseline,baselineReview,{variant:'baseline',cases:36}),c=reviewed(candidate,candidateReview,{variant:'candidate',cases:36}),t=reviewed(transfer,transferReview,{variant:'candidate',cases:8});
 const hasGeneralization=generalization!==undefined||generalizationReview!==undefined;
 if(requireGeneralization&&!hasGeneralization)throw new Error('A fresh 16-case generalization evaluation and independent review are required.');
 const g=hasGeneralization?reviewed(generalization,generalizationReview,{variant:'candidate',cases:16}):[];
 const hasRegression=regression!==undefined||regressionReview!==undefined;
 if(requireRegression&&!hasRegression)throw new Error('The retained 16-case grounding regression evaluation and independent review are required.');
 const r=hasRegression?reviewed(regression,regressionReview,{variant:'candidate',cases:16}):[];
 const runs=[baseline,candidate,transfer,...(hasRegression?[regression]:[]),...(hasGeneralization?[generalization]:[])];
 if(runs.some(run=>run.answerPlanning!==undefined&&typeof run.answerPlanning!=='boolean')||runs.some(run=>(run.answerPlanning??false)!==(candidate.answerPlanning??false)))throw new Error('Comparison must use the same answer-planning setting for every run.');
 if(requireAnswerPlanning&&runs.some(run=>run.answerPlanning!==true))throw new Error('This release requires answer planning enabled in every evaluation run.');
 if(baseline.matrixHash!==candidate.matrixHash||typeof baseline.model!=='string'||!baseline.model.trim()||baseline.model!==candidate.model||candidate.model!==transfer.model||!isDeepStrictEqual(baseline.sourceHashes,candidate.sourceHashes)||!isDeepStrictEqual(candidate.sourceHashes,transfer.sourceHashes))throw new Error('Comparison must use the same matrix, model and runtime source, including transfer checks.');
 if(baseline.packHash!==null||!hash(candidate.packHash)||candidate.packHash!==transfer.packHash)throw new Error('Baseline must be unguided and transfer evaluation must use the same candidate pack.');
 if(transfer.matrixHash===candidate.matrixHash||t.some(r=>b.some(old=>old.id===r.id)))throw new Error('Transfer checks must be distinct from the main matrix.');
 const normalizedQuestion=question=>String(question).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const distinctSet=(run,rows,priorRuns,priorRows)=>{
  const priorQuestions=new Set(priorRows.map(row=>normalizedQuestion(row.source.question))),questions=rows.map(row=>normalizedQuestion(row.source.question));
  return !priorRuns.some(prior=>prior.matrixHash===run.matrixHash)&&!rows.some(row=>priorRows.some(prior=>prior.id===row.id))&&questions.every(q=>q&&!priorQuestions.has(q))&&new Set(questions).size===rows.length;
 };
 if(hasRegression){
  if(regression.model!==candidate.model||!isDeepStrictEqual(regression.sourceHashes,candidate.sourceHashes)||regression.packHash!==candidate.packHash)throw new Error('Regression must use the same model, runtime source and candidate pack.');
  if(!distinctSet(regression,r,[candidate,transfer],[...b,...t]))throw new Error('Regression checks must contain distinct cases and questions in a separate matrix.');
 }
 if(hasGeneralization){
  if(generalization.model!==candidate.model||!isDeepStrictEqual(generalization.sourceHashes,candidate.sourceHashes)||generalization.packHash!==candidate.packHash)throw new Error('Generalization must use the same model, runtime source and candidate pack.');
  if(!distinctSet(generalization,g,[candidate,transfer,...(hasRegression?[regression]:[])],[...b,...t,...r]))throw new Error('Generalization must contain distinct fresh cases and questions in a separate matrix.');
 }
 const sameCase=(a,z)=>['snapshotHash','question','fixture','precedingTurns','expectedBehaviors','forbiddenThings'].every(key=>isDeepStrictEqual(a[key],z[key]));
 if(c.some(r=>!b.some(old=>old.id===r.id&&sameCase(old.source,r.source))))throw new Error('Comparison snapshots or case inputs do not match.');
 const regressions=c.filter(r=>b.find(old=>old.id===r.id).hardPass&&!r.hardPass).map(r=>r.id);
 const improvements=c.filter(r=>r.hardPass&&r.qualityRating>b.find(old=>old.id===r.id).qualityRating).map(r=>r.id);
 const score=rows=>rows.reduce((sum,r)=>sum+r.qualityRating,0)/rows.length;
 const costKnown=[baseline,candidate].every(run=>run.usage?.cost?.status==='estimated'&&run.usage.unreportedCalls===0&&Number.isFinite(run.usage.cost.estimatedUsd)&&run.usage.cost.estimatedUsd>=0)&&baseline.usage.cost.estimatedUsd>0;
 const costRatio=costKnown?candidate.usage.cost.estimatedUsd/baseline.usage.cost.estimatedUsd:null;
 const snapshotIntact=[...b,...c,...t,...r,...g].every(r=>r.source.snapshotUnchanged===true);
 const guidedCalls=c.flatMap(r=>r.source.calls??[]).filter(call=>['LANGUAGE','AUDITOR'].includes(call.role)&&call.value&&Array.isArray(call.input?.exampleGuidance?.examples)&&call.input.exampleGuidance.examples.length>0).length;
 const unsupported=c.filter(r=>r.unsupportedClaims.length).map(r=>r.id);
 const transferFailed=t.filter(r=>!r.hardPass||r.unsupportedClaims.length).map(r=>r.id);
 const supplementFailed=rows=>rows.filter(row=>!row.hardPass||row.qualityRating<2||row.unsupportedClaims.length).map(row=>row.id);
 const guidedLanguageCalls=rows=>rows.filter(row=>row.hardPass&&row.qualityRating>=2&&row.source.status==='answered'&&row.source.result?.kind==='answer').flatMap(row=>row.source.calls??[]).filter(call=>call.role==='LANGUAGE'&&call.value&&Array.isArray(call.input?.exampleGuidance?.examples)&&call.input.exampleGuidance.examples.length>0).length;
 const generalizationFailed=supplementFailed(g),generalizationGuidedCalls=guidedLanguageCalls(g);
 const regressionFailed=supplementFailed(r),regressionGuidedCalls=guidedLanguageCalls(r);
 const gates={sameFrozenHistory:snapshotIntact,noUnsupportedDeliveredClaims:unsupported.length===0,noHardRegressions:regressions.length===0,
  atLeastOneImprovedCase:improvements.length>=1,noAverageQualityDecrease:score(c)>=score(b),manageableTokenCost:costKnown&&Number.isFinite(costRatio)&&costRatio<=1.2,transferChecksPass:transferFailed.length===0,examplesActuallyUsed:guidedCalls>0,
  ...(hasRegression?{regressionChecksPass:regressionFailed.length===0,regressionExamplesActuallyUsed:regressionGuidedCalls>0}:{}),
  ...(hasGeneralization?{generalizationChecksPass:generalizationFailed.length===0,generalizationExamplesActuallyUsed:generalizationGuidedCalls>0}:{})};
 return {schemaVersion:1,reviewedAt:new Date().toISOString(),model:candidate.model,answerPlanning:candidate.answerPlanning??false,packHash:candidate.packHash,
  activate:Object.values(gates).every(Boolean),gates,
  baseline:{cases:b.length,hardPasses:b.filter(r=>r.hardPass).length,blocked:b.filter(r=>r.blocked).length,unsupportedDelivered:b.filter(r=>r.unsupportedClaims.length).length,meanQuality:score(b),estimatedUsd:baseline.usage?.cost?.estimatedUsd??null},
  candidate:{cases:c.length,hardPasses:c.filter(r=>r.hardPass).length,blocked:c.filter(r=>r.blocked).length,unsupportedDelivered:unsupported.length,meanQuality:score(c),estimatedUsd:candidate.usage?.cost?.estimatedUsd??null},
  transfer:{cases:t.length,hardPasses:t.filter(r=>r.hardPass).length,failed:transferFailed},
  ...(hasRegression?{regression:{cases:r.length,hardPasses:r.filter(row=>row.hardPass).length,failed:regressionFailed,guidedLanguageCalls:regressionGuidedCalls}}:{}),
  ...(hasGeneralization?{generalization:{cases:g.length,hardPasses:g.filter(r=>r.hardPass).length,failed:generalizationFailed,guidedLanguageCalls:generalizationGuidedCalls}}:{}),guidedCalls,costRatio,improvements,regressions,unsupported,
  limitation:'Single stochastic sample per question and variant, with independent assistant semantic review; not a statistical improvement estimate or clinical validation. Adaption billing remains separate.'};
}
export function comparisonArtifacts(label='pilot-25'){
 if(typeof label!=='string'||!/^[a-z0-9][a-z0-9-]{0,60}$/.test(label))throw new Error('Invalid label.');
 const prefix=label==='pilot-25'?'':`${label}-`;
 return {baseline:`${label}-baseline.json`,candidate:`${label}-candidate.json`,baselineReview:`${prefix}review-baseline.json`,candidateReview:`${prefix}review-candidate.json`,transfer:`${label}-transfer-candidate.json`,transferReview:`${prefix}review-transfer.json`,
  ...(label==='pilot-25'?{}:{generalization:`${label}-generalization-candidate.json`,generalizationReview:`${label}-review-generalization.json`}),
  ...(label.startsWith('release-')?{regression:`${label}-regression-candidate.json`,regressionReview:`${label}-review-regression.json`}:{})};
}
export function comparisonMatrices(label='pilot-25'){
 comparisonArtifacts(label); // Validate labels without opening or inspecting any matrix.
 const release=label.startsWith('release-');
 return [
  {path:'../../work/natural-conversation-evaluation.json',runs:['baseline','candidate']},
  {path:'./data/guidance-transfer-evaluation.json',runs:['transfer']},
  ...(release?[{path:'./data/grounding-generalization-evaluation.json',runs:['regression']}]:[]),
  ...(label==='pilot-25'?[]:[{path:release?'./data/release-generalization-v2.json':'./data/grounding-generalization-evaluation.json',runs:['generalization']}])
 ];
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const label=process.argv[2]??'pilot-25',names=comparisonArtifacts(label),requireGeneralization=label!=='pilot-25',requireRegression=label.startsWith('release-');
 const folder=new URL('./runs/',import.meta.url),read=async name=>{const bytes=await readFile(new URL(name,folder));return {value:JSON.parse(bytes),hash:sha256(bytes)};};
 const loaded=Object.fromEntries(await Promise.all(Object.entries(names).map(async([key,name])=>[key,await read(name)])));
 const {baseline,candidate,baselineReview,candidateReview,transfer,transferReview,generalization,generalizationReview,regression,regressionReview}=loaded;
 for(const [evaluation,review] of [[baseline,baselineReview],[candidate,candidateReview],[transfer,transferReview],...(requireRegression?[[regression,regressionReview]]:[]),...(requireGeneralization?[[generalization,generalizationReview]]:[])])if(review.value.sourceEvaluationHash!==evaluation.hash)throw new Error('Independent review does not match the exact evaluation file.');
 for(const {path:matrixPath,runs:keys} of comparisonMatrices(label)){
  const bytes=await readFile(new URL(matrixPath,import.meta.url)),matrix=JSON.parse(bytes);
  for(const key of keys){const run=loaded[key];
   if(run.value.matrixHash!==sha256(bytes)||!isDeepStrictEqual(run.value.records.map(r=>r.id).sort(),matrix.cases.map(r=>r.id).sort()))throw new Error('Evaluation does not match the current held-out matrix.');
   for(const record of run.value.records){
    const sample=matrix.cases.find(row=>row.id===record.id);
    const precedingTurns=sample.precedingTurns.map((turn,index)=>({...turn,id:`eval-${sample.id}-${index}`,interaction:turn.interaction??'answer'}));
    if(!['question','fixture','expectedBehaviors','forbiddenThings'].every(key=>isDeepStrictEqual(record[key],sample[key]))||!isDeepStrictEqual(record.precedingTurns,precedingTurns))throw new Error('Evaluation case inputs differ from the current held-out matrix.');
   }
  }
 }
 for(const file of runtimeFiles)if(candidate.value.sourceHashes[file]!==sha256(await readFile(new URL(`../live/${file}`,import.meta.url))))throw new Error('Runtime changed after the reviewed comparison.');
 const result=compareResults(baseline.value,candidate.value,baselineReview.value,candidateReview.value,transfer.value,transferReview.value,{requireGeneralization,requireRegression,requireAnswerPlanning:requireRegression,...(requireGeneralization?{generalization:generalization.value,generalizationReview:generalizationReview.value}:{}),...(requireRegression?{regression:regression.value,regressionReview:regressionReview.value}:{})});
 const path=new URL(`${label}-decision.json`,folder);await writeFile(path,JSON.stringify(result,null,2),{flag:'wx'});
 console.log(JSON.stringify({path:fileURLToPath(path),...result}));
}
