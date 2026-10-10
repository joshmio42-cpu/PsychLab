// Public token prices checked on the provider's model pages; never an account balance.
export const PRICING_CHECKED_ON='2026-10-09';
export const PRICING_VERSION='featherless-2026-10-09';
export const MODEL_PRICES=Object.freeze(Object.fromEntries([
  ['Qwen/Qwen2.5-72B-Instruct',0.37,0.4,null],
  ['Qwen/Qwen3-30B-A3B-Instruct-2507',0.125,0.45,null,'2026-10-08'],
  ['Qwen/Qwen3-32B',0.102,0.493,0.0816,'2026-10-08'],
  ['deepseek-ai/DeepSeek-V4-Flash-0731',0.14,0.28,null],
  ['deepseek-ai/DeepSeek-V4.1-Flash',0.3,1.2,0.03],
  ['Qwen/Qwen3-Next-80B-A3B-Instruct',0.125,1.15,null],
].map(([model,inputUsdPerMillion,outputUsdPerMillion,cachedInputUsdPerMillion,checkedOn=PRICING_CHECKED_ON])=>[model,Object.freeze({
  model,inputUsdPerMillion,outputUsdPerMillion,cachedInputUsdPerMillion,
  source:`https://featherless.ai/models/${model}`,checkedOn,version:PRICING_VERSION,
})])));
const validTokens=n=>Number.isSafeInteger(n)&&n>=0;
const validRate=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
export function reportedUsage(meta){
  const u=meta?.usage??{};
  const promptTokens=validTokens(u.prompt_tokens)?u.prompt_tokens:null;
  const completionTokens=validTokens(u.completion_tokens)?u.completion_tokens:null;
  const totalTokens=validTokens(u.total_tokens)?u.total_tokens:
    promptTokens!==null&&completionTokens!==null?promptTokens+completionTokens:null;
  return {promptTokens,completionTokens,totalTokens};
}
export function estimateCallCost(meta,configuredModel,{prices=MODEL_PRICES,now=Date.now()}={}){
  // The returned model wins: a requested model's price must not price a different model.
  const model=typeof meta?.returnedModel==='string'?meta.returnedModel:
    typeof meta?.requestedModel==='string'?meta.requestedModel:configuredModel??null;
  const usage=reportedUsage(meta),rate=prices[model],reasons=[];
  let estimatedUsd=null,cachedTokens=null,cacheAssumption=null;
  if(!rate)reasons.push('unknown_model_price');
  else if(!validRate(rate.inputUsdPerMillion)||!validRate(rate.outputUsdPerMillion)||
    rate.cachedInputUsdPerMillion!==null&&!validRate(rate.cachedInputUsdPerMillion))reasons.push('invalid_price');
  if(usage.promptTokens===null||usage.completionTokens===null)reasons.push('missing_token_split');
  const cache=meta?.usage?.prompt_tokens_details?.cached_tokens;
  if(cache!==undefined){
    if(!validTokens(cache)||usage.promptTokens===null||cache>usage.promptTokens)reasons.push('invalid_cache_usage');
    else cachedTokens=cache;
  }
  if(usage.promptTokens!==null&&usage.completionTokens!==null&&validTokens(meta?.usage?.total_tokens)&&
    meta.usage.total_tokens!==usage.promptTokens+usage.completionTokens)reasons.push('inconsistent_token_usage');
  if(!reasons.length){
    const discountKnown=cachedTokens!==null&&validRate(rate.cachedInputUsdPerMillion);
    const cached=discountKnown?cachedTokens:0;
    estimatedUsd=((usage.promptTokens-cached)*rate.inputUsdPerMillion+
      cached*(discountKnown?rate.cachedInputUsdPerMillion:0)+usage.completionTokens*rate.outputUsdPerMillion)/1_000_000;
    if(cachedTokens===null)cacheAssumption='Cache usage unreported; regular input rate applied.';
    else if(cachedTokens>0&&!discountKnown)cacheAssumption='Cached tokens reported; no published cache rate stored, so regular input rate applied.';
  }
  const stale=!!rate&&(!Number.isFinite(Date.parse(`${rate.checkedOn}T00:00:00Z`))||
    now-Date.parse(`${rate.checkedOn}T00:00:00Z`)>30*24*60*60*1000);
  return {currency:'USD',model,...usage,cachedTokens,estimatedUsd,reasons,cacheAssumption,
    pricingStale:stale,rate:rate?{...rate}:null};
}
export function emptyCost(){return {currency:'USD',estimatedUsd:0,status:'no_calls',pricedCalls:0,
  unpricedCalls:0,pendingCalls:0,reasons:[],pricingCheckedOn:PRICING_CHECKED_ON,pricingStale:false,models:[],
  note:'Estimate from reported input/output tokens and published rates; not your bill or account balance. Rates may change. Unreported cache usage uses the regular input rate.'};}
export function refreshCostStatus(cost){
  const settled=cost.pricedCalls+cost.unpricedCalls;
  cost.status=!settled&&!cost.pendingCalls?'no_calls':cost.unpricedCalls||cost.pendingCalls?
    cost.pricedCalls?'partial':'unavailable':'estimated';
  if(!cost.pricedCalls)cost.estimatedUsd=cost.status==='no_calls'?0:null;
}
export function recordCallCost(cost,estimate,{failed=false}={}){
  cost.pendingCalls=Math.max(0,cost.pendingCalls-1);
  if(estimate.estimatedUsd===null)cost.unpricedCalls++;
  else{cost.pricedCalls++;cost.estimatedUsd=(cost.estimatedUsd??0)+estimate.estimatedUsd;}
  cost.reasons=[...new Set([...cost.reasons,...estimate.reasons])];
  cost.pricingStale ||= estimate.pricingStale;
  // Different rate revisions remain separate rather than repricing past requests.
  const key=JSON.stringify([estimate.model,estimate.rate]);
  let row=cost.models.find(item=>JSON.stringify([item.model,item.rate])===key);
  if(!row){row={model:estimate.model,rate:estimate.rate?{...estimate.rate}:null,estimatedUsd:null,
    calls:0,failedCalls:0,pricedCalls:0,unpricedCalls:0,promptTokens:0,completionTokens:0,cachedTokens:0,cacheAssumptions:[]};cost.models.push(row);}
  row.calls++;if(failed)row.failedCalls++;
  row.promptTokens+=estimate.promptTokens??0;row.completionTokens+=estimate.completionTokens??0;
  row.cachedTokens+=estimate.cachedTokens??0;
  if(estimate.estimatedUsd===null)row.unpricedCalls++;
  else{row.pricedCalls++;row.estimatedUsd=(row.estimatedUsd??0)+estimate.estimatedUsd;}
  if(estimate.cacheAssumption&&!row.cacheAssumptions.includes(estimate.cacheAssumption))row.cacheAssumptions.push(estimate.cacheAssumption);
  refreshCostStatus(cost);
}
