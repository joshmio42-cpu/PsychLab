import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,cp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {compareResults,comparisonArtifacts,comparisonMatrices} from '../compare-results.mjs';
import {inspectRelease,activateRelease,loadActiveRelease} from '../release-activation.mjs';
import {createReleaseConfiguredApp} from '../../live/launch-psychlab.mjs';
import {sha256} from '../config.mjs';

const runtimeFiles=['model.mjs','answer-plan.mjs','evidence-render.mjs','interview-style.mjs','example-guidance.mjs','prompt-context.mjs','conversation.mjs','question-resolution.mjs','agent-context.mjs','factual-support.mjs','usage.mjs','pricing.mjs'];
const bytes=value=>Buffer.from(JSON.stringify(value,null,2)+'\n');
async function write(path,value){await mkdir(resolve(path,'..'),{recursive:true});await writeFile(path,bytes(value));}
function pack(){return {schemaVersion:1,id:'synthetic-reviewed-pack',version:'1.0.0',status:'approved',review:{reviewedBy:'Synthetic test review',reviewedAt:'2026-10-09T00:00:00Z',sourceRunId:'synthetic-run'},examples:[{
 id:'synthetic-example',perspective:'patient',lifeStage:'Adult',tags:['habit'],question:'What is usual?',reply:'I keep a list.',sourceFacts:[{id:'EX_fixture',statement:'I keep a list.'}],factIds:['EX_fixture'],audit:{supported:true,relevant:true,no_leak:true,unsupported:[]},review:{status:'approved',reviewedBy:'Synthetic test review',reviewedAt:'2026-10-09T00:00:00Z'}
}]};}
function matrix(prefix,count){return {cases:Array.from({length:count},(_,index)=>({id:`${prefix}-${index}`,question:`${prefix} distinct question ${index}?`,fixture:{patientId:'fictional-fixture',days:14},precedingTurns:[],expectedBehaviors:['Give a supported detail.'],forbiddenThings:['Invent a detail.']}))};}
function evaluation(matrix,{variant,model,sourceHashes,packHash}){
 const records=matrix.cases.map(sample=>({...sample,variant,status:'answered',snapshotHash:sha256(sample.id),snapshotUnchanged:true,
  result:{reply:'The supported detail.',kind:'answer'},calls:variant==='candidate'?[{role:'LANGUAGE',input:{exampleGuidance:{examples:[{question:'A separate example?',answer:{reply:'A supported example.'}}]}},value:{reply:'The supported detail.'}}]:[]}));
 return {status:'complete',cases:records.length,model,answerPlanning:true,sourceHashes,packHash:variant==='baseline'?null:packHash,matrixHash:sha256(bytes(matrix)),records,
  output:'C:\\old-machine\\original-output-path.json',usage:{unreportedCalls:0,cost:{status:'estimated',estimatedUsd:variant==='baseline'?0.03:0.033}}};
}
function review(run){return {status:'complete',sourceEvaluationHash:sha256(bytes(run)),sourceHashes:run.sourceHashes,sourceMatrixHash:run.matrixHash,records:run.records.map((record,index)=>({
 id:record.id,variant:record.variant,status:record.status,blocked:false,hardPass:true,qualityRating:record.variant==='candidate'&&index===0?3:2,unsupportedClaims:[],sourceRecordHash:sha256(JSON.stringify(record)),
 expectedBehaviorChecks:record.expectedBehaviors.map(behavior=>({behavior,met:true,evidence:'Synthetic supported detail.'})),forbiddenBehaviorChecks:record.forbiddenThings.map(behavior=>({behavior,occurred:false}))
}))};}
async function temporaryProject(t){
 const project=await mkdtemp(join(tmpdir(),'psychlab-release-test-'));
 t.after(async()=>{const target=resolve(project),parent=resolve(tmpdir());assert.ok(target.startsWith(parent+sep)&&target.slice(parent.length+1).startsWith('psychlab-release-test-'));await rm(target,{recursive:true,force:true});});
 return project;
}
async function fixture(t){
 const project=await temporaryProject(t),foundationRoot=join(project,'psych-simulator-foundation'),adaption=join(foundationRoot,'adaption'),label='release-synthetic',names=comparisonArtifacts(label);
 const sourceHashes={};
 for(const file of runtimeFiles){const content=`// Synthetic source fixture: ${file}\n`;await mkdir(join(foundationRoot,'live'),{recursive:true});await writeFile(join(foundationRoot,'live',file),content);sourceHashes[file]=sha256(content);}
 const approvedPack=pack(),packPath=join(adaption,'runs','approved-pack.json');await write(packPath,approvedPack);
 const matrices={main:matrix('main',36),transfer:matrix('transfer',8),regression:matrix('regression',16),generalization:matrix('fresh-synthetic',16)};
 const byRun={baseline:matrices.main,candidate:matrices.main,transfer:matrices.transfer,regression:matrices.regression,generalization:matrices.generalization};
 // These are newly generated synthetic matrices in the temporary directory;
 // this test never opens the actual project's reserved release matrix.
 for(const descriptor of comparisonMatrices(label))await write(resolve(adaption,descriptor.path),byRun[descriptor.runs[0]]);
 const common={model:'evaluated-synthetic-model',sourceHashes,packHash:sha256(bytes(approvedPack))},loaded={};
 for(const key of ['baseline','candidate','transfer','regression','generalization']){
  loaded[key]=evaluation(byRun[key],{...common,variant:key==='baseline'?'baseline':'candidate'});loaded[`${key}Review`]=review(loaded[key]);
  await write(join(adaption,'runs',names[key]),loaded[key]);await write(join(adaption,'runs',names[`${key}Review`]),loaded[`${key}Review`]);
 }
 const verdict=compareResults(loaded.baseline,loaded.candidate,loaded.baselineReview,loaded.candidateReview,loaded.transfer,loaded.transferReview,{requireRegression:true,requireGeneralization:true,requireAnswerPlanning:true,regression:loaded.regression,regressionReview:loaded.regressionReview,generalization:loaded.generalization,generalizationReview:loaded.generalizationReview});
 await write(join(adaption,'runs',`${label}-decision.json`),verdict);
 return {project,foundationRoot,adaption,label,names,loaded,verdict,packPath,options:{foundationRoot,label,packPath:'runs/approved-pack.json'}};
}
const appFactory=seen=>async options=>{seen.push(options);return {server:{synthetic:true},controller:{status:()=>({providerReady:options.provider.configured,model:options.provider.model})}};};

test('Inspection recomputes the full passing verdict without creating a release selection',async t=>{
 const f=await fixture(t),checked=await inspectRelease(f.options);
 assert.equal(checked.verdict.activate,true);assert.equal(checked.manifest.model,'evaluated-synthetic-model');assert.equal(checked.manifest.answerPlanning,true);
 assert.equal(Object.keys(checked.manifest.artifacts).length,10);assert.equal(checked.manifest.matrices.length,4);
 assert.ok(Object.values(checked.manifest.artifacts).every(pin=>!pin.path.includes('old-machine')&&!/^[A-Z]:/.test(pin.path)));
 assert.equal((await loadActiveRelease({foundationRoot:f.foundationRoot})).status,'absent');
});

test('Explicit activation persists exact portable bindings and does not silently replace a selection',async t=>{
 const f=await fixture(t),activated=await activateRelease(f.options),active=await loadActiveRelease({foundationRoot:f.foundationRoot});
 assert.equal(active.status,'active');assert.equal(active.model,'evaluated-synthetic-model');assert.equal(active.pack.id,'synthetic-reviewed-pack');
 assert.equal(activated.path,join(f.adaption,'active-release.json'));
 await assert.rejects(activateRelease(f.options),/already exists/);
 assert.equal((await loadActiveRelease({foundationRoot:f.foundationRoot})).status,'active');
});

test('Copied exact bytes remain valid despite old absolute paths inside evaluation metadata',async t=>{
 const f=await fixture(t);await activateRelease(f.options);
 const copy=await temporaryProject(t);await cp(f.project,copy,{recursive:true});
 const active=await loadActiveRelease({foundationRoot:join(copy,'psych-simulator-foundation')});
 assert.equal(active.status,'active');assert.equal(active.label,f.label);
});

test('Runtime, pack, decision and exact review/evaluation tampering all fail closed',async t=>{
 for(const change of ['runtime','pack','decision','evaluation','review','manifest-model','manifest-planning']){
  const f=await fixture(t);await activateRelease(f.options);
  if(change==='runtime')await writeFile(join(f.foundationRoot,'live','model.mjs'),'// changed\n');
  if(change==='pack'){const data=pack();data.examples[0].reply='Changed wording.';await write(f.packPath,data);}
  if(change==='decision')await write(join(f.adaption,'runs',`${f.label}-decision.json`),{...f.verdict,activate:false});
  if(change==='evaluation'){f.loaded.regression.output='another path';await write(join(f.adaption,'runs',f.names.regression),f.loaded.regression);}
  if(change==='review'){f.loaded.candidateReview.records[0].qualityRating=2;await write(join(f.adaption,'runs',f.names.candidateReview),f.loaded.candidateReview);}
  if(change.startsWith('manifest-')){const path=join(f.adaption,'active-release.json'),value=JSON.parse(await readFile(path,'utf8'));if(change==='manifest-model')value.model='unreviewed-model';else value.answerPlanning=false;await write(path,value);}
  const result=await loadActiveRelease({foundationRoot:f.foundationRoot});assert.equal(result.status,'invalid',change);assert.equal(result.pack,undefined);assert.equal(result.model,undefined);
 }
});

test('A forged activate:true decision cannot override failed recomputed cost gates',async t=>{
 const f=await fixture(t);f.loaded.candidate.usage.unreportedCalls=1;f.loaded.candidateReview=review(f.loaded.candidate);
 await write(join(f.adaption,'runs',f.names.candidate),f.loaded.candidate);await write(join(f.adaption,'runs',f.names.candidateReview),f.loaded.candidateReview);
 await assert.rejects(inspectRelease(f.options),/every recomputed release gate/);
 assert.equal((await loadActiveRelease({foundationRoot:f.foundationRoot})).status,'absent');
});

test('Matrix content changes and missing full-release artifacts cannot activate a partial result',async t=>{
 const f=await fixture(t),descriptor=comparisonMatrices(f.label).find(item=>item.runs.includes('generalization'));
 await write(resolve(f.adaption,descriptor.path),matrix('substituted',16));
 await assert.rejects(activateRelease(f.options),/matrix hash mismatch/);
 await assert.rejects(inspectRelease({...f.options,label:'pilot-25'}),/full release label/);
 const missing=await fixture(t);await rm(join(missing.adaption,'runs',missing.names.regressionReview));
 await assert.rejects(activateRelease(missing.options),/ENOENT/);
});

test('Bootstrap injects the reviewed model and pack without changing saved-model environment or starting a server',async t=>{
 const f=await fixture(t);await activateRelease(f.options);
 const oldModel=process.env.FEATHERLESS_MODEL,seen=[];
 const app=await createReleaseConfiguredApp({foundationRoot:f.foundationRoot,providerOptions:{model:'saved-synthetic-model',key:'synthetic-not-a-real-key'},createAppImpl:appFactory(seen)});
 assert.equal(seen.length,1);assert.equal(seen[0].provider.model,'evaluated-synthetic-model');assert.equal(seen[0].provider.supportsAnswerPlan,true);assert.equal(seen[0].exampleGuidance.id,'synthetic-reviewed-pack');
 assert.equal(process.env.FEATHERLESS_MODEL,oldModel);assert.equal(app.server.synthetic,true);
 assert.deepEqual(app.controller.status().release,{status:'active',label:f.label,model:'evaluated-synthetic-model',answerPlanning:true});
});

test('Missing or invalid selection starts only the unguided saved model and reports its release status',async t=>{
 const f=await fixture(t);
 for(const state of ['absent','invalid']){
  if(state==='invalid')await writeFile(join(f.adaption,'active-release.json'),'invalid JSON');
  const seen=[],app=await createReleaseConfiguredApp({foundationRoot:f.foundationRoot,providerOptions:{model:'saved-synthetic-model',key:'synthetic-not-a-real-key',answerPlanning:true},createAppImpl:appFactory(seen)});
  assert.equal(seen[0].provider.model,'saved-synthetic-model');assert.equal(seen[0].provider.supportsAnswerPlan,false);assert.equal(seen[0].exampleGuidance,null);
  assert.equal(app.controller.status().release.status,state);assert.equal(app.controller.status().release.answerPlanning,false);
 }
});

test('The documented off switch disables an activated release without changing its manifest or saved model',async t=>{
 const f=await fixture(t);await activateRelease(f.options);
 const manifestPath=join(f.adaption,'active-release.json'),before=await readFile(manifestPath),seen=[];
 const app=await createReleaseConfiguredApp({foundationRoot:f.foundationRoot,configuredExampleGuidancePath:'  off  ',providerOptions:{model:'saved-synthetic-model',key:'synthetic-not-a-real-key',answerPlanning:true},createAppImpl:appFactory(seen)});
 assert.equal(seen[0].provider.model,'saved-synthetic-model');assert.equal(seen[0].provider.supportsAnswerPlan,false);assert.equal(seen[0].exampleGuidance,null);
 assert.equal(app.controller.status().release.status,'disabled');assert.equal(app.controller.status().release.answerPlanning,false);assert.match(app.controller.status().release.reason,/PSYCHLAB_EXAMPLE_GUIDANCE_PACK=off/);
 assert.deepEqual(await readFile(manifestPath),before);assert.equal((await loadActiveRelease({foundationRoot:f.foundationRoot})).status,'active');
});

test('The off switch is read from the existing environment setting when no explicit test option is supplied',async t=>{
 const f=await fixture(t);await activateRelease(f.options);
 const previous=process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK;process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK='off';
 try{
  const seen=[],app=await createReleaseConfiguredApp({foundationRoot:f.foundationRoot,providerOptions:{model:'saved-synthetic-model',key:'synthetic-not-a-real-key'},createAppImpl:appFactory(seen)});
  assert.equal(app.release.status,'disabled');assert.equal(seen[0].provider.model,'saved-synthetic-model');assert.equal(seen[0].exampleGuidance,null);
 }finally{if(previous===undefined)delete process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK;else process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK=previous;}
});

test('Arbitrary pack paths cannot bypass a missing or invalid release, or replace the authenticated pack',async t=>{
 const f=await fixture(t),unverifiedPath=join(f.adaption,'runs','unverified-pack.json');await write(unverifiedPath,{...pack(),id:'not-selected'});
 for(const state of ['absent','active','invalid']){
  if(state==='active')await activateRelease(f.options);
  if(state==='invalid')await writeFile(join(f.adaption,'active-release.json'),'bad JSON');
  const seen=[],app=await createReleaseConfiguredApp({foundationRoot:f.foundationRoot,configuredExampleGuidancePath:unverifiedPath,providerOptions:{model:'saved-synthetic-model',key:'synthetic-not-a-real-key'},createAppImpl:appFactory(seen)});
  assert.equal(app.release.status,state);assert.equal(app.release.pathOverrideIgnored,true);
  if(state==='active'){assert.equal(seen[0].exampleGuidance.id,'synthetic-reviewed-pack');assert.equal(seen[0].provider.model,'evaluated-synthetic-model');}
  else{assert.equal(seen[0].exampleGuidance,null);assert.equal(seen[0].provider.supportsAnswerPlan,false);assert.equal(seen[0].provider.model,'saved-synthetic-model');}
 }
});
