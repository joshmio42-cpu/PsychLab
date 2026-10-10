const $=id=>document.getElementById(id);
const el=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
let session=null,status=null,pending=null,report=null,epoch=0,sending=false;
let screen='setup',selectionMode='chosen',disorderIndex=0,preparationEpoch=0,preparationTimer=null,preparationRequest=null,preparationBusy=false;
let guideHash=null,guideDraft=null,guideDirty=false,guideSaving=false,guideTab='Checklist';
// SELECTION_HELPERS_START: these helpers never resolve a mystery case in the browser.
function eligibleDisorders(disorders,patient){return disorders.filter(d=>!['none','no_disorder'].includes(d.id)&&d.stages.includes(patient.lifeStage));}
function selectionPayload(mode,disorder){
  if(mode==='random'||mode==='none')return {mode};
  if(mode!=='chosen'||!disorder)throw new Error('Choose an available disorder for this patient.');
  return {mode:'chosen',disorderId:disorder.id};
}
function publicSelection(selection){
  if(!selection)return undefined;
  return selection.mode==='chosen'?{mode:'chosen',name:selection.name}: {mode:selection.mode};
}
function selectionLabel(selection){return selection?.mode==='random'?'Mystery case':selection?.mode==='none'?'No disorder':selection?.name||'Interview practice';}
// SELECTION_HELPERS_END
// HISTORY_STORE_START: no server state, credentials, or reviewer data is stored.
const HISTORY_KEY='psychlab.conversations.v1';
// Public archives have a fixed shape: new server fields never become browser
// persistence automatically (in particular credentials, private traces or IDs).
function archiveFields(value,schema){
  if(schema===true)return value===null||['string','boolean'].includes(typeof value)||typeof value==='number'&&Number.isFinite(value)?value:undefined;
  if(Array.isArray(schema))return Array.isArray(value)?value.map(item=>archiveFields(item,schema[0])).filter(item=>item!==undefined):[];
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  return Object.fromEntries(Object.entries(schema).filter(([key])=>Object.hasOwn(value,key)).map(([key,nested])=>[key,archiveFields(value[key],nested)]).filter(([,item])=>item!==undefined));
}
function archiveGuide(work){
  const saved=archiveFields(work,{version:true,title:true,checklist:[{id:true,label:true}],state:{hypothesisId:true,alternatives:true,nextStep:true,reviewed:true},
    review:{hypothesis:true,documented:true,total:true,summary:true,gaps:[true],unasked:[true],unclear:[true],unlinked:[true],counterEvidence:[true],
      comparison:{target:true,hypothesis:true,match:true,message:true},limitation:true}});
  if(saved?.state)saved.state.items=Object.fromEntries((saved.checklist??[]).filter(item=>typeof item.id==='string'&&Object.hasOwn(work.state.items??{},item.id)).map(item=>[item.id,archiveFields(work.state.items[item.id],{status:true,turnId:true,note:true})]));
  return saved;
}
function archiveFeedback(feedback){return archiveFields(feedback,{version:true,perspective:true,
  usefulQuestions:[{turnId:true,question:true,reply:true,sources:[{id:true,label:true}],checkpointLeads:[{id:true,label:true}],interpretation:true}],
  unknowns:[{checkpointId:true,label:true,reason:true,question:true,nextStep:true}],
  evidenceGaps:[{checkpointId:true,label:true,turnId:true,issue:true,nextStep:true}],
  conclusionReview:{statement:true,supportingTurnIds:[true],gaps:[true],status:true},limitations:[true]});}
function caseNoteFields(turn){return typeof turn.exerciseNote==='string'&&turn.exerciseNote.trim()?{exerciseNote:turn.exerciseNote}:{};}
function caseNoteText(turn){const note=caseNoteFields(turn).exerciseNote;return note?`\nCase note (not patient evidence): ${note}`:'';}
// COST_HELPERS_START: an archive keeps this interview's estimate, never the server ledger.
function costSnapshot(cost){
  if(!cost||typeof cost!=='object')return undefined;
  const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
  return {currency:'USD',status:['no_calls','estimated','partial','unavailable'].includes(cost.status)?cost.status:'unavailable',
    estimatedUsd:amount(cost.estimatedUsd),pricedCalls:count(cost.pricedCalls),unpricedCalls:count(cost.unpricedCalls),pendingCalls:count(cost.pendingCalls),
    pricingCheckedOn:typeof cost.pricingCheckedOn==='string'?cost.pricingCheckedOn:null,pricingStale:cost.pricingStale===true,
    models:(Array.isArray(cost.models)?cost.models:[]).map(item=>({model:typeof item.model==='string'?item.model:'Unknown model',estimatedUsd:amount(item.estimatedUsd),
      promptTokens:count(item.promptTokens),completionTokens:count(item.completionTokens),cachedTokens:count(item.cachedTokens),
      pricedCalls:count(item.pricedCalls),unpricedCalls:count(item.unpricedCalls),
      rate:item.rate?{inputUsdPerMillion:amount(item.rate.inputUsdPerMillion),outputUsdPerMillion:amount(item.rate.outputUsdPerMillion),cachedInputUsdPerMillion:amount(item.rate.cachedInputUsdPerMillion),
        checkedOn:typeof item.rate.checkedOn==='string'?item.rate.checkedOn:null,
        source:typeof item.rate.source==='string'&&item.rate.source.startsWith('https://featherless.ai/models/')?item.rate.source:null}:null}))};
}
function costAmount(cost){
  if(!cost||!['no_calls','estimated','partial'].includes(cost.status)||typeof cost.estimatedUsd!=='number'||!Number.isFinite(cost.estimatedUsd)||cost.estimatedUsd<0)return 'Unavailable';
  if(cost.estimatedUsd===0)return 'US$0.00';
  return cost.estimatedUsd<0.0001?'Less than US$0.0001':`US$${cost.estimatedUsd.toLocaleString('en-US',{minimumFractionDigits:4,maximumFractionDigits:4,useGrouping:false})}`;
}
function costCoverage(cost){
  if(!cost)return 'No cost estimate was recorded.';
  if(cost.status==='no_calls')return 'No AI requests yet.';
  if(cost.status==='partial')return `Incomplete estimate: ${cost.pricedCalls} priced requests; ${cost.unpricedCalls} could not be priced${cost.pendingCalls?`; ${cost.pendingCalls} still pending`:''}.`;
  if(cost.status==='unavailable')return cost.pendingCalls?'Waiting for reported usage.':'Usage details or a model price are missing.';
  return `Estimated from ${cost.pricedCalls} priced request${cost.pricedCalls===1?'':'s'}.`;
}
function costText(cost){
  if(!cost)return '\n\nSESSION COST (USD)\nNo cost estimate was recorded for this conversation.';
  const rates=(cost.models??[]).map(item=>`${item.model}: ${item.promptTokens} input / ${item.completionTokens} output tokens${item.rate?`\nRates per million: input US$${item.rate.inputUsdPerMillion}; output US$${item.rate.outputUsdPerMillion}${item.rate.cachedInputUsdPerMillion!==null?`; cached input US$${item.rate.cachedInputUsdPerMillion}`:''}\nChecked ${item.rate.checkedOn}. ${item.rate.source??''}`:'; price unavailable.'}`).join('\n');
  return `\n\nSESSION COST (USD)\n${costAmount(cost)}${cost.status==='partial'?' — known portion only':cost.status==='estimated'?' estimated':''}\n${costCoverage(cost)}\n${rates}\nAn estimate, not an account bill. Unreported cache usage uses the regular input rate. Rates may change.${cost.pricingStale?' Stored rates are over 30 days old and need review.':''}`;
}
// COST_HELPERS_END
function readHistory(storage){
  const raw=storage.getItem(HISTORY_KEY);if(raw===null)return [];
  const entries=JSON.parse(raw);
  if(!Array.isArray(entries)||entries.some(x=>!x||typeof x.id!=='string'||typeof x.name!=='string'||!Array.isArray(x.turns)||x.turns.some(t=>typeof t.question!=='string'||typeof t.reply!=='string')))throw new Error('Saved history could not be read. Existing data has not been overwritten.');
  return entries;
}
function saveHistory(storage,current,now=new Date().toISOString()){
  if(!current?.turns?.length)return null;
  const first=current.turns[0];
  const id=`${current.brief.hash}:${first.requestId}`;
  const entries=readHistory(storage),previous=entries.find(x=>x.id===id);
  const record={id,name:current.brief.name,lifeStage:current.brief.lifeStage,speaker:current.brief.speaker,mode:current.brief.mode,difficulty:current.brief.difficulty??'standard',hash:current.brief.hash,ended:!!current.ended,
    turns:current.turns.map(t=>({id:t.id,question:t.question,reply:t.reply,kind:t.kind,...(typeof t.interaction==='string'?{interaction:t.interaction}:{}),...caseNoteFields(t)})),
    ...(current.guideWork?{guideWork:archiveGuide(current.guideWork)}:{}),
    ...(current.ended&&current.feedback?{feedback:archiveFeedback(current.feedback)}:{}),
    ...(current.usage?.session?.cost?{cost:costSnapshot(current.usage.session.cost)}:{})};
  if(previous&&JSON.stringify({...previous,createdAt:undefined,updatedAt:undefined})===JSON.stringify(record))return previous;
  if(!previous&&entries.length>=50)throw new Error('History is full (50 conversations). Download and delete an old conversation to save this one.');
  const saved={...record,createdAt:previous?.createdAt??now,updatedAt:now};
  storage.setItem(HISTORY_KEY,JSON.stringify([saved,...entries.filter(x=>x.id!==id)]));return saved;
}
function deleteHistory(storage,id){storage.setItem(HISTORY_KEY,JSON.stringify(readHistory(storage).filter(x=>x.id!==id)));}
// HISTORY_STORE_END
function saveConversation(){
  try{const saved=saveHistory(localStorage,session);$('saveStatus').textContent=saved?'Conversation saved on this browser.':'Ask a question first to save a conversation.';return !!saved;}
  catch(e){$('saveStatus').textContent=`Conversation not saved: ${e.message} You can still download the active conversation.`;return false;}
}
function conversationText(record){return `${record.name}${record.lifeStage?` · ${record.lifeStage}`:''} · ${record.mode}\nDifficulty: ${record.difficulty??'standard'}\nSaved conversation${costText(record.cost)}\n\n${record.turns.map(t=>`You: ${t.question}\n${t.kind==='answer'?(record.speaker??record.name):'Simulation boundary'}: ${t.reply}${caseNoteText(t)}`).join('\n\n')}${guideWorkText(record.guideWork)}${feedbackText(record.feedback)}`;}
function downloadConversation(record){const url=URL.createObjectURL(new Blob([conversationText(record)],{type:'text/plain;charset=utf-8'}));const a=el('a','');a.href=url;a.download='psychlab-conversation.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function appendCaseNote(parent,turn){
  const note=caseNoteFields(turn).exerciseNote;if(!note)return;
  const box=el('aside','');box.className='case-note';box.setAttribute('aria-label','Case note');
  box.append(el('strong','Case note'),el('p',note));parent.append(box);
}
function conversationExchange(turn,speaker){
  const row=el('div','');row.className='exchange';const response=el('p',turn.reply);response.className='reply';
  row.append(el('strong',`${turn.id} · LEARNER`),el('p',turn.question),el('strong',turn.kind==='answer'?speaker:'SIMULATION BOUNDARY'),response);
  appendCaseNote(row,turn);return row;
}
function savedTranscript(record){
  const transcript=el('div','');transcript.className='saved-transcript';
  if(!record.turns.some(t=>caseNoteFields(t).exerciseNote)){transcript.textContent=conversationText(record);return transcript;}
  transcript.append(el('div',conversationText({...record,turns:[],guideWork:null,feedback:null})));
  for(const turn of record.turns)transcript.append(conversationExchange(turn,record.speaker??record.name));
  transcript.append(el('div',`${guideWorkText(record.guideWork)}${feedbackText(record.feedback)}`));return transcript;
}
function showHistory(){
  $('historyList').replaceChildren();$('historyDetail').hidden=true;
  try{
    const records=readHistory(localStorage);$('historyNotice').textContent=records.length?`${records.length} saved conversation${records.length===1?'':'s'}`:'No saved conversations yet. Your first answered question will be saved automatically.';
    for(const record of records){
      const row=el('div','');row.className='history-row';
      const open=el('button',`${record.name} · ${new Date(record.updatedAt).toLocaleString()} · ${record.turns.length} exchanges`);open.className='secondary';
      open.onclick=()=>{const detail=$('historyDetail');detail.replaceChildren(el('h3',`${record.name} · saved conversation`));detail.hidden=false;detail.append(savedTranscript(record));};
      const download=el('button','Download');download.className='secondary';download.onclick=()=>downloadConversation(record);
      const remove=el('button','Delete');remove.className='secondary';remove.onclick=()=>{try{deleteHistory(localStorage,record.id);showHistory();}catch(e){$('historyNotice').textContent=`Could not delete: ${e.message}`;}};
      row.append(open,download,remove);$('historyList').append(row);
    }
  }catch(e){$('historyNotice').textContent=`History unavailable: ${e.message}`;}
}
function error(e){$('error').textContent=e.message;$('error').hidden=false;}
async function api(path,method='GET',body){
  if(typeof path!=='string'||!/^\/api\/[a-z]+(?:\/[a-z]+)*$/.test(path))throw new Error('Invalid application endpoint.');
  let res;try{res=await fetch(path,{method,mode:'same-origin',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/json','X-PsychLab':'1'},...(body?{body:JSON.stringify(body)}:{})});}catch{throw new Error('Connection interrupted. Your entries are still here. Check the connection and try again.');}
  const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'Request failed.'),{status:res.status});return data;
}
function controls(){
  const canReview=status?.permissions?.review===true;
  $('reviewerPanel').hidden=!canReview;$('review').disabled=!canReview||!session?.ended;
  if(!canReview)$('trace').textContent='';
  $('saveConversation').disabled=!session?.turns?.length||sending;
  $('downloadConversation').disabled=!session?.turns?.length;
  const locked=!session||session.ended||session.paused||session.busy||sending||guideSaving;
  const budgetBlocked=session?.usage&&[session.usage.session,session.usage.process].some(x=>x.limit-x.attemptedCalls<3);
  $('send').disabled=locked||!status?.providerReady||budgetBlocked;$('sync').disabled=sending||guideSaving;$('question').disabled=sending||guideSaving||!!session?.ended||!!session?.paused;
  document.querySelectorAll('#assessmentForm button,#finishForm button').forEach(x=>x.disabled=locked);
  for(const id of ['guideSave','guideCheck'])$(id).disabled=!session||session.ended||sending||session.busy||guideSaving;
  document.querySelectorAll('#guideQuestions button').forEach(x=>x.disabled=locked);
}
function drawCost(usage){
  let card=$('costStatus');
  if(!card){card=el('div','');card.id='costStatus';card.className='cost-card';card.setAttribute('aria-label','Estimated AI cost');$('usageStatus').before(card);}
  card.replaceChildren();
  const cost=usage?.session?.cost,processCost=usage?.process?.cost;
  const label=el('p','Estimated interview cost'),amount=el('strong',costAmount(cost)),coverage=el('p',costCoverage(cost));
  label.className='cost-label';amount.className='cost-amount';coverage.className='small';
  card.append(label,amount,coverage);
  const detail=el('details','');detail.append(el('summary','Cost details'));
  detail.append(el('p',`Since server start: ${costAmount(processCost)}${processCost?.status==='partial'?' (incomplete estimate)':''}. This includes other interviews on this server.`));
  detail.append(el('p','USD estimate, not your bill or account balance. Input and output tokens have separate rates. Unreported cache usage uses the regular input rate.'));
  if(cost?.pricingCheckedOn)detail.append(el('p',`Rates checked ${cost.pricingCheckedOn}.${cost.pricingStale?' These rates are over 30 days old; review current prices.':' Published rates may change.'}`));
  for(const row of cost?.models??[]){if(!row.rate?.source)continue;detail.append(guideLink(`${row.model} pricing`,row.rate.source));}
  card.append(detail);
}
function draw(){
  if(session)screen='interview';
  $('setup').hidden=screen!=='setup';$('disorderSelection').hidden=screen!=='selection';$('preparationPanel').hidden=screen!=='preparing';$('workspace').hidden=!session;
  if(!session){controls();return;}
  if(session.turns.length)saveConversation();else $('saveStatus').textContent='Conversations save automatically after each response.';
  const b=session.brief;$('clientName').textContent=`${b.name} · ${b.lifeStage}`;$('referral').textContent=b.referral;$('caseNotice').textContent=b.notice;
  $('interviewSelection').textContent=selectionLabel(publicSelection(b.selection));$('interviewSelection').hidden=!b.selection;
  $('interviewDifficulty').textContent=`${b.difficultyLabel??'Standard'} difficulty · ${b.difficultyDescription??'Natural conversation with focused follow-ups.'}`;
  $('send').textContent=b.interviewPerspective==='caregiver'?'Ask caregiver':'Ask patient';
  $('frozen').textContent=`Frozen ${b.mode==='generated'?`${b.historyDays}-day history`:'authored case'} · ${b.hash.slice(0,12)}`;
  $('sessionStatus').textContent=session.ended?'Interview ended':session.paused?'Exercise paused':session.busy?'Processing a question…':!status?.providerReady?'History prepared · waiting for AI setup':'Ready for interview';
  const u=session.usage;
  drawCost(u);
  $('usageStatus').textContent=u?`Economy mode · ${u.session.attemptedCalls}/${u.session.limit} API calls this interview · ${u.process.attemptedCalls}/${u.process.limit} since server start · ${u.session.reportedTokens.toLocaleString()} reported tokens${u.session.unreportedCalls?` (${u.session.unreportedCalls} calls with unknown usage)`:''}. A checked answer uses up to 3 calls. Preparing history uses none.`:'';
  $('conversation').replaceChildren();
  if(!session.turns.length)$('conversation').append(el('p','Ask what brings the client here today.'));
  for(const t of session.turns)$('conversation').append(conversationExchange(t,b.speaker??b.name));
  $('assessmentForm').hidden=!b.assessmentAvailable;
  $('assessmentNotice').textContent=b.assessmentAvailable?'Alex has fixed authored GAD-7 responses. Explain your rationale before revealing them.':'This generated history has no authored GAD-7 responses. Model state is not a screening score.';
  $('assessmentResult').replaceChildren();
  if(session.assessment){const a=session.assessment;$('assessmentResult').append(el('h3',`${a.total}/21 · ${a.band} anxiety symptoms`),el('p','Fictional authored responses, not a diagnosis.'),el('p',a.instruction));a.items.forEach((item,i)=>$('assessmentResult').append(el('p',`${i+1}. ${item}: ${a.labels[a.values[i]]} (${a.values[i]})`)));$('assessmentResult').append(el('p',`Functional difficulty: ${a.difficulty} (not included in total).`),el('p',a.attribution));}
  $('assessmentPanel').hidden=!b.assessmentAvailable;
  $('reportPanel').hidden=!session.ended;drawGuide();controls();
}
function reportText(r){const answer=r.caseAnswer?`\n\nCASE REVEAL\n${r.caseAnswer.name}\n${r.caseAnswer.description}\n${r.caseAnswer.classification||''}\n${Array.isArray(r.caseAnswer.notes)?r.caseAnswer.notes.join('\n'):r.caseAnswer.notes||''}`:'';return `${r.title}\n${r.brief.name} | ${r.brief.version}\nFrozen snapshot: ${r.brief.hash}\nDifficulty: ${r.brief.difficultyLabel??'Standard'}\nModel: ${r.model}${costText(r.usage?.session?.cost)}${feedbackText(r.feedback)}${answer}\n\nLEARNER REASONING\n${Object.entries(r.reasoning).map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nDISCLOSED EVIDENCE\n${r.evidence.map(t=>`${t.turnId} [${t.kind}]\nQuestion: ${t.question}\nResponse: ${t.quote}${caseNoteText(t)}`).join('\n\n')}\n\nASSESSMENT\n${r.assessment?`${r.assessment.total}/21, ${r.assessment.band}. Fictional authored responses; not a diagnosis.`:'Not administered; no score disclosed.'}\n\nRATINGS\n${r.ratings.map(x=>`${x.domain}: ${x.rating}`).join('\n')}\n\nLIMITATIONS\n${r.limitations.join('\n')}\n${guideWorkText(r.guideWork)}`;}
function feedbackText(feedback){
  if(!feedback)return '';
  return `\n\nYOUR INTERVIEW REVIEW\n${feedback.perspective}\n\nQUESTIONS THAT OPENED NEW AREAS\n${feedback.usefulQuestions.map(x=>`${x.turnId} · ${x.question}\nResponse: ${x.reply}\nSources: ${x.sources.map(s=>`${s.id} — ${s.label}`).join('; ')}\nRelated checkpoints: ${x.checkpointLeads.map(c=>c.label).join('; ')||'Personal context; no clinical checkpoint inferred.'}`).join('\n\n')||'No new source material identified.'}\n\nWHAT REMAINS UNKNOWN\n${feedback.unknowns.map(x=>`${x.label}: ${x.reason}\nFollow-up: ${x.question}\n${x.nextStep}`).join('\n\n')||'Each checkpoint has some mapped material; unanswered parts still need review.'}\n\nEVIDENCE GAPS\n${feedback.evidenceGaps.map(x=>`${x.label}${x.turnId?` (${x.turnId})`:''}: ${x.issue}\n${x.nextStep}`).join('\n\n')||'No checklist link issues found. Interpretation has not been graded.'}\n\nYOUR CONCLUSION\n${feedback.conclusionReview.statement}\nTraceable factual turns: ${feedback.conclusionReview.supportingTurnIds.join(', ')||'None referenced'}\n${feedback.conclusionReview.gaps.join('\n')}\n${feedback.conclusionReview.status}\n\nHOW TO READ THIS FEEDBACK\n${feedback.limitations.join('\n')}\n`;
}
function drawReport(){
  const box=$('report');box.replaceChildren();if(!report)return;
  if(!report.feedback){box.textContent=reportText(report);return;}
  const f=report.feedback,review=el('div','');review.className='debrief-review';
  review.append(el('h3','Your interview review'),el('p',f.perspective),el('p','See what your questions brought into the conversation, then use the gaps to plan your next interview.'));
  const useful=el('section','');useful.append(el('h3','Questions that opened new areas'));
  for(const item of f.usefulQuestions){const card=el('article','');card.className='debrief-question';card.append(el('strong',`${item.turnId} · ${item.question}`),el('blockquote',item.reply));appendCaseNote(card,report.evidence?.find(t=>t.turnId===item.turnId)??{});card.append(el('p',item.checkpointLeads.length?`Related prompts: ${item.checkpointLeads.map(x=>x.label).join('; ')}`:'Personal context; no clinical checkpoint inferred.'));const source=el('p',`${item.sources.map(x=>`${x.id} · ${x.label}`).join('; ')}. ${item.interpretation}`);source.className='small';card.append(source);useful.append(card);}
  review.append(useful);
  const gaps=el('section','');gaps.append(el('h3','Evidence gaps in your notes'));
  if(!f.evidenceGaps.length)gaps.append(el('p','No checklist link issues found. Your interpretation has not been graded.'));
  for(const item of f.evidenceGaps){const card=el('div','');card.className='debrief-gap';card.append(el('strong',`${item.label}${item.turnId?` · ${item.turnId}`:''}`),el('p',item.issue),el('p',item.nextStep));gaps.append(card);}
  review.append(gaps);
  const unknown=el('details','');unknown.className='debrief-unknowns';unknown.open=true;unknown.append(el('summary',`What remains unknown · ${f.unknowns.length} areas`));
  for(const item of f.unknowns){const card=el('div','');card.className='debrief-gap';card.append(el('strong',item.label),el('p',item.reason),el('blockquote',item.question));const next=el('p',item.nextStep);next.className='small';card.append(next);unknown.append(card);}
  if(!f.unknowns.length)unknown.append(el('p','Each checkpoint has some mapped material. This does not establish every part of a checkpoint or diagnostic requirement.'));
  review.append(unknown);
  const conclusion=el('section','');conclusion.append(el('h3','Review your conclusion'),el('blockquote',f.conclusionReview.statement),el('p',`Traceable factual turns: ${f.conclusionReview.supportingTurnIds.join(', ')||'None referenced'}`));const list=el('ul','');f.conclusionReview.gaps.forEach(x=>list.append(el('li',x)));conclusion.append(list,el('p',f.conclusionReview.status));review.append(conclusion);
  const limits=el('details','');limits.append(el('summary','How this feedback works'));f.limitations.forEach(x=>limits.append(el('p',x)));review.append(limits);box.append(review);
  const full=el('details','');full.append(el('summary','Full debrief, teaching case and transcript'));const text=el('div',reportText({...report,feedback:null}));text.className='debrief-full';full.append(text);box.append(full);
}
async function loadReport(){report=await api('/api/report');if(report.guideWork)session.guideWork=report.guideWork;session.feedback=report.feedback;drawReport();drawGuide();saveConversation();}

function guideWorkText(work){
  if(!work)return '';
  const state=work.state;
  return `\n\nINTERVIEW NOTES · ${work.title}\n${work.checklist.map(item=>{const e=state.items[item.id];return `${item.label}: ${e?.status??'unasked'}${e?.turnId?` (${e.turnId})`:''}${e?.note?` — ${e.note}`:''}`;}).join('\n')}\nProvisional impression: ${work.review.hypothesis}\nAlternatives: ${state.alternatives||'Not recorded'}\nNext step: ${state.nextStep||'Not recorded'}\n${work.review.summary}\n${work.review.gaps.join('\n')}\n${work.review.comparison?`${work.review.comparison.message}\nTeaching case: ${work.review.comparison.target}\n`:''}${work.review.limitation}\n`;
}
function guideChanged(){
  guideDirty=true;guideDraft.reviewed=false;
  $('guideSaveStatus').textContent='Unsaved notes';$('guideSaveStatus').classList.toggle('guide-dirty',true);
  $('guideFeedback').hidden=true;
}
function switchGuideTab(name,focus=false){
  guideTab=name;
  for(const tab of ['Checklist','Questions','Diagnosis']){
    const selected=tab===name,button=$(`guide${tab}Tab`);
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    $(`guide${tab}Panel`).hidden=!selected;
    if(selected&&focus)button.focus();
  }
}
for(const name of ['Checklist','Questions','Diagnosis']){
  $(`guide${name}Tab`).onclick=()=>switchGuideTab(name);
  $(`guide${name}Tab`).onkeydown=e=>{const names=['Checklist','Questions','Diagnosis'],i=names.indexOf(name);if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();switchGuideTab(e.key==='Home'?names[0]:e.key==='End'?names[2]:names[(i+(e.key==='ArrowRight'?1:2))%3],true);}};
}
function safeExternalUrl(value){
  if(typeof value!=='string'||!/^https:\/\//i.test(value)||/[\u0000-\u0020\u007f\\]/.test(value))return null;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
function guideLink(title,url){const href=safeExternalUrl(url);if(!href)return el('span',title);const a=el('a',title);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a;}
// Legacy answers without interaction metadata remain available as evidence.
function isEvidenceTurn(turn){return turn.kind==='answer'&&!['social','unavailable'].includes(turn.interaction);}
function drawGuideFeedback(){
  const review=session?.guideWork?.review;
  $('guideFeedback').hidden=!review||(!session.ended&&(!guideDraft?.reviewed||guideDirty));
  if($('guideFeedback').hidden)return;
  const box=$('guideFeedback');box.replaceChildren(el('h3',review.summary),el('p',`Provisional impression: ${review.hypothesis}`));
  const lines=[...review.gaps,...(review.unasked.length?[`Not explored: ${review.unasked.join('; ')}`]:[]),...(review.unclear.length?[`Needs clarification: ${review.unclear.join('; ')}`]:[]),...(review.unlinked.length?[`Evidence links needed: ${review.unlinked.join('; ')}`]:[]),...(review.counterEvidence.length?[`Checkpoints marked not supported (some features are optional, so absence alone does not rule out the condition): ${review.counterEvidence.join('; ')}`]:[])];
  if(lines.length){const list=el('ul','');lines.forEach(x=>list.append(el('li',x)));box.append(list);}
  if(review.comparison)box.append(el('h3',`Teaching case: ${review.comparison.target}`),el('p',review.comparison.message));
  box.append(el('p',review.limitation));
}
function drawGuide(){
  const guide=session?.guide;$('interviewGuide').hidden=!guide;if(!guide)return;
  if(guideHash!==session.brief.hash){guideHash=session.brief.hash;guideDraft=JSON.parse(JSON.stringify(session.guideWork.state));guideDirty=false;guideTab='Checklist';}
  else if(!guideDirty)guideDraft=JSON.parse(JSON.stringify(session.guideWork.state));
  if(session.ended){guideDraft=JSON.parse(JSON.stringify(session.guideWork.state));guideDirty=false;}
  $('guideTitle').textContent=guide.name;$('guidePerspective').textContent=guide.perspective;
  $('guideAgeNote').textContent=guide.ageNote;$('guideCourse').textContent=guide.course;
  $('guideChecklist').replaceChildren();$('guideQuestions').replaceChildren();
  const evidenceTurns=session.turns.filter(isEvidenceTurn);
  for(const item of guide.checklist){
    const entry=guideDraft.items[item.id]??={status:'unasked',turnId:'',note:''};
    const row=el('details',''),summary=el('summary',item.label),badge=el('span','Not asked');row.append(summary);summary.append(badge);
    const fields=el('div','');fields.className='guide-evidence-grid';
    const stateBox=el('div',''),label=el('label','Your observation'),choice=el('select','');choice.id=`guide-state-${item.id}`;label.htmlFor=choice.id;
    const labels={unasked:'Not asked',supported:'Supported',absent:'Not supported',uncertain:'Unclear'};
    for(const [value,text] of Object.entries(labels)){const option=el('option',text);option.value=value;choice.append(option);}
    choice.value=entry.status;badge.textContent=labels[entry.status];choice.disabled=!!session.ended||guideSaving;
    choice.onchange=()=>{entry.status=choice.value;badge.textContent=labels[entry.status];guideChanged();};stateBox.append(label,choice);
    const turnBox=el('div',''),turnLabel=el('label','Interview evidence'),turnChoice=el('select','');turnChoice.id=`guide-turn-${item.id}`;turnLabel.htmlFor=turnChoice.id;
    const empty=el('option','Choose an answered turn');empty.value='';turnChoice.append(empty);
    for(const turn of evidenceTurns){const option=el('option',`${turn.id} · ${turn.question.slice(0,90)}`);option.value=turn.id;turnChoice.append(option);}
    turnChoice.value=entry.turnId;turnChoice.disabled=!!session.ended||guideSaving;
    const quote=el('p','');quote.className='small';const showQuote=()=>{quote.textContent=evidenceTurns.find(t=>t.id===turnChoice.value)?.reply??'';};showQuote();
    turnChoice.onchange=()=>{entry.turnId=turnChoice.value;showQuote();guideChanged();};turnBox.append(turnLabel,turnChoice);fields.append(stateBox,turnBox);
    const noteLabel=el('label','Why this evidence matters'),note=el('textarea','');note.id=`guide-note-${item.id}`;noteLabel.htmlFor=note.id;note.rows=2;note.maxLength=1000;note.value=entry.note;note.disabled=!!session.ended||guideSaving;note.oninput=()=>{entry.note=note.value;guideChanged();};
    row.append(fields,quote,noteLabel,note);$('guideChecklist').append(row);
    const question=el('div','');question.className='guide-question';const copy=el('button','Use question');copy.className='secondary';copy.type='button';copy.disabled=!!session.ended||sending||!!session.paused;
    copy.onclick=()=>{$('question').value=item.question;$('question').focus();$('questionForm').scrollIntoView({behavior:'smooth',block:'center'});$('answerStatus').textContent='Question copied. Edit it if needed, then send when ready.';};question.append(el('p',item.question),copy);$('guideQuestions').append(question);
  }
  $('guideHypothesis').replaceChildren(...guide.hypothesisOptions.map(x=>{const o=el('option',x.name);o.value=x.id;return o;}));
  $('guideHypothesis').value=guideDraft.hypothesisId;
  for(const [id,key] of [['guideHypothesis','hypothesisId'],['guideAlternatives','alternatives'],['guideNext','nextStep']]){const node=$(id);node.value=guideDraft[key];node.disabled=!!session.ended||guideSaving;node.oninput=()=>{guideDraft[key]=node.value;guideChanged();};node.onchange=node.oninput;}
  const a=guide.test;$('guideAssessment').replaceChildren(guideLink(a.name,a.url),el('p',a.purpose),el('p',a.interpretation));
  $('guideDifferentials').replaceChildren(...guide.differentials.map(x=>el('li',x)));$('guideCautions').textContent=guide.cautions;
  $('guideSources').replaceChildren(...guide.sources.map(x=>{const li=el('li','');li.append(guideLink(x.title,x.url));return li;}));
  $('guideSaveStatus').textContent=session.ended?'Notes included in the debrief.':guideDirty?'Unsaved notes':'Notes are saved with this session when you press Save or Check.';
  switchGuideTab(guideTab);drawGuideFeedback();
}
async function persistGuide(reviewed){
  if(!session?.guide)return true;
  if(guideSaving)return false;
  const captured=epoch,body={expectedHash:session.brief.hash,state:JSON.parse(JSON.stringify({...guideDraft,reviewed:reviewed||guideDraft.reviewed}))};
  guideSaving=true;controls();
  // Freeze editing for this short local save so later typing cannot be marked saved accidentally.
  const fields=document.querySelectorAll('#interviewGuide input,#interviewGuide select,#interviewGuide textarea');fields.forEach(x=>x.disabled=true);
  try{
    const result=await api('/api/guide','POST',body);if(epoch!==captured)return false;
    session.guideWork=result.guideWork;guideDraft=JSON.parse(JSON.stringify(result.guideWork.state));guideDirty=false;
    if(session.turns.length)saveConversation();drawGuide();
    $('guideSaveStatus').textContent='Saved. No AI calls used.';$('guideSaveStatus').classList.toggle('guide-dirty',false);return true;
  }catch(e){if(epoch===captured){$('guideSaveStatus').textContent=`Notes not saved: ${e.message}`;$('guideSaveStatus').classList.toggle('guide-dirty',true);}return false;}
  finally{guideSaving=false;document.querySelectorAll('#interviewGuide input,#interviewGuide select,#interviewGuide textarea').forEach(x=>x.disabled=!!session?.ended);controls();}
}
$('guideSave').onclick=()=>persistGuide(false);
$('guideCheck').onclick=()=>persistGuide(true);

function selectedPatient(){return status.patients.find(p=>p.id===$('mode').value);}
function validForm(id){const form=$(id);return typeof form.reportValidity!=='function'||form.reportValidity();}
function validateSetup(){
  const patient=selectedPatient();if(!patient)throw new Error('Choose an available patient.');
  if(!selectedDifficulty())throw new Error('Choose an available interview difficulty.');
  if(patient.mode!=='baseline'){
    const days=$('days').value,seed=$('seed').value;
    if(!/^\d+$/.test(days)||!Number.isSafeInteger(Number(days))||Number(days)<1||Number(days)>90)throw new Error('Choose a whole number of days from 1 to 90.');
    if(!/^\d+$/.test(seed)||!Number.isSafeInteger(Number(seed))||Number(seed)>4294967295)throw new Error('Choose a whole number seed from 0 to 4294967295.');
  }
  return patient;
}
function availableDisorders(){return eligibleDisorders(status.disorders||[],selectedPatient());}
function selectedDifficulty(){return (status?.difficulties??[{id:'beginner',name:'Beginner',description:'Clear explanations with more relevant detail offered up front.'},{id:'standard',name:'Standard',description:'Natural conversation; follow-up questions bring out more detail.'},{id:'challenging',name:'Challenging',description:'Brief replies; focused follow-ups uncover the same underlying history.'}]).find(d=>d.id===$('difficulty').value);}
function patientContext(){const p=selectedPatient();return `${p.name} · ${p.lifeStage} · ${p.mode==='baseline'?'Authored history':`${$('days').value} simulated days · Seed ${$('seed').value}`} · ${selectedDifficulty()?.name??'Standard'}`;}
function drawSelection(){
  const disorders=availableDisorders(),chosen=selectionMode==='chosen';
  disorderIndex=disorders.length?((disorderIndex%disorders.length)+disorders.length)%disorders.length:0;
  const disorder=disorders[disorderIndex];
  $('selectionContext').textContent=patientContext();
  $('previousDisorder').hidden=!chosen;$('nextDisorder').hidden=!chosen;
  $('previousDisorder').disabled=disorders.length<2;$('nextDisorder').disabled=disorders.length<2;
  $('carouselHelp').hidden=!chosen||disorders.length<2;
  $('disorderCarousel').classList.toggle('mystery',selectionMode==='random');
  $('disorderCarousel').classList.toggle('no-disorder',selectionMode==='none');
  $('disorderClassification').textContent=chosen?(disorder?.classification||'No available cases'):selectionMode==='random'?'A CASE TO DISCOVER':'EVERYDAY EXPERIENCES';
  $('disorderName').textContent=chosen?(disorder?.name||'No disorders for this life stage'):selectionMode==='random'?'Mystery case':'No disorder';
  $('disorderDescription').textContent=chosen?(disorder?.description||'Choose another patient or prepare an interview with no disorder.'):selectionMode==='random'?'A suitable case will be selected privately. Explore the patient’s experiences and form your own impression. The answer is revealed after you finish.':'Prepare a patient’s everyday experiences without an assigned mental disorder. Explore their routines, personality, relationships, and recent life events.';
  $('disorderPosition').textContent=chosen&&disorders.length?`${disorderIndex+1} of ${disorders.length}`:'';
  $('disorderSearch').hidden=!chosen;
  closeOptions();
  $('caseCount').textContent=`${disorders.length} ${disorders.length===1?'option':'options'} for this life stage`;
  $('caseModeNote').hidden=chosen;
  $('caseModeNote').textContent=selectionMode==='random'?'The selected disorder stays hidden during the interview.':'No disorder will be assigned.';
  $('selectionNote').textContent=selectionMode==='none'?'Personality and daily experiences still shape this case.':selectionMode==='random'?'The seed repeats daily events for the same case. Choosing Random again can give you a different disorder. Earlier background is included when the case needs a longer course.':'The selected days form the recent history. Earlier background is included when the case needs a longer course.';
  $('beginPreparation').disabled=(chosen||selectionMode==='random')&&!disorders.length;
  $('beginPreparation').textContent=selectionMode==='random'?'Prepare mystery interview →':selectionMode==='none'?'Prepare interview →':'Prepare this interview →';
}
function drawOptions(){
  const query=$('optionsSearch').value.trim().toLocaleLowerCase();
  const disorders=availableDisorders();
  $('optionsList').replaceChildren();
  let count=0;
  disorders.forEach((disorder,index)=>{
    if(!disorder.name.toLocaleLowerCase().includes(query))return;
    count++;
    const button=el('button',disorder.name);button.type='button';button.className='secondary disorder-option';
    button.setAttribute('aria-pressed',String(index===disorderIndex));
    button.onclick=()=>{disorderIndex=index;drawSelection();$('optionsSearch').value='';$('disorderCarousel').focus();};
    $('optionsList').append(button);
  });
  $('optionsCount').textContent=count?`${count} of ${disorders.length} options · Select one to view its card.`:'No matching options. Try another name.';
}
function closeOptions(){
  $('optionsResults').hidden=true;
  $('optionsSearch').setAttribute('aria-expanded','false');$('caseCount').setAttribute('aria-expanded','false');
}
function openOptions(){
  if(screen!=='selection'||selectionMode!=='chosen')return;
  drawOptions();$('optionsResults').hidden=false;
  $('optionsSearch').setAttribute('aria-expanded','true');$('caseCount').setAttribute('aria-expanded','true');
}
$('caseCount').onclick=()=>{$('optionsSearch').value='';openOptions();$('optionsSearch').focus();};
$('optionsSearch').onfocus=openOptions;
$('optionsSearch').oninput=openOptions;
$('optionsClose').onclick=()=>{closeOptions();$('caseCount').focus();};
$('disorderSearch').onkeydown=e=>{if(e.key==='Escape'){closeOptions();$('caseCount').focus();}};
function moveDisorder(direction){if(screen!=='selection'||selectionMode!=='chosen')return;disorderIndex+=direction;drawSelection();}
function stopPreparationPolling(){preparationEpoch++;clearTimeout(preparationTimer);preparationTimer=null;}
function restorePreparationChoices(configuration){
  if(!configuration||!status.patients.some(p=>p.id===configuration.patientId))return false;
  $('mode').value=configuration.patientId;$('mode').onchange();
  if(Number.isInteger(configuration.days))$('days').value=String(configuration.days);
  if(Number.isInteger(configuration.seed))$('seed').value=String(configuration.seed);
  $('difficulty').value=configuration.difficulty??'standard';$('difficulty').onchange();
  selectionMode=['chosen','random','none'].includes(configuration.selection?.mode)?configuration.selection.mode:'none';
  if(selectionMode==='chosen')disorderIndex=Math.max(0,availableDisorders().findIndex(d=>d.id===configuration.selection.disorderId));
  document.querySelectorAll('input[name="selectionMode"]').forEach(input=>input.checked=input.value===selectionMode);
  drawSelection();$('preparationContext').textContent=`${patientContext()} · ${selectionMode==='chosen'?availableDisorders()[disorderIndex]?.name||'Selected case':selectionMode==='random'?'Mystery case':'No disorder'}`;
  return true;
}
function showPreparationProblem(message,retry=false){
  $('preparationSpinner').hidden=true;$('preparationProgress').hidden=true;$('preparationError').hidden=false;$('preparationError').textContent=message;
  $('retryPreparation').hidden=!retry;$('resumePreparation').hidden=retry;$('cancelPreparation').disabled=false;
}
function renderPreparation(preparation){
  const phases=['identity','premise','simulation','freeze'],index=phases.indexOf(preparation.phase);
  $('preparationMessage').textContent=preparation.message||'Preparing the case…';
  $('preparationSpinner').hidden=preparation.status!=='running';
  document.querySelectorAll('.preparation-steps li').forEach((step,i)=>{step.classList.toggle('complete',i<index||preparation.status==='ready');step.classList.toggle('active',i===index&&preparation.status==='running');if(i===index&&preparation.status==='running')step.setAttribute('aria-current','step');else step.removeAttribute('aria-current');});
  const hasDays=preparation.phase==='simulation'&&Number.isInteger(preparation.totalDays)&&preparation.totalDays>0;
  $('preparationProgress').hidden=!hasDays;$('preparationDays').textContent=hasDays?`${preparation.completedDays??0} of ${preparation.totalDays} recent days simulated`:'';
  if(hasDays){$('preparationProgress').max=preparation.totalDays;$('preparationProgress').value=preparation.completedDays??0;}
  if(preparation.status==='failed')showPreparationProblem(preparation.error||'The history could not be prepared. You can retry with the same choices.',true);
}
function acceptPreparedSession(ready){
  stopPreparationPolling();session=ready;epoch++;pending=null;report=null;sending=false;screen='interview';
  guideHash=null;guideDraft=null;guideDirty=false;
  for(const id of ['questionForm','assessmentForm','finishForm'])$(id).reset();
  $('trace').textContent='';$('report').textContent='';$('answerStatus').textContent='';$('error').hidden=true;draw();$('question').focus();
}
async function pollPreparation(ticket){
  if(ticket!==preparationEpoch||screen!=='preparing')return;
  try{
    const result=await api('/api/preparation');if(ticket!==preparationEpoch||screen!=='preparing')return;
    renderPreparation(result.preparation);
    if(result.preparation.status==='ready'){if(!result.session)throw new Error('The prepared interview could not be loaded. Check preparation to try again.');acceptPreparedSession(result.session);return;}
    if(result.preparation.status==='running')preparationTimer=setTimeout(()=>pollPreparation(ticket),300);
  }catch(e){if(ticket===preparationEpoch&&screen==='preparing')showPreparationProblem(e.status===401||e.status===404?'Preparation is no longer available. Return to your choices and prepare it again.':`${e.message} Check preparation to reconnect without creating another case.`);}
}
async function beginPreparation(){
  if(preparationBusy)return;
  preparationBusy=true;stopPreparationPolling();const ticket=preparationEpoch;
  try{
    const p=validateSetup();
    preparationRequest={requestId:crypto.randomUUID(),mode:p.mode,patientId:p.id,seed:Number($('seed').value),days:Number($('days').value),difficulty:$('difficulty').value,selection:selectionPayload(selectionMode,availableDisorders()[disorderIndex])};
    screen='preparing';session=null;draw();$('preparationContext').textContent=`${patientContext()} · ${selectionMode==='chosen'?availableDisorders()[disorderIndex].name:selectionMode==='random'?'Mystery case':'No disorder'}`;
    $('preparationTitle').focus();$('preparationError').hidden=true;$('retryPreparation').hidden=true;$('resumePreparation').hidden=true;$('error').hidden=true;$('cancelPreparation').disabled=true;
    renderPreparation({status:'running',phase:'identity',message:'Starting preparation…'});
    const result=await api('/api/prepare','POST',preparationRequest);if(ticket!==preparationEpoch)return;
    preparationBusy=false;$('cancelPreparation').disabled=false;renderPreparation(result.preparation);
    if(result.preparation.status==='ready'&&result.session)acceptPreparedSession(result.session);
    else if(result.preparation.status==='running')await pollPreparation(ticket);
  }catch(e){if(ticket===preparationEpoch){if(screen==='preparing')showPreparationProblem(e.message,!!e.status&&e.status!==409);else error(e);}}
  finally{if(ticket===preparationEpoch)preparationBusy=false;}
}
$('previousDisorder').onclick=()=>moveDisorder(-1);$('nextDisorder').onclick=()=>moveDisorder(1);
$('disorderCarousel').onkeydown=e=>{if(selectionMode!=='chosen')return;const direction=['ArrowRight','ArrowDown'].includes(e.key)?1:['ArrowLeft','ArrowUp'].includes(e.key)?-1:0;if(direction){e.preventDefault();moveDisorder(direction);}else if(e.key==='Home'||e.key==='End'){e.preventDefault();disorderIndex=e.key==='Home'?0:availableDisorders().length-1;drawSelection();}};
let lastWheelTime=0;
$('disorderCarousel').addEventListener('wheel',e=>{if(screen!=='selection'||selectionMode!=='chosen'||availableDisorders().length<2)return;const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!delta)return;e.preventDefault();if(performance.now()-lastWheelTime<220)return;lastWheelTime=performance.now();moveDisorder(delta>0?1:-1);},{passive:false});
document.querySelectorAll('input[name="selectionMode"]').forEach(input=>input.onchange=()=>{selectionMode=input.value;drawSelection();});
$('selectionBack').onclick=()=>{screen='setup';$('error').hidden=true;draw();$('prepare').focus();};
$('beginPreparation').onclick=beginPreparation;$('retryPreparation').onclick=beginPreparation;
$('resumePreparation').onclick=()=>{stopPreparationPolling();$('preparationError').hidden=true;$('resumePreparation').hidden=true;$('preparationSpinner').hidden=false;pollPreparation(preparationEpoch);};
$('cancelPreparation').onclick=async()=>{if(preparationBusy)return;stopPreparationPolling();$('cancelPreparation').disabled=true;try{try{await api('/api/preparation/cancel','POST',{});}catch(e){if(e.status!==401&&e.status!==404)throw e;}screen='selection';$('error').hidden=true;drawSelection();draw();$('selectionTitle').focus();}catch(e){showPreparationProblem(e.message);}finally{$('cancelPreparation').disabled=false;}};
$('mode').onchange=()=>{
  const p=selectedPatient(),authored=p.mode==='baseline';
  $('seed').disabled=authored;$('randomizeSeed').disabled=authored;$('days').disabled=authored;
  $('days').value=authored?'':String(p.defaultDays);
  $('patientStage').textContent=`${p.lifeStage} · Interview with ${p.interviewWith.toLowerCase()}`;
  $('patientDescription').textContent=p.description;
  $('communicationPreview').textContent=p.communicationPreview??'Use the interview to discover this person’s preferred way of communicating.';
  $('daysHelp').textContent=authored?'Alex uses a fixed authored history.':`Choose 1–90 recent days within the ${p.lifeStage.toLowerCase()} stage. Days add experiences; the life stage stays the same.`;
  disorderIndex=0;
};
function populatePatients(){
  $('mode').replaceChildren(...status.patients.map(p=>{const option=el('option',`${p.name} · ${p.lifeStage}`);option.value=p.id;return option;}));
  $('mode').value='jordan';$('mode').onchange();$('difficulty').value='standard';$('difficulty').onchange();$('prepare').disabled=false;
}
$('difficulty').onchange=()=>{$('difficultyHelp').textContent=selectedDifficulty()?.description??'';};
$('randomizeSeed').onclick=()=>{if($('seed').disabled)return;const values=new Uint32Array(1);do{crypto.getRandomValues(values);}while(values[0]===Number($('seed').value));$('seed').value=String(values[0]);};
$('saveConversation').onclick=saveConversation;
$('downloadConversation').onclick=()=>{if(session?.turns?.length)downloadConversation({...session.brief,cost:costSnapshot(session.usage?.session?.cost),turns:session.turns,guideWork:session.guideWork,feedback:session.ended?session.feedback:undefined});};
$('historyButton').onclick=()=>{showHistory();$('historyDialog').showModal();};
$('historyClose').onclick=()=>$('historyDialog').close();
$('setupForm').onsubmit=e=>{e.preventDefault();if(!validForm('setupForm'))return;try{validateSetup();$('error').hidden=true;screen='selection';drawSelection();draw();$('selectionTitle').focus();}catch(e){error(e);}};
$('questionForm').onsubmit=async e=>{
  e.preventDefault();if(sending||!session||!validForm('questionForm'))return;
  const question=$('question').value;if(!question.trim())return;
  if(question.length>1500){error(new Error('Keep your question within 1,500 characters.'));return;}
  const currentEpoch=epoch;
  if(!pending||pending.question!==question||pending.expectedTurn!==session.turns.length)pending={question,requestId:crypto.randomUUID(),expectedTurn:session.turns.length};
  sending=true;controls();$('error').hidden=true;$('answerStatus').textContent='Interpreting your question, preparing a reply, and checking its support…';
  try{const result=await api('/api/turn','POST',pending);if(epoch!==currentEpoch)return;session.turns.push(result.turn);session.paused=result.paused;session.usage=result.usage;pending=null;$('question').value='';draw();$('conversation').scrollTop=$('conversation').scrollHeight;}
  catch(e){if(epoch===currentEpoch){error(e);try{const refreshed=await api('/api/session');if(epoch===currentEpoch){session=refreshed;draw();}}catch{}}}
  finally{if(epoch===currentEpoch){sending=false;$('answerStatus').textContent='';controls();}}
};
$('sync').onclick=async()=>{try{session=await api('/api/session');if(pending&&session.turns.some(t=>t.requestId===pending.requestId)){if($('question').value===pending.question)$('question').value='';pending=null;}$('error').hidden=true;draw();if(session.ended)await loadReport();}catch(e){error(e);}};
$('clear').onclick=async()=>{try{await api('/api/session','DELETE');stopPreparationPolling();epoch++;session=null;pending=null;report=null;sending=false;screen='setup';guideHash=null;guideDraft=null;guideDirty=false;for(const id of ['questionForm','assessmentForm','finishForm'])$(id).reset();$('report').textContent='';$('trace').textContent='';$('answerStatus').textContent='';$('error').hidden=true;draw();$('prepare').focus();}catch(e){error(e);}};
$('assessmentForm').onsubmit=async e=>{e.preventDefault();if(!session||!validForm('assessmentForm'))return;try{session.assessment=await api('/api/assessment','POST',{rationale:$('rationale').value,explained:$('explained').checked});$('error').hidden=true;draw();}catch(e){error(e);}};
$('finishForm').onsubmit=async e=>{e.preventDefault();if(!session||!validForm('finishForm'))return;try{if(session.guide&&!await persistGuide(false))return;report=await api('/api/finish','POST',{reasoning:Object.fromEntries(new FormData(e.target))});session.ended=true;if(report.guideWork)session.guideWork=report.guideWork;session.feedback=report.feedback;drawReport();$('error').hidden=true;draw();$('reportPanel').scrollIntoView({behavior:'smooth'});}catch(e){error(e);}};
$('review').onclick=async()=>{if(status?.permissions?.review!==true||!session?.ended)return;const captured=epoch;$('trace').textContent='';try{const data=await api('/api/review');if(epoch===captured&&status?.permissions?.review===true&&session?.ended)$('trace').textContent=JSON.stringify(data,null,2);}catch(e){if(epoch===captured)error(e);}};
$('download').onclick=()=>{if(!report)return;const url=URL.createObjectURL(new Blob([reportText(report)],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='psychlab-ai-debrief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
async function init(){try{status=await api('/api/status');populatePatients();$('providerStatus').hidden=!!status.providerReady;$('providerStatus').textContent=status.providerReady?'':'Featherless is not configured. You can prepare a frozen history; AI answers need the server key and model. See live/README.txt for setup.';
  try{const result=await api('/api/preparation');if(result.preparation?.status==='running'||result.preparation?.status==='failed'){screen='preparing';draw();const restored=restorePreparationChoices(result.preparation.configuration);if(!restored)$('preparationContext').textContent='Restoring your preparation…';renderPreparation(result.preparation);if(!restored&&result.preparation.status==='failed'){$('retryPreparation').hidden=true;$('preparationError').textContent+=' Return to selection to choose the next case.';}if(result.preparation.status==='running')pollPreparation(preparationEpoch);return;}if(result.preparation?.status==='ready'&&result.session){session=result.session;draw();if(session.ended)await loadReport();return;}}
  catch(e){if(e.status!==401&&e.status!==404)throw e;}
  try{session=await api('/api/session');draw();if(session.ended)await loadReport();}catch(e){if(e.status!==401)throw e;}controls();}catch(e){error(e);}}
init();
