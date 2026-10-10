import test from 'node:test';
import assert from 'node:assert/strict';
import {ANSWER_PLAN_INSTRUCTION,AnswerPlanError,validateAnswerPlan,projectAnswerPlan,anchorUsualInterestSources} from '../answer-plan.mjs';

// Generic fixtures exercise the contract without encoding live evaluation cases.
const facts=[
  {id:'routine',response:'I sometimes water the plants with my neighbor.',scope:'usual'},
  {id:'future',response:'I would like to plant a small herb bed. That is an idea I have not tried yet.',scope:'wish'},
  {id:'past',response:'Before this diary, I put a blue pot beside the gate.',scope:'past',timeframe:'before-simulation'},
  {id:'observer',response:'I saw the child place a block in the box. I cannot say what the child was thinking.'}
];
const source=(id,quote)=>({id,quote});
const supported=(request,...sources)=>({request,status:'supported',sources});
const unknown=(request,contextSources=[])=>({request,status:'unrecorded',sources:[],...(contextSources.length?{contextSources}:{})});
const validate=(question,parts,fact_ids,options={})=>validateAnswerPlan({kind:fact_ids.length?'answer':'unavailable',fact_ids,parts},{question,facts,...options});

test('Complete question parts keep missing people out of the writer task and preserve real paraphrasing',()=>{
  const question='How often do you water the plants, and what is your neighbor’s name?';
  const plan=validate(question,[supported('How often do you water the plants',source('routine',facts[0].response)),unknown('and what is your neighbor’s name?')],['routine']);
  const projected=projectAnswerPlan(plan,{allowedFacts:facts});
  assert.equal(plan.state,'planned');assert.equal(projected.requiresWriter,true);
  assert.deepEqual(projected.factIds,['routine']);assert.equal(projected.writerRequests.length,1);
  assert.equal(projected.writerRequests[0].sources[0].scope,'usual');
  assert.equal(projected.writerRequests[0].sources[0].quote,facts[0].response);
  assert.equal(projected.writerRequests[0].request,'How often do you water the plants');
  assert.equal(JSON.stringify(projected.writerRequests).includes('name'),false);
  assert.equal(projected.exerciseNote,'Not recorded for this interview: “and what is your neighbor’s name?”');
  assert.equal(Object.hasOwn(projected,'reply'),false);
});

test('Unknown requests can retain canonical context without asking the writer to fill the gap',()=>{
  const question='Who has agreed to help with that herb bed?';
  const plan=validate(question,[unknown(question,[source('future',facts[1].response)])],['future']);
  const projected=projectAnswerPlan(plan,{allowedFacts:facts});
  assert.deepEqual(projected.writerRequests,[{kind:'context',request:'Briefly describe this recorded context.',sources:[{...source('future',facts[1].response),scope:'wish'}]}]);
  assert.equal(JSON.stringify(projected.writerRequests).includes('agreed'),false);
  assert.equal(projected.unrecordedParts[0],question);assert.equal(projected.requiresWriter,true);
});

test('The compact wire format derives routing only from validated quotes, without redundant model IDs',()=>{
  const question='Who will help with the herb bed?';
  const context={kind:'plan',parts:[unknown(question,[source('future',facts[1].response)])]};
  const plan=validateAnswerPlan(context,{question,facts});
  assert.equal(plan.kind,'answer');assert.deepEqual(plan.factIds,['future']);
  const absent=validateAnswerPlan({kind:'plan',parts:[unknown(question)]},{question,facts});
  assert.equal(absent.kind,'unavailable');assert.deepEqual(absent.factIds,[]);
  for(const bad of [{...context,fact_ids:[]},{...context,fact_ids:['future']},{kind:'plan'},
    {kind:'plan',parts:[unknown(question,[source('future','A fabricated plan.')])]}]){
    assert.throws(()=>validateAnswerPlan(bad,{question,facts}),AnswerPlanError);
  }
});

test('A wholly unrecorded request without context needs no writer call',()=>{
  const question='What was the address?';
  const projected=projectAnswerPlan(validate(question,[unknown(question)],[]),{allowedFacts:facts});
  assert.equal(projected.requiresWriter,false);assert.deepEqual(projected.writerRequests,[]);assert.deepEqual(projected.factIds,[]);
  assert.ok(projected.exerciseNote.includes(question));
});

test('Exact ordered spans must cover every question word including multipart suffixes',()=>{
  for(const parts of [
    [unknown('What changed?')],
    [unknown('What changed?'),unknown('Why?')],
    [unknown('Why?'),unknown('What changed?')],
    [unknown('What changed?'),unknown('And why?')],
    [unknown('What changed?'),unknown('What changed? and why?')]
  ])assert.throws(()=>validate('What changed? and why?',parts,[]),AnswerPlanError);
  assert.doesNotThrow(()=>validate('  What changed? — and why?  ',[unknown('What changed?'),unknown('and why?')],[]));
});

test('Omitted introductory framing and connectors are retained verbatim, never discarded or used to fill a missing question',()=>{
 const question='For the planned garden, who will visit, and what will they bring?';
 const plan=validateAnswerPlan({kind:'plan',parts:[unknown('who will visit'),unknown('what will they bring?')]},{question,facts});
 assert.deepEqual(plan.parts.map(part=>part.request),['For the planned garden, who will visit',', and what will they bring?']);
 assert.equal(plan.parts.map(part=>part.request).join(''),question);
 for(const question of ['Who will visit, and what will they bring?','For the garden, who will visit and what will they bring?']){
   assert.throws(()=>validateAnswerPlan({kind:'plan',parts:[unknown('what will they bring?')]},{question,facts}),AnswerPlanError);
  }
 const negative='For the trip you did not take, who was there?';
 const preserved=validateAnswerPlan({kind:'plan',parts:[unknown('who was there?')]},{question:negative,facts});
 assert.equal(preserved.parts[0].request,negative);
 assert.throws(()=>validateAnswerPlan({kind:'plan',parts:[unknown('What do you want'),unknown('what actually happened?')]},{question:'What do you want, not what actually happened?',facts}),AnswerPlanError);
 assert.throws(()=>validateAnswerPlan({kind:'plan',parts:[unknown('is your sleep broken?')]},{question:'About sleep, do you take medication, is your sleep broken?',facts}),AnswerPlanError);
});

test('Verified excerpts expand to canonical sentence boundaries so negation and qualifiers cannot disappear',()=>{
 const question='Do you take medication?';
 const evidence=[{id:'F',response:'I do not take medication. I sometimes go for a walk.'}];
 const plan=validateAnswerPlan({kind:'plan',parts:[supported(question,source('F','take medication'))]},{question,facts:evidence});
 assert.equal(plan.parts[0].sources[0].quote,'I do not take medication.');
 const walk=validateAnswerPlan({kind:'plan',parts:[supported('Do you go for a walk?',source('F','go for a walk'))]},{question:'Do you go for a walk?',facts:evidence});
 assert.equal(walk.parts[0].sources[0].quote,'I sometimes go for a walk.');
});

test('Punctuation and Unicode are preserved without case folding or approximate quotation matching',()=>{
  const question='What did you say—exactly?';
  assert.doesNotThrow(()=>validate(question,[unknown(question)],[]));
  assert.throws(()=>validate(question,[unknown('What did you say-exactly?')],[]),AnswerPlanError);
  assert.throws(()=>validate(question,[supported(question,source('routine','I Sometimes water the plants with my neighbor.'))],['routine']),AnswerPlanError);
});

test('Unsupported IDs, invented quotations and source mismatches fail locally',()=>{
  const question='What do you usually do?';
  for(const sources of [
    [source('EX_other_patient','I sometimes water the plants with my neighbor.')],
    [source('routine','I always water the plants with my neighbor.')],
    [source('future',facts[0].response)],
    [source('routine','')]
  ])assert.throws(()=>validate(question,[supported(question,...sources)],sources.map(item=>item.id)),AnswerPlanError);
  assert.throws(()=>validate(question,[supported(question,source('routine',facts[0].response))],['future']),AnswerPlanError);
  assert.throws(()=>validate(question,[supported(question,source('routine',facts[0].response))],['routine','future']),AnswerPlanError);
});

test('Unknown sources cannot masquerade as direct evidence and schemas have bounded complexity',()=>{
  const question='Who helped?';
  assert.throws(()=>validate(question,[{request:question,status:'unrecorded',sources:[source('routine',facts[0].response)]}],['routine']),AnswerPlanError);
  assert.throws(()=>validate(question,[{...supported(question,source('routine',facts[0].response)),contextSources:[]}],['routine']),AnswerPlanError);
  assert.throws(()=>validate(question,[{...unknown(question),answer:'The neighbor.'}],[]),AnswerPlanError);
  assert.throws(()=>validate(question,Array.from({length:5},()=>unknown(question)),[]),AnswerPlanError);
  assert.throws(()=>validate(question,[unknown(question,[source('routine',facts[0].response),source('future',facts[1].response),source('past',facts[2].response)])],['routine','future','past']),AnswerPlanError);
  assert.throws(()=>validate(question,[supported(question,source('routine',facts[0].response),source('routine',facts[0].response))],['routine']),AnswerPlanError);
});

test('Withheld supporting evidence does not become missing case information or leak through the plan',()=>{
  const question='What happened earlier and what do you hope to do?';
  const plan=validate(question,[supported('What happened earlier',source('past',facts[2].response)),supported('and what do you hope to do?',source('future',facts[1].response))],['past','future']);
  const projected=projectAnswerPlan(plan,{allowedFacts:[facts[2]]});
  assert.deepEqual(projected.factIds,['past']);assert.equal(projected.writerRequests[0].sources[0].timeframe,'before-simulation');
  assert.equal(projected.withheldParts.length,1);assert.equal(projected.exerciseNote,null);assert.deepEqual(projected.unrecordedParts,[]);
  assert.equal(JSON.stringify(projected.writerRequests).includes('herb bed'),false);
});

test('A multipart supported request requires all its evidence after disclosure',()=>{
  const question='How do your earlier activity and future wish differ?';
  const plan=validate(question,[supported(question,source('past',facts[2].response),source('future',facts[1].response))],['past','future']);
  const projected=projectAnswerPlan(plan,{allowedFacts:[facts[2]]});
  assert.deepEqual(projected.writerRequests,[]);assert.equal(projected.requiresWriter,false);assert.equal(projected.withheldParts.length,1);assert.equal(projected.exerciseNote,null);
});

test('Disclosure narrowing under the same fact ID cannot re-expose omitted content',()=>{
  const question='Who was with you?';
  const plan=validate(question,[supported(question,source('routine',facts[0].response))],['routine']);
  const projected=projectAnswerPlan(plan,{allowedFacts:[{id:'routine',response:'I sometimes water the plants.'}]});
  assert.deepEqual(projected.writerRequests,[]);assert.equal(projected.withheldParts.length,1);assert.equal(projected.exerciseNote,null);
});

test('Only disclosed context quotations are projected; omitted context does not erase the missing-detail note',()=>{
  const question='Who will attend?';
  const plan=validate(question,[unknown(question,[source('future',facts[1].response),source('past',facts[2].response)])],['future','past']);
  const projected=projectAnswerPlan(plan,{allowedFacts:[facts[1]]});
  assert.deepEqual(projected.factIds,['future']);assert.equal(projected.withheldParts.length,1);assert.ok(projected.exerciseNote.includes(question));
});

test('Missing-detail context keeps one active anchor without treating deliberately omitted background as undisclosed evidence',()=>{
 const question='Who will attend?';
 const plan=validate(question,[unknown(question,[source('past',facts[2].response),source('future',facts[1].response)])],['past','future']);
 const projected=projectAnswerPlan(plan,{allowedFacts:facts,preferredContextIds:['future']});
 assert.deepEqual(projected.factIds,['future']);assert.deepEqual(projected.withheldParts,[]);
 assert.equal(projected.writerRequests[0].sources.length,1);assert.ok(projected.exerciseNote.includes(question));
});

test('Separate unknown requests each retain their own closest context',()=>{
 const question='Who will visit the herb bed, and who helped with the pot?';
 const plan=validate(question,[unknown('Who will visit the herb bed',[source('future',facts[1].response)]),unknown('and who helped with the pot?',[source('past',facts[2].response)])],['future','past']);
 const projected=projectAnswerPlan(plan,{allowedFacts:facts});
 assert.equal(projected.writerRequests.length,2);assert.deepEqual(projected.factIds,['future','past']);
});

test('Caregiver statements remain caregiver evidence and no persona is invented by projection',()=>{
  const question='What did you observe?';
  const projected=projectAnswerPlan(validate(question,[supported(question,source('observer',facts[3].response))],['observer']),{allowedFacts:facts});
  assert.equal(projected.writerRequests[0].sources[0].quote,facts[3].response);
  assert.equal(Object.hasOwn(projected,'speaker'),false);assert.equal(Object.hasOwn(projected,'personality'),false);
});

test('Boundary routes remain boundaries and legacy plans require explicit compatibility',()=>{
  for(const kind of ['social','clarification','out_of_scope','safety_pause']){
    const plan=validateAnswerPlan({kind,fact_ids:[]},{question:'Hello.',facts});
    assert.equal(plan.state,'boundary');assert.equal(projectAnswerPlan(plan,{allowedFacts:facts}).requiresWriter,false);
    assert.throws(()=>validateAnswerPlan({kind,fact_ids:[],parts:[unknown('Hello.')]},{question:'Hello.',facts}),AnswerPlanError);
  }
  const route={kind:'answer',fact_ids:['routine']},args={question:'What is usual?',facts};
  assert.throws(()=>validateAnswerPlan(route,args),AnswerPlanError);
  const legacy=validateAnswerPlan(route,{...args,allowUnplanned:true});
  assert.equal(legacy.state,'unplanned');assert.ok(legacy.limitation.includes('not planned'));
  assert.deepEqual(projectAnswerPlan(legacy,{allowedFacts:facts}).writerRequests,[]);
});

test('Validation does not pretend exact quotations prove entailment',()=>{
  const question='What is your neighbor’s name?';
  // A semantic auditor must reject this association. Local validation verifies
  // only that the quoted words exist, IDs match and the request was not dropped.
  const plan=validate(question,[supported(question,source('routine',facts[0].response))],['routine']);
  assert.equal(plan.state,'planned');assert.match(ANSWER_PLAN_INSTRUCTION,/not merely the same topic/);
});

test('Validated plans and projections are immutable and do not modify canonical facts',()=>{
  const before=JSON.stringify(facts),question='What is your routine?';
  const plan=validate(question,[supported(question,source('routine',facts[0].response))],['routine']);
  const projection=projectAnswerPlan(plan,{allowedFacts:facts});
  assert.ok(Object.isFrozen(plan.parts[0].sources[0]));assert.ok(Object.isFrozen(projection.writerRequests[0]));
  assert.equal(JSON.stringify(facts),before);
});

const enjoymentFacts=[
  {id:'current',response:'My usual activities feel much less rewarding.',scope:'current'},
  {id:'interest',label:'Usual interests and hobbies',scope:'usual',response:'I usually make charcoal drawings and keep them in a folder.'},
  {id:'background',label:'Usual drawing supplies',scope:'usual',response:'I put spare drawings in a box.'},
  {id:'context',response:'I hope to visit the lake. That trip has not happened yet.',scope:'wish'}
];
const enjoymentPlan=(question,parts,canonical=enjoymentFacts)=>validateAnswerPlan({kind:'plan',parts},{question,facts:canonical});

test('Current general enjoyment gets one exact usual-interest anchor with conservative plural matching',()=>{
  const question='Do you enjoy drawing now?';
  const original=enjoymentPlan(question,[supported(question,source('current',enjoymentFacts[0].response))]);
  const before=JSON.stringify({original,facts:enjoymentFacts});
  const enriched=anchorUsualInterestSources(original,{facts:enjoymentFacts});
  assert.deepEqual(enriched.factIds,['current','interest']);
  assert.deepEqual(enriched.parts[0].sources.map(item=>item.quote),[enjoymentFacts[0].response,enjoymentFacts[1].response]);
  for(const key of ['request','start','end','status'])assert.equal(enriched.parts[0][key],original.parts[0][key]);
  assert.equal(JSON.stringify({original,facts:enjoymentFacts}),before);
  assert.ok(Object.isFrozen(enriched.parts[0].sources[1]));
  assert.equal(anchorUsualInterestSources(enriched,{facts:enjoymentFacts}),enriched);
});

test('The anchor generalizes to another activity and preserves caregiver wording and qualifiers',()=>{
  const canonical=[
    {id:'feeling',response:'Their usual hobbies seem a little less enjoyable.',scope:'current'},
    {id:'photos',topic:'Hobbies',scope:'usual',response:'They sometimes take photographs of trees with me.'}
  ];
  const question='Is taking a photograph still enjoyable?';
  const original=enjoymentPlan(question,[supported(question,source('feeling',canonical[0].response))],canonical);
  const enriched=anchorUsualInterestSources(original,{facts:canonical});
  assert.deepEqual(enriched.factIds,['feeling','photos']);
  assert.equal(enriched.parts[0].sources[1].quote,canonical[1].response);
  assert.equal(enriched.parts[0].sources[0].quote,canonical[0].response);
  const currentQuestion='How have your usual photographs felt recently?';
  const currentPlan=enjoymentPlan(currentQuestion,[supported(currentQuestion,source('feeling',canonical[0].response))],canonical);
  assert.deepEqual(anchorUsualInterestSources(currentPlan,{facts:canonical}).factIds,['feeling','photos']);
});

test('Current feeling wording can anchor a usual activity without putting the missing value into the writer',()=>{
  const question='How has your usual drawing felt lately, and what started that change?';
  const original=enjoymentPlan(question,[supported('How has your usual drawing felt lately',source('current',enjoymentFacts[0].response)),unknown('and what started that change?')]);
  const enriched=anchorUsualInterestSources(original,{facts:enjoymentFacts});
  assert.deepEqual(enriched.factIds,['current','interest']);
  assert.deepEqual(enriched.parts[1],original.parts[1]);
  const projected=projectAnswerPlan(enriched,{allowedFacts:enjoymentFacts});
  assert.ok(projected.exerciseNote.includes('what started that change'));
  assert.equal(JSON.stringify(projected.writerRequests).includes('started that change'),false);
});

test('A question or usual-interest source alone cannot establish current enjoyment',()=>{
  for(const question of ['Do you enjoy painting now?','What is in the drawing folder?','Are usual activities enjoyable?']){
    const original=enjoymentPlan(question,[supported(question,source('current',enjoymentFacts[0].response))]);
    assert.equal(anchorUsualInterestSources(original,{facts:enjoymentFacts}),original);
  }
  const question='Do you enjoy drawing now?';
  for(const part of [supported(question,source('interest',enjoymentFacts[1].response)),unknown(question,[source('current',enjoymentFacts[0].response)])]){
    const original=enjoymentPlan(question,[part]);
    assert.equal(anchorUsualInterestSources(original,{facts:enjoymentFacts}),original);
  }
});

test('Only a selected current enjoyment claim qualifies; labels, history and unselected sentences do not',()=>{
  const question='Do you enjoy drawing now?';
  for(const claim of [
    {id:'claim',label:'Current enjoyment',response:'I have low energy.'},
    {id:'claim',response:'My usual activities felt less rewarding.'},
    {id:'claim',scope:'past',response:'My usual activities feel less rewarding.'},
    {id:'claim',timeframe:'before-simulation',response:'My usual activities feel less rewarding.'},
    {id:'claim',scope:'wish',response:'My usual activities feel less rewarding.'},
    {id:'claim',response:'I hope my usual activities feel more rewarding.'},
    {id:'claim',response:'I have low energy. My usual activities feel less rewarding.',selectedQuote:'I have low energy.'}
  ]){
    const canonical=[...enjoymentFacts,claim];
    const original=enjoymentPlan(question,[supported(question,source('claim',claim.selectedQuote??claim.response))],canonical);
    assert.equal(anchorUsualInterestSources(original,{facts:canonical}),original);
  }
});

test('Ambiguous hobby sources or a wrong source scope leave the plan unchanged',()=>{
  const question='Do you enjoy drawing now?';
  for(const canonical of [
    [...enjoymentFacts,{id:'other-interest',label:'Hobbies',scope:'usual',response:'I usually share drawings with a friend.'}],
    enjoymentFacts.map(fact=>fact.id==='interest'?{...fact,scope:'past'}:fact),
    enjoymentFacts.map(fact=>fact.id==='interest'?{...fact,label:'Storage routine'}:fact)
  ]){
    const original=enjoymentPlan(question,[supported(question,source('current',enjoymentFacts[0].response))],canonical);
    assert.equal(anchorUsualInterestSources(original,{facts:canonical}),original);
  }
});

test('Direct evidence precedes optional context even when the unrecorded request appears first',()=>{
  const question='Who will join the trip, and how do activities feel?';
  const original=enjoymentPlan(question,[unknown('Who will join the trip',[source('context',enjoymentFacts[3].response)]),supported('and how do activities feel?',source('current',enjoymentFacts[0].response))]);
  assert.deepEqual(original.factIds,['current','context']);
  const full=projectAnswerPlan(original,{allowedFacts:enjoymentFacts});
  assert.deepEqual(full.factIds,['current','context']);
  assert.deepEqual(full.writerRequests.map(part=>part.kind),['context','answer']);
  const narrow=projectAnswerPlan(original,{allowedFacts:[enjoymentFacts[0]]});
  assert.deepEqual(narrow.factIds,['current']);
  assert.equal(narrow.writerRequests[0].kind,'answer');
  assert.ok(narrow.exerciseNote.includes('Who will join'));
});

test('The required source pair displaces only optional context when the four-ID allowance is full',()=>{
  const more=[{id:'sleep',response:'My sleep is broken.'},{id:'energy',response:'My energy is low.'}];
  const canonical=[...enjoymentFacts,...more],question='Who will join the trip, and do you enjoy drawing, and how are sleep and energy?';
  const original=enjoymentPlan(question,[
    unknown('Who will join the trip',[source('context',enjoymentFacts[3].response)]),
    supported('and do you enjoy drawing',source('current',enjoymentFacts[0].response)),
    supported('and how are sleep and energy?',...more.map(fact=>source(fact.id,fact.response)))
  ],canonical);
  const enriched=anchorUsualInterestSources(original,{facts:canonical});
  assert.deepEqual(enriched.factIds,['current','interest','sleep','energy']);
  assert.deepEqual(enriched.parts[0].contextSources,[]);
  assert.equal(enriched.parts[0].status,'unrecorded');
  assert.deepEqual(enriched.parts[2].sources,original.parts[2].sources);
  assert.ok(projectAnswerPlan(enriched,{allowedFacts:canonical}).exerciseNote.includes('Who will join'));
});

test('Four required direct IDs cannot be dropped to fit another anchor',()=>{
  const more=['a','b','c'].map((id,index)=>({id,response:`Recorded detail number ${index+1}.`}));
  const canonical=[...enjoymentFacts,...more],question='Do you enjoy drawing, and what else is recorded?';
  const original=enjoymentPlan(question,[supported('Do you enjoy drawing',source('current',enjoymentFacts[0].response)),supported('and what else is recorded?',...more.map(fact=>source(fact.id,fact.response)))],canonical);
  assert.equal(anchorUsualInterestSources(original,{facts:canonical}),original);
  assert.deepEqual(original.factIds,['current','a','b','c']);
});

test('Both enjoyment and activity sources are required after disclosure; neither alone can leak an answer',()=>{
  const question='Do you enjoy drawing now?';
  const original=enjoymentPlan(question,[supported(question,source('current',enjoymentFacts[0].response))]);
  const enriched=anchorUsualInterestSources(original,{facts:enjoymentFacts});
  for(const allowedFacts of [[enjoymentFacts[0]],[enjoymentFacts[1]]]){
    const projected=projectAnswerPlan(enriched,{allowedFacts});
    assert.equal(projected.requiresWriter,false);assert.deepEqual(projected.writerRequests,[]);
    assert.equal(projected.withheldParts.length,1);assert.equal(projected.exerciseNote,null);
  }
  assert.equal(projectAnswerPlan(enriched,{allowedFacts:enjoymentFacts}).requiresWriter,true);
});

test('Anchoring revalidates all supplied source quotations and leaves canonical inputs unchanged',()=>{
  const question='Do you enjoy drawing now?';
  const original=enjoymentPlan(question,[supported(question,source('current',enjoymentFacts[0].response))]);
  const tampered=structuredClone(original);tampered.parts[0].sources[0].quote='My usual activities feel completely unrewarding.';
  assert.throws(()=>anchorUsualInterestSources(tampered,{facts:enjoymentFacts}),AnswerPlanError);
  assert.throws(()=>anchorUsualInterestSources(original,{facts:enjoymentFacts.filter(fact=>fact.id!=='current')}),AnswerPlanError);
});
