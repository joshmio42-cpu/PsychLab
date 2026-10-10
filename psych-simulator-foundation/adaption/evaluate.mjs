import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createFeatherless,answerQuestion,requestPayload,PROMPT_VERSION} from '../live/model.mjs';
import {loadExampleGuidancePack} from '../live/example-guidance.mjs';
import {simulateHistory} from '../live/engine.mjs';
import {createLedger,meteredComplete,ECONOMY} from '../live/usage.mjs';
import {sha256} from './config.mjs';
import {MODEL_PRICES} from '../live/pricing.mjs';

const args=process.argv.slice(2),value=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1];};
const label=value('--label')??'pilot-25';
if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(label))throw new Error('Invalid evidence label.');
const variantSelection=value('--variant')??'both';
const model=value('--model')??'Qwen/Qwen2.5-72B-Instruct';
if(!Object.hasOwn(MODEL_PRICES,model))throw new Error('This model needs a verified price before a cost comparison.');
if(!['baseline','candidate','both'].includes(variantSelection))throw new Error('Invalid comparison variant.');
const packPath=value('--pack');
const pack=await loadExampleGuidancePack(packPath);
if(variantSelection!=='baseline'&&!pack)throw new Error('A reviewed candidate pack is required; no evaluation requests were sent.');
if(['--transfer','--generalization','--release-generalization'].filter(flag=>args.includes(flag)).length>1)throw new Error('Select one evaluation matrix.');
const matrixFile=args.includes('--release-generalization')?'./data/release-generalization-v2.json':args.includes('--generalization')?'./data/grounding-generalization-evaluation.json':args.includes('--transfer')?'./data/guidance-transfer-evaluation.json':'../../work/natural-conversation-evaluation.json';
const matrixBytes=await readFile(new URL(matrixFile,import.meta.url));
const matrix=JSON.parse(matrixBytes);
const folder=new URL('./runs/',import.meta.url),output=new URL(`${label}-${variantSelection}.json`,folder);
const sourceHashes={};
for(const file of ['model.mjs','answer-plan.mjs','evidence-render.mjs','interview-style.mjs','example-guidance.mjs','prompt-context.mjs','conversation.mjs','agent-context.mjs','factual-support.mjs','question-resolution.mjs','usage.mjs','pricing.mjs'])sourceHashes[file]=sha256(await readFile(new URL(`../live/${file}`,import.meta.url)));
const variantCount=variantSelection==='both'?2:1;
const summary={cases:matrix.cases.length,variants:variantCount,maximumProviderCalls:matrix.cases.length*3*variantCount,model,answerPlanning:args.includes('--planned'),matrixFile,packHash:pack?sha256(await readFile(packPath)):null,matrixHash:sha256(matrixBytes),output:fileURLToPath(output)};
if(!args.includes('--live')){console.log(JSON.stringify({mode:'dry-run',...summary}));process.exit(0);}
if(process.env.FEATHERLESS_MODEL!==summary.model)throw new Error('Configured model must match the explicitly selected evaluation model.');
const real=createFeatherless({answerPlanning:summary.answerPlanning});if(!real.configured)throw new Error('Missing Featherless configuration.');
await mkdir(folder,{recursive:true});
try{await access(output);throw new Error('Evidence exists: use a new label.');}catch(error){if(error.code!=='ENOENT')throw error;}
const processLedger=createLedger(summary.maximumProviderCalls);
const report={schemaVersion:1,label,...summary,sourceHashes,promptVersion:PROMPT_VERSION,status:'running',startedAt:new Date().toISOString(),
 method:'Same frozen snapshot and question for both variants; alternate order when run together, otherwise record separate run times; no retries; independent semantic review pending. The 36 main, 8 transfer and first 16 grounding cases are now regression sets after diagnosis. Only release-generalization-v2 is reserved unseen until its first release run; subsequent use is regression evidence. Candidate examples predate these later matrices.',
 releaseGate:{noUnsupportedDeliveredClaims:true,noHardRegressions:true,minimumImprovedCases:1,qualityMustNotDecrease:true,maxCostIncreaseFraction:0.2,allCasesReviewed:true},records:[]};
const save=()=>writeFile(output,JSON.stringify({...report,usage:processLedger},null,2));await save();
for(const [index,sample] of matrix.cases.entries()){
 const snapshot=simulateHistory({seed:42,days:sample.fixture.days??28,...sample.fixture});
 const turns=sample.precedingTurns.map((t,i)=>({...t,id:`eval-${sample.id}-${i}`,interaction:t.interaction??'answer'}));
 for(const variant of variantSelection==='both'?(index%2?['candidate','baseline']:['baseline','candidate']):[variantSelection]){
  const ledger=createLedger(3),record={id:sample.id,variant,question:sample.question,fixture:sample.fixture,precedingTurns:turns,
   expectedBehaviors:sample.expectedBehaviors,forbiddenThings:sample.forbiddenThings,snapshotHash:snapshot.hash,calls:[],review:{status:'pending'}};
  report.records.push(record);const before=sha256(JSON.stringify(snapshot));
  const provider={configured:real.configured,model:real.model,supportsAnswerPlan:real.supportsAnswerPlan,async complete(request){
   const call={role:request.role,input:request.input};record.calls.push(call);
   try{const payload=requestPayload(request);call.inputBytes=payload.bytes;const result=await meteredComplete(real,request,[ledger,processLedger],payload);call.value=result.value;call.meta=result.meta;return result;}
   catch(error){call.error={message:error.message,meta:error.meta};throw error;}
  }};
  try{record.result=await answerQuestion({snapshot,turns,question:sample.question,provider,difficulty:sample.fixture.difficulty,exampleGuidance:variant==='candidate'?pack:null});record.status='answered';}
  catch(error){record.status='blocked';record.error={message:error.message,status:error.status??null};}
  record.snapshotUnchanged=before===sha256(JSON.stringify(snapshot));record.usage=ledger;
  const ids=new Set(record.calls.flatMap(c=>[...(c.value?.fact_ids??[]),...(c.value?.parts??[]).flatMap(part=>[...(part.sources??[]),...(part.contextSources??[])].map(source=>source.id)),...(c.input?.permittedFacts??[]).map(f=>f.id),...(c.input?.citedFacts??[]).map(f=>f.id)]));
  record.canonicalFacts=snapshot.facts.filter(f=>ids.has(f.id));
  await save();console.log(JSON.stringify({id:sample.id,variant,status:record.status,calls:ledger.attemptedCalls,tokens:ledger.reportedTokens,estimatedUsd:ledger.cost.estimatedUsd}));
 }
}
report.status='complete';report.completedAt=new Date().toISOString();await save();console.log(JSON.stringify({complete:summary.output,cost:processLedger.cost,reviewRequired:true}));
