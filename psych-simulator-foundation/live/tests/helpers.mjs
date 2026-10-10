import {readFile} from 'node:fs/promises';
export const baseline=JSON.parse(await readFile(new URL('../../data/case-a01.json',import.meta.url),'utf8'));
export const reasoning={hypothesis:'Defer diagnosis',support:'Opening statement',alternatives:'Other explanations remain possible',missing:'Further history',next:'Ask focused follow-up questions'};
export function mockProvider(override){
  const calls=[];
  return {configured:true,model:'MOCK-NOT-LIVE',calls,
    async complete(request){
      calls.push(structuredClone({role:request.role,input:request.input}));
      const overridden=override?await override(request):undefined;
      const value=overridden??(request.role==='CORTEX'?{kind:'answer',fact_ids:[request.input.catalog[0].id]}:request.role==='LANGUAGE'?{reply:request.input.permittedFacts[0].statement,fact_ids:[request.input.permittedFacts[0].id],out_of_scope:false}:{supported:true,relevant:true,no_leak:true,unsupported:[]});
      return {value,meta:{role:request.role,requestedModel:'MOCK-NOT-LIVE',returnedModel:'MOCK-NOT-LIVE',promptVersion:'test',latencyMs:0,usage:{}}};
    }};
}
