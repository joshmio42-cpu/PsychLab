// Local diagnostic server, used only with authored test cases on port 8773.
import {appendFile} from 'node:fs/promises';
import {createApp} from '../psych-simulator-foundation/live/server.mjs';
import {createFeatherless} from '../psych-simulator-foundation/live/model.mjs';
const log=new URL('../research/natural-conversation-2026-10-08/06-Provider-diagnostics.jsonl',import.meta.url);
const provider=createFeatherless({fetchImpl:async(url,options)=>{
 const r=await fetch(url,options),body=await r.json(),request=JSON.parse(options.body);
 const input=JSON.parse(request.messages[1].content),choice=body.choices?.[0];
 await appendFile(log,JSON.stringify({model:request.model,role:request.messages[0].content.match(/^Role: (\w+)/)?.[1],question:input.question,finish:choice?.finish_reason,content:choice?.message?.content,usage:body.usage,status:r.status})+'\n');
 return {ok:r.ok,status:r.status,json:async()=>body};
}});
const {server}=await createApp({provider});server.listen(8773,'127.0.0.1',()=>console.log('Fictional-case diagnostic server ready on port 8773.'));
