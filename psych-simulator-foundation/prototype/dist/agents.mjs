// Deterministic interview responsibilities, not validated psychological models.
export const agentVersion = '0.1.0';
export const agentRegistry = Object.freeze([
  {id:'IDENTITY', role:'Coordinates TRAIT, SCHEMA and MOTIVE using authored context.'},
  {id:'MNEMOSYNE', role:'Retrieves previously disclosed interview evidence; does not invent memories.'},
  {id:'CORTEX', role:'Resolves the explicitly selected authored topic; does not infer intent.'},
  {id:'AFFECT', role:'Supplies authored expression guidance; no computed emotion or mood.'},
  {id:'SOCIAL', role:'Selects the permitted authored response.'},
  {id:'EVIDENCE', role:'Collects source references; does not verify scientific support.'},
  {id:'AUDITOR', role:'Rejects altered text, unsupported fact IDs and case mismatches before commit.'},
  {id:'OBSERVER', role:'Summarizes disclosed evidence only; no diagnostic inference.'},
  {id:'ANALYST', role:'Summarizes topic repetition from the observation view.'}
].map(Object.freeze));

// Explicit allowlist: never pass the case, trace, or hidden profile to observers.
export function observationView(session) {
  return {
    turns:session.turns.map(t=>({id:t.id,question:t.question,reply:t.reply})),
    assessment:session.assessment ? {
      name:session.assessment.name,total:session.assessment.total,band:session.assessment.band
    } : null
  };
}
export function observe(view) {
  return {status:'Descriptive evidence only; no psychological classification',
    evidence:view.turns.map(t=>({turnId:t.id,quote:t.reply})),
    assessment:view.assessment ? {...view.assessment} : null};
}
export function analyze(view) {
  const unique = new Set(view.turns.map(t=>t.question)).size;
  return {exchanges:view.turns.length,distinctQuestions:unique,
    repeatedQuestions:view.turns.length-unique,meaning:'Counts do not measure competence.'};
}
export function auditTurn(turn, fact, expectedId) {
  if (turn.id!==expectedId || turn.question!==fact.question || turn.reply!==fact.response ||
      turn.mode!=='scripted' || JSON.stringify(turn.factIds)!==JSON.stringify([fact.id]) ||
      JSON.stringify(turn.domains)!==JSON.stringify(fact.domains)) {
    throw new Error('Agent proposal failed authored-evidence validation.');
  }
  return {status:'pass',checks:['Exact authored question and response','Exact fact and domain references','Sequential turn ID']};
}
export function planInterviewTurn(session, caseData, topicId) {
  if(session.reasoning) throw new Error('This rehearsal has ended. Start a new session to continue.');
  if(session.caseId!==caseData.id || session.caseVersion!==caseData.version) throw new Error('Case does not match this session.');
  const fact=caseData.facts.find(f=>f.id===topicId);
  if(!fact) throw new Error('That topic is not authored for this case.');
  const identity={
    profile:caseData.background,
    TRAIT:{status:'Unspecified; no Big Five or temperament scores authored'},
    SCHEMA:{status:'Unspecified; no belief or attachment model authored'},
    MOTIVE:{factIds:caseData.facts.filter(f=>f.domains.includes('goals')).map(f=>f.id),status:'Authored goals; no inferred utility scores'}
  };
  const memory=session.turns.filter(t=>t.factIds.includes(topicId)).map(t=>({turnId:t.id,quote:t.reply}));
  const cortex={selectedTopic:topicId,method:'Explicit learner topic selection',alternatives:'Not modeled'};
  const affect={guidance:caseData.affect,status:'Authored guidance only; no emotional state update'};
  const turn={id:`T${session.turns.length+1}`,question:fact.question,reply:fact.response,
    factIds:[fact.id],domains:[...fact.domains],mode:'scripted'};
  // The renderer only receives selected speech, not profile, formulation or assessment.
  const rendererInput={speech:fact.response};
  const audit=auditTurn(turn,fact,`T${session.turns.length+1}`);
  return {turn,trace:{version:agentVersion,turnId:turn.id,mode:'deterministic authored interview',
    steps:[
      {agent:'IDENTITY',output:identity},
      {agent:'MNEMOSYNE',output:{retrieved:memory}},
      {agent:'CORTEX',output:cortex},
      {agent:'AFFECT',output:affect},
      {agent:'SOCIAL',output:{action:'Answer selected interview topic',factIds:[fact.id]}},
      {agent:'EVIDENCE',output:{sourceIds:[...fact.sources],status:'References only; support not automatically verified'}},
      {agent:'AUDITOR',output:audit}
    ],rendererInput}};
}
