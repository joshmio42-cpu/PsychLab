import {createHash} from 'node:crypto';
import {readFile, writeFile, access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateExamples, exportJsonl} from './build-examples.mjs';

export const REVIEW_CHECKS=['supported','relevant','noLeak','perspective','chronology','uncertainty','noInventedFacts'];
export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const nonempty=value=>typeof value==='string'&&value.trim().length>0;
const onlyKeys=(value,keys)=>Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));

export function runIdentity(runState){
  if(!object(runState)||!nonempty(runState.datasetId)||!nonempty(runState.runId)||!nonempty(runState.dataHash))throw new Error('A saved run with dataset ID, run ID and uploaded data hash is required.');
  return {datasetId:runState.datasetId,runId:runState.runId,inputDataHash:runState.dataHash,downloadHash:runState.download?.sha256??null,partial:runState.download?.partial??null};
}

export function parseCompletion(text){
  if(!nonempty(text))throw new Error('enhanced_completion must be a nonempty JSON string.');
  let parsed;
  try{parsed=JSON.parse(text);}catch{throw new Error('enhanced_completion is not valid JSON; no repair was attempted.');}
  if(!object(parsed)||!onlyKeys(parsed,['reply','factIds'])||!nonempty(parsed.reply)||parsed.reply.length>400||!Array.isArray(parsed.factIds)||parsed.factIds.length<1||parsed.factIds.length>4||parsed.factIds.some(ref=>typeof ref!=='string')||new Set(parsed.factIds).size!==parsed.factIds.length)throw new Error('Candidate must have exactly reply (1–400 characters) and 1–4 unique factIds.');
  return parsed;
}

// Raw provider records are retained in full. Extra provider columns are neither
// guessed nor used to replace locally pinned canonical evidence.
export function prepareReview({sourceText,outputText,runState,createdAt=new Date().toISOString()}){
  const source=JSON.parse(sourceText),sourceErrors=validateExamples(source);
  if(sourceErrors.length)throw new Error(`Invalid canonical development source: ${sourceErrors.join(' ')}`);
  const sourceHash=digest(sourceText),sourceJsonlHash=digest(exportJsonl(source)),outputHash=digest(outputText),run=runIdentity(runState),runHash=digest(run);
  const globalIssues=[];
  if(run.inputDataHash!==sourceJsonlHash)globalIssues.push('Uploaded source data hash differs from the current reviewed development corpus.');
  if(run.downloadHash!==outputHash)globalIssues.push('Downloaded output hash is absent or differs from the raw output file.');
  if(runState.remote?.status!=='succeeded'||run.partial!==false)globalIssues.push('Only a succeeded, non-partial downloaded run is eligible for compilation.');
  const byQuestion=new Map(source.examples.map(row=>[row.question,row]));
  const uploadedByQuestion=new Map(exportJsonl(source).trim().split('\n').map(line=>{const row=JSON.parse(line);return [row.prompt,row];}));
  if(byQuestion.size!==source.examples.length)throw new Error('Canonical questions are not unique.');
  const lines=outputText.split(/\r?\n/);
  if(lines.at(-1)==='')lines.pop();
  const entries=lines.map((rawLine,index)=>{
    const issues=[],blockingIssues=[],notes=[];
    const block=message=>{issues.push(message);blockingIssues.push(message);};
    let rawRecord=null,canonical=null,candidate=null;
    const sourceColumns={originalQuestion:null,originalCompletion:null,candidateQuestion:null,questionUnchanged:false,verifiedContext:[]};
    if(!rawLine.trim())block('Empty interior output line.');
    else try{rawRecord=JSON.parse(rawLine);}catch{block('Malformed JSONL record; raw line preserved.');}
    if(rawRecord!==null&&!object(rawRecord))block('Output record must be a JSON object.');
    if(object(rawRecord)){
      const questionColumns=['original_prompt','prompt'].filter(column=>Object.hasOwn(rawRecord,column));
      const originalQuestion=questionColumns.length?rawRecord[questionColumns[0]]:undefined;
      sourceColumns.originalQuestion=questionColumns[0]??null;
      if(questionColumns.length===2&&rawRecord.original_prompt!==rawRecord.prompt)block('Conflicting original_prompt and mapped prompt columns.');
      if(!nonempty(originalQuestion))block('Missing or malformed original question (original_prompt or mapped prompt).');
      else {
        canonical=byQuestion.get(originalQuestion)??null;
        if(!canonical)block('Original question does not exactly match a unique canonical development question.');
      }
      if(canonical){
        const uploaded=uploadedByQuestion.get(originalQuestion);
        const completionColumns=['original_completion','completion'].filter(column=>Object.hasOwn(rawRecord,column));
        sourceColumns.originalCompletion=completionColumns[0]??null;
        if(completionColumns.length===2&&rawRecord.original_completion!==rawRecord.completion)block('Conflicting original_completion and mapped completion columns.');
        if(completionColumns.length){
          for(const column of completionColumns)if(rawRecord[column]!==uploaded.completion)block(`${column} differs from the uploaded reviewed completion.`);
        }else notes.push('Provider omitted original_completion and mapped completion; canonical completion is recovered only from the pinned local source.');
        for(const column of ['context','original_context'])if(Object.hasOwn(rawRecord,column)){
          if(rawRecord[column]!==uploaded.context)block(`${column} differs from the exact uploaded canonical context.`);
          else sourceColumns.verifiedContext.push(column);
        }
      }
      // The verified pilot export uses null here when prompt rephrasing is off.
      // This selects the exact original input; it does not invent an enhancement.
      const candidateQuestion=rawRecord.enhanced_prompt===null?originalQuestion:rawRecord.enhanced_prompt;
      sourceColumns.candidateQuestion=rawRecord.enhanced_prompt===null?sourceColumns.originalQuestion:'enhanced_prompt';
      sourceColumns.questionUnchanged=rawRecord.enhanced_prompt===null;
      if(rawRecord.enhanced_prompt===null)notes.push(`enhanced_prompt is null; the question remains the exact original ${sourceColumns.originalQuestion} value (no question rephrasing).`);
      if(!nonempty(candidateQuestion)||candidateQuestion.length>400)issues.push('Missing or malformed candidate question (expected enhanced_prompt or its explicit null with a valid original).');
      let completion=null;
      try{completion=parseCompletion(rawRecord.enhanced_completion);}catch(error){issues.push(error.message);}
      if(completion&&canonical){
        const permitted=new Set(canonical.permittedFacts.map(fact=>fact.id));
        if(completion.factIds.some(ref=>!permitted.has(ref)))issues.push('Candidate cites a fact outside the permitted canonical evidence.');
      }
      if(completion&&nonempty(candidateQuestion))candidate={question:candidateQuestion,completionText:rawRecord.enhanced_completion,reply:completion.reply,factIds:completion.factIds};
    }
    const sourceId=canonical?.id??null;
    const hashes={source:sourceHash,sourceRow:canonical?digest(canonical):null,candidate:digest(rawLine),run:runHash,output:outputHash};
    return {lineNumber:index+1,sourceId,hashes,sourceColumns,rawLine,rawRecord,canonical,candidate,issues,blockingIssues,notes,decision:{status:'pending',reviewedBy:null,reviewedAt:null,rationale:'',checks:Object.fromEntries(REVIEW_CHECKS.map(check=>[check,null])),reviewedHashes:null,additionalTags:[],factExcerpts:{}}};
  });
  const counts=new Map();
  for(const entry of entries)if(entry.sourceId)counts.set(entry.sourceId,(counts.get(entry.sourceId)??0)+1);
  for(const entry of entries)if(entry.sourceId&&counts.get(entry.sourceId)>1){entry.issues.push('Duplicate original question/source ID in output.');entry.blockingIssues.push('Duplicate original question/source ID in output.');}
  const missingIds=source.examples.filter(row=>!counts.has(row.id)).map(row=>row.id);
  if(entries.length!==source.examples.length)globalIssues.push(`Expected ${source.examples.length} rows; received ${entries.length}.`);
  if(missingIds.length)globalIssues.push(`Missing canonical rows: ${missingIds.join(', ')}.`);
  const valid=globalIssues.length===0&&entries.every(entry=>entry.issues.length===0);
  const compilationEligible=globalIssues.length===0&&entries.every(entry=>entry.blockingIssues.length===0);
  return {schemaVersion:1,type:'psychlab-adaption-candidate-review',createdAt,source:{datasetId:source.datasetId,version:source.version,sha256:sourceHash,jsonlSha256:sourceJsonlHash},run:{...run,sha256:runHash},output:{sha256:outputHash,bytes:Buffer.byteLength(outputText),lineCount:entries.length},structural:{valid,compilationEligible,globalIssues,missingIds},instructions:'Every decision begins pending. Read the exact candidate against the canonical facts. Approve only after semantic review; fill reviewer, ISO time, rationale, all checks true, and reviewedHashes copied from this entry. Rejections need a reason. Candidate format failures must be rejected individually; ambiguous identity/provenance blocks the whole batch. Additional runtime tags may describe the reviewed example, never add patient facts. Oversized facts need manually reviewed exact-source factExcerpts. No automatic approval or activation.',entries};
}

export function renderReview(review){
  const decisions=review.entries.map(entry=>entry.decision.status);
  const lines=[`PsychLab Adaption candidate review — ${review.run.runId}`,
    `Structural eligibility: ${review.structural.valid?'PASS':review.structural.compilationEligible?'Candidate errors require individual rejection':'BLOCKED: batch identity/provenance ambiguity'}`,
    `Semantic decisions: ${decisions.filter(status=>status==='approved').length} approved, ${decisions.filter(status=>status==='rejected').length} rejected, ${decisions.filter(status=>status==='pending').length} pending.`,
    `Source SHA-256: ${review.source.sha256}`,`Raw output SHA-256: ${review.output.sha256}`,
    'Raw provider rows are preserved verbatim in the JSON workbook. This text is a reading aid; decisions must be saved explicitly in JSON.',
    ...review.structural.globalIssues.map(issue=>`BLOCK: ${issue}`),''];
  for(const entry of review.entries){
    lines.push(`ROW ${entry.lineNumber}: ${entry.sourceId??'UNMATCHED'}`,`Structural issues: ${entry.issues.length?entry.issues.join(' | '):'none'}`,`Verified source columns: ${JSON.stringify(entry.sourceColumns)}`,...entry.notes.map(note=>`Note: ${note}`));
    if(entry.canonical){
      const source=entry.canonical;
      lines.push(`Profile: ${source.patientSetup.patientId}; ${source.lifeStage}; ${source.perspective}; premise ${source.patientSetup.disorderId??'none'}`,
        `Original question: ${source.question}`,`Reviewed baseline: ${source.reviewedResponse}`,
        `Original citations: ${source.supportingFactIds.join(', ')}`,`Original review: ${source.review.basis}`,
        ...source.permittedFacts.map(fact=>`[${fact.id}${fact.scope?`, ${fact.scope}`:''}${fact.timeframe?`, ${fact.timeframe}`:''}] ${fact.response}`));
    }
    if(entry.candidate)lines.push(`Candidate question: ${entry.candidate.question}`,`Candidate reply (exact): ${entry.candidate.reply}`,`Candidate citations: ${entry.candidate.factIds.join(', ')}`);
    else lines.push(`Raw line: ${entry.rawLine}`);
    lines.push(`Candidate hash: ${entry.hashes.candidate}`,`Decision: ${entry.decision.status}`,
      `Review: ${entry.decision.rationale||'Pending semantic review.'}`,
      `Reviewer: ${entry.decision.reviewedBy??'pending'}; time: ${entry.decision.reviewedAt??'pending'}`,'');
  }
  return lines.join('\n')+'\n';
}

export function labelFromArgs(args){
  const position=args.indexOf('--label'),label=position<0?'pilot-25':args[position+1];
  if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(label??''))throw new Error('Invalid batch label.');
  return label;
}

export async function loadReviewInputs(label){
  const base=new URL('./runs/',import.meta.url);
  const [sourceText,outputText,runText]=await Promise.all([
    readFile(new URL('./data/source-examples.json',import.meta.url),'utf8'),
    readFile(new URL(`${label}-output.jsonl`,base),'utf8'),
    readFile(new URL(`${label}.json`,base),'utf8')
  ]);
  return {sourceText,outputText,runState:JSON.parse(runText)};
}

const isMain=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(isMain){
  try{
    const args=process.argv.slice(2);
    if(args.length&&!(args.length===2&&args[0]==='--label'))throw new Error('Usage: node prepare-review.mjs [--label pilot-25]');
    const label=labelFromArgs(args),review=prepareReview(await loadReviewInputs(label));
    const jsonPath=new URL(`./runs/${label}-review.json`,import.meta.url),textPath=new URL(`./runs/${label}-review.txt`,import.meta.url);
    for(const path of [jsonPath,textPath]){try{await access(path);throw new Error('A review artifact already exists; it will not be overwritten.');}catch(error){if(error.code!=='ENOENT')throw error;}}
    await writeFile(jsonPath,JSON.stringify(review,null,2)+'\n',{flag:'wx'});
    await writeFile(textPath,renderReview(review),{flag:'wx'});
    console.log(JSON.stringify({label,rows:review.entries.length,structurallyValid:review.structural.valid,compilationEligible:review.structural.compilationEligible,pendingDecisions:review.entries.length,activated:false}));
    if(!review.structural.compilationEligible)process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1;}
}
