// Deliberate live smoke check: four answers (up to twelve provider calls).
// Sends only authored fictional cases through the already-configured local app.
const base='http://127.0.0.1:8771';
async function scenario(patientId,difficulty,questions){
 let cookie='';
 const api=async(path,method='GET',body)=>{
  const r=await fetch(base+path,{method,headers:{Origin:base,'X-PsychLab':'1','Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});
  if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  const value=await r.json();if(!r.ok)throw new Error(`${r.status}: ${value.error}`);return value;
 };
 try{
  await api('/api/prepare','POST',{patientId,difficulty,seed:42,days:28,selection:{mode:'chosen',disorderId:'mdd'},requestId:crypto.randomUUID()});
  let prepared;
  for(let i=0;i<100;i++){prepared=await api('/api/preparation');if(prepared.preparation.status==='ready')break;if(prepared.preparation.status==='failed')throw new Error('Preparation failed');await new Promise(r=>setTimeout(r,25));}
  const exchanges=[];let usage;
  for(const [i,question] of questions.entries()){
   const result=await api('/api/turn','POST',{question,expectedTurn:i,requestId:crypto.randomUUID()});
   exchanges.push(result.turn);usage=result.usage;
  }
  await api('/api/finish','POST',{reasoning:{hypothesis:'Software smoke check, not a diagnosis',support:'Compare replies with authored facts',alternatives:'Not assessing alternatives in this check',missing:'Full clinical assessment not performed',next:'Inspect support in the private trace'}});
  const review=await api('/api/review');
  return {patientId,difficulty,preparationCalls:prepared.session.usage.session.attemptedCalls,calls:usage.session.attemptedCalls,tokens:usage.session.reportedTokens,
   exchanges:exchanges.map((e,i)=>({question:e.question,reply:e.reply,kind:e.kind,allowed:review.interviewTraces[i].allowedFactIds?.map(id=>{const f=review.snapshot.facts.find(x=>x.id===id);return f?{id,statement:id==='G01'&&review.interviewTraces[i].disclosure?.briefOpening?f.briefResponse:f.response}:{id};})}))};
 }finally{if(cookie)await api('/api/session','DELETE');}
}
const output=[];
for(const [patient,level,questions] of [
 ['jordan','beginner',['What brings you here today?']],
 ['jordan','challenging',['What brings you here today?','Could you tell me more about that?']],
 ['alex','standard',['What are your personal goals and usual interests?']]
]){try{output.push(await scenario(patient,level,questions));}catch(e){output.push({patient,level,error:e.message});}}
console.log(JSON.stringify(output,null,2));
