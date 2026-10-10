import {mkdir,writeFile,readFile,open,unlink} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createAdaption,AdaptionError,storageTransfer} from './client.mjs';
import {adaptationConfig,sha256,parsePilot,quoteSummary,requireRunGate} from './config.mjs';

const args=process.argv.slice(2),action=args[0]??'check';
const val=flag=>{const index=args.indexOf(flag);return index<0?null:args[index+1];};
const label=val('--label')??'pilot-25';
let lock,lockPath;
try{
  if(!/^[a-z0-9][a-z0-9-]{0,60}$/.test(label))throw new AdaptionError('Invalid batch label.');
  const client=createAdaption(),folder=new URL('./runs/',import.meta.url);await mkdir(folder,{recursive:true});
  if(action==='check'){
    const result=await client.check();
    await writeFile(new URL('authentication.json',folder),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }else{
    if(!['upload','estimate','run','status','download'].includes(action))throw new AdaptionError('Unsupported action.');
    lockPath=new URL(`${label}.lock`,folder);try{lock=await open(lockPath,'wx');}catch{throw new AdaptionError('This batch is locked. Verify its previous process has stopped before removing a stale lock.');}
    const statePath=new URL(`${label}.json`,folder);
    let state;try{state=JSON.parse(await readFile(statePath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
    const save=()=>writeFile(statePath,JSON.stringify(state,null,2));
    if(action==='upload'){
      if(state)throw new AdaptionError('This batch already exists. Inspect status; do not duplicate the upload.');
      const bytes=await readFile(new URL('./data/examples.jsonl',import.meta.url));parsePilot(bytes);
      state={schemaVersion:1,label,createdAt:new Date().toISOString(),dataHash:sha256(bytes),rowCount:25,idempotencyKey:randomUUID(),stage:'create-requested',datasetId:null};await save();
      // No column mapping is passed at ingestion. Structured uploads stop at
      // awaiting_input until the separate /adapt request; see get_status docs.
      const created=await client.request('/datasets',{method:'POST',body:{source:{name:`psychlab-${label}.jsonl`,file_format:'jsonl'}}});
      if(typeof created.dataset_id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(created.dataset_id))throw new AdaptionError('Create response missing a usable dataset ID. Inspect account before any retry.');
      state.datasetId=created.dataset_id;state.stage='created';await save();
      if(created.upload_instructions?.method!=='PUT')throw new AdaptionError('Unexpected upload method; dataset ID saved.');
      await storageTransfer(created.upload_instructions.url,{method:'PUT',body:bytes});
      state.stage='file-uploaded';await save();
      await client.request(`/datasets/${state.datasetId}/upload/complete`,{method:'POST',body:{file_size_bytes:bytes.length,sha256:sha256(bytes)}});
      state.stage='ingesting';await save();
      console.log(JSON.stringify({label,datasetId:state.datasetId,stage:state.stage,rows:25,adaptationStarted:false}));
    }else{
      if(!state?.datasetId||!/^[a-zA-Z0-9_-]+$/.test(state.datasetId))throw new AdaptionError('No uploaded dataset found for this label.');
      const path=`/datasets/${state.datasetId}`;
      const status=await client.request(`${path}/status`);
      state.remote={status:status.status,rowCount:status.row_count,progress:status.progress,checkedAt:new Date().toISOString(),errorCode:status.error_data?.code??null};await save();
      if(action==='status')console.log(JSON.stringify({label,datasetId:state.datasetId,runId:state.runId??null,...state.remote}));
      if(action==='estimate'||action==='run'){
        if(status.status!=='awaiting_input'||status.row_count!==25)throw new AdaptionError(`Dataset is ${status.status}; exactly 25 ingested rows in awaiting_input are required.`);
        const config=adaptationConfig(state.idempotencyKey),bytes=await readFile(new URL('./data/examples.jsonl',import.meta.url));parsePilot(bytes);
        if(state.dataHash!==sha256(bytes))throw new AdaptionError('Source data changed after upload.');
        if(action==='estimate'){
          const data=await client.request(`${path}/adapt`,{method:'POST',body:{...config,estimate:true}});
          state.quote={...quoteSummary(data),configHash:sha256(JSON.stringify(config)),checkedAt:new Date().toISOString()};state.stage='estimated';await save();
          console.log(JSON.stringify({label,datasetId:state.datasetId,rows:25,...state.quote,note:'Credits are not dollars. Actual billed usage may vary. No adaptation run started.'}));
        }else{
          const max=val('--max-credits');requireRunGate(state,config,bytes,max===null?NaN:Number(max));
          state.runAttemptedAt=new Date().toISOString();state.approvedQuoteCeiling=Number(max);state.stage='run-requested';await save();
          const data=await client.request(`${path}/adapt`,{method:'POST',body:{...config,estimate:false}});
          if(data.estimate!==false||typeof data.run_id!=='string')throw new AdaptionError('Run response is ambiguous. Inspect this dataset status before any other action.');
          state.runId=data.run_id;state.stage='running';state.launchQuote={credits:data.estimatedCreditsConsumed,minutes:data.estimatedMinutes};await save();
          console.log(JSON.stringify({label,datasetId:state.datasetId,runId:state.runId,stage:state.stage,...state.launchQuote}));
        }
      }
      if(action==='download'){
        if(!state.runAttemptedAt||!['succeeded','failed'].includes(status.status))throw new AdaptionError('No terminal adaptation run to download.');
        const bytes=await client.request(`${path}/download?fileFormat=jsonl`,{binary:true});
        const output=new URL(`${label}-output.jsonl`,folder);await writeFile(output,bytes,{flag:'wx'});
        state.download={file:`${label}-output.jsonl`,sha256:sha256(bytes),bytes:bytes.length,partial:status.status==='failed',downloadedAt:new Date().toISOString()};state.stage='downloaded';await save();
        console.log(JSON.stringify({label,...state.download,reviewRequired:true,activated:false}));
      }
    }
  }
}catch(error){console.error(error instanceof AdaptionError?error.message:'Operation failed locally. No secret or provider payload is displayed.');process.exitCode=1;}
finally{if(lock){await lock.close();await unlink(lockPath);}}
