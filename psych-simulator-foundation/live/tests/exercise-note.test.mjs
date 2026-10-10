import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {randomBytes,randomInt} from 'node:crypto';
import {setImmediate as nextTick} from 'node:timers/promises';
import * as engine from '../engine.mjs';
import * as usage from '../usage.mjs';
import * as core from '../../prototype/dist/core.mjs';
import * as registry from '../../personality_system/models/registry.mjs';
import * as patients from '../patients.mjs';
import * as disorders from '../disorders.mjs';
import * as style from '../interview-style.mjs';
import * as guide from '../interview-guide.mjs';
import * as feedback from '../interview-feedback.mjs';
import {requestPayload} from '../model.mjs';
import {baseline,reasoning} from './helpers.mjs';

// Keep the real controller/storage/guide implementation and stub only the model boundary.
// This exercises optional result propagation before or after model integration, without API calls.
const controllerSource=readFileSync(new URL('../controller.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const appSource=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8').replace(/init\(\);\s*$/,'');
const note='The playmate’s identity is not provided in this case.';
const reply='I would like to try the toy-shop playdate. We haven’t carried out that plan yet.';
function controllerWithAnswer(answer){
 const {createController}=runInNewContext(controllerSource+'\n({createController})',{
  randomBytes,randomInt,nextTick,...engine,...usage,...core,...registry,...patients,...disorders,...style,...guide,...feedback,
  requestPayload,answerQuestion:async()=>structuredClone(answer),AbortController,structuredClone});
 const controller=createController({baseline,provider:{configured:true,model:'MOCK-NO-API',complete(){throw new Error('Unexpected API call');}}});
 const {id}=controller.create({mode:'generated',patientId:'leo'});return {controller,id};
}
const answer=(extra={})=>({reply,kind:'answer',interaction:'answer',factIds:['P12'],domains:['goals'],sourceIds:[],trace:{},...extra});
const request={question:'What is planned and who will come?',requestId:'note-request-001',expectedTurn:0};

test('Controller preserves a separate case note through response, retry, session and report without changing evidence',async()=>{
 const {controller:c,id}=controllerWithAnswer(answer({exerciseNote:note}));
 const result=await c.ask(id,request),retry=await c.ask(id,request);
 assert.equal(result.turn.reply,reply);assert.equal(result.turn.exerciseNote,note);assert.equal(retry.turn.exerciseNote,note);
 assert.equal(c.read(id).turns[0].exerciseNote,note);assert.ok(!Object.hasOwn(result.turn,'factIds'));
 const report=c.finish(id,{reasoning});
 assert.equal(report.evidence[0].quote,reply);assert.equal(report.evidence[0].exerciseNote,note);
 assert.deepEqual(Array.from(report.evidence[0].factIds),['P12']);
 assert.equal(JSON.stringify(report.feedback).includes(note),false);
 assert.equal(JSON.stringify(report.guideWork).includes(note),false);
 c.close();
});

test('A case note alone cannot unlock Finish or a checklist evidence link',async()=>{
 const {controller:c,id}=controllerWithAnswer(answer({kind:'unavailable',interaction:'unavailable',reply:'That detail is not available.',factIds:[],domains:[],exerciseNote:note}));
 await c.ask(id,request);const current=c.read(id);
 assert.equal(current.turns[0].exerciseNote,note);
 assert.throws(()=>c.finish(id,{reasoning}),/supported client answer/);
 const state=structuredClone(current.guideWork.state),checkpoint=current.guide.checklist[0].id;
 state.items[checkpoint]={status:'supported',turnId:'T1',note:'The case note mentions this area.'};
 assert.throws(()=>c.saveGuide(id,{expectedHash:current.brief.hash,state}),/patient history/);
 c.close();
});

test('Absent, empty and non-string notes leave legacy controller turns and quotes unchanged',async()=>{
 for(const exerciseNote of [undefined,'','   ',{factIds:['B01']}]){
  const {controller:c,id}=controllerWithAnswer(answer({exerciseNote}));
  const {turn}=await c.ask(id,request);assert.equal(Object.hasOwn(turn,'exerciseNote'),false);
  const report=c.finish(id,{reasoning});assert.equal(Object.hasOwn(report.evidence[0],'exerciseNote'),false);
  assert.equal(report.evidence[0].quote,reply);c.close();
 }
});

class Node {
 constructor(tagName='div'){this.tagName=tagName;this.textContent='';this.children=[];this.value='';this.hidden=false;this.attributes=new Map();this.classList={toggle(){}};}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(key,value){this.attributes.set(key,value);}
 addEventListener(name,handler){this[`on${name}`]=handler;}
 focus(){} scrollIntoView(){} reset(){}
 set innerHTML(_){throw new Error('Untrusted note must never use innerHTML');}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
function browser(){
 const nodes=new Map(),data=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 const app=runInNewContext(appSource+'\n({saveHistory,readHistory,conversationText,reportText,savedTranscript,conversationExchange,draw,drawReport,setSession:value=>{session=value;status={providerReady:true};},setReport:value=>report=value})',{
  document:{getElementById:get,createElement:tag=>new Node(tag),querySelectorAll:()=>[]},localStorage:storage,
  console,Date,setTimeout,clearTimeout,crypto:{randomUUID:()=> 'note-request-001'}});
 return {app,get,storage};
}
function session(extra={}){return {brief:{hash:'frozen-note-example',name:'Leo',speaker:"Leo's caregiver",lifeStage:'Preschool child',mode:'generated',historyDays:14,notice:'',referral:''},turns:[{id:'T1',requestId:'note-request-001',question:request.question,reply,kind:'answer',interaction:'answer',...extra}],ended:false};}
function debrief(extra={}){return {title:'Interview debrief',brief:session().brief,model:'MOCK-NO-API',reasoning:{},evidence:[{turnId:'T1',question:request.question,quote:reply,kind:'answer',...extra}],ratings:[],limitations:[]};}

test('Live Case note is a separate text-only aside immediately after the patient reply',()=>{
 const h=browser(),unsafe='<img src=x onerror="alert(1)"> Missing detail';
 h.app.setSession(session({exerciseNote:unsafe}));h.app.draw();
 const row=h.get('conversation').children[0],patientReply=row.children[3],caseNote=row.children[4];
 assert.equal(patientReply.className,'reply');assert.equal(patientReply.textContent,reply);
 assert.equal(caseNote.tagName,'aside');assert.equal(caseNote.className,'case-note');
 assert.equal(caseNote.attributes.get('aria-label'),'Case note');
 assert.equal(caseNote.children[0].textContent,'Case note');assert.equal(caseNote.children[1].textContent,unsafe);
 assert.equal(descendants(row).some(n=>n.tagName==='img'),false);
 const archive=h.app.readHistory(h.storage)[0];assert.equal(archive.turns[0].exerciseNote,unsafe);
 assert.equal(archive.turns[0].reply,reply);assert.equal(Object.hasOwn(archive.turns[0],'factIds'),false);
});

test('Saved history reload and text downloads preserve notes without quoting them as patient evidence',()=>{
 const h=browser();h.app.saveHistory(h.storage,session({exerciseNote:note}));
 const saved=h.app.readHistory(h.storage)[0],transcript=h.app.savedTranscript(saved);
 const row=transcript.children.find(n=>n.className==='exchange');
 assert.equal(row.children[3].textContent,reply);assert.equal(row.children[4].children[1].textContent,note);
 const exported=h.app.conversationText(saved);
 assert.ok(exported.includes(`Leo's caregiver: ${reply}\nCase note (not patient evidence): ${note}`));
 const report=h.app.reportText(debrief({exerciseNote:note}));
 assert.ok(report.includes(`Response: ${reply}\nCase note (not patient evidence): ${note}`));
 assert.equal(saved.turns[0].reply.includes(note),false);
});

test('Debrief cards place the case note after the patient quote instead of inside it',()=>{
 const h=browser(),report=debrief({exerciseNote:note});
 report.feedback={perspective:'Review your interview.',usefulQuestions:[{turnId:'T1',question:request.question,reply,sources:[{id:'P12',label:'Plan'}],checkpointLeads:[],interpretation:'Read the source.'}],evidenceGaps:[],unknowns:[],conclusionReview:{statement:'Review needed',supportingTurnIds:[],gaps:[],status:'Unrated'},limitations:[]};
 h.app.setReport(report);h.app.drawReport();
 const card=descendants(h.get('report')).find(n=>n.className==='debrief-question');
 assert.equal(card.children[1].tagName,'blockquote');assert.equal(card.children[1].textContent,reply);
 assert.equal(card.children[2].tagName,'aside');assert.equal(card.children[2].children[1].textContent,note);
});

test('Legacy notes-free history retains its original text, node layout and absent field',()=>{
 const h=browser(),old=session();h.app.setSession(old);h.app.draw();
 const row=h.get('conversation').children[0];assert.equal(row.children.length,4);
 const saved=h.app.readHistory(h.storage)[0];assert.equal(Object.hasOwn(saved.turns[0],'exerciseNote'),false);
 const transcript=h.app.savedTranscript(saved);assert.equal(transcript.children.length,0);
 assert.equal(transcript.textContent,h.app.conversationText(saved));
 assert.equal(h.app.conversationText(saved).includes('Case note'),false);
 assert.equal(h.app.reportText(debrief()).includes('Case note'),false);
});
