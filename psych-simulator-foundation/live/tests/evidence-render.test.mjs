import test from 'node:test';
import assert from 'node:assert/strict';
import {renderEvidenceIfNeeded,EvidenceRenderError} from '../evidence-render.mjs';
const fact=(id,statement,more={})=>({id,statement,...more});
const render=(reply,permittedFacts,more={})=>renderEvidenceIfNeeded({draft:{reply,fact_ids:[permittedFacts[0]?.id??'missing']},permittedFacts,...more});

test('An added causal connection renders complete evidence instead of editing generated clauses',()=>{
 const permitted=[fact('record-a','The bus was late. I waited beside the shop.',{scope:'past',timeframe:'before-simulation'}),fact('record-b','I sometimes read while I wait.',{scope:'usual'})];
 const raw='The bus was late, so I waited beside the shop.',before=JSON.stringify(permitted),result=render(raw,permitted);
 assert.equal(result.reply,'The bus was late. I waited beside the shop.\n\nI sometimes read while I wait.');
 assert.deepEqual(result.factIds,['record-a','record-b']);assert.equal(result.repair.rawDraft.reply,raw);assert.equal(result.repair.quoteAssembly,result.reply);
 assert.deepEqual(result.repair.sourceExcerpts,permitted);assert.equal(result.repair.extraModelCalls,0);assert.equal(JSON.stringify(permitted),before);
});

test('A source connector somewhere else cannot authorize a new relation between generated claims',()=>{
 const permitted=[fact('a','I label the pots so I can tell them apart.'),fact('b','I felt tired. I sat by the window.')];
 const result=render('I felt tired, so I sat by the window.',permitted);
 assert.ok(result);assert.equal(result.reply,permitted.map(f=>f.statement).join('\n\n'));
});

test('Complete authored causal sentences survive case, terminal punctuation, whitespace and unambiguous contractions',()=>{
 const permitted=[fact('a','I cannot see the label, so I have moved the pot.')];
 for(const reply of ['I cannot see the label, so I have moved the pot.',"I can't see the label, so I've moved the pot.",'i cannot see the label, so i have moved the pot!','I cannot see the label,  so\nI have moved the pot.'])assert.equal(render(reply,permitted),null,reply);
});

test('Quotation marks preserve speaker scope and cannot license unquoted personal claims',()=>{
 const quoted="My brother said, 'I was tired, so I left.'",permitted=[fact('reported-speech',quoted)];
 const changed='My brother said I was tired, so I left.';
 const result=render(changed,permitted);
 assert.ok(result);assert.equal(result.reply,quoted);assert.equal(result.repair.rawDraft.reply,changed);
 assert.equal(render(quoted,permitted),null);
 assert.equal(render("my brother said, 'i was tired, so i left!'",permitted),null);
 const doubleQuoted='My brother said, "I was tired, so I left."';
 assert.ok(render('My brother said, I was tired, so I left.',[fact('double-speech',doubleQuoted)]));
});

test('Internal numeric punctuation cannot turn ranges, fractions or thousands into different amounts',()=>{
 for(const [authored,changed] of [
  ['I used 1-2 drops, so the paper changed color.','I used 1.2 drops, so the paper changed color.'],
  ['I used 1/2 cup, so the bowl was nearly full.','I used 1.2 cup, so the bowl was nearly full.'],
  ['I counted 1,200 beads, so the tray was full.','I counted 1.200 beads, so the tray was full.'],
  ['The temperature was -2 degrees, so I went inside.','The temperature was 2 degrees, so I went inside.']
 ]){
  const permitted=[fact('measured-value',authored)],result=render(changed,permitted);
  assert.ok(result,changed);assert.equal(result.reply,authored);assert.equal(render(authored,permitted),null);
 }
});

test('Other internal punctuation changes remain conservatively unlicensed',()=>{
 const permitted=[fact('a','I could not see the label, so I moved the pot.')];
 assert.ok(render('I could not see the label; so I moved the pot.',permitted));
 assert.ok(render('I could not see the label so I moved the pot.',permitted));
});

test('Ambiguous contractions, changed negation, qualifiers and numbers do not acquire an authored license',()=>{
 const permitted=[fact('a','I have checked twice, so I know which key fits.')];
 for(const reply of ["I'd checked twice, so I know which key fits.",'I have checked once, so I know which key fits.','I have not checked twice, so I know which key fits.'])assert.ok(render(reply,permitted),reply);
});

test('Noncausal degree, duration and discourse uses of so retain the AI paraphrase',()=>{
 const permitted=[fact('a','I felt very tired that day.')];
 for(const reply of ['I felt so tired that day.','It took so long.','So, I felt tired that day.','So far, I have described that day.'])assert.equal(render(reply,permitted),null,reply);
});

test('Common causal markers use the same source-based fallback without topic-specific rules',()=>{
 const permitted=[fact('a','The room was quiet. I read a page.')];
 for(const reply of ['I read a page because the room was quiet.','The room was quiet; therefore I read a page.','The room was quiet. As a result, I read a page.',"The room was quiet. That's why I read a page.",'I read a page due to the quiet room.','The room was quiet, so I read a page.'])assert.ok(render(reply,permitted),reply);
});

test('One exact authored causal sentence does not license a second invented connection',()=>{
 const permitted=[fact('a','I use a basket so I can carry the books.'),fact('b','I felt tired. I left the room.')];
 const result=render('I use a basket so I can carry the books. I felt tired, so I left the room.',permitted);
 assert.equal(result.repair.unlicensedCausalSentences.length,1);assert.match(result.repair.unlicensedCausalSentences[0].sentence,/left the room/);
});

test('The selected excerpts preserve caregiver perspective, uncertainty and unfinished plans exactly',()=>{
 const permitted=[fact('caregiver','I saw the child point at the toy. I cannot say what they were thinking.'),fact('future','I would like to try it together. We have not tried that plan yet.',{scope:'wish'})];
 const result=render('The child pointed at the toy, so they wanted to try it together.',permitted);
 assert.equal(result.reply,permitted.map(f=>f.statement).join('\n\n'));assert.equal(result.repair.sourceExcerpts[1].scope,'wish');
 assert.equal(result.reply.includes('they wanted'),false);
});

test('Empty or oversized evidence fails without truncation, expansion or silently dropping sources',()=>{
 assert.throws(()=>render('A happened, so B happened.',[]),EvidenceRenderError);
 assert.throws(()=>render('A happened, so B happened.',[fact('a',' ')]),EvidenceRenderError);
 assert.throws(()=>render('A happened, so B happened.',[fact('a','A '.repeat(1200))]),/exceeds the reply limit/);
 assert.throws(()=>render('A happened, so B happened.',[fact('a','One full statement.'),fact('b','Another full statement.')],{maxReplyChars:20}),/nothing was truncated/);
});

test('Unvalidated references and out-of-scope drafts cannot be laundered through source rendering',()=>{
 const permittedFacts=[fact('a','A recorded statement.')];
 assert.throws(()=>renderEvidenceIfNeeded({draft:{reply:'A happened, so B happened.',fact_ids:['other']},permittedFacts}),/belong to the writer excerpts/);
 assert.throws(()=>renderEvidenceIfNeeded({draft:{reply:'A happened, so B happened.',fact_ids:['a'],out_of_scope:true},permittedFacts}),/out-of-scope/);
 assert.throws(()=>render('A happened, so B happened.',[fact('a','A.'),fact('a','B.')]),/unique writer excerpts/);
});

test('Only supplied excerpts are rendered; no lookup or automatic expansion to full case facts occurs',()=>{
 const result=render('I checked the drawer, so I used the key.',[fact('selected-part','I checked the drawer.')]);
 assert.equal(result.reply,'I checked the drawer.');assert.deepEqual(result.factIds,['selected-part']);
 assert.equal(Object.hasOwn(result,'passedAudit'),false);assert.match(result.repair.limitation,/semantic audit/);
});

test('Omitting a required direct source renders exact disclosed excerpts without another call',()=>{
 const permittedFacts=[fact('current','My usual activities feel a little less enjoyable.',{scope:'current'}),fact('interest','I sometimes take photographs of trees.',{scope:'usual'})];
 const draft={reply:'My usual activities feel a little less enjoyable.',fact_ids:['current']},requiredFactIds=['current','interest'];
 const before=JSON.stringify({draft,permittedFacts,requiredFactIds});
 const result=renderEvidenceIfNeeded({draft,permittedFacts,requiredFactIds});
 assert.equal(result.reply,permittedFacts.map(f=>f.statement).join('\n\n'));
 assert.deepEqual(result.factIds,['current','interest']);
 assert.deepEqual(result.repair.triggers,['omitted-direct-source']);
 assert.deepEqual(result.repair.missingRequiredFactIds,['interest']);
 assert.deepEqual(result.repair.requiredFactIds,requiredFactIds);
 assert.deepEqual(result.repair.unlicensedCausalSentences,[]);
 assert.deepEqual(result.repair.rawDraft,draft);assert.equal(result.repair.extraModelCalls,0);
 assert.equal(JSON.stringify({draft,permittedFacts,requiredFactIds}),before);
});

test('Optional context is not made mandatory and empty required IDs preserve existing behavior',()=>{
 const permittedFacts=[fact('direct','I walked to the gate.'),fact('optional','I hope to visit the lake.')];
 const draft={reply:'I walked to the gate.',fact_ids:['direct']};
 for(const requiredFactIds of [[],['direct']])assert.equal(renderEvidenceIfNeeded({draft,permittedFacts,requiredFactIds}),null);
 assert.equal(renderEvidenceIfNeeded({draft,permittedFacts}),null);
});

test('Coverage and causal triggers remain distinct when both require the same exact fallback',()=>{
 const permitted=[fact('a','I felt tired. I left the room.'),fact('b','I sometimes bring a book.')];
 const result=render('I felt tired, so I left the room.',permitted,{requiredFactIds:['a','b']});
 assert.deepEqual(result.repair.triggers,['unverified-causal-link','omitted-direct-source']);
 assert.deepEqual(result.repair.missingRequiredFactIds,['b']);
 assert.equal(result.repair.unlicensedCausalSentences.length,1);
 assert.equal(result.reply,permitted.map(f=>f.statement).join('\n\n'));
 const causalOnly=render('I felt tired, so I left the room.',permitted,{requiredFactIds:['a']});
 assert.deepEqual(causalOnly.repair.triggers,['unverified-causal-link']);
 assert.deepEqual(causalOnly.repair.missingRequiredFactIds,[]);
});

test('Required IDs cannot introduce undisclosed facts or bypass bounded unique references',()=>{
 const permittedFacts=[fact('a','A complete recorded statement.')],draft={reply:'A recorded statement.',fact_ids:['a']};
 for(const requiredFactIds of [null,'a',['a','a'],[''],['a','b','c','d','e']]){
  assert.throws(()=>renderEvidenceIfNeeded({draft,permittedFacts,requiredFactIds}),/required direct evidence IDs must be unique/);
 }
 for(const requiredFactIds of [['undisclosed'],['a','undisclosed']]){
  assert.throws(()=>renderEvidenceIfNeeded({draft,permittedFacts,requiredFactIds}),/belong to the disclosed writer excerpts/);
 }
});

test('A citation-only coverage trigger is conservative and never certifies semantic coverage',()=>{
 const permittedFacts=[fact('a','I usually walk by the river.'),fact('b','My usual activities feel less enjoyable.')];
 // Even a complete answer with a missing citation triggers an exact rendering.
 const complete={reply:'I usually walk by the river. My usual activities feel less enjoyable.',fact_ids:['a']};
 assert.ok(renderEvidenceIfNeeded({draft:complete,permittedFacts,requiredFactIds:['a','b']}));
 // Conversely, listing a source ID without expressing its content cannot be
 // detected by this local check. The same relevance/support audit is essential.
 const omitted={reply:'I usually walk by the river.',fact_ids:['a','b']};
 assert.equal(renderEvidenceIfNeeded({draft:omitted,permittedFacts,requiredFactIds:['a','b']}),null);
});

test('Coverage repair retains caregiver uncertainty and fails on oversize assembly without truncating',()=>{
 const permitted=[fact('observed','I saw the child point at a book. I cannot say what they thought.'),fact('usual','They sometimes bring a book to me.',{scope:'usual'})];
 const result=render('I saw the child point at a book.',permitted,{requiredFactIds:['observed','usual']});
 assert.equal(result.reply,permitted.map(f=>f.statement).join('\n\n'));
 assert.throws(()=>render('I saw the child point at a book.',permitted,{requiredFactIds:['observed','usual'],maxReplyChars:30}),/nothing was truncated/);
});

test('Since and as cannot turn co-recorded observations into a new explanation',()=>{
 const permitted=[fact('observations','I leave the curtains open. I prefer daylight.')];
 for(const reply of ['I leave the curtains open since I prefer daylight.','Since I prefer daylight, I leave the curtains open.','I leave the curtains open, as I prefer daylight.','As I prefer daylight, I leave the curtains open.']){
  const result=render(reply,permitted);
  assert.ok(result,reply);assert.equal(result.reply,permitted[0].statement);
  assert.ok(result.repair.unlicensedCausalSentences[0].markers.includes('since-as'));
  assert.equal(result.repair.extraModelCalls,0);
 }
});

test('Result and lead verbs cannot create consequences absent from the selected excerpts',()=>{
 const permitted=[fact('cooccurrence','The waiting room was quiet. I finished a page.')];
 for(const reply of ['The quiet room resulted in my finishing a page.','The room was quiet, resulting in my finishing a page.','Finishing a page results from the quiet room.','A quiet room can result in finishing a page.','The quiet room led to my finishing a page.','A quiet room leads me to finish a page.','The room was quiet, leading to my finishing a page.','Quiet rooms lead to finishing pages.']){
  const result=render(reply,permitted);
  assert.ok(result,reply);assert.equal(result.reply,permitted[0].statement);
 }
});

test('Causal and facilitation verbs cannot invent a benefit, motivation or private state',()=>{
 const permitted=[fact('observed','I saw the child take a blue cup. I put water on the table. I cannot say what they were thinking.')];
 for(const reply of [
  'Putting water on the table caused the child to take a cup.',
  'Water on the table causes the child to choose a cup.',
  'The water was on the table, causing the child to take a cup.',
  'The water prompted the child to take a blue cup.',
  'Water on the table prompts the child to choose a cup.',
  'The water was there, prompting a choice of cup.',
  'Water on the table made choosing a cup easier.',
  'Water on the table makes choosing a cup easier.',
  'The water helped the child choose a cup.',
  'The water helps the child choose a cup.',
  'The water was there, helping the child choose a cup.',
  'Putting water there enabled the child to choose a cup.',
  'The water allows the child to choose a cup.'
 ]){
  const result=render(reply,permitted);
  assert.ok(result,reply);assert.equal(result.reply,permitted[0].statement);
  assert.equal(result.reply.includes('easier'),false);
 }
});

test('Complete authored explanatory, temporal and ordinary action sentences retain their license',()=>{
 for(const statement of [
  'I opened the door since the bell was ringing.',
  'As the bell was ringing, I opened the door.',
  'The broken latch resulted in the door staying open.',
  'The reminder led me to check the door.',
  'The reminder prompted me to check the door.',
  'The latch made the door difficult to open.',
  'The handrail helps me climb the steps.',
  'The wide opening allows me to carry the basket through.',
  'I have lived here since May.',
  'I saw the bus as I crossed the road.',
  'I made a sandwich.',
  'I sometimes ask for help.'
 ])assert.equal(render(statement,[fact('authored',statement)]),null,statement);
});

test('Temporal since/as and ordinary make/help paraphrases are conservative false positives, not proven causation',()=>{
 for(const [statement,reply] of [
  ['I have lived here since May.','Since May, I have lived here.'],
  ['I saw the bus as I crossed the road.','As I crossed the road, I saw the bus.'],
  ['I made a sandwich.','I made myself a sandwich.'],
  ['I sometimes ask for help.','Sometimes I ask for help.']
 ]){
  const result=render(reply,[fact('authored',statement)]);
  assert.ok(result);assert.equal(result.reply,statement);
  assert.match(result.repair.limitation,/Temporal since\/as/);
  assert.match(result.repair.limitation,/do not prove causality/);
 }
});

test('New explanatory triggers retain quotation, negation and temporal scope controls',()=>{
 const quote='My neighbor said, "The lamp helped me read."';
 assert.equal(render(quote,[fact('reported',quote)]),null);
 assert.equal(render('My neighbor said the lamp helped me read.',[fact('reported',quote)]).reply,quote);
 const denial='The reminder did not cause me to leave.';
 assert.equal(render('The reminder caused me to leave.',[fact('negative',denial)]).reply,denial);
 const earlier='Before this diary, the handrail helped me climb the steps.';
 const result=render('The handrail helps me climb the steps now.',[fact('earlier',earlier,{scope:'past',timeframe:'before-simulation'})]);
 assert.equal(result.reply,earlier);assert.equal(result.repair.sourceExcerpts[0].timeframe,'before-simulation');
});
