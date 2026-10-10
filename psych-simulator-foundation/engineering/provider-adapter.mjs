// Server-only integration scaffold. No live provider call has been performed.
// Pass only fictional data until provider handling and clinical review are complete.
export function validateReply(raw,allowedFactIds){
  let parsed;try{parsed=JSON.parse(raw);}catch{throw new Error('Provider did not return valid JSON.');}
  if(!parsed||typeof parsed.reply!=='string'||!parsed.reply.trim()||parsed.reply.length>2000||typeof parsed.out_of_scope!=='boolean'||!Array.isArray(parsed.fact_ids)||parsed.fact_ids.some(id=>typeof id!=='string'||!allowedFactIds.includes(id))) throw new Error('Provider output failed the case schema.');
  if(!parsed.out_of_scope&&!parsed.fact_ids.length) throw new Error('A factual answer must identify supporting case facts.');
  return parsed; // IDs do not establish semantic fidelity. Audit the actual wording.
}
export async function generateReply({systemPrompt,question,allowedFacts,history=[],fetchImpl=fetch,key=process.env.FEATHERLESS_API_KEY,model=process.env.FEATHERLESS_MODEL}){
  if(!key||!model)throw new Error('Configure the server-held Featherless key and chosen model ID.');
  if(typeof question!=='string'||!question.trim()||question.length>4000)throw new Error('Invalid question.');
  if(!Array.isArray(allowedFacts)||!allowedFacts.length)throw new Error('Allowed case facts are required.');
  if(!Array.isArray(history)||history.some(m=>!['user','assistant'].includes(m.role)||typeof m.content!=='string'))throw new Error('Invalid conversation history.');
  const res=await fetchImpl('https://api.featherless.ai/v1/chat/completions',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0.2,max_tokens:500,messages:[{role:'system',content:systemPrompt+'\nAllowed authored facts:\n'+JSON.stringify(allowedFacts)},...history.slice(-20),{role:'user',content:question}]}),signal:AbortSignal.timeout(30000)});
  if(!res.ok)throw new Error(`Model request failed (${res.status}). Retry deliberately; no scripted fallback was used.`);
  const body=await res.json();const content=body.choices?.[0]?.message?.content;
  if(typeof content!=='string')throw new Error('Model response has no message.');
  return validateReply(content,allowedFacts.map(f=>f.id));
}
