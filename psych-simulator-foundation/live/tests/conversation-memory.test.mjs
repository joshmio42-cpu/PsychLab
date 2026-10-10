import {test} from 'node:test';
import assert from 'node:assert/strict';
import {simulateHistory} from '../engine.mjs';
import {conversationContext} from '../conversation.mjs';
import {answerQuestion,requestPayload} from '../model.mjs';
import {mockProvider} from './helpers.mjs';

const snapshot=()=>simulateHistory({patientId:'jordan',disorderId:'mdd',seed:42,days:90});
const turn=(factIds,question='Tell me about that.')=>({kind:'answer',interaction:'answer',factIds,question,reply:'UNTRUSTED_REPLY invented castle and sister.'});

test('Whole-interview source memory survives more than a short window of social turns',()=>{
  const s=snapshot(),turns=[turn(['E02'],'What happened on day 2?'),...Array.from({length:12},()=>({kind:'answer',interaction:'social',factIds:[],question:'Thanks.',reply:'Okay.'}))];
  const memory=conversationContext(turns,s.facts,'Can you explain that day?');
  assert.deepEqual(memory.lastFactIds,['E02']);
  assert.deepEqual(memory.disclosedFactIds,['E02']);
  assert.equal(memory.lastQuestion,'What happened on day 2?');
  assert.deepEqual(memory.recentlyUsedFactIds,[]);
  assert.ok(!JSON.stringify(memory).includes('UNTRUSTED_REPLY'));
});

test('A distant explicit callback retrieves canonical old diary evidence after unrelated interview topics',async()=>{
  const s=snapshot(),before=JSON.stringify(s);
  const turns=[turn(['E02'],'What happened on day 2?'),...Array.from({length:14},(_,i)=>turn([i%2?'P02':'B01']))];
  const provider=mockProvider(req=>{
    requestPayload(req);
    if(req.role==='CORTEX'){
      assert.ok(req.input.conversation.recalledFactIds.includes('E02'));
      assert.ok(req.input.catalog.some(f=>f.id==='E02'));
      assert.equal(req.input.history.length,4,'The complete transcript is not resent.');
      return {kind:'answer',fact_ids:['E02']};
    }
    if(req.role==='LANGUAGE'){
      assert.ok(req.input.permittedFacts[0].statement.includes('day 2,'));
      assert.ok(!JSON.stringify(req.input).includes('UNTRUSTED_REPLY'));
      assert.ok(!JSON.stringify(req.input).includes('castle'));
    }
  });
  const result=await answerQuestion({snapshot:s,turns,question:'Earlier you described day 2. What happened then?',provider});
  assert.deepEqual(result.factIds,['E02']);
  assert.equal(provider.calls.length,3,'Memory adds no provider calls.');
  assert.equal(JSON.stringify(s),before,'Memory never changes frozen case data.');
});

test('Old personal topics can be recalled by their canonical content without treating prior paraphrases as evidence',()=>{
  const s=snapshot(),turns=[turn(['P04'],'Who is around you?'),...Array.from({length:20},()=>turn(['B01']))];
  const m=conversationContext(turns,s.facts,'Going back to your cousin, what do you do together?');
  assert.ok(m.recalledFactIds.includes('P04'));
  assert.deepEqual(m.lastFactIds,['B01']);
  assert.deepEqual(m.disclosedFactIds,['P04','B01']);
  assert.ok(!JSON.stringify(m).includes('castle'));
});

test('A distant diary callback without a day number includes the canonical event preview for the router',async()=>{
  const s=snapshot(),turns=[turn(['E02'],'What happened on day 2?'),...Array.from({length:12},()=>turn(['P02']))];
  const provider=mockProvider(req=>{
    if(req.role==='CORTEX'){
      assert.ok(req.input.conversation.recalledFactIds.includes('E02'));
      const event=req.input.catalog.find(f=>f.id==='E02');
      assert.match(event.detail,/cousin offered .*listen/);
      assert.ok(!event.detail.includes('UNTRUSTED_REPLY'));
      return {kind:'answer',fact_ids:['E02']};
    }
  });
  const result=await answerQuestion({snapshot:s,turns,question:'Earlier, your cousin offered to listen. What did you do then?',provider});
  assert.deepEqual(result.factIds,['E02']);
});

test('Invalid source IDs and explicit social records cannot poison the disclosed-source ledger',()=>{
  const s=snapshot();
  const m=conversationContext([turn(['SECRET']),{...turn(['B02']),interaction:'social'},{...turn(['B03']),kind:'unavailable'},turn(['P02','SECRET'])],s.facts,'Any hobbies?');
  assert.deepEqual(m.disclosedFactIds,['P02']);
  assert.deepEqual(m.lastFactIds,['P02']);
  assert.ok(!JSON.stringify(m).includes('SECRET'));
});

test('An 80-turn source ledger stays compact with a 90-day case and passes every prompt limit',async()=>{
  const s=snapshot(),turns=Array.from({length:80},(_,i)=>turn([`E${String(i+1).padStart(2,'0')}`]));
  const m=conversationContext(turns,s.facts,'What happened on day 2?');
  assert.equal(m.disclosedFactIds.length,80);
  assert.ok(Buffer.byteLength(JSON.stringify(m))<2000);
  const provider=mockProvider(req=>{requestPayload(req);if(req.role==='CORTEX')return {kind:'answer',fact_ids:['E02']};});
  await answerQuestion({snapshot:s,turns,question:'What happened on day 2?',provider});
  assert.equal(provider.calls.length,3);
});

test('Author-written earlier anecdotes retain their timeframe in both selection and speech prompts',async()=>{
  const s=snapshot(),fact=s.facts.find(f=>f.scope==='past');
  assert.ok(fact);
  const provider=mockProvider(req=>{
    requestPayload(req);
    if(req.role==='CORTEX'){
      const item=req.input.catalog.find(f=>f.id===fact.id);
      assert.equal(item.timeframe,'before-simulation');
      assert.equal(item.scope,'past');
      return {kind:'answer',fact_ids:[fact.id]};
    }
    if(req.role==='LANGUAGE')assert.equal(req.input.permittedFacts[0].timeframe,'before-simulation');
  });
  await answerQuestion({snapshot:s,turns:[],question:'Tell me about an earlier drawing.',provider});
});
