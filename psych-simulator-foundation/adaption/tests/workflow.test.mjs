import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha256} from '../config.mjs';

const sourceFolder=fileURLToPath(new URL('../',import.meta.url));
const preload=new URL('./fixtures/mock-workflow-fetch.mjs',import.meta.url).href;
const fixtureRows=()=>Array.from({length:25},(_,index)=>({prompt:`Fictional question ${index+1}?`,context:JSON.stringify({id:`pilot-${index+1}`,permittedFacts:[{id:'P01',text:'The fictional person likes drawing.'}]}),completion:JSON.stringify({reply:'I like drawing.',factIds:['P01']})}));

async function setup(t){
  const prefix=join(tmpdir(),'psychlab-adaption-workflow-');
  const folder=await mkdtemp(prefix);
  t.after(async()=>{
    const target=resolve(folder),root=resolve(tmpdir());
    assert.ok(target.startsWith(root+sep)&&target.startsWith(resolve(prefix)),'Temporary cleanup must stay in the test directory.');
    await rm(target,{recursive:true,force:true});
  });
  await mkdir(join(folder,'data'));
  await mkdir(join(folder,'runs'));
  await Promise.all(['workflow.mjs','client.mjs','config.mjs'].map(name=>copyFile(join(sourceFolder,name),join(folder,name))));
  const dataPath=join(folder,'data','examples.jsonl');
  await writeFile(dataPath,fixtureRows().map(row=>JSON.stringify(row)).join('\n')+'\n');
  const remotePath=join(folder,'fake-remote.json');
  const callsPath=join(folder,'public-wire-calls.jsonl');
  const statePath=join(folder,'runs','test-batch.json');
  await writeFile(remotePath,'{}');
  await writeFile(callsPath,'');
  const state=async()=>JSON.parse(await readFile(statePath,'utf8'));
  const remote=async()=>JSON.parse(await readFile(remotePath,'utf8'));
  const calls=async()=>{const text=(await readFile(callsPath,'utf8')).trim();return text?text.split('\n').map(line=>JSON.parse(line)):[];};
  const setRemote=async patch=>writeFile(remotePath,JSON.stringify({...await remote(),...patch}));
  const run=(action,extra=[],scenario='')=>{
    const result=spawnSync(process.execPath,['--import',preload,join(folder,'workflow.mjs'),action,'--label','test-batch',...extra],{
      encoding:'utf8',timeout:10000,windowsHide:true,
      env:{...process.env,ADAPTION_API_KEY:'fictional-test-key',PSYCHLAB_TEST_REMOTE_STATE:remotePath,PSYCHLAB_TEST_CALLS:callsPath,PSYCHLAB_TEST_SCENARIO:scenario}
    });
    assert.equal(result.error,undefined,result.error?.message);
    assert.ok(!result.stdout.includes('fictional-test-key')&&!result.stderr.includes('fictional-test-key'));
    assert.ok(!result.stdout.includes('X-Amz-Signature')&&!result.stderr.includes('X-Amz-Signature'));
    return result;
  };
  const okay=(action,extra=[],scenario='')=>{const result=run(action,extra,scenario);assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout.trim());};
  const prepare=()=>{okay('upload');okay('estimate');};
  return {folder,dataPath,remotePath,statePath,state,remote,calls,setRemote,run,okay,prepare};
}

test('same saved batch completes upload, estimate, paid launch, polling and reviewed-only download',async t=>{
  const f=await setup(t);
  assert.equal(f.okay('check').authenticated,true);
  assert.equal(f.okay('upload').adaptationStarted,false);
  const uploaded=await f.state();
  assert.equal(uploaded.stage,'ingesting');
  assert.equal(uploaded.rowCount,25);
  assert.equal(uploaded.dataHash,sha256(await readFile(f.dataPath)));
  assert.equal(f.okay('estimate').estimateOnly,true);
  assert.equal((await f.remote()).paidRequests,undefined);
  const quoted=await f.state();
  assert.equal(quoted.quote.credits,1);
  assert.equal(f.okay('run',['--max-credits','1']).runId,'fictional-run-id');
  const running=await f.state();
  assert.ok(running.runAttemptedAt);
  assert.equal(running.idempotencyKey,uploaded.idempotencyKey);
  assert.equal(f.okay('status').status,'running');
  await f.setRemote({status:'succeeded'});
  const downloaded=f.okay('download');
  assert.equal(downloaded.reviewRequired,true);
  assert.equal(downloaded.activated,false);
  assert.equal(downloaded.partial,false);
  const bytes=await readFile(join(f.folder,'runs',downloaded.file));
  assert.equal(bytes.toString().trim().split('\n').length,25);
  assert.equal(downloaded.sha256,sha256(bytes));
  assert.equal((await f.remote()).paidRequests,1);
  const calls=await f.calls();
  assert.equal(calls.filter(call=>call.path.endsWith('/adapt')&&call.estimate===false).length,1);
  assert.equal(calls.filter(call=>call.path.endsWith('/adapt')).every(call=>call.idempotencyKey===uploaded.idempotencyKey),true);
  assert.equal(calls.find(call=>call.path==='signed-storage').authorizationPresent,false);
  assert.equal((await f.state()).stage,'downloaded');
});

test('missing and insufficient ceilings never send a paid request',async t=>{
  const f=await setup(t);f.prepare();
  for(const extra of [[],['--max-credits','0']]) {
    const result=f.run('run',extra);
    assert.equal(result.status,1);
    assert.match(result.stderr,/credit ceiling/);
  }
  assert.equal((await f.remote()).paidRequests,undefined);
  assert.equal((await f.state()).runAttemptedAt,undefined);
});

test('changed source and changed adaptation configuration invalidate the saved quote',async t=>{
  const f=await setup(t);f.prepare();
  const original=await readFile(f.dataPath);
  await writeFile(f.dataPath,Buffer.concat([original,Buffer.from(' ')]));
  let result=f.run('run',['--max-credits','1']);
  assert.equal(result.status,1);assert.match(result.stderr,/Source data changed/);
  await writeFile(f.dataPath,original);
  const path=join(f.folder,'config.mjs');
  await writeFile(path,(await readFile(path,'utf8')).replace("length:'concise'","length:'minimal'"));
  result=f.run('run',['--max-credits','1']);
  assert.equal(result.status,1);assert.match(result.stderr,/matching dataset and configuration estimate/);
  assert.equal((await f.remote()).paidRequests,undefined);
});

test('expired quote and per-batch lock block launching',async t=>{
  const f=await setup(t);f.prepare();
  const state=await f.state();state.quote.checkedAt='2000-01-01T00:00:00Z';
  await writeFile(f.statePath,JSON.stringify(state));
  let result=f.run('run',['--max-credits','1']);
  assert.equal(result.status,1);assert.match(result.stderr,/Estimate expired/);
  const lockPath=join(f.folder,'runs','test-batch.lock');
  await writeFile(lockPath,'test lock');
  const before=(await f.calls()).length;
  result=f.run('run',['--max-credits','1']);
  assert.equal(result.status,1);assert.match(result.stderr,/batch is locked/);
  assert.equal((await f.calls()).length,before);
  assert.equal(await readFile(lockPath,'utf8'),'test lock');
  assert.equal((await f.remote()).paidRequests,undefined);
});

test('ambiguous paid outcome remains saved and cannot be launched twice',async t=>{
  const f=await setup(t);f.prepare();
  const first=f.run('run',['--max-credits','1'],'ambiguous-run');
  assert.equal(first.status,1);
  const state=await f.state();
  assert.equal(state.stage,'run-requested');assert.ok(state.runAttemptedAt);
  assert.equal((await f.remote()).paidRequests,1);
  assert.equal(f.okay('status').status,'running');
  let again=f.run('run',['--max-credits','1']);
  assert.equal(again.status,1);
  // Even an eventually consistent status must not permit another paid POST.
  await f.setRemote({status:'awaiting_input'});
  again=f.run('run',['--max-credits','1']);
  assert.equal(again.status,1);assert.match(again.stderr,/already been attempted/);
  assert.equal((await f.remote()).paidRequests,1);
  await f.setRemote({status:'succeeded'});
  assert.equal(f.okay('download').partial,false);
});

test('ambiguous dataset creation remains saved and refuses duplicate upload',async t=>{
  const f=await setup(t);
  assert.equal(f.run('upload',[],'ambiguous-create').status,1);
  const state=await f.state();
  assert.equal(state.stage,'create-requested');assert.equal(state.datasetId,null);
  const second=f.run('upload');
  assert.equal(second.status,1);assert.match(second.stderr,/batch already exists/);
  assert.equal((await f.calls()).filter(call=>call.path==='/api/v1/datasets'&&call.method==='POST').length,1);
  assert.equal((await f.remote()).paidRequests,undefined);
});

test('running jobs cannot download; failed jobs export marked partial output without activation',async t=>{
  const f=await setup(t);f.prepare();f.okay('run',['--max-credits','1']);
  assert.equal(f.run('download').status,1);
  await f.setRemote({status:'failed'});
  const result=f.okay('download');
  assert.equal(result.partial,true);assert.equal(result.reviewRequired,true);assert.equal(result.activated,false);
  const path=join(f.folder,'runs',result.file),original=await readFile(path);
  assert.equal(original.toString().trim().split('\n').length,2);
  assert.equal(f.run('download').status,1);
  assert.deepEqual(await readFile(path),original);
  assert.equal((await f.remote()).paidRequests,1);
});
