import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createFeatherless,answerQuestion,requestPayload,PROMPT_VERSION} from '../psych-simulator-foundation/live/model.mjs';
import {simulateHistory} from '../psych-simulator-foundation/live/engine.mjs';
import {createLedger,meteredComplete,ECONOMY} from '../psych-simulator-foundation/live/usage.mjs';

// Sixteen genuine sequential exchanges, not authored preceding-turn fixtures.
let questions=[
 'What happened on day 2?',
 'What do you usually like doing outside work?',
 'Can you tell me about an earlier drawing you made?',
 'Who do you keep in touch with?',
 'How long has your mood been low?',
 'How has your sleep been?',
 'How does this affect your everyday responsibilities?',
 'How do you usually keep your drawing things ready?',
 'Is there anything you would like to make with your drawings?',
 'Thanks for explaining that.',
 'What helps when someone makes plans with you?',
 'Would concrete examples help you explain what you mean?',
 'Going back to day 2 at the start of our conversation, what happened then?',
 'Earlier you mentioned your cousin. How do you usually spend time with them?',
 'Your cousin is called Jamie, right?',
 'So sketching still makes you feel great these days?'
];
if(!process.argv.includes('--live')){console.log(JSON.stringify({questions,maximumCalls:48}));process.exit(0);}
const label=process.argv[process.argv.indexOf('--label')+1];
if(!/^[a-z0-9-]+$/.test(label??''))throw new Error('A unique evidence label is required.');
const folder=new URL('../research/interview-improvements-2026-10-08/',import.meta.url),file=new URL(`long-${label}.json`,folder);
await mkdir(folder,{recursive:true});
try{await access(file);throw new Error('Preserve prior evidence; choose a new label.');}catch(e){if(e.code!=='ENOENT')throw e;}
const real=createFeatherless();
if(!real.configured||real.model!=='Qwen/Qwen2.5-72B-Instruct')throw new Error('Use the private runner and selected model.');
const snapshot=simulateHistory({patientId:'jordan',disorderId:'mdd',seed:42,days:90});
const before=JSON.stringify(snapshot),ledger=createLedger(ECONOMY.sessionCalls),turns=[],records=[];
const resumeAt=process.argv.indexOf('--resume');
let continuedFrom=null;
if(resumeAt>=0){
 const priorLabel=process.argv[resumeAt+1];if(!/^[a-z0-9-]+$/.test(priorLabel??''))throw new Error('Invalid prior evidence label.');
 const previous=JSON.parse(await readFile(new URL(`long-${priorLabel}.json`,folder),'utf8'));
 if(!previous.completedAt||!previous.snapshotUnchanged)throw new Error('Only a completed unchanged-history trial can be continued.');
 for(const record of previous.records){
  for(const fact of record.canonicalFacts)if(snapshot.facts.find(f=>f.id===fact.id)?.response!==fact.response)throw new Error('Prior canonical facts changed.');
  if(record.result){const r=record.result;turns.push({id:`T${turns.length+1}`,question:record.question,reply:r.reply,kind:r.kind,interaction:r.interaction,factIds:r.factIds});}
 }
 Object.assign(ledger,structuredClone(previous.usage));
 continuedFrom={file:`long-${priorLabel}.json`,acceptedTurns:turns.length,initialCalls:ledger.attemptedCalls,initialEstimatedUsd:ledger.cost.estimatedUsd};
 questions=['At the start you described your cousin offering to listen. What did you do then?','So sketching still makes you feel great these days?'];
}
const report={title:'Actual sequential long interview with distant callbacks',startedAt:new Date().toISOString(),model:real.model,promptVersion:PROMPT_VERSION,
 method:'Each question sees only previously accepted live turns. No automatic retries or authored preceding reply; a separately documented continuation can deliberately recheck a rejected question after a code fix.',continuedFrom,snapshotHash:snapshot.hash,sourceHashes:{},records};
for(const name of ['model.mjs','conversation.mjs','factual-support.mjs']){const content=await readFile(new URL(`../psych-simulator-foundation/live/${name}`,import.meta.url));report.sourceHashes[name]=createHash('sha256').update(content).digest('hex');}
await writeFile(file,JSON.stringify(report,null,2),{flag:'wx'});
for(const question of questions){
 const record={question,precedingAcceptedTurns:turns.length,calls:[]};records.push(record);
 const provider={configured:true,model:real.model,async complete(req){
  const call={role:req.role,input:req.input};record.calls.push(call);
  try{const r=await meteredComplete(real,req,[ledger],requestPayload(req));call.value=r.value;call.meta=r.meta;return r;}
  catch(e){call.error={message:e.message,meta:e.meta};throw e;}
 }};
 try{
  const r=await answerQuestion({snapshot,turns,question,provider});record.result=r;
  turns.push({id:`T${turns.length+1}`,question,reply:r.reply,kind:r.kind,interaction:r.interaction,factIds:r.factIds});
 }catch(e){record.error={message:e.message,status:e.status};}
 const ids=new Set(record.calls.flatMap(c=>(c.input.permittedFacts??[]).map(f=>f.id)));
 record.canonicalFacts=snapshot.facts.filter(f=>ids.has(f.id));
 record.review={status:'pending'};report.usage=structuredClone(ledger);report.snapshotUnchanged=before===JSON.stringify(snapshot);
 await writeFile(file,JSON.stringify(report,null,2));
 console.log(JSON.stringify({turn:records.length,question,reply:record.result?.reply,error:record.error?.message,estimateUsd:ledger.cost.estimatedUsd}));
}
report.completedAt=new Date().toISOString();report.acceptedTurns=turns.length;
await writeFile(file,JSON.stringify(report,null,2));
console.log(JSON.stringify({completed:true,acceptedTurns:turns.length,usage:ledger}));
