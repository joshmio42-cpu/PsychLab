import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {emptyCost,estimateCallCost,recordCallCost} from '../pricing.mjs';
const app=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
const storeCode=app.split('// HISTORY_STORE_START')[1].split('// HISTORY_STORE_END')[0].split('\n').slice(1).join('\n');
const api=runInNewContext(storeCode+'\n({saveHistory,readHistory,costSnapshot,costAmount,costCoverage,costText})');
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
function priced(){const cost=emptyCost();recordCallCost(cost,estimateCallCost({returnedModel:'Qwen/Qwen2.5-72B-Instruct',usage:{prompt_tokens:1000,completion_tokens:200}}));return cost;}
const interview=()=>({brief:{hash:'cost-snapshot',name:'Jordan',mode:'generated'},turns:[{id:'T1',requestId:'request-cost-001',kind:'answer',question:'Hi',reply:'Hello'}]});

test('Cost display distinguishes no requests, priced requests, incomplete estimates and old archives',()=>{
  assert.equal(api.costAmount(emptyCost()),'US$0.00');assert.match(api.costCoverage(emptyCost()),/No AI requests/);
  const cost=priced();assert.equal(api.costAmount(cost),'US$0.0005');assert.match(api.costCoverage(cost),/1 priced/);
  cost.status='partial';cost.unpricedCalls=2;assert.match(api.costCoverage(cost),/Incomplete estimate/);assert.match(api.costText(cost),/known portion only/);
  assert.equal(api.costAmount(undefined),'Unavailable');assert.match(api.costText(undefined),/No cost estimate was recorded/);
  assert.ok(!api.costText(undefined).includes('US$0'));
  assert.equal(api.costAmount({...cost,status:'unavailable',estimatedUsd:0}),'Unavailable');
  assert.equal(api.costAmount({...cost,status:'estimated',estimatedUsd:0.0000004}),'Less than US$0.0001');
});

test('Saved histories preserve only this interview cost snapshot and never reprice old conversations',()=>{
  const s=storage(),current=interview(),cost=priced();current.usage={session:{cost,secret:'do-not-save'},process:{secret:'other-session'}};
  current.usage.session.cost.apiKey='do-not-save';current.usage.session.cost.models[0].rate.secret='do-not-save';
  const record=api.saveHistory(s,current,'2026-10-08T00:00:00Z');
  assert.equal(record.cost.estimatedUsd,.00045);assert.equal(record.cost.models[0].rate.inputUsdPerMillion,.37);
  assert.ok(!JSON.stringify(record).includes('do-not-save'));assert.ok(!JSON.stringify(record).includes('other-session'));
  current.usage.session.cost.estimatedUsd=55;current.usage.session.cost.models[0].rate.inputUsdPerMillion=99;
  const reloaded=api.readHistory(s)[0];assert.equal(reloaded.cost.estimatedUsd,.00045);assert.equal(reloaded.cost.models[0].rate.inputUsdPerMillion,.37);
  assert.match(api.costText(reloaded.cost),/input US\$0.37/);
});

test('Legacy history remains readable without fabricating a zero-dollar estimate',()=>{
  const s=storage();api.saveHistory(s,interview());const record=api.readHistory(s)[0];
  assert.equal(record.cost,undefined);assert.match(api.costText(record.cost),/No cost estimate/);
});

test('Conversation and debrief export functions include the session estimate',()=>{
  const conversationCode=app.slice(app.indexOf('function conversationText('),app.indexOf('function downloadConversation('));
  const reportCode=app.slice(app.indexOf('function reportText('),app.indexOf('function feedbackText('));
  const exportApi=runInNewContext(storeCode+'\n'+conversationCode+'\n'+reportCode+'\n({conversationText,reportText})',{
    guideWorkText:()=>'',feedbackText:()=>''});
  const current=interview(),cost=priced();
  assert.match(exportApi.conversationText({...current.brief,turns:current.turns,cost}),/SESSION COST \(USD\)/);
  assert.match(exportApi.reportText({title:'Debrief',brief:current.brief,usage:{session:{cost}},reasoning:{},evidence:[],ratings:[],limitations:[]}),/US\$0.0005 estimated/);
});
