import test from 'node:test';
import assert from 'node:assert/strict';
import {answerQuestion,planningCatalog,requestPayload,patientEvidenceStatement} from '../model.mjs';
import {simulateHistory} from '../engine.mjs';
import {disorderOptions} from '../disorders.mjs';
import {patientOptions} from '../patients.mjs';
import {ECONOMY} from '../usage.mjs';

const source=(id,quote)=>({id,quote});
const known=(request,...sources)=>({request,status:'supported',sources});
const unknown=(request,contextSources=[])=>({request,status:'unrecorded',sources:[],...(contextSources.length?{contextSources}:{})});
const route=(parts,fact_ids)=>({kind:fact_ids.length?'answer':'unavailable',parts,fact_ids});
function fixture(){
  const snapshot=structuredClone(simulateHistory({patientId:'jordan',disorderId:'none',days:14,seed:391}));
  snapshot.facts=[
    {id:'F1',label:'Future growing plan',response:'I would like to plant herbs in a box. That plan has not been carried out.',scope:'wish',domains:['goals'],sources:[]},
    {id:'F2',label:'Usual plant routine',response:'I sometimes water plants with my neighbor.',scope:'usual',domains:['support'],sources:[]},
    {id:'F3',label:'An earlier pot',response:'Before this diary, I put a blue pot beside the gate.',scope:'past',timeframe:'before-simulation',domains:['support'],sources:[]}
  ];
  return snapshot;
}
function plannedProvider({plan,reply,audit}={}){
  const calls=[];
  let lastIds=[];
  return {configured:true,supportsAnswerPlan:true,model:'MOCK-PLANNED-NO-NETWORK',calls,
    async complete(request){
      const payload=requestPayload(request);
      const record={role:request.role,input:structuredClone(request.input),instruction:request.instruction,bytes:payload.bytes};calls.push(record);
      let value;
      if(request.role==='CORTEX')value=typeof plan==='function'?plan(request.input):plan;
      else if(request.role==='LANGUAGE'){
        value=typeof reply==='function'?reply(request.input):reply??{reply:request.input.permittedFacts[0].statement,fact_ids:[request.input.permittedFacts[0].id]};
        lastIds=value.fact_ids;
      }else value=typeof audit==='function'?audit(request.input):audit??{unsupported:[],supported:true,relevant:true,no_leak:true,fact_ids:lastIds};
      record.value=structuredClone(value);
      return {value,meta:{role:request.role,requestedModel:'MOCK-PLANNED-NO-NETWORK',returnedModel:'MOCK-PLANNED-NO-NETWORK',usage:{},inputBytes:payload.bytes}};
    }
  };
}
const ask=(snapshot,provider,question,options={})=>answerQuestion({snapshot,provider,question,turns:[],...options});

test('Authored provenance limits are not patient ignorance, while authored patient uncertainty stays usable',()=>{
 const statement='I felt little interest. This is my account of the experience; its cause is not established by this moment alone. It affected how I took part.';
 assert.equal(patientEvidenceStatement(statement),'I felt little interest. It affected how I took part.');
 const personal='I did not know why the plan changed. I cannot say what the child thought.';
 assert.equal(patientEvidenceStatement(personal),personal);
});

test('Simulation coverage remains in the frozen record but cannot become patient evidence',async()=>{
  const snapshot=simulateHistory({patientId:'avery',disorderId:'gad',days:7,seed:104}),before=JSON.stringify(snapshot);
  const scope=snapshot.facts.find(f=>f.id==='G03'),course=snapshot.facts.find(f=>f.id==='B01');
  const question='How long have you been having these experiences?';
  const provider=plannedProvider({plan:input=>{
    assert.equal(input.catalog.some(f=>f.id==='G03'),false);
    assert.equal(input.catalog.find(f=>f.id==='B01').statement,course.response);
    return {kind:'plan',parts:[known(question,source('B01',course.response))]};
  }});
  const result=await ask(snapshot,provider,question);
  assert.deepEqual(result.factIds,['B01']);assert.equal(JSON.stringify(snapshot),before);
  assert.match(scope.response,/7 recent simulated days/);
  const invalid=plannedProvider({plan:{kind:'plan',parts:[known(question,source('G03',scope.response))]}});
  await assert.rejects(ask(snapshot,invalid,question),/evidence plan failed validation/);
  assert.deepEqual(invalid.calls.map(call=>call.role),['CORTEX']);
});

test('A misleading social route for substantive wellbeing uses exact current evidence through writer and audit',async()=>{
  const snapshot=simulateHistory({patientId:'jordan',disorderId:'mdd',days:14,seed:91}),before=JSON.stringify(snapshot);
  const course=snapshot.facts.find(fact=>fact.id==='B01');
  for(const [difficulty,question] of [['beginner','Hey, how have you been?'],['standard','How are you doing?'],['challenging','Hello, how are things?']]){
    const provider=plannedProvider({plan:{kind:'social',fact_ids:[]},reply:input=>{
      assert.deepEqual(input.permittedFacts,[{id:course.id,statement:patientEvidenceStatement(course.response)}]);
      assert.deepEqual(input.requests[0].fact_ids,[course.id]);
      return {reply:patientEvidenceStatement(course.response),fact_ids:[course.id]};
    },audit:input=>{
      assert.equal(input.interaction,'answer');assert.equal(input.requests[0].request,question);
      assert.deepEqual(input.draftFactIds,[course.id]);
      return {unsupported:[],supported:true,relevant:true,no_leak:true,fact_ids:[course.id]};
    }});
    const result=await ask(snapshot,provider,question,{difficulty});
    assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE','AUDITOR']);
    assert.equal(result.interaction,'answer');assert.deepEqual(result.factIds,[course.id]);
    assert.equal(result.trace.answerPlan.parts[0].sources[0].quote,patientEvidenceStatement(course.response));
    assert.equal(result.trace.disclosure.maxFacts,{beginner:4,standard:2,challenging:1}[difficulty]);
  }
  assert.equal(JSON.stringify(snapshot),before);
});

test('Wellbeing without recorded current evidence is unrecorded, never a social wellness assertion',async()=>{
  const snapshot=fixture(),question='Hey, how have you been?';
  const provider=plannedProvider({plan:{kind:'social',fact_ids:[]},reply:{reply:"I've been okay, thanks.",fact_ids:[]}});
  const result=await ask(snapshot,provider,question);
  assert.equal(result.kind,'unavailable');assert.deepEqual(result.factIds,[]);
  assert.equal(result.reply,'That detail isn’t available for this interview.');
  assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX']);
});

test('Wellbeing correction preserves true greetings and safety/out-of-scope boundaries',async()=>{
  const snapshot=simulateHistory({patientId:'jordan',disorderId:'mdd',days:7,seed:11});
  const greeting=plannedProvider({plan:{kind:'social',fact_ids:[]},reply:{reply:'Hello.',fact_ids:[]}});
  const hello=await ask(snapshot,greeting,'Hello!');
  assert.equal(hello.interaction,'social');assert.deepEqual(hello.factIds,[]);
  assert.deepEqual(greeting.calls.map(call=>call.role),['CORTEX','LANGUAGE']);
  for(const kind of ['safety_pause','out_of_scope']){
    const provider=plannedProvider({plan:{kind,fact_ids:[]}});
    const result=await ask(snapshot,provider,'How have you been?');
    assert.equal(result.kind,kind);assert.deepEqual(result.factIds,[]);
    assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX']);
  }
});

test('A corrected wellbeing route still rejects a writer claim lacking support',async()=>{
  const snapshot=simulateHistory({patientId:'jordan',disorderId:'mdd',days:7,seed:13});
  const provider=plannedProvider({plan:{kind:'social',fact_ids:[]},reply:{reply:"I've been okay, thanks.",fact_ids:['B01']},audit:{unsupported:["I've been okay"],supported:false,relevant:true,no_leak:true,fact_ids:['B01']}});
  await assert.rejects(ask(snapshot,provider,'How have you been?'),/factual check|support check/);
});

test('Every difficulty sends the minimum-complete-bundle instruction and unchanged disclosure budget',async()=>{
  const snapshot=fixture(),question='What is your usual plant routine?';
  for(const [difficulty,maxFacts] of [['beginner',4],['standard',2],['challenging',1]]){
    const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F2',snapshot.facts[1].response))]}});
    await ask(snapshot,provider,question,{difficulty});
    const planner=provider.calls[0];
    assert.equal(planner.input.maxFacts,maxFacts);
    for(const rule of [/input\.maxFacts is the disclosure budget/,/minimum complete bundles/,/all sources in a part are mandatory/,/Omit optional background\/examples/,/never necessary sources or qualifiers/,/Keep usual-activity\/current-enjoyment pairs/,/Preserve every request/,/Never mark known information unrecorded/])assert.match(planner.instruction,rule);
  }
});

test('Planned mixed answers use exactly three calls and keep the unknown request outside patient generation',async()=>{
  const snapshot=fixture(),before=JSON.stringify(snapshot),question='What is your usual plant routine, and what is the neighbor’s name?';
  const provider=plannedProvider({plan:route([known('What is your usual plant routine',source('F2',snapshot.facts[1].response)),unknown('and what is the neighbor’s name?')],['F2']),reply:{reply:'Sometimes I water plants with my neighbor.',fact_ids:['F2']}});
  const result=await ask(snapshot,provider,question);
  assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE','AUDITOR']);
  const writing=provider.calls[1].input;
  assert.equal(writing.requests[0].request,'State the selected evidence for this part.');assert.equal(JSON.stringify(writing).includes('neighbor’s name'),false);
  assert.deepEqual(result.factIds,['F2']);assert.deepEqual(result.sourceIds,[]);
  assert.equal(result.exerciseNote,'Not recorded for this interview: “and what is the neighbor’s name?”');
  assert.equal(result.reply.includes('Not recorded'),false);assert.equal(result.trace.answerPlan.state,'planned');
  assert.deepEqual(provider.calls[2].input.requests.map(part=>part.request),['What is your usual plant routine','and what is the neighbor’s name?']);assert.equal(provider.calls[2].input.question,undefined);assert.equal(JSON.stringify(snapshot),before);
  assert.ok(provider.calls.every(call=>call.bytes<=ECONOMY.maxInputBytes));
});

test('Unknown requested values can get natural known context without turning absence into patient indecision',async()=>{
  const snapshot=fixture(),question='Which visitor has agreed to attend your planting day?';
  const provider=plannedProvider({plan:route([unknown(question,[source('F1',snapshot.facts[0].response)])],['F1'])});
  const result=await ask(snapshot,provider,question);
  const writing=provider.calls.find(call=>call.role==='LANGUAGE').input;
  assert.equal(writing.requests[0].request,'Briefly describe this recorded context.');
  assert.equal(JSON.stringify(writing).includes('agreed to attend'),false);
  assert.equal(writing.requests[0].kind,'context');assert.equal(writing.permittedFacts[0].scope,'wish');
  assert.equal(result.reply,snapshot.facts[0].response);assert.ok(result.exerciseNote.includes(question));
  assert.deepEqual(result.factIds,['F1']);assert.equal(result.reply.includes('decided'),false);
});

test('The new plan wire format reaches generation with locally derived source IDs',async()=>{
  const snapshot=fixture(),question='Have you planted that herb box already?';
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F1',snapshot.facts[0].response))]}});
  const result=await ask(snapshot,provider,question);
  assert.deepEqual(result.factIds,['F1']);assert.equal(result.trace.route.kind,'answer');
  assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE','AUDITOR']);
  assert.equal(result.reply,snapshot.facts[0].response);
});

test('A named usual hobby and its current enjoyment claim reach the writer as one supported evidence unit',async()=>{
  const snapshot=fixture(),question='How have your usual photographs felt lately?';
  const interest={id:'HOBBY',label:'Usual interests and hobbies',scope:'usual',response:'Usually, I take photographs of buildings.',domains:['support'],sources:[]};
  const experience={id:'EXPERIENCE',label:'Current experience',response:'Activities I usually enjoy feel much less rewarding.',domains:['presenting'],sources:[]};
  snapshot.facts.push(interest,experience);
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source(experience.id,experience.response))]},reply:input=>{
    assert.deepEqual(new Set(input.permittedFacts.map(f=>f.id)),new Set([interest.id,experience.id]));
    return {reply:'I usually take photographs of buildings. Things I usually enjoy feel much less rewarding.',fact_ids:[interest.id,experience.id]};
  }});
  const result=await ask(snapshot,provider,question);
  assert.deepEqual(new Set(result.factIds),new Set([interest.id,experience.id]));
  assert.equal(provider.calls.length,3);
});

test('Leading dates and assumptions reach planning and audit but never the patient writer',async()=>{
  const snapshot=fixture(),question='Was that plant routine something you did this morning?';
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F2',snapshot.facts[1].response))]}});
  await ask(snapshot,provider,question);
  assert.equal(provider.calls[0].input.question,question);
  assert.equal(JSON.stringify(provider.calls[1].input).includes('this morning'),false);
  assert.equal(provider.calls[1].input.permittedFacts[0].statement,snapshot.facts[1].response);
  assert.equal(provider.calls[2].input.requests[0].request,question);
});

test('Omitted direct evidence renders the complete disclosed excerpts before the same audit',async()=>{
  const snapshot=fixture(),before=JSON.stringify(snapshot),question='How do your usual routine and future plan compare?';
  const expected=snapshot.facts.slice(0,2).map(f=>f.response).join('\n\n');
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F1',snapshot.facts[0].response),source('F2',snapshot.facts[1].response))]},reply:{reply:'Sometimes I water plants with my neighbor.',fact_ids:['F2']},audit:input=>{
    assert.equal(input.candidate,expected);assert.deepEqual(input.draftFactIds,['F1','F2']);
    return {unsupported:[],supported:true,relevant:true,no_leak:true,fact_ids:['F1','F2']};
  }});
  const result=await ask(snapshot,provider,question);
  assert.equal(result.reply,expected);assert.deepEqual(result.factIds,['F1','F2']);
  assert.ok(result.trace.renderRepair);assert.equal(result.trace.renderRepair.extraModelCalls,0);
  assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE','AUDITOR']);
  assert.equal(result.reply.includes('blue pot'),false);assert.equal(JSON.stringify(snapshot),before);
});

test('Omitting optional missing-detail context alone does not force source rendering',async()=>{
  const snapshot=fixture(),question='What is your routine, and what was the gate address?';
  const provider=plannedProvider({plan:{kind:'plan',parts:[known('What is your routine',source('F2',snapshot.facts[1].response)),unknown('and what was the gate address?',[source('F3',snapshot.facts[2].response)])]},reply:{reply:'Sometimes I water plants with my neighbor.',fact_ids:['F2']}});
  const result=await ask(snapshot,provider,question);
  assert.equal(result.reply,'Sometimes I water plants with my neighbor.');
  assert.equal(result.trace.renderRepair,undefined);assert.deepEqual(result.factIds,['F2']);
  assert.match(result.exerciseNote,/gate address/);assert.equal(provider.calls.length,3);
});

test('The writer gets selected excerpts while the auditor retains qualifiers and the prior referent',async()=>{
  const snapshot=fixture(),question='How do the earlier pot and the future plan compare?';
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F3','I put a blue pot beside the gate.'))]},audit:input=>{
    assert.deepEqual(input.referenceFactIds,['F1']);
    assert.equal(input.referenceContext[0].statement,snapshot.facts[0].response);
    assert.equal(input.permittedFacts[0].statement,snapshot.facts[2].response);
    return {unsupported:[],supported:true,relevant:false,no_leak:true,fact_ids:['F3']};
  }});
  const turns=[{kind:'answer',question:'What would you like to plant?',reply:snapshot.facts[0].response,factIds:['F1']}];
  await assert.rejects(ask(snapshot,provider,question,{turns}),/support check/);
  assert.equal(provider.calls[0].input.catalog[0].id,'F1');assert.equal(provider.calls[0].input.catalog[0].referenced,true);
  assert.equal(provider.calls[1].input.permittedFacts[0].statement,snapshot.facts[2].response);
  assert.equal(provider.calls[1].input.permittedFacts.some(f=>f.id==='F1'),false);
});

test('Planned writer receives factual memory interpretations only through selected evidence',async()=>{
  const snapshot=simulateHistory({patientId:'avery',disorderId:'gad',days:7,seed:811});
  const fact=snapshot.facts.find(f=>f.id==='E01');
  const statement=patientEvidenceStatement(fact.response),question='What happened on day 1?';
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('E01',statement))]}});
  const result=await ask(snapshot,provider,question);
  const writer=provider.calls.find(call=>call.role==='LANGUAGE').input;
  assert.equal(Object.hasOwn(writer.agentContext.mentalPremise,'mnemosyne'),false);
  assert.ok(writer.agentContext.mentalPremise.cortex);
  assert.equal(JSON.stringify(writer).includes('cause is not established by this moment alone'),false);
  assert.ok(result.trace.agentContext.mentalPremise.mnemosyne.length>0,'The debugging trace retains source provenance.');
});

test('An unambiguous callback cannot route to a similar but different older source',async()=>{
  const snapshot=fixture(),question='What happens in its next step?';
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F3',snapshot.facts[2].response))]}});
  const turns=[{kind:'answer',question:'What would you like to plant?',reply:snapshot.facts[0].response,factIds:['F1']}];
  await assert.rejects(ask(snapshot,provider,question,{turns}),/routing failed validation/);
  assert.deepEqual(provider.calls[0].input.catalog.map(f=>f.id),['F1']);assert.equal(provider.calls.length,1);
});

test('A wholly unrecorded detail is a local exercise boundary with no patient-writing call',async()=>{
  const snapshot=fixture(),question='What is the street address?';
  const provider=plannedProvider({plan:route([unknown(question)],[])});
  const result=await ask(snapshot,provider,question);
  assert.equal(result.kind,'unavailable');assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX']);
  assert.deepEqual(result.factIds,[]);assert.deepEqual(result.sourceIds,[]);
  assert.equal(result.reply,'That detail isn’t available for this interview.');
});

test('A source-free planned boundary may omit redundant empty citations, but cannot smuggle source IDs',async()=>{
  const snapshot=fixture();
  const provider=plannedProvider({plan:{kind:'social',parts:[]},reply:{reply:'Hi.',fact_ids:[]}});
  const result=await ask(snapshot,provider,'Hello.');
  assert.equal(result.reply,'Hi.');assert.deepEqual(result.factIds,[]);
  const invalid=plannedProvider({plan:{kind:'social',fact_ids:['F1']},reply:{reply:'Hi.',fact_ids:[]}});
  await assert.rejects(ask(snapshot,invalid,'Hello.'),/routing failed validation/);
  assert.equal(invalid.calls.length,1);
});

test('Malformed, incomplete and fabricated plans reject before the writer is called',async()=>{
  const snapshot=fixture(),question='What is your routine, and who visits?';
  for(const plan of [
    {kind:'answer',fact_ids:['F2']},
    route([known('What is your routine',source('F2',snapshot.facts[1].response))],['F2']),
    route([known(question,source('F2','I always water plants with my neighbor.'))],['F2']),
    route([unknown(question,[source('F2',snapshot.facts[0].response)])],['F2'])
  ]){
    const provider=plannedProvider({plan});
    await assert.rejects(ask(snapshot,provider,question),/evidence plan failed validation/);
    assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX']);
  }
});

test('Challenging disclosure preserves the selected first part and identifies later evidence as withheld',async()=>{
  const snapshot=fixture(),question='What is your usual routine, and what happened earlier?';
  const provider=plannedProvider({plan:route([known('What is your usual routine',source('F2',snapshot.facts[1].response)),known('and what happened earlier?',source('F3',snapshot.facts[2].response))],['F2','F3'])});
  const result=await ask(snapshot,provider,question,{difficulty:'challenging'});
  assert.deepEqual(result.factIds,['F2']);assert.equal(result.exerciseNote,undefined);
  assert.equal(result.trace.planProjection.withheldParts.length,1);
  const writing=provider.calls[1].input;
  assert.deepEqual(writing.permittedFacts.map(fact=>fact.id),['F2']);assert.equal(JSON.stringify(writing).includes('blue pot'),false);
  assert.deepEqual(provider.calls[2].input.withheldFactIds,['F3']);
});

test('Challenging opening quotes and writes only the authored brief version',async()=>{
  const snapshot=simulateHistory({patientId:'jordan',disorderId:'mdd',days:14,seed:412}),question='What brings you here?';
  const opening=snapshot.facts.find(fact=>fact.id==='G01');assert.ok(opening.briefResponse);
  const provider=plannedProvider({plan:input=>route([known(question,source('G01',input.catalog.find(fact=>fact.id==='G01').statement))],['G01'])});
  const result=await ask(snapshot,provider,question,{difficulty:'challenging'});
  assert.equal(provider.calls[0].input.catalog.find(fact=>fact.id==='G01').statement,opening.briefResponse);
  assert.equal(provider.calls[1].input.permittedFacts.find(fact=>fact.id==='G01').statement,opening.briefResponse);
  assert.equal(result.reply,opening.briefResponse);assert.equal(result.trace.disclosure.briefOpening,true);
});

test('A selected multi-source part cannot leak partially when challenging disclosure withholds a required source',async()=>{
  const snapshot=fixture(),question='How does your earlier activity compare with the future plan?';
  const provider=plannedProvider({plan:route([known(question,source('F3',snapshot.facts[2].response),source('F1',snapshot.facts[0].response))],['F3','F1'])});
  const result=await ask(snapshot,provider,question,{difficulty:'challenging'});
  assert.equal(result.kind,'clarification');assert.equal(result.trace.planProjection.withheldParts.length,1);
  assert.deepEqual(result.factIds,[]);assert.equal(result.exerciseNote,undefined);assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX']);
});

test('Planned caregiver generation preserves interview identity and observed-perspective source',async()=>{
  const snapshot=simulateHistory({patientId:'mika',disorderId:'none',days:14,seed:742}),question='How do you describe your observations?';
  const fact=snapshot.facts.find(item=>item.id==='P03');
  const provider=plannedProvider({plan:route([known(question,source('P03',fact.response))],['P03'])});
  const result=await ask(snapshot,provider,question);
  const voice=provider.calls[1].input.agentContext;
  assert.equal(voice.interview.perspective,'caregiver');assert.equal(voice.interview.patient,'Mika');
  assert.match(voice.interview.speaker,/caregiver/);assert.ok(voice.personality.communication);assert.ok(voice.mentalPremise.cortex);
  assert.equal(result.reply,fact.response);assert.deepEqual(result.factIds,['P03']);
});

test('Semantic support remains an independent gate after locally valid source quotations',async()=>{
  const snapshot=fixture(),question='What is your routine?';
  const provider=plannedProvider({plan:route([known(question,source('F2',snapshot.facts[1].response))],['F2']),audit:{unsupported:['unsupported claim'],supported:false,relevant:true,no_leak:true,fact_ids:['F2']}});
  await assert.rejects(ask(snapshot,provider,question),/support check/);
  assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE','AUDITOR']);
});

test('Unverified causal wording uses exact selected excerpts and still receives the independent audit',async()=>{
  const snapshot=fixture(),question='What happened on that earlier walk?';
  const statement='I felt tired on an earlier walk. I stopped by the gate.';
  snapshot.facts.push({id:'F4',label:'Earlier walk',response:statement,domains:['context'],sources:[]});
  const rawDraft='I felt tired on an earlier walk, so I stopped by the gate.';
  const provider=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F4',statement))]},reply:{reply:rawDraft,fact_ids:['F4']},audit:input=>{
    assert.equal(input.candidate,statement);assert.deepEqual(input.draftFactIds,['F4']);
    return {unsupported:[],supported:true,relevant:true,no_leak:true,fact_ids:['F4']};
  }});
  const result=await ask(snapshot,provider,question);
  assert.equal(result.reply,statement);assert.ok(result.trace.renderRepair);
  assert.deepEqual(provider.calls.map(call=>call.role),['CORTEX','LANGUAGE','AUDITOR']);
  assert.equal(provider.calls[1].value.reply,rawDraft);
  const rejected=plannedProvider({plan:{kind:'plan',parts:[known(question,source('F4',statement))]},reply:{reply:rawDraft,fact_ids:['F4']},audit:{unsupported:[],supported:true,relevant:false,no_leak:true,fact_ids:['F4']}});
  await assert.rejects(ask(snapshot,rejected,question),/support check/);
});

test('Writer cannot cite a disclosed ID excluded from the projected writer evidence',async()=>{
  const snapshot=fixture(),question='How do the future plan, earlier activity and routine compare, and what happened earlier?';
  const plan=route([known('How do the future plan, earlier activity and routine compare',source('F1',snapshot.facts[0].response),source('F3',snapshot.facts[2].response),source('F2',snapshot.facts[1].response)),known('and what happened earlier?',source('F3',snapshot.facts[2].response))],['F1','F3','F2']);
  const provider=plannedProvider({plan,reply:{reply:snapshot.facts[2].response,fact_ids:['F1']}});
  await assert.rejects(ask(snapshot,provider,question),/evidence validation|evidence references|factual check/);
});

test('Auditor cannot return a citation for a withheld request excluded from projected evidence',async()=>{
  const snapshot=fixture(),question='How do the future plan, earlier activity and routine compare, and what happened earlier?';
  const plan=route([known('How do the future plan, earlier activity and routine compare',source('F1',snapshot.facts[0].response),source('F3',snapshot.facts[2].response),source('F2',snapshot.facts[1].response)),known('and what happened earlier?',source('F3',snapshot.facts[2].response))],['F1','F3','F2']);
  const provider=plannedProvider({plan,audit:{unsupported:[],supported:true,relevant:true,no_leak:true,fact_ids:['F1']}});
  await assert.rejects(ask(snapshot,provider,question),/evidence validation|evidence references|factual check/);
});

test('Planning catalog retains complete source statements and prioritizes explicitly requested diary days',()=>{
  const snapshot=simulateHistory({patientId:'jordan',disorderId:'mdd',days:90,seed:39});
  const catalog=planningCatalog(snapshot.facts,'What happened on day 2?',['E89']);
  assert.ok(catalog.some(fact=>fact.id==='E02'));assert.ok(catalog.some(fact=>fact.id==='E89'));
  for(const fact of catalog)assert.equal(fact.statement,snapshot.facts.find(item=>item.id===fact.id).response);
  assert.equal(catalog.filter(fact=>/^E\d+$/.test(fact.id)).length,6);
  assert.equal(catalog.filter(fact=>!/^E\d+$/.test(fact.id)).length,snapshot.facts.filter(fact=>!/^E\d+$/.test(fact.id)).length);
});

test('All 67 disorder options plus no disorder fit three planned calls with maximum Unicode questions and long history',async()=>{
  const patients=patientOptions(),options=disorderOptions(),failures=[];
  assert.equal(options.length,68);
  const question='Which unrecorded person is named here? '+('界'.repeat(1460));assert.ok(question.length<=1500);
  for(const option of options){
    const patient=patients.find(item=>option.stages.includes(item.lifeStage));assert.ok(patient,option.id);
    const snapshot=simulateHistory({patientId:patient.id,disorderId:option.id,days:90,seed:710});
    const fact=snapshot.facts.find(item=>item.id==='P03');
    const provider=plannedProvider({plan:route([unknown(question,[source('P03',fact.response)])],['P03'])});
    const turns=Array.from({length:24},(_,i)=>({id:`turn-${i}`,kind:'answer',question:'Earlier recorded topic? '+('古'.repeat(400)),reply:'A prior answer. '+('話'.repeat(400)),factIds:['P03']}));
    try{
      const result=await ask(snapshot,provider,question,{turns});
      assert.equal(result.kind,'answer');assert.equal(provider.calls.length,3);
      assert.ok(provider.calls.every(call=>call.bytes<=ECONOMY.maxInputBytes));
      assert.equal(provider.calls[0].input.question,question);assert.equal(provider.calls[2].input.requests.map(part=>part.request).join(''),question);
      assert.equal(provider.calls[1].input.agentContext.interview.patient,snapshot.name);
    }catch(error){failures.push(`${option.id}: ${error.message} (${provider.calls.map(call=>call.role).join(',')})`);}
  }
  assert.deepEqual(failures,[]);
});
