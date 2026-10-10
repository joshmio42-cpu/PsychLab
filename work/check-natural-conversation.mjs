import {writeFile} from 'node:fs/promises';
const base=process.env.PSYCHLAB_TEST_URL??'http://127.0.0.1:8773';
const destination=new URL('../research/natural-conversation-2026-10-08/03-Live-evaluation.json',import.meta.url);
const output={model:(await (await fetch(base+'/api/status')).json()).model,startedAt:new Date().toISOString(),scenarios:[]};
const scenarios=[
 ['jordan','mdd',['Hey Jordan!','What do you usually do for fun?','What kind of things do you draw?','Why those things?','That sounds cool.','Thanks for sharing.','So sketching still makes you feel great these days?','What has your mood been like?','So every day?']],
 ['alex','gad',['What music are you usually into?','What’s your favorite album called?','What do you like about listening to a whole album?']],
 ['mika','autism',['What does Mika like playing with?','What is Mika thinking when playing?']],
 ['riley','selective_mutism',['Hey Riley, you can type if that helps. What music do you usually listen to?','Why do you like making playlists?']]
];
for(const [patientId,disorderId,questions] of scenarios){
 let cookie='',turnCount=0;
 const entry={patientId,disorderId,exchanges:[]};output.scenarios.push(entry);
 const api=async(path,method='GET',body)=>{
  const r=await fetch(base+path,{method,headers:{Origin:base,'X-PsychLab':'1','Content-Type':'application/json',Cookie:cookie},...(body?{body:JSON.stringify(body)}:{})});
  if(r.headers.has('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];
  const value=await r.json();if(!r.ok)throw new Error(`${r.status}: ${value.error}`);return value;
 };
 try{
  await api('/api/prepare','POST',{patientId,difficulty:'standard',seed:42,days:28,selection:{mode:'chosen',disorderId},requestId:crypto.randomUUID()});
  let prepared;
  for(let i=0;i<100;i++){prepared=await api('/api/preparation');if(prepared.preparation.status==='ready')break;if(prepared.preparation.status==='failed')throw new Error('Preparation failed');await new Promise(r=>setTimeout(r,25));}
  entry.preparationCalls=prepared.session.usage.session.attemptedCalls;
  for(const question of questions){
   try{
    const result=await api('/api/turn','POST',{question,expectedTurn:turnCount,requestId:crypto.randomUUID()});
    turnCount++;entry.exchanges.push(result.turn);entry.usage=result.usage.session;
    console.log(JSON.stringify({patientId,question,reply:result.turn.reply,interaction:result.turn.interaction}));
   }catch(e){entry.exchanges.push({question,error:e.message});console.log(JSON.stringify({patientId,question,error:e.message}));}
   await writeFile(destination,JSON.stringify(output,null,2));
  }
  entry.usage=(await api('/api/session')).usage.session;
  if(turnCount){
   await api('/api/finish','POST',{reasoning:{hypothesis:'Software conversation check, not diagnosis',support:'Compare replies against frozen fictional facts',alternatives:'Not a clinical differential assessment',missing:'This tests a small set of questions only',next:'Review conversational quality and factual support'}});
   const review=await api('/api/review');
   entry.facts=review.snapshot.facts.map(({id,response})=>({id,response}));
   entry.traces=review.interviewTraces.map(t=>({route:t.route,allowedFactIds:t.allowedFactIds,audit:t.audit,calls:t.calls.map(c=>({role:c.role,inputBytes:c.inputBytes,usage:c.usage}))}));
  }
 }catch(e){entry.error=e.message;console.log(JSON.stringify({patientId,error:e.message}));}
 finally{if(cookie)await api('/api/session','DELETE');await writeFile(destination,JSON.stringify(output,null,2));}
}
output.completedAt=new Date().toISOString();await writeFile(destination,JSON.stringify(output,null,2));
