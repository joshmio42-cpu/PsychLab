import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packPromptContext,promptContextBytes,PromptContextError} from '../prompt-context.mjs';
import {requestPayload} from '../model.mjs';
const make=(input={},role='LANGUAGE')=>({role,instruction:'Only supported facts. Preserve caregiver perspective.',input});

test('Packer measures the exact production JSON envelope for Unicode and escaping',()=>{
  for(const question of ['Hello','界'.repeat(100),'🙂'.repeat(100),'\\'.repeat(100),'"quoted"\nnext line']){
    const req=make({question,history:[{question:'Before?',reply:'Earlier.'}]});
    assert.equal(promptContextBytes(req),requestPayload(req).bytes);
    const packed=packPromptContext(req);assert.equal(packed.request,req);assert.deepEqual(packed.omitted,[]);
  }
});

test('Optional old context is removed before a source ledger or canonical evidence; caller remains unchanged',()=>{
  const signal=new AbortController().signal;
  const req={...make({question:'What happened earlier?',permittedFacts:[{id:'P07',statement:'An earlier authored event.'}],
    previousQuestions:['old '.repeat(500),'Recent question?'],conversation:{disclosedFactIds:['P07'],lastFactIds:['P07'],recalledFactIds:['P07']}}),signal};
  const before=structuredClone(req.input),packed=packPromptContext(req,1000);
  assert.deepEqual(req.input,before);assert.equal(packed.request.signal,signal);
  assert.equal(packed.request.input.question,req.input.question);
  assert.deepEqual(packed.request.input.permittedFacts,req.input.permittedFacts);
  assert.deepEqual(packed.request.input.previousQuestions,['Recent question?']);
  assert.deepEqual(packed.request.input.conversation.disclosedFactIds,['P07']);
  assert.deepEqual(packed.omitted,['previousQuestions[0]']);assert.ok(promptContextBytes(packed.request)<=1000);
});

test('Catalog compaction drops least relevant details before recalled topics and preserves time scope',()=>{
  const input={question:'Tell me about the cousin.',conversation:{disclosedFactIds:Array.from({length:100},(_,i)=>`E${i}`),lastFactIds:['P04'],recalledFactIds:['P04']},
    catalog:[{id:'P04',topic:'Cousin visits',detail:'My cousin joins me for a walk.',scope:'past',timeframe:'before-simulation'},
      {id:'P08',topic:'Ordinary shopping',detail:'An unrelated shopping detail. '.repeat(80),scope:'past',timeframe:'before-simulation'}]};
  const req=make(input,'CORTEX'),packed=packPromptContext(req,1100);
  assert.equal(packed.request.input.conversation.disclosedFactIds,undefined);
  assert.deepEqual(packed.request.input.conversation.lastFactIds,['P04']);assert.deepEqual(packed.request.input.conversation.recalledFactIds,['P04']);
  assert.equal(packed.request.input.catalog[0].detail,input.catalog[0].detail);
  assert.equal(packed.request.input.catalog[1].detail,undefined);
  for(const item of packed.request.input.catalog){assert.equal(item.scope,'past');assert.equal(item.timeframe,'before-simulation');assert.ok(item.topic);}
});

test('Required question, candidate, cited facts, permitted facts and caregiver identity are never truncated',()=>{
  const input={question:'界'.repeat(400),candidate:'A supported caregiver observation.',
    permittedFacts:[{id:'P03',statement:'I cannot report private thoughts.',scope:'observation'}],
    citedFacts:[{id:'P03',statement:'I cannot report private thoughts.',scope:'observation'}],
    agentContext:{interview:{patient:'Mika',lifeStage:'Toddler',perspective:'caregiver',speaker:"Mika's caregiver",language:'Use observations.',pronouns:'they/them'},
      personality:{schema:['style '.repeat(300)],motive:'optional motive '.repeat(30),communication:'Speak naturally.'},
      mentalPremise:{mnemosyne:['duplicate interpretation '.repeat(40)],cortex:'Preserve uncertainty.'}}};
  const req=make(input),packed=packPromptContext(req,2300);
  for(const key of ['question','candidate','citedFacts','permittedFacts'])assert.deepEqual(packed.request.input[key],input[key]);
  assert.deepEqual(packed.request.input.agentContext.interview,input.agentContext.interview);
  assert.ok(packed.omitted.some(x=>x.startsWith('agentContext.')));assert.ok(promptContextBytes(packed.request)<=2300);
});

test('Impossible required content rejects locally with 413 instead of trimming evidence or making a call',()=>{
  const req=make({question:'A question?',citedFacts:[{id:'B01',statement:'required '.repeat(2000)}],candidate:'A response.'});
  const before=structuredClone(req);
  assert.throws(()=>packPromptContext(req),error=>error instanceof PromptContextError&&error.status===413&&error.inputBytes>12000);
  assert.deepEqual(req,before);
});

test('Planning can discard topic headings while retaining complete statements and diary sources',()=>{
  const req={...make({question:'What happened on that walk?',catalog:[
    {id:'P01',topic:'Detailed optional heading '.repeat(20),statement:'I sometimes walk with my neighbor.',scope:'usual'},
    {id:'E01',topic:'Another optional heading '.repeat(20),statement:'On day 1, I stopped by the gate.',scope:'past'}]},'CORTEX'),completeCatalog:true};
  const withoutHeadings={...req,input:{...req.input,catalog:req.input.catalog.map(({topic,...fact})=>fact)}};
  const packed=packPromptContext(req,promptContextBytes(withoutHeadings));
  assert.deepEqual(packed.request.input.catalog,withoutHeadings.input.catalog);
  assert.ok(packed.omitted.every(item=>item.includes('optional heading')));
  assert.ok(req.input.catalog.every(fact=>fact.topic));
});

test('Topic shortening retains Unicode characters, source IDs and last/recalled IDs',()=>{
  const req=make({question:'Follow up?',conversation:{lastFactIds:['P01'],recalledFactIds:['P01']},
    catalog:[{id:'P01',topic:'🙂'.repeat(110),scope:'usual',timeframe:'ongoing'}]},'CORTEX');
  const packed=packPromptContext(req,650),item=packed.request.input.catalog[0];
  assert.equal(item.id,'P01');assert.equal(item.scope,'usual');assert.equal(item.timeframe,'ongoing');
  assert.ok(!/[\uD800-\uDBFF]$/.test(item.topic));assert.ok(item.topic.length>=24);
  assert.deepEqual(packed.request.input.conversation.lastFactIds,['P01']);assert.ok(promptContextBytes(packed.request)<=650);
});
