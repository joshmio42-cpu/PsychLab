import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export function freeze(value){
  if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
}
export const readJson=path=>JSON.parse(readFileSync(new URL(path,import.meta.url),'utf8'));
export const constructs=freeze(readJson('../data/constructs.json'));
export const parameters=freeze(readJson('../data/authored_parameters.json'));
const sources=readJson('../evidence/sources.json');
const mechanisms=readJson('../evidence/mechanisms.json');
const evidenceMap=readJson('../evidence/evidence_map.json');
const bundle=freeze({sources,mechanisms,evidenceMap,constructs,parameters});
const digest=createHash('sha256').update(JSON.stringify(bundle)).digest('hex');
export const evidenceVersion=freeze({version:sources.registry_version,digest,sourceCount:sources.sources.length});
export function evidenceBundle(){return bundle;}
export function ruleTrace(ruleId){
  const rule=mechanisms.mechanisms.find(m=>m.rule_id===ruleId);
  if(!rule)throw new Error(`Unregistered rule: ${ruleId}`);
  return {ruleId,ruleVersion:rule.rule_version,mechanismId:rule.mechanism_id,
    status:rule.implementation_status,sourceIds:[...rule.source_ids],inferenceGap:rule.known_limitations};
}
export function explainRules(ruleIds){
  return ruleIds.map(id=>{
    const trace=ruleTrace(id),mechanism=mechanisms.mechanisms.find(m=>m.rule_id===id);
    return {...trace,mechanism,sources:sources.sources.filter(s=>trace.sourceIds.includes(s.source_id))};
  });
}
