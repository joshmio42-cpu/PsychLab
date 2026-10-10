import test from 'node:test';
import assert from 'node:assert/strict';
import {assertFactualSupport,factualSupportIssues} from '../factual-support.mjs';
import {simulateHistory} from '../engine.mjs';
const get=(person,...ids)=>simulateHistory({patientId:person,days:2,disorderId:'none'}).facts.filter(f=>ids.includes(f.id));

test('known live motive embellishments fail independently of a permissive semantic auditor',()=>{
 for(const [person,ids,reply,code] of [
  ['jordan',['P05','P06'],'I draw mugs because they have interesting shapes.','added-shape-motive'],
  ['alex',['P06'],'I like how an album tells a story.','added-narrative-meaning'],
  ['riley',['P02'],'Comparing songs with my friend is fun.','added-enjoyment'],
  ['jordan',['P10'],'It helps me feel more secure about our plans.','added-safety-effect'],
  ['jordan',['P02'],'Drawing helps me clear my head.','added-soothing-effect'],
  ['jordan',['P02'],'Sketching takes my mind off my worries.','added-distraction-effect']
 ]){
  const facts=get(person,...ids),issues=factualSupportIssues(reply,facts);
  assert.ok(issues.some(x=>x.code===code),JSON.stringify({reply,issues}));
  assert.throws(()=>assertFactualSupport(reply,facts),/Unsupported factual detail/);
 }
});

test('low energy and withdrawal do not independently establish a motivation deficit',()=>{
 const s=simulateHistory({patientId:'jordan',disorderId:'mdd',days:2}),facts=s.facts.filter(f=>['B02','B03','P01'].includes(f.id));
 for(const reply of ['I want to get back to drawing, but I have no motivation.','My drive is low and I can’t be bothered to try.'])assert.throws(()=>assertFactualSupport(reply,facts),/added-motivation/);
 assert.doesNotThrow(()=>assertFactualSupport('I have less energy, and everyday things take longer.',facts));
});

test('supported hobby reasons can be paraphrased naturally without exact matching',()=>{
 for(const [person,reply] of [
  ['jordan','The things were close at hand. I didn’t need to set anything up.'],
  ['alex','I was curious about how the tracks connected.'],
  ['riley','Changing the order makes the same songs feel different. That interested me.'],
  ['sam','I could decide what happened after the picture.'],
  ['mika','It gives us an activity to share, and I follow Mika’s lead.'],
  ['leo','The game lets me offer Leo a couple of choices.'],
  ['robin','Watching new growth got me interested.']
 ])assert.doesNotThrow(()=>assertFactualSupport(reply,get(person,'P06'),{patientName:person[0].toUpperCase()+person.slice(1)}),person);
});

test('natural synonyms for explicitly authored enjoyment and emotional effects are allowed',()=>{
 const facts=[{id:'P06',response:'I enjoyed the game. It calms me and gives me a sense of security.'}];
 assert.doesNotThrow(()=>assertFactualSupport('The game is fun and soothing. I feel more secure.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('Those appealing forms caught my attention.',[{id:'P06',response:'The shapes were interesting; I found the forms appealing.'}]));
});

test('new named relatives, friends, title names and surnames cannot be supplied by the question',()=>{
 const facts=get('jordan','P04');
 for(const reply of ['My cousin Jamie listens.','My cousin is named Jamie.','Jamie is my cousin.','My friend Alex Smith came over.','The album is called Blue Sky.']){
  assert.throws(()=>assertFactualSupport(reply,facts,{question:'Is your cousin Jamie?'}),/unsupported-name/,reply);
 }
 assert.doesNotThrow(()=>assertFactualSupport('My cousin listens.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('My cousin Jamie listens.',[{id:'P04',response:'My cousin Jamie listens when I talk.'}]));
 assert.throws(()=>assertFactualSupport('My cousin Jamie Smith listens.',[{id:'P04',response:'My cousin Jamie listens.'}]),/unsupported-name/);
});

test('earlier examples and usual interests cannot become recent diary events',()=>{
 for(const reply of ['Yesterday I sketched a mug.','I recently sketched a mug.','I’ve sketched a mug today.'])assert.throws(()=>assertFactualSupport(reply,get('jordan','P08')),/background-recast-as-recent-event/);
 assert.throws(()=>assertFactualSupport('Last night I listened to an album.',get('alex','P02')),/background-recast-as-recent-event/);
 assert.doesNotThrow(()=>assertFactualSupport('In an earlier drawing, I sketched a mug from a different angle.',get('jordan','P08')));
 assert.doesNotThrow(()=>assertFactualSupport('Not yesterday. I sketched it earlier.',get('jordan','P08')));
 assert.doesNotThrow(()=>assertFactualSupport('I usually sketch things around me.',get('jordan','P02')));
});

test('a recent clinical source cannot move an earlier personal example into the recent period',()=>{
 const s=simulateHistory({patientId:'jordan',disorderId:'mdd',days:2}),facts=s.facts.filter(f=>['B02','P08'].includes(f.id));
 assert.throws(()=>assertFactualSupport('Recently I sketched that mug from a different angle.',facts),/earlier-memory-recast-as-recent/);
 assert.doesNotThrow(()=>assertFactualSupport('My energy is low these days. In an earlier drawing, I sketched a mug.',facts));
});

test('uncompleted wishes remain intentions; negated completion is preserved',()=>{
 const facts=get('riley','P12');
 assert.throws(()=>assertFactualSupport('We made the playlist together.',facts),/wish-recast-as-completed-event/);
 assert.throws(()=>assertFactualSupport('I’ve finished that playlist.',facts),/wish-recast-as-completed-event/);
 assert.doesNotThrow(()=>assertFactualSupport('I’d like to make a playlist together. We haven’t made it yet.',facts));
});

test('negated corrections and ordinary conversational phrasing are not flattened by these guards',()=>{
 assert.doesNotThrow(()=>assertFactualSupport('Not every day—most days, over the last four months.',[{id:'B01',response:'For four months I have felt low on most days.'}]));
 for(const text of ['Hey!','Okay, thanks.','Give me a second.','Mostly ordinary objects, with a pencil.'])assert.doesNotThrow(()=>assertFactualSupport(text,get('jordan','P05')));
});

test('all authored personal facts pass unchanged, so guards do not outlaw existing case content',()=>{
 for(const person of ['mika','leo','sam','riley','jordan','avery','robin','alex']){
  const facts=simulateHistory({patientId:person,days:2,disorderId:'none'}).facts.filter(f=>/^P\d+$/.test(f.id));
  for(const fact of facts)assert.doesNotThrow(()=>assertFactualSupport(fact.response,[fact]),`${person} ${fact.id}`);
 }
});

test('a usual first-step strategy cannot deny current stress or gain invented efficacy',()=>{
 const facts=get('jordan','P11'),question='Have everyday tasks been getting on top of you at all?';
 const reply='Not really. I usually just write down the first thing that needs doing and start there. Keeps things manageable.';
 const issues=factualSupportIssues(reply,facts,{question});
 assert.ok(issues.some(x=>x.code==='background-as-current-health-answer'));
 assert.ok(issues.some(x=>x.code==='added-coping-efficacy'));
 for(const answer of ['No, I’m not overwhelmed.','Yes, I feel stressed.','I feel fine.'])assert.throws(()=>assertFactualSupport(answer,facts,{question}),/background-as-current-health-answer/);
 assert.doesNotThrow(()=>assertFactualSupport('I usually write the first thing down and start with that.',facts,{question:'How do you usually start a task?'}));
 assert.doesNotThrow(()=>assertFactualSupport('Yes, I usually write a short list.',facts,{question:'Do you usually use a list when stressed?'}),'A question about a usual method is distinct from a current health assessment');
 assert.doesNotThrow(()=>assertFactualSupport('Not every day—most days.',[{id:'B01',response:'Worry has affected most days.'}],{question:'Are you anxious every day?'}));
});

test('current symptoms need current evidence, while authored efficacy allows plain synonyms',()=>{
 assert.doesNotThrow(()=>assertFactualSupport('Yes, I feel stressed.',[{id:'B02',response:'I feel stressed by everyday tasks.'}],{question:'Have tasks been stressing you?'}));
 assert.throws(()=>assertFactualSupport('It makes things easier to manage.',get('jordan','P11')),/added-coping-efficacy/);
 assert.doesNotThrow(()=>assertFactualSupport('It makes things easier to manage.',get('alex','P11')));
 assert.doesNotThrow(()=>assertFactualSupport('Keeping a short list helps me organize things.',[{id:'P11',scope:'usual',response:'A short list helps me manage the tasks.'}]),'Explicitly authored benefit supports an ordinary synonym');
});

test('for fun can name a usual hobby without permitting invented enjoyment of an interaction',()=>{
 assert.doesNotThrow(()=>assertFactualSupport('For fun, I usually compare songs with a friend.',get('riley','P02')));
 assert.doesNotThrow(()=>assertFactualSupport('I sketch everyday objects for fun.',get('jordan','P02','P05')));
 assert.throws(()=>assertFactualSupport('Comparing songs with my friend is fun.',get('riley','P02')),/added-enjoyment/);
 assert.throws(()=>assertFactualSupport('I compare songs for fun. Comparing them is fun.',get('riley','P02')),/added-enjoyment/,'A permitted first occurrence cannot hide a later unsupported evaluation');
 assert.throws(()=>assertFactualSupport('I write a task list for fun.',get('jordan','P11')),/added-enjoyment/,'The exception is restricted to usual hobby facts');
});

test('an event cannot acquire an unauthored next day or next morning sequence',()=>{
 const facts=[{id:'E22',response:'On day 22, I had broken sleep and found the work deadline demanding.'},{id:'E24',response:'On day 24, I felt tired and postponed a task.'}];
 for(const reply of ['I slept badly, and the next day the deadline felt demanding.','The following morning, I postponed the task.'])assert.throws(()=>assertFactualSupport(reply,facts),/invented-relative-chronology/);
 assert.doesNotThrow(()=>assertFactualSupport('I slept badly and found that deadline demanding.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('I postponed the task until the following day.',[{id:'E22',response:'I postponed the task until the next day.'}]));
 assert.throws(()=>assertFactualSupport('I finished it the next morning.',[{id:'E22',response:'I postponed the task until the next day.'}]),/invented-relative-chronology/,'Next day does not establish a morning');
 assert.doesNotThrow(()=>assertFactualSupport('It was not the next day.',facts),'A correction may reject the invented relative date');
});

test('delivery style and preferred questions do not authorize a self-reported personality trait',()=>{
 const facts=[{id:'P20',scope:'preference',response:'I prefer thoughtful questions and a moment to answer.'},{id:'P21',scope:'usual',response:'I keep a notebook for recipes and share meals with a friend.'}];
 for(const reply of ["I'm a thoughtful person.",'I tend to be reflective.',"I'm usually pretty low-key.",'I see myself as dependable.',"I'm a creative person.","I've always been outgoing.","I'd describe myself as reserved."]){
  assert.ok(factualSupportIssues(reply,facts).some(issue=>issue.code==='unsupported-personality-trait'),reply);
 }
 assert.doesNotThrow(()=>assertFactualSupport('A moment to answer helps. I prefer thoughtful questions.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('My friend asked a thoughtful question.',facts),'The self-trait guard does not blacklist the adjective in all contexts; other claims still require the semantic audit');
 assert.doesNotThrow(()=>assertFactualSupport("I'm kind of unsure how to answer.",facts));
 assert.doesNotThrow(()=>assertFactualSupport("I'm a patient in this interview.",facts),'A patient role is not a claim to have a patient temperament');
});

test('explicit self-traits allow close synonyms but not negation reversal or other people’s traits',()=>{
 const facts=[{id:'P20',response:'I am reflective. I am not outgoing. My sister is very reliable.'}];
 assert.doesNotThrow(()=>assertFactualSupport("I'm thoughtful. I am not extroverted.",facts));
 for(const reply of ['I am not reflective.',"I'm outgoing.",'I am dependable.'])assert.throws(()=>assertFactualSupport(reply,facts),/unsupported-personality-trait/);
 assert.throws(()=>assertFactualSupport('I am thoughtful.',[{id:'P20',response:'I am thoughtful when choosing gifts.'}]),/unsupported-personality-trait/,'A context-bound behavior is not a general trait');
 assert.throws(()=>assertFactualSupport('I am thoughtful when solving puzzles.',[{id:'P20',response:'I am thoughtful when choosing gifts.'}]),/unsupported-personality-trait/,'A different bounded context cannot borrow the trait');
 assert.doesNotThrow(()=>assertFactualSupport('I am reflective when choosing gifts.',[{id:'P20',response:'I am thoughtful when choosing gifts.'}]));
});

test('occasional activity cannot become typical or absolute despite usual metadata',()=>{
 const facts=[{id:'P20',scope:'usual',response:'My friend and I occasionally exchange recipes and suggest changes to each other’s meals.'}];
 for(const reply of ['My friend and I usually exchange recipes.','We regularly exchange recipes.','We exchange recipes all the time.','We exchange recipes every day.'])assert.throws(()=>assertFactualSupport(reply,facts),/inflated-frequency/,reply);
 assert.doesNotThrow(()=>assertFactualSupport('We sometimes exchange recipes.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('Not every day. We occasionally exchange recipes.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('I don’t always exchange recipes.',facts));
});

test('frequency belongs to the matched activity, including separate claims inside one fact',()=>{
 const facts=[{id:'P20',scope:'usual',response:'I sometimes paint landscapes, but I usually bake bread. I always keep my bicycle locked.'}];
 assert.throws(()=>assertFactualSupport('I usually paint landscapes.',facts),/inflated-frequency/);
 assert.throws(()=>assertFactualSupport('I always bake bread.',facts),/inflated-frequency/);
 assert.doesNotThrow(()=>assertFactualSupport('I sometimes paint landscapes. I usually bake bread.',facts));
 assert.throws(()=>assertFactualSupport('I usually paint landscapes and I usually bake bread.',facts),/inflated-frequency/);
 const joined=[{id:'P20',scope:'usual',response:'I sometimes paint landscapes and I usually bake bread.'}];
 assert.throws(()=>assertFactualSupport('I usually paint landscapes.',joined),/inflated-frequency/);
});

test('A negated ownership claim does not turn sometimes into a positive every-time frequency',()=>{
 const facts=[{id:'P20',scope:'usual',response:'My friend and I sometimes exchange recipes. We take turns choosing one, so it is not just my choice.'}];
 assert.doesNotThrow(()=>assertFactualSupport("Sometimes we exchange recipes, so it isn't just my choice every time.",facts));
 assert.doesNotThrow(()=>assertFactualSupport('It is not my choice every time.',facts));
 assert.throws(()=>assertFactualSupport('We exchange recipes every time.',facts),/inflated-frequency/);
 assert.throws(()=>assertFactualSupport("It isn't just my choice. We exchange recipes every day.",facts),/inflated-frequency/);
});

test('usual and absolute frequency are allowed when associated evidence actually supports them',()=>{
 const facts=[{id:'P20',scope:'usual',response:'I usually write shopping lists. I always lock the bicycle.'}];
 assert.doesNotThrow(()=>assertFactualSupport('I typically write a shopping list. I always lock the bicycle.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('I usually read mystery books.',[{id:'P20',scope:'usual',response:'I read mystery books.'}]));
 assert.doesNotThrow(()=>assertFactualSupport('Most days I have little energy.',[{id:'B20',response:'My energy is low on most days.'}]));
 assert.throws(()=>assertFactualSupport('Every day I have little energy.',[{id:'B20',response:'My energy is low on most days.'}]),/inflated-frequency/);
});

test('preferences and intentions do not become observed routines',()=>{
 const facts=[{id:'P20',scope:'preference',response:'I prefer to ask my neighbor which plants need water.'}];
 for(const reply of ['I usually ask my neighbor which plants need water.','I ask my neighbor which plants need water.'])assert.ok(factualSupportIssues(reply,facts).some(issue=>['preference-as-established-routine','inflated-frequency'].includes(issue.code)),reply);
 assert.doesNotThrow(()=>assertFactualSupport('I prefer to ask my neighbor about watering the plants.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('I would ask which plants need water.',facts));
 const routine=[...facts,{id:'P21',scope:'usual',response:'I ask my neighbor which plants need water before each visit.'}];
 assert.doesNotThrow(()=>assertFactualSupport('I ask my neighbor which plants need water.',routine),'An additional explicit routine can support the action');
});

test('a distinctive detail in one past event cannot become a general preference or routine',()=>{
 const facts=[{id:'P20',scope:'usual',response:'I bake bread.'},{id:'P21',scope:'past',response:'For an earlier loaf, I added walnuts to the bread.'}];
 for(const reply of ['I like adding walnuts to bread.','I enjoy bread with walnuts.','I prefer walnuts in my bread.'])assert.throws(()=>assertFactualSupport(reply,facts),/event-as-general-preference/);
 assert.throws(()=>assertFactualSupport('I usually add walnuts to bread.',facts),/inflated-frequency/);
 assert.doesNotThrow(()=>assertFactualSupport('I added walnuts to an earlier loaf of bread.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('I like adding walnuts to bread.',[...facts,{id:'P22',scope:'preference',response:'I like adding walnuts to bread.'}]));
});

test('a habit and ongoing symptoms do not establish that the habit fails to help',()=>{
 const facts=[{id:'P20',scope:'usual',response:'I write appointments on a calendar.'},{id:'B20',response:'Worry interrupts my evening reading.'}];
 for(const reply of [
  'Writing appointments on a calendar doesn’t stop worry interrupting my reading.',
  'Using a calendar does not help with my worry.',
  'A calendar didn’t reduce my worry.',
  'I use a calendar. It doesn’t ease my worry.'
 ])assert.throws(()=>assertFactualSupport(reply,facts),/unsupported-negative-coping-effect/,reply);
 assert.doesNotThrow(()=>assertFactualSupport('I write appointments on a calendar. Worry interrupts my evening reading.',facts));
 for(const reply of ['Using a calendar doesn’t establish recovery from worry.','Using a calendar does not prove that my worry is gone.','The calendar doesn’t mean worry has stopped.'])assert.doesNotThrow(()=>assertFactualSupport(reply,facts));
});

test('denying a trait inference does not assert a personality trait or support later assertions',()=>{
 const facts=[{id:'P30',scope:'preference',response:'I prefer a moment to phrase an answer.'}];
 for(const verb of ['mean','prove','establish','imply']){
  assert.doesNotThrow(()=>assertFactualSupport(`It doesn't ${verb} that I'm naturally thoughtful.`,facts));
  assert.doesNotThrow(()=>assertFactualSupport(`It does not necessarily ${verb} I am reflective.`,facts));
 }
 for(const reply of ["I'm not thoughtful.","That means I'm naturally thoughtful.","It doesn't mean I'm thoughtful. I am reflective.","It doesn't prove I'm thoughtful, but I'm reflective."])
  assert.throws(()=>assertFactualSupport(reply,facts),/unsupported-personality-trait/,reply);
 assert.throws(()=>assertFactualSupport("I'm thoughtful.",[{id:'X',response:"That doesn't mean I'm thoughtful."}]),/unsupported-personality-trait/);
});

test('negative coping results need the same action and target, not unrelated failure vocabulary',()=>{
 const facts=[{id:'B20',response:'Slow breathing did not reduce my panic. A quiet walk did not help my headaches.'}];
 assert.doesNotThrow(()=>assertFactualSupport('Slow breathing didn’t ease my panic.',facts));
 assert.doesNotThrow(()=>assertFactualSupport('A quiet walk didn’t help my headaches.',facts));
 for(const reply of ['Slow breathing didn’t help my headaches.','A quiet walk didn’t reduce my panic.','Slow breathing doesn’t reduce my panic.'])assert.throws(()=>assertFactualSupport(reply,facts),/unsupported-negative-coping-effect/,reply);
 assert.doesNotThrow(()=>assertFactualSupport('I tried slow breathing. It didn’t reduce my panic.',facts));
 assert.throws(()=>assertFactualSupport('Slow breathing didn’t stop my panic.',facts),/unsupported-negative-coping-effect/,'Failure to reduce is not interchangeable with a separately asserted complete stopping result');
 assert.throws(()=>assertFactualSupport('Using a calendar didn’t help my worry.',[{id:'B20',response:'Using a notebook didn’t help my worry.'}]),/unsupported-negative-coping-effect/,'The generic word using cannot transfer an outcome to a different strategy');
 assert.throws(()=>assertFactualSupport('Slow breathing didn’t help headaches during reading.',[{id:'B20',response:'Slow breathing didn’t help panic during reading.'}]),/unsupported-negative-coping-effect/,'Shared circumstances cannot substitute a different symptom outcome');
});
