// Test-only preload. It replaces fetch before the copied CLI module is imported.
// Every request is handled here; unexpected URLs fail instead of using a network.
import {readFile,writeFile,appendFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

const statePath=process.env.PSYCHLAB_TEST_REMOTE_STATE;
const callsPath=process.env.PSYCHLAB_TEST_CALLS;
if(!statePath||!callsPath)throw new Error('Mock workflow paths are required.');
const load=async()=>JSON.parse(await readFile(statePath,'utf8'));
const save=state=>writeFile(statePath,JSON.stringify(state));
const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const datasetId='fictional-pilot-dataset';
const signedURL='https://fictional-pilot.s3.us-east-1.amazonaws.com/data.jsonl?X-Amz-Signature=fixture-only';
globalThis.fetch=async(url,options={})=>{
  const target=new URL(url);
  const method=options.method??'GET';
  const state=await load();
  assert.equal(options.redirect,'error');
  assert.ok(options.signal instanceof AbortSignal);
  if(target.origin==='https://fictional-pilot.s3.us-east-1.amazonaws.com') {
    assert.equal(url,signedURL);
    assert.equal(method,'PUT');
    assert.equal(options.headers,undefined);
    state.rows=options.body.toString('utf8').trim().split('\n').map(line=>JSON.parse(line));
    state.uploaded=true;
    await save(state);
    await appendFile(callsPath,JSON.stringify({path:'signed-storage',method,authorizationPresent:false})+'\n');
    return new Response(null,{status:200});
  }
  assert.equal(target.origin,'https://api.prod.adaptionlabs.ai');
  assert.equal(options.headers.Authorization,`Bearer ${process.env.ADAPTION_API_KEY}`);
  const body=options.body?JSON.parse(options.body):null;
  // Persist only public request metadata, never credentials or signed URLs.
  await appendFile(callsPath,JSON.stringify({path:target.pathname,query:target.search,method,estimate:body?.estimate,idempotencyKey:body?.job_specification?.idempotency_key,maxRows:body?.job_specification?.max_rows})+'\n');
  if(target.pathname==='/api/v1/datasets'&&method==='GET')return respond({datasets:[]});
  if(target.pathname==='/api/v1/datasets'&&method==='POST') {
    assert.deepEqual(Object.keys(body),['source']);
    assert.equal(body.source.file_format,'jsonl');
    state.created=true;
    await save(state);
    if(process.env.PSYCHLAB_TEST_SCENARIO==='ambiguous-create')throw new Error('simulated transport error containing confidential transport details');
    return respond({dataset_id:datasetId,status:'pending',upload_instructions:{url:signedURL,method:'PUT',s3_key:'data.jsonl'}});
  }
  assert.ok(state.created,'Dataset must be created first.');
  const base=`/api/v1/datasets/${datasetId}`;
  if(target.pathname===`${base}/upload/complete`&&method==='POST') {
    assert.equal(state.uploaded,true);
    assert.equal(typeof body.file_size_bytes,'number');
    assert.match(body.sha256,/^[a-f0-9]{64}$/);
    state.status='awaiting_input';
    await save(state);
    return respond({dataset_id:datasetId,status:'processing'});
  }
  if(target.pathname===`${base}/status`&&method==='GET')return respond({dataset_id:datasetId,status:state.status??'pending',row_count:state.rows?.length??0,progress:state.status==='running'?{percent:20,processed_rows:5,total_rows:25}:null,error_data:state.status==='failed'?{code:'TEST_PARTIAL',message:'fixture failure'}:null});
  if(target.pathname===`${base}/adapt`&&method==='POST') {
    assert.equal(state.status,'awaiting_input');
    assert.equal(body.job_specification.max_rows,25);
    assert.equal(body.language_expansion,null);
    assert.equal(body.brand_controls.hallucination_mitigation,false);
    assert.deepEqual(body.recipe_specification.recipes,{prompt_rephrase:false,deduplication:false,reasoning_traces:false});
    if(body.estimate===true) {
      state.estimatedKey=body.job_specification.idempotency_key;
      await save(state);
      return respond({estimate:true,run_id:null,estimatedCreditsConsumed:1,estimatedMinutes:2,multimodalPricingApplied:false});
    }
    assert.equal(body.estimate,false);
    assert.equal(body.job_specification.idempotency_key,state.estimatedKey);
    state.paidRequests=(state.paidRequests??0)+1;
    state.status='running';
    await save(state);
    if(process.env.PSYCHLAB_TEST_SCENARIO==='ambiguous-run')throw new Error('simulated timeout after the service accepted the paid request');
    return respond({estimate:false,run_id:'fictional-run-id',estimatedCreditsConsumed:1,estimatedMinutes:2,multimodalPricingApplied:false});
  }
  if(target.pathname===`${base}/download`&&method==='GET') {
    assert.equal(target.search,'?fileFormat=jsonl');
    assert.ok(['succeeded','failed'].includes(state.status));
    const rows=state.status==='failed'?state.rows.slice(0,2):state.rows;
    return new Response(rows.map(row=>JSON.stringify({original_prompt:row.prompt,original_completion:row.completion,enhanced_prompt:row.prompt,enhanced_completion:row.completion})).join('\n')+'\n');
  }
  throw new Error(`Unexpected fixture operation ${method} ${target.pathname}`);
};
