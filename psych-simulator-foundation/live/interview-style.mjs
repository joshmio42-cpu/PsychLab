const LEVELS=[
 {id:'beginner',name:'Beginner',description:'Clear explanations with more relevant detail offered up front.',maxFacts:4,instruction:'Explain concerns plainly in 2–3 short sentences. Offer the relevant detail supplied, without coaching or naming a diagnosis.'},
 {id:'standard',name:'Standard',description:'Natural conversation; follow-up questions bring out more detail.',maxFacts:2,instruction:'Answer naturally in 1–3 concise sentences. Stay with the question; let focused follow-ups bring out more detail.'},
 {id:'challenging',name:'Challenging',description:'Brief replies; focused follow-ups uncover the same underlying history.',maxFacts:1,instruction:'Give one relevant point in 1–2 short sentences, preserving the fact’s concrete meaning in everyday language. Brevity is the challenge; do not invent feelings, uncertainty, metaphorical experiences, hostility or forgotten memories. Answer direct questions truthfully.'}
];
export function difficultyOptions(){return LEVELS.map(({id,name,description})=>({id,name,description}));}
export function difficultySettings(id='standard'){
 const level=LEVELS.find(x=>x.id===id);if(!level)throw new Error('Choose Beginner, Standard or Challenging.');return {...level};
}
export function isGeneralFollowUp(question){return /^(?:please\s+)?(?:can you |could you |would you )?(?:tell me more|say more|go on|keep going|elaborate|what else)(?:\s+(?:about that|about it|happened))?[?.!\s]*$/i.test(question.trim());}
// This is a presentation policy, never a history update. It has no model calls
// and no trust score. Directly asked facts remain reachable at every level.
export function disclosurePlan({snapshot,turns,question,factIds,difficulty='standard',preserveSelection=false}){
 const level=difficultySettings(difficulty),byId=new Map(snapshot.facts.map(f=>[f.id,f]));
 const disclosed=new Set(turns.filter(t=>t.kind==='answer').flatMap(t=>t.factIds??[]));
 const last=[...turns].reverse().find(t=>t.kind==='answer'&&t.factIds?.length)??null;
 const continuation=isGeneralFollowUp(question)&&!!last;
 let ids=[...factIds];
  if(continuation&&!preserveSelection){
  const previous=last.factIds??[];
  const trail=previous.some(id=>id==='G01'||/^B0[123]$/.test(id))?['B02','B01','B03','P01']:previous.includes('P01')?['P02','P04']:previous.some(id=>['P02','P05','P06'].includes(id))?['P05','P06']:previous.includes('P04')?['P03','P01']:[];
  const next=trail.find(id=>byId.has(id)&&!disclosed.has(id));
  if(next)ids=[next,...ids.filter(id=>id!==next&&!disclosed.has(id))];
 }
 const opening=ids.includes('G01')&&!continuation;
 if(opening&&level.id==='beginner'&&!preserveSelection)ids=['G01',...(byId.has('B02')?['B02']:[]),...ids.filter(id=>id!=='G01')];
 ids=[...new Set(ids)].filter(id=>byId.has(id)||id==='PROFILE').slice(0,level.maxFacts);
 const openingIsBrief=opening&&!disclosed.has('G01')&&level.id==='challenging'&&byId.get('G01')?.briefResponse;
 return {factIds:ids,openingIsBrief:!!openingIsBrief,openingStatement:openingIsBrief||null,
  guidance:level.instruction,trace:{difficulty:level.id,maxFacts:level.maxFacts,continuation:!!continuation,briefOpening:!!openingIsBrief,historyMutation:false,extraModelCalls:0}};
}
