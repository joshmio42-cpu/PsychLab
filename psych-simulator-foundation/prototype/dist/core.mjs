import {planInterviewTurn,agentVersion} from './agents.mjs';
export const domains = ['presenting','timeline','worry','control','associated','function','context','medical','medication','substances','alternatives','safety','support','goals','history'];
export function scoreGad7(values){
  if(!Array.isArray(values)||values.length!==7||values.some(v=>typeof v!=='number'||!Number.isInteger(v)||v<0||v>3)) throw new Error('Seven integer responses from 0 to 3 are required.');
  const total=values.reduce((a,b)=>a+b,0);
  return {total,band:total>=15?'Severe':total>=10?'Moderate':total>=5?'Mild':'Minimal',maximum:21};
}
export function startSession(caseData){return {caseId:caseData.id,caseVersion:caseData.version,agentVersion,agentTraces:[],turns:[],assessment:null,reasoning:null};}
export function askTopic(session,caseData,id){
  const {turn,trace}=planInterviewTurn(session,caseData,id);
  session.turns.push(turn);session.agentTraces.push(trace);return turn;
}
export function administer(session,caseData,rationale,explained){
  if(session.reasoning) throw new Error('This rehearsal has ended.');
  if(typeof rationale!=='string'||rationale.trim().length<10||explained!==true) throw new Error('Explain the purpose and confirm the timeframe before continuing.');
  session.assessment={name:'GAD-7',version:caseData.gad7.version,values:[...caseData.gad7.responses],...scoreGad7(caseData.gad7.responses),difficulty:caseData.gad7.difficulty,rationale:rationale.trim(),simulated:true};
  return session.assessment;
}
export function finish(session,reasoning){
  if(!session.turns.length) throw new Error('Explore at least one interview topic first.');
  const keys=['hypothesis','support','alternatives','missing','next'];
  if(!reasoning||keys.some(k=>typeof reasoning[k]!=='string'||reasoning[k].trim().length<3)) throw new Error('Complete all five reasoning fields. State uncertainty when appropriate.');
  session.reasoning=Object.fromEntries(keys.map(k=>[k,reasoning[k].trim()]));
  return makeReport(session);
}
export function makeReport(session){
  const covered=[...new Set(session.turns.flatMap(t=>t.domains))];
  return {title:'Formative rehearsal debrief',mode:'Scripted review prototype; not a live AI evaluation',caseId:session.caseId,caseVersion:session.caseVersion,rubricVersion:'0.1.0',sourceVersion:'2026-10-05',coverage:{covered,missing:domains.filter(x=>!covered.includes(x)),total:domains.length,meaning:'Topics opened, not a competence score.'},evidence:session.turns.map(t=>({turnId:t.id,question:t.question,quote:t.reply,factIds:[...t.factIds]})),assessment:session.assessment,reasoning:session.reasoning,ratings:['Interview coverage','Communication','Reasoning','Assessment use','Next steps and uncertainty'].map(name=>({name,rating:'NR',reason:'Qualified review pending; no automated clinical rating.'})),reviewStatus:'Not reviewed',sources:['S1','S2','S3','S6','S7']};
}
export function reportText(r){
  return `${r.title}\n${r.mode}\nCase ${r.caseId} v${r.caseVersion} | rubric ${r.rubricVersion} | sources ${r.sourceVersion}\n\nTOPICS OPENED ${r.coverage.covered.length}/${r.coverage.total}\n${r.coverage.meaning}\nOpened: ${r.coverage.covered.join(', ')}\nStill unexplored: ${r.coverage.missing.join(', ')||'All authored topic areas opened; depth still needs review.'}\n\nASSESSMENT\n${r.assessment?`Simulated ${r.assessment.name}: ${r.assessment.total}/21, ${r.assessment.band} anxiety symptoms. Not a diagnosis. Purpose: ${r.assessment.rationale}`:'Not administered. No result is disclosed.'}\n\nLEARNER REASONING\n${Object.entries(r.reasoning||{}).map(([k,v])=>`${k}: ${v}`).join('\n')}\n\nEVIDENCE\n${r.evidence.map(e=>`${e.turnId} | ${e.factIds.join(', ')}\nQuestion: ${e.question}\nClient: ${e.quote}`).join('\n\n')}\n\nRATINGS\n${r.ratings.map(x=>`${x.name}: ${x.rating} - ${x.reason}`).join('\n')}\n\nNEXT REVIEW\nUse the rubric to examine your question quality, evidence and alternatives with a supervisor. Coverage is descriptive. Hidden-case facts are not evidence you elicited. This report is not a certification.\n`;
}
