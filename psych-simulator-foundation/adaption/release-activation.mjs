// Activation is a local startup selection, never a credential edit or a live
// server restart. Recompute the full release verdict instead of trusting a
// manifest's activate flag. All bindings use relative paths and exact bytes.
import {readFile,writeFile,mkdir,link,access,unlink} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute,join,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {randomUUID} from 'node:crypto';
import {compareResults,comparisonArtifacts,comparisonMatrices} from './compare-results.mjs';
import {sha256} from './config.mjs';
import {validateExampleGuidancePack} from '../live/example-guidance.mjs';

const defaultFoundation=fileURLToPath(new URL('../',import.meta.url));
const asJson=bytes=>JSON.parse(bytes.toString('utf8'));
const requireValid=(condition,message)=>{if(!condition)throw new Error(`Release activation rejected: ${message}.`);};
const hashPattern=/^[a-f0-9]{64}$/;
const sameDecision=(a,b)=>isDeepStrictEqual({...a,reviewedAt:null},{...b,reviewedAt:null});
function layout(foundationRoot){
 const foundation=resolve(foundationRoot),adaption=join(foundation,'adaption'),project=dirname(foundation);
 return {foundation,adaption,project,manifest:join(adaption,'active-release.json')};
}
function projectPath(project,path){
 const resolved=resolve(project,path),local=relative(project,resolved);
 requireValid(local&&!isAbsolute(local)&&local!=='..'&&!local.startsWith(`..${sep}`),'artifact must remain inside this project');
 return resolved;
}
function relativePin(project,path,bytes){return {path:relative(project,projectPath(project,path)).split(sep).join('/'),sha256:sha256(bytes)};}
async function readJson(path){const bytes=await readFile(path);return {bytes,value:asJson(bytes)};}

/** Read only. Does not write a manifest, start a server, call a provider or read credentials. */
export async function inspectRelease({label,packPath,foundationRoot=defaultFoundation}={}){
 requireValid(typeof label==='string'&&label.startsWith('release-'),'a full release label is required');
 const paths=layout(foundationRoot),names=comparisonArtifacts(label),loaded={},artifacts={};
 for(const [key,name] of Object.entries(names)){
  const path=join(paths.adaption,'runs',name);loaded[key]=await readJson(path);artifacts[key]=relativePin(paths.project,path,loaded[key].bytes);
 }
 for(const [evaluation,review] of [['baseline','baselineReview'],['candidate','candidateReview'],['transfer','transferReview'],['regression','regressionReview'],['generalization','generalizationReview']]){
  requireValid(loaded[evaluation]&&loaded[review],'every required evaluation and independent review must exist');
  requireValid(loaded[review].value.sourceEvaluationHash===sha256(loaded[evaluation].bytes),'review does not bind the exact evaluation bytes');
 }
 const matrices=[];
 for(const descriptor of comparisonMatrices(label)){
  const path=resolve(paths.adaption,descriptor.path),matrix=await readJson(path);
  projectPath(paths.project,path);
  requireValid(Array.isArray(matrix.value.cases),'matrix cases are required');
  matrices.push({...relativePin(paths.project,path,matrix.bytes),runs:[...descriptor.runs]});
  for(const key of descriptor.runs){
   const run=loaded[key].value;
   requireValid(run.matrixHash===sha256(matrix.bytes),'matrix hash mismatch');
   requireValid(isDeepStrictEqual(run.records.map(record=>record.id).sort(),matrix.value.cases.map(record=>record.id).sort()),'matrix case IDs mismatch');
   for(const record of run.records){
    const sample=matrix.value.cases.find(row=>row.id===record.id);
    const turns=sample.precedingTurns.map((turn,index)=>({...turn,id:`eval-${sample.id}-${index}`,interaction:turn.interaction??'answer'}));
    requireValid(['question','fixture','expectedBehaviors','forbiddenThings'].every(key=>isDeepStrictEqual(record[key],sample[key]))&&isDeepStrictEqual(record.precedingTurns,turns),'evaluated case inputs differ from the matrix');
   }
  }
 }
 const candidate=loaded.candidate.value;
 requireValid(candidate.sourceHashes&&typeof candidate.sourceHashes==='object','runtime source hashes are required');
 for(const [file,hash] of Object.entries(candidate.sourceHashes)){
  requireValid(/^[a-z0-9][a-z0-9.-]*\.mjs$/.test(file)&&hashPattern.test(hash),'invalid runtime source binding');
  requireValid(sha256(await readFile(join(paths.foundation,'live',file)))===hash,'runtime changed after evaluation');
 }
 const verdict=compareResults(loaded.baseline.value,candidate,loaded.baselineReview.value,loaded.candidateReview.value,loaded.transfer.value,loaded.transferReview.value,{
  requireRegression:true,requireGeneralization:true,requireAnswerPlanning:true,
  regression:loaded.regression.value,regressionReview:loaded.regressionReview.value,
  generalization:loaded.generalization.value,generalizationReview:loaded.generalizationReview.value
 });
 requireValid(verdict.activate===true&&Object.values(verdict.gates).every(value=>value===true),'every recomputed release gate must pass');
 const decisionPath=join(paths.adaption,'runs',`${label}-decision.json`),decision=await readJson(decisionPath);
 requireValid(sameDecision(decision.value,verdict),'saved decision differs from the recomputed verdict');
 requireValid(typeof packPath==='string'&&packPath.trim(),'approved pack path is required');
 const resolvedPack=projectPath(paths.project,isAbsolute(packPath)?packPath:resolve(paths.adaption,packPath)),packFile=await readJson(resolvedPack);
 requireValid(sha256(packFile.bytes)===verdict.packHash,'pack differs from the evaluated pack');
 const pack=validateExampleGuidancePack(packFile.value);
 return {manifest:{schemaVersion:1,label,createdAt:new Date().toISOString(),model:verdict.model,answerPlanning:verdict.answerPlanning,
  pack:relativePin(paths.project,resolvedPack,packFile.bytes),decision:relativePin(paths.project,decisionPath,decision.bytes),artifacts,matrices,sourceHashes:structuredClone(candidate.sourceHashes)},pack,verdict};
}

/** Explicit activation only. Existing selections are never silently replaced. */
export async function activateRelease(options){
 const verified=await inspectRelease(options),paths=layout(options?.foundationRoot??defaultFoundation);
 try{await access(paths.manifest);throw new Error('A release selection already exists. Review and archive it before activating another release.');}
 catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(paths.adaption,{recursive:true});
 const temporary=join(paths.adaption,`.active-release-${randomUUID()}.tmp`);
 try{
  await writeFile(temporary,JSON.stringify(verified.manifest,null,2)+'\n',{flag:'wx'});
  // Publishing a complete file with a hard link is atomic and cannot replace a
  // selection created concurrently. Both files are in the same directory.
  await link(temporary,paths.manifest);
 }finally{await unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 return {path:paths.manifest,manifest:verified.manifest};
}

/** Missing/invalid selections return no pack/model override, preserving baseline startup. */
export async function loadActiveRelease({foundationRoot=defaultFoundation,manifestPath}={}){
 const paths=layout(foundationRoot),path=manifestPath??paths.manifest;
 let saved;
 try{saved=await readJson(path);}catch(error){return {status:error.code==='ENOENT'?'absent':'invalid',reason:error.code==='ENOENT'?'No reviewed release is selected.':'The release selection could not be read.'};}
 try{
  const manifest=saved.value;
  requireValid(manifest?.schemaVersion===1&&typeof manifest.pack?.path==='string','manifest schema');
  const verified=await inspectRelease({label:manifest.label,packPath:projectPath(paths.project,manifest.pack.path),foundationRoot});
  requireValid(isDeepStrictEqual({...manifest,createdAt:null},{...verified.manifest,createdAt:null}),'manifest model, settings or evidence bindings changed');
  return {status:'active',label:manifest.label,model:manifest.model,answerPlanning:manifest.answerPlanning,pack:verified.pack,manifest};
 }catch(error){return {status:'invalid',reason:error.message};}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2),value=flag=>args[args.indexOf(flag)+1];
 try{
  if(args.includes('--activate')){
   const activated=await activateRelease({label:value('--label'),packPath:value('--pack')});
   console.log(JSON.stringify({status:'selected-for-next-launch',path:activated.path,model:activated.manifest.model,label:activated.manifest.label,answerPlanning:activated.manifest.answerPlanning}));
  }else if(args.includes('--check')){
   const checked=await inspectRelease({label:value('--label'),packPath:value('--pack')});
   console.log(JSON.stringify({status:'verified',model:checked.manifest.model,label:checked.manifest.label,answerPlanning:checked.manifest.answerPlanning}));
  }else{
   const active=await loadActiveRelease();
   console.log(JSON.stringify({status:active.status,...(active.label?{label:active.label,model:active.model,answerPlanning:active.answerPlanning}:{reason:active.reason})}));
  }
 }catch(error){console.error(error.message);process.exitCode=1;}
}
