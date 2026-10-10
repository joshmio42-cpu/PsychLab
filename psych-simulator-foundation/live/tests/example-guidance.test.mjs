import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateExampleGuidancePack,loadExampleGuidancePack,selectExampleGuidance,EXAMPLE_GUIDANCE_MAX_BYTES,EXAMPLE_GUIDANCE_INSTRUCTION} from '../example-guidance.mjs';
import {packPromptContext,promptContextBytes} from '../prompt-context.mjs';
import {answerQuestion,requestPayload} from '../model.mjs';
import {simulateHistory} from '../engine.mjs';
import {createController} from '../controller.mjs';
import {loadConfiguredExampleGuidance} from '../server.mjs';
import {baseline,mockProvider} from './helpers.mjs';

const reviewedAt='2026-10-09T00:00:00.000Z';
const sample=(id='hobby-example')=>({id,tags:['hobby','interests','usual'],perspective:'patient',
  sourceFacts:[{id:'EX_INTEREST',statement:'I usually watch birds.'}],question:'What are your usual interests?',reply:'I usually watch birds.',factIds:['EX_INTEREST'],
  style:{personality:'Brief and concrete.',mentalPremise:'Do not invent a reason for the preference.'},
  audit:{unsupported:[],supported:true,relevant:true,no_leak:true},review:{status:'approved',reviewedBy:'fixture-review',reviewedAt}});
const pack=()=>({schemaVersion:1,id:'fixture-only',version:'1.0',status:'approved',review:{reviewedBy:'fixture-review',reviewedAt,sourceRunId:'fixture-no-network'},examples:[sample()]});
const context={role:'LANGUAGE',question:'What are your usual interests?',snapshot:{name:'Jordan',lifeStage:'Young adult',interviewPerspective:'patient'}};

test('Only reviewed packs with resolvable EX_ citations qualify; invalid injection fails empty',()=>{
  const mutations=[p=>p.status='candidate',p=>delete p.review.sourceRunId,p=>p.examples[0].review.status='pending',p=>p.examples[0].sourceFacts[0].id='P01',
    p=>p.examples[0].factIds=['EX_MISSING'],p=>p.examples[0].audit.supported=false,p=>p.examples[0].audit.unsupported=['a claim'],p=>p.examples.push(p.examples[0])];
  for(const change of mutations){const invalid=pack();change(invalid);assert.throws(()=>validateExampleGuidancePack(invalid),/Invalid example guidance/);assert.equal(selectExampleGuidance(invalid,context),null);}
  const value=validateExampleGuidancePack(pack());assert.ok(Object.isFrozen(value.examples[0].sourceFacts));
});

test('Loader fails safely on missing, malformed, pending or overlarge files without network',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'psychlab-guidance-'));
  try{
    assert.equal(await loadExampleGuidancePack(undefined),null);assert.equal(await loadExampleGuidancePack(join(dir,'missing')),null);
    const path=join(dir,'pack.json');
    for(const contents of ['not JSON',JSON.stringify({...pack(),status:'pending'}),' '.repeat(256001)]){
      await writeFile(path,contents);assert.equal(await loadExampleGuidancePack(path),null);
    }
    await writeFile(path,JSON.stringify(pack()));assert.equal((await loadExampleGuidancePack(path)).id,'fixture-only');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Persistent opt-in loads the reviewed default, explicit path overrides it, and off restores baseline',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'psychlab-guidance-config-'));
  try{
    const defaultPath=join(dir,'active-pack.json'),overridePath=join(dir,'candidate-pack.json');
    assert.equal(await loadConfiguredExampleGuidance({configuredPath:'',defaultPath}),null);
    await writeFile(defaultPath,JSON.stringify(pack()));
    assert.equal((await loadConfiguredExampleGuidance({configuredPath:'',defaultPath})).id,'fixture-only');
    const override=pack();override.id='candidate-explicit';await writeFile(overridePath,JSON.stringify(override));
    assert.equal((await loadConfiguredExampleGuidance({configuredPath:overridePath,defaultPath})).id,'candidate-explicit');
    assert.equal(await loadConfiguredExampleGuidance({configuredPath:'off',defaultPath}),null);
    // An invalid explicit override must not silently activate the default pack.
    assert.equal(await loadConfiguredExampleGuidance({configuredPath:join(dir,'missing.json'),defaultPath}),null);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('Relevance, life stage, perspective and current patient name prevent unrelated examples',()=>{
  assert.equal(selectExampleGuidance(pack(),{...context,role:'CORTEX'}),null);
  assert.equal(selectExampleGuidance(pack(),{...context,question:'What happened at work?'}),null);
  for(const change of [s=>s.lifeStage='Toddler',s=>s.perspective='caregiver',s=>s.sourceFacts[0].statement='Jordan usually watches birds.']){
    const value=pack();change(value.examples[0]);assert.equal(selectExampleGuidance(value,context),null);
  }
  const selected=selectExampleGuidance(pack(),context);assert.equal(selected.payload.examples.length,1);
  assert.match(selected.payload.purpose,/never current patient evidence/);
});

test('At most two compact examples are selected with an actual UTF-8 budget for both roles',()=>{
  const value=pack();value.examples=[sample('a'),sample('b'),sample('c')];
  for(const role of ['LANGUAGE','AUDITOR']){
    const selected=selectExampleGuidance(value,{...context,role});
    assert.equal(selected.payload.examples.length,2);assert.equal(selected.trace.extraModelCalls,0);
    assert.ok(Buffer.byteLength(JSON.stringify(selected.payload),'utf8')<=EXAMPLE_GUIDANCE_MAX_BYTES);
  }
  value.examples[0].sourceFacts[0].statement='界'.repeat(400);value.examples[0].reply='界'.repeat(130);
  const selected=selectExampleGuidance(value,context);assert.ok(!selected.trace.exampleIds.includes('a'));
});

test('Packer drops demonstrations and their instruction before any canonical or historical context',()=>{
  const input={question:'What happened?',permittedFacts:[{id:'P01',statement:'My canonical fact.'}],previousQuestions:['An earlier question?'],exampleGuidance:selectExampleGuidance(pack(),context).payload};
  const req={role:'LANGUAGE',instruction:'Preserve facts.'+EXAMPLE_GUIDANCE_INSTRUCTION,optionalExampleInstruction:EXAMPLE_GUIDANCE_INSTRUCTION,input};
  const original=structuredClone(req),without={role:'LANGUAGE',instruction:'Preserve facts.',input:{...input}};delete without.input.exampleGuidance;
  const limit=promptContextBytes(without),packed=packPromptContext(req,limit);
  assert.deepEqual(packed.omitted,['exampleGuidance']);assert.deepEqual(packed.request.input,without.input);
  assert.equal(packed.request.instruction,'Preserve facts.');assert.equal(promptContextBytes(packed.request),limit);assert.deepEqual(req,original);
});

test('Baseline and disabled packs leave requests identical; candidate adds no calls, sources or snapshot changes',async()=>{
  const snapshot=simulateHistory({patientId:'jordan',disorderId:'none',days:28}),before=JSON.stringify(snapshot);
  const requests=[];
  for(const exampleGuidance of [null,{...pack(),status:'candidate'},pack()]){
    const provider=mockProvider(request=>{
      assert.ok(requestPayload(request).bytes<=12000);
      if(request.role==='CORTEX')return {kind:'answer',fact_ids:['P01']};
    });
    const result=await answerQuestion({snapshot,turns:[],question:context.question,provider,exampleGuidance});
    assert.equal(provider.calls.length,3);assert.deepEqual(result.factIds,['P01']);assert.equal(JSON.stringify(snapshot),before);
    assert.deepEqual(provider.calls[1].input.permittedFacts.map(fact=>fact.id),['P01']);assert.deepEqual(provider.calls[2].input.permittedFacts.map(fact=>fact.id),['P01']);assert.deepEqual(provider.calls[2].input.draftFactIds,['P01']);
    requests.push(provider.calls);
  }
  assert.deepEqual(requests[0],requests[1]);assert.deepEqual(requests[0][0],requests[2][0]);
  assert.ok(requests[2][1].input.exampleGuidance);assert.ok(requests[2][2].input.exampleGuidance);
});

test('Example citations cannot become real patient citations, and social turns receive none',async()=>{
  const snapshot=simulateHistory({patientId:'jordan',disorderId:'none',days:28});
  const invalid=mockProvider(request=>request.role==='CORTEX'?{kind:'answer',fact_ids:['P01']}:request.role==='LANGUAGE'?{reply:'I usually watch birds.',fact_ids:['EX_INTEREST']}:undefined);
  await assert.rejects(answerQuestion({snapshot,turns:[],question:context.question,provider:invalid,exampleGuidance:pack()}),/evidence validation/);
  const social=mockProvider(request=>request.role==='CORTEX'?{kind:'social',fact_ids:[]}:request.role==='LANGUAGE'?{reply:'Thanks.',fact_ids:[]}:undefined);
  await answerQuestion({snapshot,turns:[],question:'Thanks.',provider:social,exampleGuidance:pack()});
  assert.ok(social.calls.every(request=>!request.input.exampleGuidance));
});

test('Controller propagates an explicitly injected pack without exposing examples as patient evidence',async()=>{
  const provider=mockProvider(request=>request.role==='CORTEX'?{kind:'answer',fact_ids:['P01']}:undefined);
  const controller=createController({baseline,provider,exampleGuidance:pack()});
  const {id}=controller.create({patientId:'jordan',mode:'generated'});
  try{
    const result=await controller.ask(id,{question:context.question,requestId:'guidance-request-1',expectedTurn:0});
    assert.ok(provider.calls[1].input.exampleGuidance);assert.ok(!JSON.stringify(result).includes('EX_INTEREST'));
  }finally{controller.close();}
});
