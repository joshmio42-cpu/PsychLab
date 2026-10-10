import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveQuestionRoute,anaphoricSourceIds} from '../question-resolution.mjs';
import {simulateHistory} from '../engine.mjs';
import {conversationContext} from '../conversation.mjs';

const referenceFacts=[
 {id:'planned-panels',label:'A future comic idea',response:'I want to draw a comic about a bakery. I have not drawn that comic yet.',scope:'wish'},
 {id:'past-panels',label:'An earlier drawn comic',response:'I drew a comic about a bird. In its final picture, the bird found its nest.',scope:'past'},
 {id:'read-example',label:'Earlier reading example',response:'In a mystery I read, I guessed the ending before I reached it.',scope:'past'},
 {id:'another-book',label:'Another book',response:'I would like to read a novel with a friend.',scope:'wish'},
 {id:'plant-example',label:'Plant care',response:'I sometimes water the plants with a neighbor.',scope:'usual'}
];
const bind=(question,lastFactIds=[],recalledFactIds=[])=>anaphoricSourceIds({question,facts:referenceFacts,conversation:{lastFactIds,recalledFactIds}});

test('Anaphoric source binding keeps an undrawn object distinct from an older completed example',()=>{
 assert.deepEqual(bind('What happens in its last picture?',['planned-panels'],['past-panels']),['planned-panels']);
 assert.deepEqual(bind('What is its ending?',['planned-panels']),['planned-panels']);
 assert.deepEqual(bind('What happens in its last picture?',['past-panels'],['planned-panels']),['past-panels']);
 assert.equal(referenceFacts.find(f=>f.id==='planned-panels').response.includes('nest'),false);
});

test('A named demonstrative binds the active book without treating its title as known',()=>{
 assert.deepEqual(bind('What was that book called?',['read-example']),['read-example']);
 assert.deepEqual(bind('What was it called?',['read-example']),['read-example']);
 assert.deepEqual(bind('Who wrote that book?',['read-example']),['read-example']);
 assert.deepEqual(bind('What is the title of that book?',['read-example']),['read-example']);
 assert.deepEqual(bind('What was that book called?',['read-example','plant-example']),['read-example']);
});

test('Explicit older, different, named or dated topics do not force the active source',()=>{
 for(const question of [
  'In the older comic, what happens in its last picture?',
  'What happens in its last picture in the older comic?',
  'What happens in the other comic rather than this one?',
  'What was that previous book called?',
  'Going back to the bird comic, what happens in its ending?',
  'On day 3, what did that involve?',
  'What happened to it yesterday?',
  'What happened to it in 2022?',
  'What did Jamie think of it?',
  'What was that book called, and who visited?',
  'How does its ending compare with the film?',
  'Does caffeine affect it?',
  'What does alcohol do to it?',
  'What did your friend say about it?',
  'What happened in the bakery comic?'
 ])assert.equal(bind(question,['planned-panels']),null,question);
});

test('No active referent or multiple possible active sources leave routing unrestricted',()=>{
 for(const question of ['What happens in its last picture?','What happened then?','What was it called?']){
  assert.equal(bind(question),null,question);
  assert.equal(bind(question,['missing-source']),null,question);
  assert.equal(bind(question,['planned-panels','past-panels']),null,question);
  assert.equal(bind(question,[],['past-panels']),null,question);
 }
 assert.equal(bind('What was that book called?',['read-example','another-book']),null);
 assert.equal(bind('What did that doctor say?',['read-example']),null);
});

test('Recalled sources are only a fallback for a uniquely named demonstrative',()=>{
 assert.deepEqual(bind('What was that book called?',['plant-example'],['read-example']),['read-example']);
 assert.equal(bind('What was that book called?',['plant-example'],['read-example','another-book']),null);
 assert.deepEqual(bind('What was that book called?',['read-example'],['another-book']),['read-example']);
 assert.equal(bind('What was it called?',['read-example','plant-example'],['read-example']),null);
});

test('An intervening greeting retains the last substantive source through the conversation ledger',()=>{
 const question='What happens in its last picture?';
 const turns=[
  {kind:'answer',interaction:'answer',question:'What would you like to draw?',reply:'A bakery comic. I have not drawn it yet.',factIds:['planned-panels']},
  {kind:'answer',interaction:'social',question:'Thanks.',reply:'Okay.',factIds:[]}
 ];
 const before=JSON.stringify({facts:referenceFacts,turns});
 const conversation=conversationContext(turns,referenceFacts,question);
 assert.deepEqual(conversation.lastFactIds,['planned-panels']);
 assert.deepEqual(anaphoricSourceIds({question,facts:referenceFacts,conversation}),['planned-panels']);
 assert.equal(JSON.stringify({facts:referenceFacts,turns}),before);
});

test('Anaphoric binding is canonical-source based and independent of patient names or fixed IDs',()=>{
 const facts=[{id:'object-z91',label:'A photographed sculpture',response:'I took a photo of a clay sculpture.'}];
 assert.deepEqual(anaphoricSourceIds({question:'What was that photo called?',facts,conversation:{lastFactIds:['object-z91']}}),['object-z91']);
 assert.equal(anaphoricSourceIds({question:'What was that photo called?',facts,conversation:{lastFactIds:['EX_other_patient']}}),null);
 assert.equal(anaphoricSourceIds(),null);
});

const snapshot=(patientId='jordan',disorderId='none')=>simulateHistory({patientId,disorderId,seed:191,days:17});
const resolve=(question,{patientId='jordan',disorderId='none',kind='clarification',facts,conversation={}}={})=>resolveQuestionRoute({question,route:{kind,fact_ids:[]},facts:facts??snapshot(patientId,disorderId).facts,conversation});

test('Clear missing clinical details become unavailable rather than generic clarification across patients',()=>{
 const questions=[
  'How many months have the low mood and loss of interest been going on?',
  'When did your depressed mood begin?',
  'Which medication are you taking now?',
  'What dose did the hospital give you?',
  'Was that eight-day period of high energy part of your earlier history?',
  'Why have you been hearing voices lately?',
  'Do you have low energy and broken sleep at the moment?'
 ];
 for(const patientId of ['jordan','riley','sam','avery','robin','alex','mika','leo'])for(const question of questions){
  const result=resolve(question,{patientId});
  assert.equal(result.kind,'unavailable',`${patientId}: ${question}`);
  assert.deepEqual(result.fact_ids,[]);
 }
});

test('A nearby ordinary planning habit cannot establish education or work-shift premises',()=>{
 for(const patientId of ['jordan','avery','robin'])for(const question of [
  'When you make practical plans, do you put your study tasks and work shifts together on one list before adding a commitment?',
  'Do you schedule university classes together with your night shifts?',
  'How do you fit lectures and shift work into the same timetable?',
  'Which college assignment do you work on between your nursing shifts?'
 ])assert.equal(resolve(question,{patientId}).kind,'unavailable',`${patientId}: ${question}`);
 const supported=resolve('Do you keep study tasks and work shifts on the same list?',{patientId:'alex'});
 assert.equal(supported.kind,'answer');assert.deepEqual(supported.fact_ids,['P07']);
});

test('Missing named details stay missing despite a related relative, music or hospitalization source',()=>{
 for(const question of ["What is your cousin's name?",'Which album are you planning to compare with your cousin?','What dose did you take at the hospital?',"What is your employer's name?",'What is the title of your favorite album?']){
  assert.equal(resolve(question,{patientId:'jordan',disorderId:'mdd'}).kind,'unavailable',question);
  assert.equal(resolve(question,{patientId:'alex',disorderId:'bipolar1'}).kind,'unavailable',question);
 }
});

test('Unanchored references stay with the existing contextual router',()=>{
 for(const kind of ['clarification','unavailable'])for(const question of ['Why?','What happened then?','Which one?','What do you mean by that?','What do you mean by it?','How did that make you feel?','What about them?','Could you say more?','What did she mean in the last message?','What is the reason behind that?','What would you want that person to do?']){
  const route={kind,fact_ids:[]};
  const facts=snapshot().facts;
  assert.equal(resolveQuestionRoute({route,question,facts,conversation:{lastFactIds:[]}}),route,question);
 }
});

test('Opening questions recover authored reasons for attending across patient and caregiver perspectives',()=>{
 for(const patientId of ['jordan','sam','mika','robin'])for(const question of ['What brings you here?','What brought you in?','Why are you here?','What would you like to talk about?']){
  const result=resolve(question,{patientId});
  assert.equal(result.kind,'answer',`${patientId}: ${question}`);assert.deepEqual(result.fact_ids,['G01']);
 }
 const facts=[{id:'opening-custom',label:'Opening and interview goals',domains:['presenting','goals'],response:'I want to talk about my recent routine.'}];
 assert.deepEqual(resolve('What brings you here?',{facts}).fact_ids,['opening-custom']);
});

test('Explicit safety and scope routes and successful answers are never overridden',()=>{
 for(const kind of ['safety_pause','out_of_scope','answer','social']){
  const route={kind,fact_ids:kind==='answer'?['P02']:[]};
  for(const question of ['What are your hobbies?','How many months have you had low mood?','What is your cousin’s name?'])assert.equal(resolveQuestionRoute({route,question,facts:snapshot().facts}),route);
 }
});

test('Supported hobbies, preferences and routines are recovered from canonical facts across life stages',()=>{
 for(const [patientId,question,expected] of [
  ['jordan','What are your hobbies?','P02'],
  ['alex','What are your usual interests?','P02'],
  ['robin','What do you usually do in the garden?','P02'],
  ['riley','How do you organize your playlists?','P07'],
  ['jordan','Why did you start sketching?','P06'],
  ['sam','What help would you prefer when drawing?','P10'],
  ['mika','What choices do you offer for play?','P10'],
  ['leo','What choices do you offer during play, and what do you let them decide for themselves?','P04']
 ])for(const kind of ['clarification','unavailable']){
  const result=resolve(question,{patientId,kind});
  assert.equal(result.kind,'answer',question);assert.deepEqual(result.fact_ids,[expected],question);
 }
});

test('An answerable preference in a multipart question does not authorize an unrecorded origin',()=>{
 for(const question of [
  'When someone helps with your drawing, whose idea is it, and what would you want that person to do?',
  'Whose idea was the picture, and what help would you prefer with your drawing?',
  'Why did the helper choose the picture, and what would you want them to do?'
 ]){
  const result=resolve(question,{patientId:'sam'});
  assert.equal(result.kind,'answer',question);assert.deepEqual(result.fact_ids,['P10'],question);
  assert.match(result.rule,/only|unsupported/);
 }
});

test('Usual hobbies and earlier episodes cannot answer current health or enjoyment',()=>{
 for(const patientId of ['alex','jordan','riley','robin'])for(const question of [
  'Does your hobby still feel rewarding now?',
  'Are you enjoying your usual interests lately?',
  'Does your usual hobby feel much less rewarding now, with broken sleep and low energy getting in the way?'
 ])assert.equal(resolve(question,{patientId}).kind,'unavailable',`${patientId}: ${question}`);
 assert.equal(resolve('Are you having high energy and very little sleep now?',{patientId:'alex',disorderId:'bipolar1'}).kind,'unavailable');
});

test('Recovery relies on source content, not stable fixture IDs or biography from another patient',()=>{
 const facts=[
  {id:'custom-b',label:'Usual way of sorting music playlists',scope:'usual',response:'I sort my playlists by mood and keep each playlist in a different folder.',keywords:['sort','playlist']},
  {id:'custom-a',label:'Preference for help with pottery',scope:'preference',response:'When making pottery, I want someone to show the first step and then let me try.',keywords:['pottery','help']}
 ];
 assert.deepEqual(resolve('How do you organize your playlists?',{facts}).fact_ids,['custom-b']);
 assert.deepEqual(resolve('What help would you prefer with pottery?',{facts}).fact_ids,['custom-a']);
 assert.equal(resolve('Do you keep study tasks and work shifts on the same list?',{facts}).kind,'unavailable');
 assert.equal(resolve('What do you want help with when drawing?',{facts}).kind,'unavailable');
});

test('A named topic with no source returns an explicit gap without consulting old dialogue as evidence',()=>{
 const conversation={lastFactIds:['OLD'],lastQuestion:'How is your violin practice?',disclosedFactIds:['OLD']};
 const result=resolve('Which violin concerto are you rehearsing?',{facts:[],conversation});
 assert.equal(result.kind,'unavailable');assert.deepEqual(result.fact_ids,[]);
});

test('An action reference without an antecedent remains unclear instead of becoming missing data',()=>{
 const facts=[{id:'source-independent',label:'Personal wish',scope:'wish',response:'I want to make a ceramic bowl.'}];
 for(const question of ['Would you do it the same way again?','Could you handle that differently?','Would you repeat this?','Will you try it again?','Did you use that approach?'])for(const kind of ['clarification','unavailable']){
  const result=resolve(question,{facts,kind,conversation:{lastFactIds:[]}});
  assert.equal(result.kind,'clarification',question);assert.deepEqual(result.fact_ids,[]);
 }
 assert.equal(resolve('Would you do it the same way again?',{facts,conversation:{lastFactIds:['stale-id']}}).kind,'clarification');
});

test('A completion callback retrieves only the named last canonical wish with an explicit unfinished statement',()=>{
 const facts=[
  {id:'earlier-object',label:'Earlier ceramic bowl',scope:'past',response:'I made a blue ceramic bowl last year.'},
  {id:'future-display',label:'Future display wish',scope:'wish',response:'I would like to make a ceramic display for visitors. That display is an idea I have not set up yet.'},
  {id:'future-mural',label:'Future mural wish',scope:'wish',response:'I would like to paint a mural. I have not finished the mural yet.'}
 ];
 for(const question of ['So that display is already ready for visitors to look at?','Is that display finished now?','Have you completed that display already?'])for(const kind of ['clarification','unavailable']){
  const result=resolve(question,{facts,kind,conversation:{lastFactIds:['future-display']}});
  assert.equal(result.kind,'answer',question);assert.deepEqual(result.fact_ids,['future-display']);assert.match(result.rule,/not-yet-completed/);
 }
 assert.deepEqual(resolve('Is that mural finished now?',{facts,conversation:{lastFactIds:['future-mural']}}).fact_ids,['future-mural']);
 assert.notDeepEqual(resolve('Is that display finished now?',{facts,conversation:{lastFactIds:['earlier-object']}}).fact_ids,['future-display']);
 assert.equal(resolve('Is that display with the golden statues finished now?',{facts,conversation:{lastFactIds:['future-display']}}).kind,'unavailable');
 assert.equal(resolve('Is that concert finished now?',{facts,conversation:{lastFactIds:['future-display']}}).kind,'unavailable');
 // A wish alone does not establish completion or its absence.
 const onlyWish=[{id:'future-display',label:'Future display wish',scope:'wish',response:'I would like to make a ceramic display for visitors.'}];
 assert.equal(resolve('Is that display finished now?',{facts:onlyWish,conversation:{lastFactIds:['future-display']}}).kind,'unavailable');
});
