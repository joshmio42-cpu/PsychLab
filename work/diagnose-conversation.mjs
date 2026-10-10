import {writeFile} from 'node:fs/promises';
import {createFeatherless,answerQuestion} from '../psych-simulator-foundation/live/model.mjs';
import {simulateHistory} from '../psych-simulator-foundation/live/engine.mjs';
const real=createFeatherless(),records=[];
const cases=[
 {patientId:'jordan',disorderId:'mdd',question:'Why do you sketch ordinary things?'},
 {patientId:'jordan',disorderId:'mdd',question:'So sketching still makes you feel great these days?'},
 {patientId:'alex',disorderId:'gad',question:'What’s your favorite album called?'},
 {patientId:'mika',disorderId:'autism',question:'What is Mika thinking when playing?'}
];
for(const sample of cases){
 const item={...sample,calls:[]};records.push(item);
 const provider={...real,async complete(request){const result=await real.complete(request);item.calls.push({role:request.role,input:request.input,value:result.value,usage:result.meta.usage});return result;}};
 try{item.result=await answerQuestion({snapshot:simulateHistory(sample),turns:[],question:sample.question,provider});}
 catch(e){item.error=e.message;}
 console.log(JSON.stringify({question:sample.question,calls:item.calls.map(({role,value})=>({role,value})),error:item.error}));
 await writeFile(new URL('../research/natural-conversation-2026-10-08/04-Diagnostic-evaluation.json',import.meta.url),JSON.stringify(records,null,2));
}
