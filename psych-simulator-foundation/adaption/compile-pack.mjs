import {readFile, writeFile, access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {prepareReview, loadReviewInputs, labelFromArgs, digest, REVIEW_CHECKS} from './prepare-review.mjs';
import {validateExampleGuidancePack} from '../live/example-guidance.mjs';
import {patientOptions} from '../live/patients.mjs';

const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;
const sourceNames=patientOptions().map(profile=>profile.name);
const escapeRegex=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const namesPattern=new RegExp(`\\b(${sourceNames.map(escapeRegex).join('|')})\\b`,'gi');

// This transform deliberately changes names for demonstration isolation. The
// original provider bytes, question and answer remain in the review workbook.
export function anonymize(text,perspective){
  const replacements=[];
  const replacement=perspective==='caregiver'?'the child':'the patient';
  const value=text.replace(namesPattern,name=>{replacements.push({from:name,to:replacement});return replacement;});
  return {value,replacements};
}

function immutableReview(review){
  return {...review,entries:review.entries.map(({decision,...entry})=>entry)};
}

export function compilePack({review,sourceText,outputText,runState,packId='psychlab-adaption-pilot',version='1.0.0',compiledAt=new Date().toISOString()}){
  if(!object(review)||!Array.isArray(review.entries))throw new Error('A candidate review workbook is required.');
  if(!ID.test(packId)||!ID.test(version))throw new Error('Invalid pack ID/version.');
  if(!timestamp(compiledAt))throw new Error('A valid compilation timestamp is required.');
  const current=prepareReview({sourceText,outputText,runState,createdAt:review.createdAt});
  if(!isDeepStrictEqual(immutableReview(review),immutableReview(current)))throw new Error('Review content or provenance differs from the exact raw output/current source/run. Only decision fields may be edited.');
  if(!current.structural.compilationEligible)throw new Error('Batch identity or provenance ambiguity blocks compilation.');
  const approved=[],rejected=[],transforms=[];
  const reviewers=new Set();
  for(const entry of review.entries){
    const decision=entry.decision;
    if(!object(decision)||!['approved','rejected'].includes(decision.status))throw new Error(`${entry.sourceId}: semantic decision is still pending.`);
    if(!nonempty(decision.reviewedBy)||decision.reviewedBy.length>120||!timestamp(decision.reviewedAt)||!nonempty(decision.rationale))throw new Error(`${entry.sourceId}: reviewer, ISO review time and semantic rationale are required.`);
    if(!isDeepStrictEqual(decision.reviewedHashes,entry.hashes))throw new Error(`${entry.sourceId}: semantic decision is not pinned to this source/candidate/run/output.`);
    if(decision.status==='rejected'){
      rejected.push({id:entry.sourceId,candidateHash:entry.hashes.candidate,issues:entry.issues,decision});
      continue;
    }
    if(entry.issues.length||!entry.candidate)throw new Error(`${entry.sourceId}: malformed or unsupported candidate references cannot be approved; reject this row without repairing it.`);
    if(!object(decision.checks)||REVIEW_CHECKS.some(check=>decision.checks[check]!==true))throw new Error(`${entry.sourceId}: every semantic check must be explicitly true for approval.`);
    if(!Array.isArray(decision.additionalTags)||decision.additionalTags.some(tag=>!nonempty(tag)||tag.length>40))throw new Error(`${entry.sourceId}: additional tags must be short reviewed strings.`);
    if(!object(decision.factExcerpts))throw new Error(`${entry.sourceId}: factExcerpts must be an object.`);
    const canonical=entry.canonical,candidate=entry.candidate;
    const tags=[...new Set([...canonical.teachingTags,...decision.additionalTags])];
    if(tags.length>12)throw new Error(`${entry.sourceId}: too many combined teaching tags.`);
    const refs=new Map(canonical.permittedFacts.map(fact=>[fact.id,`EX_${canonical.id.replace(/-/g,'_')}_${fact.id}`]));
    if(Object.keys(decision.factExcerpts).some(id=>!refs.has(id)))throw new Error(`${entry.sourceId}: excerpt refers to an unpermitted fact.`);
    const transformation={id:entry.sourceId,rawCandidateHash:entry.hashes.candidate,question:{},reply:{},facts:[],factIdMapping:Object.fromEntries(refs)};
    const question=anonymize(candidate.question,canonical.perspective),reply=anonymize(candidate.reply,canonical.perspective);
    transformation.question={original:candidate.question,compiled:question.value,replacements:question.replacements};
    transformation.reply={original:candidate.reply,compiled:reply.value,replacements:reply.replacements};
    const sourceFacts=canonical.permittedFacts.map(fact=>{
      const excerpt=Object.hasOwn(decision.factExcerpts,fact.id)?decision.factExcerpts[fact.id]:null;
      if(excerpt!==null&&(!nonempty(excerpt)||!fact.response.includes(excerpt)))throw new Error(`${entry.sourceId}: fact excerpt must be an exact contiguous substring of the canonical response.`);
      const selected=excerpt??fact.response;
      if(selected.length>400)throw new Error(`${entry.sourceId}: fact ${fact.id} exceeds 400 characters; record a semantically reviewed exact-source excerpt.`);
      const anonymized=anonymize(selected,canonical.perspective);
      transformation.facts.push({canonicalId:fact.id,exampleId:refs.get(fact.id),original:fact.response,reviewedExcerpt:excerpt,compiled:anonymized.value,replacements:anonymized.replacements});
      return {id:refs.get(fact.id),statement:anonymized.value};
    });
    const example={id:canonical.id,tags,lifeStage:canonical.lifeStage,perspective:canonical.perspective,sourceFacts,question:question.value,reply:reply.value,factIds:candidate.factIds.map(id=>refs.get(id)),audit:{unsupported:[],supported:true,relevant:true,no_leak:true},review:{status:'approved',reviewedBy:decision.reviewedBy,reviewedAt:decision.reviewedAt}};
    approved.push(example);transforms.push(transformation);reviewers.add(decision.reviewedBy);
  }
  if(!approved.length)throw new Error('No semantically approved examples are available; an empty guidance pack will not be compiled.');
  const reviewerText=[...reviewers].join('; ');
  if(reviewerText.length>120)throw new Error('Combined reviewer names exceed the pack review limit.');
  const pack=validateExampleGuidancePack({schemaVersion:1,id:packId,version,status:'approved',review:{reviewedBy:reviewerText,reviewedAt:compiledAt,sourceRunId:current.run.runId},examples:approved});
  const packText=JSON.stringify(pack,null,2)+'\n';
  const report={schemaVersion:1,type:'psychlab-adaption-compilation-report',compiledAt,pack:{id:pack.id,version:pack.version,sha256:digest(packText)},source:current.source,run:current.run,output:current.output,reviewSha256:digest(JSON.stringify(review)),approvedCount:approved.length,rejectedCount:rejected.length,activated:false,notice:'Illustrative guidance derived from semantically reviewed Adaption candidates. Patient names were locally replaced with the child/the patient, fact IDs remapped to EX_, and any explicitly reviewed source excerpts recorded. Compiled text must not be described as unchanged Adaption output. Exact raw provider records remain in the review workbook and output JSONL. Approval is source-faithfulness review, not clinical validation. This command does not activate the pack.',transforms,rejected,approvedDecisions:review.entries.filter(entry=>entry.decision.status==='approved').map(entry=>({id:entry.sourceId,hashes:entry.hashes,decision:entry.decision}))};
  return {pack,packText,report};
}

const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  try{
    const args=process.argv.slice(2);
    if(args.length&&!(args.length===2&&args[0]==='--label'))throw new Error('Usage: node compile-pack.mjs [--label pilot-25]');
    const label=labelFromArgs(args),inputs=await loadReviewInputs(label);
    const review=JSON.parse(await readFile(new URL(`./runs/${label}-review.json`,import.meta.url),'utf8'));
    const result=compilePack({...inputs,review,packId:`psychlab-adaption-${label}`});
    const packPath=new URL(`./runs/${label}-approved-pack.json`,import.meta.url),reportPath=new URL(`./runs/${label}-compilation-report.json`,import.meta.url);
    for(const path of [packPath,reportPath]){try{await access(path);throw new Error('A compiled artifact already exists; it will not be overwritten.');}catch(error){if(error.code!=='ENOENT')throw error;}}
    await writeFile(packPath,result.packText,{flag:'wx'});
    await writeFile(reportPath,JSON.stringify(result.report,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({label,approved:result.report.approvedCount,rejected:result.report.rejectedCount,packHash:result.report.pack.sha256,activated:false}));
  }catch(error){console.error(error.message);process.exitCode=1;}
}
