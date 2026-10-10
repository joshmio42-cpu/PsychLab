import {emptyCost,estimateCallCost,recordCallCost,refreshCostStatus,reportedUsage} from './pricing.mjs';
export const ECONOMY=Object.freeze({maxInputBytes:12000,sessionCalls:60,processCalls:300,
  outputTokens:Object.freeze({CORTEX:640,LANGUAGE:320,AUDITOR:192})});
export class BudgetError extends Error{constructor(message){super(message);this.status=429;}}
export function createLedger(limit){
  if(!Number.isInteger(limit)||limit<1)throw new Error('Call limit must be a positive integer.');
  return {limit,attemptedCalls:0,completedCalls:0,failedCalls:0,reportedTokens:0,unreportedCalls:0,
    reportedPromptTokens:0,reportedCompletionTokens:0,inputBytes:0,outputTokenAllowance:0,cost:emptyCost()};
}
export function usageView(session,process){return {mode:'economy',session:structuredClone(session),process:structuredClone(process),
  maxInputBytes:ECONOMY.maxInputBytes,outputTokens:ECONOMY.outputTokens,
  note:'Provider-reported tokens only; missing usage is unknown. USD estimates use separate input/output rates. Limits reset on server restart; session limits also reset on Clear. These are not dollar/account billing caps.'};}
function settle(ledgers,meta,model,failed){
  const tokens=reportedUsage(meta),cost=estimateCallCost(meta,model);
  for(const l of ledgers){
    if(failed)l.failedCalls++;else l.completedCalls++;
    if(tokens.totalTokens!==null)l.reportedTokens+=tokens.totalTokens;else l.unreportedCalls++;
    l.reportedPromptTokens+=tokens.promptTokens??0;l.reportedCompletionTokens+=tokens.completionTokens??0;
    recordCallCost(l.cost,cost,{failed});
  }
  return cost;
}
export async function meteredComplete(provider,request,ledgers,payload){
  if(!provider.configured)return provider.complete(request);
  if(request.signal?.aborted)throw new Error('Request cancelled.');
  for(const l of ledgers)if(l.attemptedCalls>=l.limit)throw new BudgetError('API call budget reached. Finish this interview or review usage before starting another.');
  // Reserve synchronously before awaiting: simultaneous sessions share one cap.
  for(const l of ledgers){l.attemptedCalls++;l.inputBytes+=payload.bytes;l.outputTokenAllowance+=payload.maxTokens;l.cost.pendingCalls++;refreshCostStatus(l.cost);}
  let result;
  try{result=await provider.complete(request);}
  catch(e){
    const cost=settle(ledgers,e?.meta,provider.model,true);
    if(e&&typeof e==='object'&&Object.isExtensible(e))e.meta={...e.meta,cost};
    throw e;
  }
  const cost=settle(ledgers,result?.meta,provider.model,false);
  return {...result,meta:{...result?.meta,cost}};
}
