import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {appSource as source} from './app-source.mjs';

class Node {
  constructor(tagName='div'){this.tagName=tagName;this.children=[];this.value='';this.textContent='';this.hidden=false;this.classList={toggle(){}};}
  set innerHTML(value){throw new Error('HTML interpretation is forbidden');}
  set outerHTML(value){throw new Error('HTML interpretation is forbidden');}
  replaceChildren(...children){this.children=children;}
  append(...children){this.children.push(...children);}
  setAttribute(){}
  removeAttribute(){}
  addEventListener(){}
  focus(){}
  reset(){}
  scrollIntoView(){}
}
function harness(){
  const nodes=new Map(),requests=[],stored=new Map();
  const get=id=>{if(!nodes.has(id))nodes.set(id,new Node());return nodes.get(id);};
  const storage={getItem:key=>stored.get(key)??null,setItem:(key,value)=>stored.set(key,value)};
  const app=runInNewContext(source+'\n({api,safeExternalUrl,guideLink,conversationExchange,savedTranscript,drawCost,saveHistory,readHistory,validateSetup,controls,setState:(s,current)=>{status=s;session=current;}})',{
    document:{getElementById:get,createElement:tag=>new Node(tag),querySelectorAll:()=>[]},
    URL,localStorage:storage,fetch:async(path,options)=>{requests.push({path,...options});return {ok:true,status:200,json:async()=>({ok:true})};},
    crypto:{randomUUID:()=> 'test-request'},setTimeout,clearTimeout
  });
  get('mode').value='jordan';get('difficulty').value='standard';get('days').value='28';get('seed').value='42';
  app.setState({patients:[{id:'jordan',mode:'generated'}],disorders:[]},null);
  return {app,get,requests,storage,stored};
}
const descendants=node=>[node,...node.children.flatMap(descendants)];
const submit={preventDefault(){}};

test('Reference links reject script, data, credentialed and obfuscated URLs',()=>{
  const h=harness();
  for(const url of ['javascript:alert(1)','JaVaScRiPt:alert(1)','data:text/html,<script>alert(1)</script>','//example.com','/api/review','http://example.com','https://user:secret@example.com','https:\\example.com','https://example.com\n/x',' https://example.com']){
    const link=h.app.guideLink('Reference',url);
    assert.equal(link.tagName,'span',url);assert.equal(link.href,undefined,url);
  }
  const link=h.app.guideLink('Reference','https://www.nimh.nih.gov/health/topics');
  assert.equal(link.href,'https://www.nimh.nih.gov/health/topics');
  assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');
});

test('Pricing links use the same safe navigation policy as guide sources',()=>{
  const h=harness();h.app.drawCost({session:{cost:{status:'no_calls',models:[{model:'Injected',rate:{source:'javascript:alert(1)'}},{model:'Valid',rate:{source:'https://featherless.ai/models/test'}}]}}});
  const links=descendants(h.get('costStatus')).filter(node=>node.tagName==='a');
  assert.deepEqual(links.map(link=>link.href),['https://featherless.ai/models/test']);
});

test('Transcript and case-note payloads remain literal text in live and saved views',()=>{
  const h=harness(),payload='<img src=x onerror=alert(document.cookie)><script>alert(1)</script>';
  const turn={id:'T1',question:payload,reply:payload,kind:'answer',exerciseNote:payload};
  const live=h.app.conversationExchange(turn,payload);
  const saved=h.app.savedTranscript({name:payload,mode:'generated',turns:[turn]});
  for(const view of [live,saved]){
    assert.equal(descendants(view).some(node=>['img','script'].includes(node.tagName)),false);
    assert.ok(descendants(view).some(node=>node.textContent===payload));
  }
});

test('API requests stay on the application origin and cannot follow redirects with form data',async()=>{
  const h=harness();await h.app.api('/api/turn','POST',{question:'Private learner text'});
  const request=h.requests[0];
  assert.equal(request.mode,'same-origin');assert.equal(request.credentials,'same-origin');
  assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');
  assert.equal(request.headers['X-PsychLab'],'1');assert.equal(h.stored.size,0);
  for(const path of ['https://example.com/api/turn','//example.com/api/turn','/api/../private','/api/turn?redirect=external'])await assert.rejects(h.app.api(path,'POST',{}),/Invalid application endpoint/);
  assert.equal(h.requests.length,1);
});

test('Archive schemas omit unexpected credentials throughout notes and feedback',()=>{
  const h=harness(),secret={accessToken:'UNEXPECTED_SECRET',refreshToken:'UNEXPECTED_SECRET',apiKey:'UNEXPECTED_SECRET',privateTrace:'UNEXPECTED_SECRET'};
  const current={...secret,brief:{hash:'case',name:'Jordan',mode:'generated',...secret},ended:true,
    turns:[{id:'T1',requestId:'request-1',question:'How are you?',reply:'Fine.',kind:'answer',...secret}],
    guideWork:{title:'Interview notes',checklist:[{id:'course',label:'Timing',...secret}],...secret,
      state:{items:{course:{status:'supported',turnId:'T1',note:'Useful context',...secret},unexpected:secret},hypothesisId:'defer',alternatives:'Need more evidence',nextStep:'Ask about timing',reviewed:true,...secret},
      review:{hypothesis:'Defer',summary:'Review evidence',gaps:[],unasked:[],unclear:[],unlinked:[],counterEvidence:[],comparison:{target:'Teaching case',message:'Compare evidence',...secret},limitation:'Practice only',...secret}},
    feedback:{perspective:'Patient account',usefulQuestions:[{turnId:'T1',question:'How are you?',reply:'Fine.',sources:[{id:'source-1',label:'Source',...secret}],checkpointLeads:[{id:'course',label:'Timing',...secret}],...secret}],
      unknowns:[{label:'Timing',reason:'Missing context',question:'When?',nextStep:'Ask',...secret}],evidenceGaps:[{label:'Timing',issue:'Missing context',nextStep:'Ask',...secret}],
      conclusionReview:{statement:'Defer',supportingTurnIds:['T1'],gaps:[],status:'Provisional',...secret},limitations:['Practice only'],...secret}};
  h.app.saveHistory(h.storage,current);
  const archive=h.app.readHistory(h.storage)[0];
  assert.ok(!JSON.stringify(archive).includes('UNEXPECTED_SECRET'));
  assert.equal(archive.guideWork.state.items.course.note,'Useful context');
  assert.deepEqual(Object.keys(archive.guideWork.state.items),['course']);
  assert.equal(archive.feedback.usefulQuestions[0].sources[0].label,'Source');
  assert.equal(archive.feedback.conclusionReview.statement,'Defer');
});

test('Invalid setup values cannot bypass the selection step or trigger preparation',async()=>{
  for(const [id,value] of [['days',''],['days','0'],['days','91'],['days','1.5'],['days','1e1'],['seed','-1'],['seed','4294967296'],['seed','Infinity'],['mode','unknown'],['difficulty','unknown']]){
    const h=harness();h.get(id).value=value;
    h.get('setupForm').onsubmit(submit);assert.ok(h.get('error').textContent.length,`${id}: ${value}`);
    await h.get('beginPreparation').onclick();assert.equal(h.requests.length,0,`${id}: ${value}`);
  }
  const h=harness();h.get('days').value='90';h.get('seed').value='4294967295';
  assert.equal(h.app.validateSetup().id,'jordan');
});

test('Oversized questions and invalid forms are rejected before network requests',async()=>{
  const h=harness();h.app.setState({patients:[]},{turns:[]});h.get('question').value='x'.repeat(1501);
  await h.get('questionForm').onsubmit(submit);assert.equal(h.requests.length,0);assert.match(h.get('error').textContent,/1,500/);
  for(const id of ['questionForm','assessmentForm','finishForm']){
    h.get(id).reportValidity=()=>false;await h.get(id).onsubmit(submit);
  }
  assert.equal(h.requests.length,0);
});

test('Reviewer controls require an explicit current server grant and a completed interview',async()=>{
  const h=harness(),ended={ended:true,turns:[]};
  for(const status of [{},{permissions:{review:false}},{permissions:{review:'true'}}]){
    h.app.setState(status,ended);h.get('trace').textContent='An earlier privileged trace';h.app.controls();
    assert.equal(h.get('reviewerPanel').hidden,true);assert.equal(h.get('review').disabled,true);assert.equal(h.get('trace').textContent,'');
    await h.get('review').onclick();assert.equal(h.requests.length,0);
  }
  h.app.setState({permissions:{review:true}},{ended:false,turns:[]});h.app.controls();
  assert.equal(h.get('reviewerPanel').hidden,false);assert.equal(h.get('review').disabled,true);
  await h.get('review').onclick();assert.equal(h.requests.length,0);
  h.app.setState({permissions:{review:true}},ended);h.app.controls();
  assert.equal(h.get('review').disabled,false);await h.get('review').onclick();
  assert.equal(h.requests.length,1);assert.equal(h.requests[0].path,'/api/review');assert.equal(h.stored.size,0);
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/<details id="reviewerPanel" hidden>/);
});
