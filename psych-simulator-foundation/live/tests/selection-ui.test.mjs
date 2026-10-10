import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {appSource as source} from './app-source.mjs';

const catalog={providerReady:true,patients:[
  {id:'jordan',name:'Jordan',lifeStage:'Young adult',mode:'generated',defaultDays:28,interviewWith:'Patient',description:'Sketching and quiet conversations.',communicationPreview:'Reflective and measured.'},
  {id:'mika',name:'Mika',lifeStage:'Toddler',mode:'generated',defaultDays:7,interviewWith:'Caregiver',description:'Block towers and picture books.',communicationPreview:'Caregiver observations.'}
],disorders:[
  {id:'anxiety',name:'Generalized anxiety disorder',description:'Persistent worry across several areas.',classification:'Anxiety disorders',stages:['Young adult']},
  {id:'depression',name:'Major depressive disorder',description:'Low mood and reduced interest.',classification:'Depressive disorders',stages:['Young adult']},
  {id:'autism',name:'Autism spectrum disorder',description:'A developmental pattern.',classification:'Neurodevelopmental disorders',stages:['Toddler']}
]};
class Node {
  constructor(tagName='div'){this.tagName=tagName;this.value='';this.hidden=false;this.disabled=false;this.textContent='';this.children=[];this.attributes=new Map();this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),contains:name=>this.classes.has(name)};}
  replaceChildren(...nodes){this.children=nodes;}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this.attributes.set(k,v);}
  removeAttribute(k){this.attributes.delete(k);}
  addEventListener(name,handler){this[`on${name}`]=handler;}
  focus(){this.focused=true;}
  reset(){}
  scrollIntoView(){}
  click(){this.onclick?.();}
  showModal(){this.open=true;}
  close(){this.open=false;}
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
const nodeText=node=>descendants(node).map(x=>x.textContent).join(' ');
function harness(handler=()=>undefined){
  const nodes=new Map(),requests=[],timers=new Map(),downloads=[],radios=['chosen','random','none'].map(value=>Object.assign(new Node(),{value})),steps=Array.from({length:4},()=>new Node());
  const get=id=>{const generated=[...nodes.values()].flatMap(descendants).find(x=>x.id===id);if(generated)return generated;if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};get('days').value='28';get('seed').value='42';
  const storage=new Map();let timer=0;
  const body=new Node('body'),safetyLinks=[new Node('button'),new Node('button')],scrolls=[];
  body.classList.add('welcome-mode');
  const fetch=async(path,options)=>{
    const request={path,method:options.method,body:options.body?JSON.parse(options.body):undefined};requests.push(request);
    const custom=await handler(request);if(custom)return {ok:custom.status===undefined||custom.status<400,status:custom.status??200,json:async()=>custom.body};
    if(path==='/api/status')return {ok:true,status:200,json:async()=>structuredClone(catalog)};
    return {ok:false,status:path==='/api/preparation'?404:401,json:async()=>({error:'No active case'})};
  };
  const app=runInNewContext(source+'\n({init,getScreen:()=>screen,getSession:()=>session,saveHistory,readHistory,selectionPayload,publicSelection,reportText})',{
    document:{body,getElementById:get,createElement:tag=>new Node(tag),querySelectorAll:selector=>selector==='.safety-link'?safetyLinks:selector==='input[name="selectionMode"]'?radios:selector==='.preparation-steps li'?steps:selector.startsWith('#interviewGuide input')?[...descendants(get('guideChecklist')).filter(x=>['select','textarea','input'].includes(x.tagName)),...['guideHypothesis','guideAlternatives','guideNext'].map(get)]:[]},
    window:{scrollTo:options=>scrolls.push(options)},
    fetch,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},crypto:{randomUUID:()=> 'request-1'},performance:{now:()=>1000},setTimeout:fn=>{const id=++timer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),console,Date,Blob,URL:{createObjectURL:blob=>{downloads.push(blob);return 'blob:test';},revokeObjectURL(){}},FormData:class{constructor(form){this.entries=form.entries??[];}[Symbol.iterator](){return this.entries[Symbol.iterator]();}}
  });
  return {app,get,requests,radios,steps,timers,storage,downloads,body,safetyLinks,scrolls};
}
const submit={preventDefault(){}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function readySession(selection={mode:'random'}){return {brief:{name:'Jordan',lifeStage:'Young adult',speaker:'Jordan',referral:'Recent routines.',notice:'',mode:'generated',historyDays:28,hash:'abcdef123456abcdef',selection},turns:[],ended:false};}

test('Fixture initialization makes one startup sequence even with welcome handlers after init',async()=>{
  const h=harness();await flush();assert.equal(h.requests.length,0);
  await h.app.init();
  assert.deepEqual(h.requests.map(r=>r.path),['/api/status','/api/preparation','/api/session']);
  assert.equal(h.get('error').textContent,'');
  assert.equal(h.body.classList.contains('welcome-mode'),true);
});

test('Welcome entry and About preserve setup choices without making API requests',async()=>{
  const h=harness();await h.app.init();const before=h.requests.length;
  h.get('seed').value='91';h.get('enterSimulator').onclick();
  assert.equal(h.body.classList.contains('welcome-mode'),false);assert.equal(h.get('welcome').hidden,true);
  assert.equal(h.get('mode').focused,true);
  h.get('aboutButton').onclick();
  assert.equal(h.body.classList.contains('welcome-mode'),true);assert.equal(h.get('welcome').hidden,false);
  assert.equal(h.get('enterSimulator').textContent,'Start an interview →');assert.equal(h.get('welcomeTitle').focused,true);
  assert.equal(h.scrolls[0].top,0);
  h.get('enterSimulator').onclick();assert.equal(h.get('seed').value,'91');assert.equal(h.requests.length,before);
});

test('Restored interviews bypass welcome and About returns to the same interview',async()=>{
  const h=harness(r=>r.path==='/api/preparation'?{body:{preparation:{status:'ready'},session:readySession()}}:undefined);
  await h.app.init();const current=h.app.getSession(),before=h.requests.length;
  assert.equal(h.get('welcome').hidden,true);assert.equal(h.body.classList.contains('welcome-mode'),false);
  h.get('question').value='What matters to you?';h.get('aboutButton').onclick();
  assert.equal(h.get('enterSimulator').textContent,'Return to interview →');
  h.get('enterSimulator').onclick();
  assert.equal(h.app.getSession(),current);assert.equal(h.app.getScreen(),'interview');
  assert.equal(h.get('question').value,'What matters to you?');assert.equal(h.get('question').focused,true);
  assert.equal(h.requests.length,before);
});

test('All safety entry points open a dismissible dialog without API requests',()=>{
  const h=harness();
  for(const trigger of [h.get('safetyButton'),...h.safetyLinks]){
    trigger.onclick();assert.equal(h.get('safetyDialog').open,true);
    h.get('safetyClose').onclick();assert.equal(h.get('safetyDialog').open,false);
  }
  assert.equal(h.requests.length,0);
});

test('Prepare opens one stage-filtered disorder card without starting a server preparation',async()=>{
  const h=harness();await h.app.init();h.get('setupForm').onsubmit(submit);
  assert.equal(h.app.getScreen(),'selection');assert.equal(h.get('disorderName').textContent,'Generalized anxiety disorder');assert.equal(h.get('disorderPosition').textContent,'1 of 2');
  h.get('nextDisorder').onclick();assert.equal(h.get('disorderName').textContent,'Major depressive disorder');
  h.get('disorderCarousel').onkeydown({key:'ArrowRight',preventDefault(){}});assert.equal(h.get('disorderPosition').textContent,'1 of 2');
  h.get('disorderCarousel').onwheel({deltaY:100,deltaX:0,preventDefault(){}});assert.equal(h.get('disorderPosition').textContent,'2 of 2');
  assert.equal(h.requests.filter(r=>r.method==='POST').length,0);
  h.get('selectionBack').onclick();h.get('mode').value='mika';h.get('mode').onchange();h.get('setupForm').onsubmit(submit);
  assert.equal(h.get('disorderName').textContent,'Autism spectrum disorder');assert.equal(h.get('disorderPosition').textContent,'1 of 1');assert.equal(h.get('days').value,'7');
});

test('Random clears the named card and never resolves or submits a disorder in the browser',async()=>{
  const h=harness();await h.app.init();h.get('setupForm').onsubmit(submit);h.radios[1].onchange();
  assert.equal(h.get('disorderName').textContent,'Mystery case');assert.ok(!h.get('disorderDescription').textContent.includes('Persistent worry'));
  assert.equal(h.get('previousDisorder').hidden,true);assert.equal(h.get('nextDisorder').hidden,true);assert.equal(h.get('disorderPosition').textContent,'');
  assert.deepEqual(JSON.parse(JSON.stringify(h.app.selectionPayload('random',catalog.disorders[0]))),{mode:'random'});
  assert.deepEqual(JSON.parse(JSON.stringify(h.app.publicSelection({mode:'random',name:'SECRET',disorderId:'SECRET',description:'SECRET'}))),{mode:'random'});
  h.radios[2].onchange();assert.equal(h.get('disorderName').textContent,'No disorder');
  assert.deepEqual(JSON.parse(JSON.stringify(h.app.selectionPayload('none',catalog.disorders[0]))),{mode:'none'});
});

test('Real server progress is shown and cancel invalidates a late ready poll',async()=>{
  let started=false,resolvePoll;
  const h=harness(async r=>{
    if(r.path==='/api/prepare'){started=true;return {status:202,body:{preparation:{status:'running',phase:'simulation',message:'Simulating recent experiences',completedDays:3,totalDays:7}}};}
    if(r.path==='/api/preparation'&&started)return await new Promise(resolve=>{resolvePoll=resolve;});
    if(r.path==='/api/preparation/cancel')return {body:{ok:true}};
  });
  await h.app.init();h.get('mode').value='mika';h.get('mode').onchange();h.get('setupForm').onsubmit(submit);h.radios[1].onchange();
  const preparation=h.get('beginPreparation').onclick();await flush();
  assert.equal(h.app.getScreen(),'preparing');assert.equal(h.get('preparationDays').textContent,'3 of 7 recent days simulated');assert.equal(h.get('preparationProgress').value,3);
  assert.deepEqual(h.requests.find(r=>r.path==='/api/prepare').body,{requestId:'request-1',mode:'generated',patientId:'mika',seed:42,days:7,difficulty:'standard',selection:{mode:'random'}});
  // A running poll must not prevent the user from cancelling the case.
  await h.get('cancelPreparation').onclick();
  assert.equal(h.app.getScreen(),'selection');
  resolvePoll({body:{preparation:{status:'ready',phase:'freeze'},session:readySession()}});await preparation;
  assert.equal(h.app.getScreen(),'selection');assert.equal(h.app.getSession(),null);
});

test('Completed preparation enters the interview and mystery metadata stays generic',async()=>{
  let started=false;
  const h=harness(r=>{
    if(r.path==='/api/prepare'){started=true;return {status:202,body:{preparation:{status:'running',phase:'identity',message:'Building personality'}}};}
    if(r.path==='/api/preparation'&&started)return {body:{preparation:{status:'ready',phase:'freeze'},session:readySession({mode:'random'})}};
  });
  await h.app.init();h.get('setupForm').onsubmit(submit);h.radios[1].onchange();await h.get('beginPreparation').onclick();
  assert.equal(h.app.getScreen(),'interview');assert.equal(h.get('workspace').hidden,false);assert.equal(h.get('interviewSelection').textContent,'Mystery case');assert.equal(h.get('question').focused,true);
  assert.equal(h.requests.filter(r=>r.path==='/api/prepare').length,1);
});

test('Reload restores safe preparation choices for retry and back navigation',async()=>{
  const h=harness(r=>r.path==='/api/preparation'?{body:{preparation:{status:'failed',phase:'simulation',message:'Preparation stopped',error:'Try again.',configuration:{mode:'generated',patientId:'mika',seed:91,days:8,selection:{mode:'none'}}}}}:undefined);
  await h.app.init();assert.equal(h.app.getScreen(),'preparing');assert.equal(h.get('mode').value,'mika');assert.equal(h.get('seed').value,'91');assert.equal(h.get('days').value,'8');
  assert.equal(h.radios[2].checked,true);assert.equal(h.get('retryPreparation').hidden,false);assert.match(h.get('preparationContext').textContent,/Mika.*8 simulated days.*No disorder/);
});

test('Ambiguous network failure offers resume, without sending a second preparation',async()=>{
  let started=false;
  const h=harness(r=>{
    if(r.path==='/api/prepare'){started=true;throw new Error('network interrupted');}
    if(r.path==='/api/preparation'&&started)return {body:{preparation:{status:'ready',phase:'freeze'},session:readySession()}};
  });
  await h.app.init();h.get('setupForm').onsubmit(submit);h.radios[1].onchange();await h.get('beginPreparation').onclick();
  assert.equal(h.get('resumePreparation').hidden,false);assert.equal(h.get('retryPreparation').hidden,true);
  h.get('resumePreparation').onclick();await flush();assert.equal(h.app.getScreen(),'interview');assert.equal(h.requests.filter(r=>r.path==='/api/prepare').length,1);
});

test('Expired preparation can return to selection without getting stuck',async()=>{
  const h=harness(r=>r.path==='/api/preparation'?{body:{preparation:{status:'failed',phase:'simulation',message:'Expired',configuration:{patientId:'jordan',seed:42,days:28,selection:{mode:'none'}}}}}:undefined);
  await h.app.init();await h.get('cancelPreparation').onclick();assert.equal(h.app.getScreen(),'selection');assert.equal(h.get('preparationPanel').hidden,true);
});

test('Difficulty choice and patient individuality preview reach preparation without changing the selected case',async()=>{
 const h=harness(r=>r.path==='/api/prepare'?{status:400,body:{error:'Test stopped before preparation'}}:undefined);
 await h.app.init();assert.equal(h.get('difficulty').value,'standard');assert.equal(h.get('communicationPreview').textContent,'Reflective and measured.');
 h.get('difficulty').value='challenging';h.get('difficulty').onchange();assert.match(h.get('difficultyHelp').textContent,/Brief replies/);
 h.get('mode').value='mika';h.get('mode').onchange();assert.equal(h.get('communicationPreview').textContent,'Caregiver observations.');assert.equal(h.get('difficulty').value,'challenging');
 h.get('setupForm').onsubmit(submit);assert.match(h.get('selectionContext').textContent,/Challenging/);
 await h.get('beginPreparation').onclick();const body=h.requests.find(r=>r.path==='/api/prepare').body;
 assert.equal(body.difficulty,'challenging');assert.equal(body.patientId,'mika');assert.equal(body.selection.disorderId,'autism');
});

test('Refresh, saved conversation and report keep difficulty without archiving hidden personality data',async()=>{
 const current=readySession();Object.assign(current.brief,{difficulty:'challenging',difficultyLabel:'Challenging',difficultyDescription:'Brief replies.'});
 current.turns=[{id:'T1',requestId:'difficulty-save-1',question:'What matters to you?',reply:'Drawing.',kind:'answer'}];
 current.individuality={secret:'PRIVATE'};
 const h=harness(r=>r.path==='/api/preparation'?{body:{preparation:{status:'ready'},session:current}}:undefined);
 await h.app.init();assert.match(h.get('interviewDifficulty').textContent,/Challenging/);
 const records=[...h.storage.values()].map(v=>JSON.parse(v)).flat();assert.equal(records[0].difficulty,'challenging');assert.ok(!JSON.stringify(records).includes('PRIVATE'));
 const failed=harness(r=>r.path==='/api/preparation'?{body:{preparation:{status:'failed',configuration:{patientId:'jordan',days:28,seed:42,difficulty:'beginner',selection:{mode:'none'}}}}}:undefined);
 await failed.app.init();assert.equal(failed.get('difficulty').value,'beginner');assert.match(failed.get('preparationContext').textContent,/Beginner/);
 failed.get('selectionBack').onclick();assert.equal(failed.get('difficulty').value,'beginner');
});

function guidedSession(mode='chosen',withTurns=true){
  const current=readySession(mode==='chosen'?{mode,name:'Generalized anxiety disorder'}:{mode});
  current.guide={name:mode==='chosen'?'Generalized anxiety disorder':mode==='none'?'Everyday functioning review':'Broad interview guide',mode,
    perspective:'Use the patient account.',ageNote:'Confirm age and respondent requirements.',course:'Ask about the earlier course as well as recent events.',
    checklist:[
      {id:'course',label:'History and timing',question:'When did these changes begin?'},
      {id:'function',label:'Daily functioning',question:'How has daily life changed?'},
      {id:'context',label:'Other explanations',question:'What else was happening then?'},
      {id:'safety',label:'Current safety',question:'Do you feel safe now?'}
    ],
    hypothesisOptions:[{id:'defer',name:'Defer — more information needed'},{id:'anxiety',name:'Generalized anxiety disorder'},{id:'depression',name:'Major depressive disorder'},{id:'none',name:'No disorder established'}],
    test:{name:'Assessment reference',url:'https://www.nimh.nih.gov/health/topics',purpose:'Consider an appropriate assessment.',interpretation:'Not a definitive diagnosis.'},
    differentials:['Other causes need consideration.'],cautions:'Interpret the evidence in context.',sources:[{title:'Public assessment reference',url:'https://www.nimh.nih.gov/health/topics'}]};
  if(withTurns)current.turns=[{id:'T1',requestId:'guide-turn-1',question:'What changed?',reply:'I stopped seeing friends.',kind:'answer'},{id:'T2',requestId:'guide-turn-2',question:'Unsupported request',reply:'This is a simulation boundary.',kind:'boundary'}];
  current.guideWork=makeGuideWork(current);return current;
}
function makeGuideWork(current,state={items:{},hypothesisId:'defer',alternatives:'',nextStep:'',reviewed:false},ended=false){
  return {title:current.guide.name,checklist:current.guide.checklist.map(({id,label})=>({id,label})),state:structuredClone(state),review:{
    hypothesis:current.guide.hypothesisOptions.find(x=>x.id===state.hypothesisId)?.name??'Defer',summary:'Review the recorded evidence and remaining questions.',
    gaps:['Check chronology and other explanations.'],unasked:[],unclear:[],unlinked:[],counterEvidence:[],
    comparison:ended?{target:'Hidden teaching condition',message:'Compare the teaching premise with the evidence.'}:null,
    limitation:'Educational review only; this is not a diagnosis.'}};
}
function guidedHarness(mode='chosen',{withTurns=true,onGuide}={}){
  let current=guidedSession(mode,withTurns);
  const report=()=>({title:'Interview debrief',brief:current.brief,model:'fixture',reasoning:{hypothesis:'Provisional'},evidence:[],assessment:null,ratings:[],limitations:['Teaching exercise.'],guideWork:current.guideWork,caseAnswer:{name:'Hidden teaching condition',description:'Authored premise.',classification:'Teaching',notes:[]}});
  const h=harness(async r=>{
    if(r.path==='/api/preparation')return current?{body:{preparation:{status:'ready'},session:structuredClone(current)}}:undefined;
    if(r.path==='/api/session'&&r.method==='DELETE'){current=null;return {body:{ok:true}};}
    if(r.path==='/api/session')return current?{body:structuredClone(current)}:undefined;
    if(r.path==='/api/prepare'){current=guidedSession(r.body.selection.mode,false);return {body:{preparation:{status:'ready'},session:structuredClone(current)}};}
    if(r.path==='/api/guide'){
      const custom=await onGuide?.(r);if(custom)return custom;
      current.guideWork=makeGuideWork(current,r.body.state);return {body:{guideWork:structuredClone(current.guideWork)}};
    }
    if(r.path==='/api/finish'){current.ended=true;current.guideWork=makeGuideWork(current,current.guideWork.state,true);return {body:report()};}
    if(r.path==='/api/report')return {body:report()};
  });
  return {...h,current:()=>current};
}
function change(h,id,value,event='oninput'){const node=h.get(id);node.value=value;node[event]();}
const savedGuides=h=>[...h.storage.values()].flatMap(v=>JSON.parse(v));

test('Checklist observations, notes and answered-turn evidence survive repeated saves',async()=>{
  const h=guidedHarness();await h.app.init();
  assert.equal(h.get('interviewGuide').hidden,false);
  assert.deepEqual(h.get('guide-state-course').children.map(x=>x.value),['unasked','supported','absent','uncertain']);
  assert.deepEqual(h.get('guide-turn-course').children.map(x=>x.value),['','T1']);
  change(h,'guide-state-course','supported','onchange');change(h,'guide-turn-course','T1','onchange');change(h,'guide-note-course','The patient described a change.');
  assert.equal(h.get('guideSaveStatus').textContent,'Unsaved notes');
  assert.match(nodeText(h.get('guideChecklist')),/I stopped seeing friends/);
  await h.get('guideSave').onclick();
  assert.equal(h.current().guideWork.state.items.course.note,'The patient described a change.');
  // Editing after a successful save must update the active draft, not a stale handler closure.
  change(h,'guide-state-course','absent','onchange');change(h,'guide-note-course','The duration is not established.');
  change(h,'guide-state-function','uncertain','onchange');
  await h.get('guideSave').onclick();
  const state=h.current().guideWork.state;
  assert.equal(state.items.course.status,'absent');assert.equal(state.items.course.note,'The duration is not established.');assert.equal(state.items.course.turnId,'T1');
  assert.equal(state.items.function.status,'uncertain');assert.equal(state.items.safety.status,'unasked');
  assert.equal(savedGuides(h)[0].guideWork.state.items.course.note,'The duration is not established.');
  assert.equal(h.requests.filter(x=>x.path==='/api/turn').length,0);
});

test('Guide question insertion fills an editable question and does not call AI',async()=>{
  const h=guidedHarness();await h.app.init();h.get('guideQuestionsTab').onclick();
  const before=h.requests.length;const button=h.get('guideQuestions').children[0].children.find(x=>x.tagName==='button');button.onclick();
  assert.equal(h.get('question').value,'When did these changes begin?');assert.equal(h.get('question').focused,true);
  assert.equal(h.get('question').disabled,false);assert.equal(h.requests.length,before);assert.match(h.get('answerStatus').textContent,/Edit it/);
});

test('Diagnosis tab preserves provisional impression and hides outdated reasoning feedback after editing',async()=>{
  const h=guidedHarness();await h.app.init();h.get('guideDiagnosisTab').onclick();
  assert.equal(h.get('guideDiagnosisPanel').hidden,false);assert.equal(h.get('guideChecklistPanel').hidden,true);
  assert.equal(h.get('guideDiagnosisTab').attributes.get('aria-selected'),'true');
  change(h,'guideHypothesis','depression','onchange');change(h,'guideAlternatives','Consider sleep and physical illness.');change(h,'guideNext','Ask about the earlier course.');
  await h.get('guideCheck').onclick();
  assert.equal(h.current().guideWork.state.reviewed,true);assert.equal(h.current().guideWork.state.hypothesisId,'depression');
  assert.equal(h.get('guideFeedback').hidden,false);assert.match(nodeText(h.get('guideFeedback')),/Major depressive disorder/);
  change(h,'guideNext','Review the school record instead.');assert.equal(h.get('guideFeedback').hidden,true);
  await h.get('guideSave').onclick();assert.equal(h.current().guideWork.state.reviewed,false);assert.equal(h.get('guideFeedback').hidden,true);
  h.get('guideDiagnosisTab').onkeydown({key:'Home',preventDefault(){}});assert.equal(h.get('guideChecklistTab').focused,true);assert.equal(h.get('guideChecklistPanel').hidden,false);
});

test('Refresh retains unsaved notes but loads newer saved notes when the draft is clean',async()=>{
  const h=guidedHarness();await h.app.init();change(h,'guide-note-course','Unsaved local observation.');
  await h.get('sync').onclick();assert.equal(h.get('guide-note-course').value,'Unsaved local observation.');
  await h.get('guideSave').onclick();
  h.current().guideWork.state.items.course.note='Saved elsewhere in this session.';
  await h.get('sync').onclick();assert.equal(h.get('guide-note-course').value,'Saved elsewhere in this session.');
  const restored=harness(r=>r.path==='/api/preparation'?{body:{preparation:{status:'ready'},session:structuredClone(h.current())}}:undefined);
  await restored.app.init();assert.equal(restored.get('guide-note-course').value,'Saved elsewhere in this session.');
});

test('A repeated frozen history starts with fresh notes and no evidence from the prior interview',async()=>{
  const h=guidedHarness();await h.app.init();const sameHash=h.current().brief.hash;
  change(h,'guide-note-course','Prior interview only.');change(h,'guide-turn-course','T1','onchange');await h.get('guideSave').onclick();
  await h.get('clear').onclick();h.get('setupForm').onsubmit(submit);await h.get('beginPreparation').onclick();
  assert.equal(h.current().brief.hash,sameHash);assert.equal(h.get('guide-note-course').value,'');assert.equal(h.get('guide-turn-course').value,'');
  assert.equal(h.get('guideHypothesis').value,'defer');assert.equal(h.get('guide-state-course').value,'unasked');
});

test('Failed guide save keeps entries editable and prevents finishing with unsaved work',async()=>{
  const h=guidedHarness('chosen',{onGuide:()=>({status:503,body:{error:'Local save unavailable'}})});await h.app.init();
  change(h,'guide-note-course','Keep this after an error.');await h.get('guideSave').onclick();
  assert.equal(h.get('guide-note-course').value,'Keep this after an error.');assert.equal(h.get('guide-note-course').disabled,false);assert.match(h.get('guideSaveStatus').textContent,/not saved/i);
  await h.get('finishForm').onsubmit({...submit,target:{entries:[['hypothesis','Defer']]}});
  assert.equal(h.requests.filter(x=>x.path==='/api/finish').length,0);assert.equal(h.app.getSession().ended,false);
});

test('Pending guide saves keep replacement form fields locked until saving completes',async()=>{
  let releaseSave;
  const h=guidedHarness('chosen',{onGuide:()=>new Promise(resolve=>{releaseSave=resolve;})});await h.app.init();
  change(h,'guide-note-course','Save this exact draft.');const saving=h.get('guideSave').onclick();await flush();
  assert.equal(h.get('guide-note-course').disabled,true);assert.equal(h.get('guideCheck').disabled,true);
  // A refresh that was already in flight may redraw the guide while saving.
  await h.get('sync').onclick();assert.equal(h.get('guide-note-course').disabled,true);
  releaseSave(undefined);await saving;
  assert.equal(h.get('guide-note-course').disabled,false);assert.equal(h.get('guideCheck').disabled,false);
  assert.equal(h.current().guideWork.state.items.course.note,'Save this exact draft.');
});

test('Ending saves the draft before creating the debrief, locks notes and archives them',async()=>{
  const h=guidedHarness('random');await h.app.init();change(h,'guide-note-function','The answer describes withdrawal from friends.');
  change(h,'guide-state-function','supported','onchange');change(h,'guide-turn-function','T1','onchange');change(h,'guideHypothesis','depression','onchange');
  await h.get('finishForm').onsubmit({...submit,target:{entries:[['hypothesis','Provisional depression'],['missing','Earlier course']]}});
  const posts=h.requests.filter(x=>x.method==='POST').map(x=>x.path);assert.deepEqual(posts,['/api/guide','/api/finish']);
  assert.equal(h.app.getSession().ended,true);assert.equal(h.get('guide-note-function').disabled,true);assert.equal(h.get('guideSave').disabled,true);
  assert.match(h.get('report').textContent,/withdrawal from friends/);assert.match(nodeText(h.get('guideFeedback')),/Hidden teaching condition/);
  const record=savedGuides(h)[0];assert.equal(record.ended,true);assert.equal(record.guideWork.state.items.function.turnId,'T1');assert.equal(record.guideWork.review.comparison.target,'Hidden teaching condition');
  h.get('historyButton').onclick();h.get('historyList').children[0].children[0].onclick();assert.match(nodeText(h.get('historyDetail')),/withdrawal from friends/);
});

test('Active conversation download includes saved interview notes and learner hypothesis',async()=>{
  const h=guidedHarness();await h.app.init();change(h,'guide-note-course','Evidence to retain in an export.');change(h,'guideHypothesis','none','onchange');await h.get('guideSave').onclick();
  h.get('downloadConversation').onclick();assert.equal(h.downloads.length,1);const text=await h.downloads[0].text();
  assert.match(text,/Evidence to retain in an export/);assert.match(text,/No disorder established/);assert.match(text,/I stopped seeing friends/);
});

test('Random and no-disorder modes display broad guidance without revealing a teaching target before the debrief',async()=>{
  for(const mode of ['random','none']){
    const h=guidedHarness(mode);await h.app.init();
    assert.equal(h.get('guideTitle').textContent,mode==='random'?'Broad interview guide':'Everyday functioning review');
    assert.equal(h.get('guideHypothesis').value,'defer');assert.equal(h.get('guideHypothesis').children.at(-1).value,'none');
    change(h,'guideHypothesis','depression','onchange');await h.get('guideCheck').onclick();
    assert.equal(h.current().guideWork.review.comparison,null);assert.doesNotMatch(nodeText(h.get('guideFeedback')),/Hidden teaching condition/);
    assert.doesNotMatch(JSON.stringify(savedGuides(h)),/Hidden teaching condition/);
  }
});

test('Finished feedback renders concrete questions and gaps, survives History, refresh and both exports',async()=>{
  const current=guidedSession('random');
  const feedback={version:'test',perspective:'Use the patient account.',usefulQuestions:[{turnId:'T1',question:'What changed?',reply:'I stopped seeing friends.',sources:[{id:'B03',label:'Daily functioning'}],checkpointLeads:[{id:'function',label:'Daily functioning'}],interpretation:'Review the exact reply.'}],unknowns:[{checkpointId:'safety',label:'Current safety',reason:'No authored source is mapped.',question:'Do you feel safe now?',nextStep:'Leave unavailable details unknown.'}],evidenceGaps:[{checkpointId:'course',label:'History and timing',turnId:'T1',issue:'The linked source does not establish course.',nextStep:'Ask when it began.'}],conclusionReview:{statement:'Defer until course is clearer.',supportingTurnIds:['T1'],gaps:['Earlier history remains unknown.'],status:'Traceability is not diagnostic correctness.'},limitations:['No clinical score.']};
  const full=()=>({title:'Interview debrief',brief:current.brief,model:'fixture',reasoning:{hypothesis:'Defer'},evidence:[],assessment:null,ratings:[],limitations:[],guideWork:current.guideWork,feedback:structuredClone(feedback)});
  const handler=r=>{
    if(r.path==='/api/preparation')return {body:{preparation:{status:'ready'},session:structuredClone(current)}};
    if(r.path==='/api/session')return {body:structuredClone(current)};
    if(r.path==='/api/guide'){current.guideWork=makeGuideWork(current,r.body.state);return {body:{guideWork:current.guideWork}};}
    if(r.path==='/api/finish'){current.ended=true;current.feedback=structuredClone(feedback);return {body:full()};}
    if(r.path==='/api/report')return {body:full()};
  };
  const h=harness(handler);await h.app.init();
  assert.ok(!Object.hasOwn(savedGuides(h)[0],'feedback'));
  await h.get('finishForm').onsubmit({...submit,target:{entries:[['hypothesis','Defer']]}});
  const displayed=nodeText(h.get('report'));assert.match(displayed,/Questions that opened new areas/);assert.match(displayed,/T1 · What changed\?/);assert.match(displayed,/linked source does not establish course/);assert.match(displayed,/Do you feel safe now/);assert.match(displayed,/Traceability is not diagnostic correctness/);
  assert.equal(savedGuides(h)[0].feedback.usefulQuestions[0].turnId,'T1');
  h.get('historyButton').onclick();h.get('historyList').children[0].children[0].onclick();assert.match(nodeText(h.get('historyDetail')),/Earlier history remains unknown/);
  h.get('downloadConversation').onclick();h.get('download').onclick();
  for(const blob of h.downloads){const content=await blob.text();assert.match(content,/YOUR INTERVIEW REVIEW/);assert.match(content,/B03 — Daily functioning/);assert.match(content,/Ask when it began/);}
  const reloaded=harness(handler);await reloaded.app.init();assert.match(nodeText(reloaded.get('report')),/What remains unknown/);assert.equal(savedGuides(reloaded)[0].feedback.conclusionReview.statement,'Defer until course is clearer.');
  assert.equal(h.requests.filter(x=>x.path==='/api/turn').length,0);
});

test('Browser archives exclude feedback before finish even if a caller supplies it prematurely',()=>{
  const h=harness(),current=guidedSession('random');current.feedback={secret:'hidden future debrief'};
  const storage={getItem:()=>null,setItem(k,v){this.saved=v;}};h.app.saveHistory(storage,current);
  assert.doesNotMatch(storage.saved,/hidden future debrief/);
});
