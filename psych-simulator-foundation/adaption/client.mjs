// Official REST reference: https://docs.adaptionlabs.ai/api (checked 2026-10-09).
// No dependency on this module exists in the live interview server.
export const API_ROOT='https://api.prod.adaptionlabs.ai/api/v1';
export class AdaptionError extends Error {
  constructor(message,status=null){super(message);this.name='AdaptionError';this.status=status;}
}
export function createAdaption({key=process.env.ADAPTION_API_KEY,fetchImpl=fetch,timeoutMs=45000}={}){
  if(typeof key!=='string'||!key.trim())throw new AdaptionError('Adaption key is not configured. Use the private Windows launcher.');
  async function request(path,{method='GET',body,binary=false}={}){
    if(!/^\/datasets(?:[/?]|$)/.test(path)||path.includes('..')||path.includes('#'))throw new AdaptionError('Unsupported Adaption API path.');
    let response;
    try{response=await fetchImpl(API_ROOT+path,{method,headers:{Authorization:`Bearer ${key.trim()}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});}
    catch{throw new AdaptionError('Adaption request did not finish. Check the saved job status before retrying a write.');}
    // Never propagate provider response bodies or transport errors: either could
    // contain a secret, signed storage URL, or account data.
    if(!response.ok)throw new AdaptionError(`Adaption returned HTTP ${response.status}. No automatic retry was made.`,response.status);
    if(binary)return readBoundedBody(response);
    try{return await response.json();}catch{throw new AdaptionError('Adaption returned an unreadable response. Check status before retrying a write.');}
  }
  return {request,async check(){const data=await request('/datasets?limit=1');if(!Array.isArray(data.datasets))throw new AdaptionError('Unexpected authentication-check response.');return {authenticated:true,checkedAt:new Date().toISOString(),endpoint:API_ROOT};}};
}

export function validateStorageURL(value){
  let url;try{url=new URL(value);}catch{throw new AdaptionError('Invalid storage URL.');}
  // Official create endpoint returns presigned S3 storage. Never send the API key
  // to storage, and reject redirects or loopback/internal destinations.
  const s3=/^(?:[a-z0-9][a-z0-9.-]*\.)?s3(?:[.-][a-z0-9-]+)?\.amazonaws\.com$/.test(url.hostname);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!s3)throw new AdaptionError('Unrecognized Adaption storage host.');
  return url;
}
export async function storageTransfer(url,{method='GET',body,fetchImpl=fetch}={}){
  validateStorageURL(url);
  let response;try{response=await fetchImpl(url,{method,body,redirect:'error',signal:AbortSignal.timeout(45000)});}catch{throw new AdaptionError('Storage transfer did not finish; no automatic retry was made.');}
  if(!response.ok)throw new AdaptionError(`Storage transfer returned HTTP ${response.status}.`,response.status);
  if(method==='PUT')return null;
  return readBoundedBody(response);
}
async function readBoundedBody(response){
  const limit=5*1024*1024;
  if(Number(response.headers.get('content-length'))>limit)throw new AdaptionError('Downloaded dataset exceeds the pilot size limit.');
  const parts=[];let size=0;
  try{for await(const part of response.body){size+=part.length;if(size>limit)throw new AdaptionError('Downloaded dataset exceeds the pilot size limit.');parts.push(part);}}
  catch(error){if(error instanceof AdaptionError)throw error;throw new AdaptionError('Dataset download did not finish. No automatic retry was made.');}
  return Buffer.concat(parts);
}
