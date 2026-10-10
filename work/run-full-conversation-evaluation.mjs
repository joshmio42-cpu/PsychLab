import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createFeatherless,answerQuestion,requestPayload,PROMPT_VERSION} from '../psych-simulator-foundation/live/model.mjs';
import {simulateHistory} from '../psych-simulator-foundation/live/engine.mjs';
import {createLedger,meteredComplete,ECONOMY} from '../psych-simulator-foundation/live/usage.mjs';
import {PROFILE_BACKGROUND_VERSION} from '../psych-simulator-foundation/live/individuality.mjs';
import {CONVERSATION_VERSION} from '../psych-simulator-foundation/live/conversation.mjs';

// Explicit --live is required. Do not place credentials in this script, arguments,
// evidence files or console output. The private PowerShell runner loads DPAPI.
const args=process.argv.slice(2);
const valueAfter=flag=>{const i=args.indexOf(flag);return i<0?null:args[i+1]??null;};
const live=args.includes('--live'),label=valueAfter('--label')??'baseline';
if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(label))throw new Error('Use a short lowercase evidence label.');
const filter=valueAfter('--ids')?.split(',').filter(Boolean)??[];
const matrix=JSON.parse(await readFile(new URL('./natural-conversation-evaluation.json',import.meta.url),'utf8'));
const cases=filter.length?matrix.cases.filter(c=>filter.includes(c.id)):matrix.cases;
if(!cases.length||filter.some(id=>!matrix.cases.some(c=>c.id===id)))throw new Error('Unknown or empty evaluation case selection.');
const folder=new URL('../research/interview-improvements-2026-10-08/',import.meta.url);
const output=new URL(`${label}.json`,folder);
const sourceNames=['model.mjs','conversation.mjs','individuality.mjs','agent-context.mjs','interview-style.mjs','usage.mjs','pricing.mjs','factual-support.mjs'];
const sourceHashes={};
for(const name of sourceNames){
 const contents=await readFile(new URL(`../psych-simulator-foundation/live/${name}`,import.meta.url));
 sourceHashes[name]=createHash('sha256').update(contents).digest('hex');
}
const prepared=cases.map(sample=>{
 const snapshot=simulateHistory({seed:42,days:sample.fixture.days??28,...sample.fixture});
 const turns=sample.precedingTurns.map((turn,i)=>({...turn,id:`fixture-${sample.id}-${i+1}`,interaction:turn.interaction??'answer'}));
 for(const turn of turns)for(const id of turn.factIds??[])if(!snapshot.facts.some(f=>f.id===id))throw new Error(`${sample.id}: unavailable fixture fact ${id}.`);
 return {sample,snapshot,turns};
});
if(!live){
 console.log(JSON.stringify({mode:'dry-run',caseCount:prepared.length,caseIds:prepared.map(p=>p.sample.id),maximumProviderCalls:prepared.length*3,evidencePath:fileURLToPath(output),sourceHashes}));
 process.exit(0);
}
const expectedModel='Qwen/Qwen2.5-72B-Instruct';
if(process.env.FEATHERLESS_MODEL!==expectedModel)throw new Error(`This evaluation requires ${expectedModel}.`);
const real=createFeatherless();if(!real.configured)throw new Error('Provider credential is not configured. Use the private runner.');
await mkdir(folder,{recursive:true});
try{await access(output);throw new Error('Evidence file already exists. Choose a new label; preserve previous outcomes.');}catch(error){if(error.code!=='ENOENT')throw error;}
const processLedger=createLedger(ECONOMY.processCalls);
const report={
 title:'PsychLab full natural conversation live evaluation',version:'1.0.0',label,
 startedAt:new Date().toISOString(),completedAt:null,status:'running',
 model:expectedModel,matrixVersion:matrix.version,promptVersion:PROMPT_VERSION,conversationVersion:CONVERSATION_VERSION,profileVersion:PROFILE_BACKGROUND_VERSION,
 sourceHashes,method:matrix.evaluationMethod,globalForbiddenThings:matrix.globalForbiddenThings,
 safeguards:{fictionOnly:true,automaticRetries:false,independentSnapshotPerCase:true,fixturesAreSupportedParaphrases:true,
  maximumCallsPerCase:3,processCallLimit:processLedger.limit,inputByteCap:ECONOMY.maxInputBytes,outputTokenCaps:ECONOMY.outputTokens,
  review:'Every actual reply and rejected candidate needs independent comparison with canonical facts. Provider audit approval alone is not a pass.'},
 requestedCaseIds:prepared.map(p=>p.sample.id),records:[],usage:structuredClone(processLedger)
};
await writeFile(output,JSON.stringify(report,null,2),{flag:'wx'});
for(const {sample,snapshot,turns} of prepared){
 const before=JSON.stringify(snapshot),ledger=createLedger(3),started=Date.now();
 const record={id:sample.id,tags:sample.tags,fixture:{seed:42,days:28,...sample.fixture},question:sample.question,
  precedingTurns:turns,expectedBehaviors:sample.expectedBehaviors,forbiddenThings:sample.forbiddenThings,
  snapshotHash:snapshot.hash,calls:[],status:'running',independentReview:{status:'pending',hardPass:null,qualityRating:null,notes:[]}};
 report.records.push(record);
 const provider={configured:real.configured,model:real.model,async complete(request){
  const call={role:request.role,input:request.input,startedAt:new Date().toISOString(),status:'running'};
  record.calls.push(call);
  try{
   const payload=requestPayload(request);call.inputBytes=payload.bytes;call.outputTokenLimit=payload.maxTokens;
   const result=await meteredComplete(real,request,[ledger,processLedger],payload);
   call.status='completed';call.value=result.value;call.meta=result.meta;
   return result;
  }catch(error){
   call.status='failed';call.error={message:error.message,status:error.status??null,meta:error.meta??null};throw error;
  }finally{call.finishedAt=new Date().toISOString();}
 }};
 try{
  const result=await answerQuestion({snapshot,turns,question:sample.question,provider,difficulty:sample.fixture.difficulty});
  record.status='answered';record.result=result;
 }catch(error){record.status='blocked';record.error={message:error.message,status:error.status??null,meta:error.meta??null};}
 record.snapshotUnchanged=before===JSON.stringify(snapshot);
 const ids=new Set(record.calls.flatMap(c=>[...(c.value?.fact_ids??[]),...(c.input?.permittedFacts??[]).map(f=>f.id),...(c.input?.citedFacts??[]).map(f=>f.id)]));
 if(record.result?.factIds)for(const id of record.result.factIds)ids.add(id);
 record.selectedCanonicalFacts=[...ids].map(id=>snapshot.facts.find(f=>f.id===id)??(id==='PROFILE'?{id:'PROFILE',response:snapshot.background}:null)).filter(Boolean);
 // Routed but subsequently removed IDs remain above for diagnosis. These two
 // narrower lists distinguish what could actually support the generated reply.
 const languageIds=new Set(record.calls.filter(c=>c.role==='LANGUAGE').flatMap(c=>(c.input?.permittedFacts??[]).map(f=>f.id)));
 record.permittedCanonicalFacts=record.selectedCanonicalFacts.filter(f=>languageIds.has(f.id));
 record.deliveredCanonicalFacts=record.selectedCanonicalFacts.filter(f=>record.result?.factIds?.includes(f.id));
 record.usage=structuredClone(ledger);record.elapsedMs=Date.now()-started;
 report.usage=structuredClone(processLedger);await writeFile(output,JSON.stringify(report,null,2));
 console.log(JSON.stringify({id:record.id,status:record.status,reply:record.result?.reply??null,error:record.error?.message??null,calls:ledger.attemptedCalls,tokens:ledger.reportedTokens,estimatedUsd:ledger.cost.estimatedUsd}));
}
report.status='complete';report.completedAt=new Date().toISOString();
report.summary={caseCount:report.records.length,answered:report.records.filter(r=>r.status==='answered').length,blocked:report.records.filter(r=>r.status==='blocked').length,
 snapshotMutations:report.records.filter(r=>!r.snapshotUnchanged).length,independentReviewsPending:report.records.length};
await writeFile(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({completed:fileURLToPath(output),summary:report.summary,usage:report.usage}));
