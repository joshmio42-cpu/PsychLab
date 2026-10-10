import {RequestError} from './controller.mjs';

// A single-process limiter matches the in-memory session architecture. Never
// derive identity from forwarded IP/email headers or from client-supplied cookies.
export function createRequestLimiter({now=Date.now,maxEntries=2048}={}){
  const buckets=new Map();
  function sweep(){const time=now();for(const [key,bucket] of buckets)if(time>=bucket.expires)buckets.delete(key);}
  function take(key,capacity,windowMs=60000){
    const time=now();let bucket=buckets.get(key);
    if(!bucket||time>=bucket.expires){
      sweep();
      if(buckets.size>=maxEntries){const error=new RequestError('Server busy. Try again later.',429);error.retryAfter=60;throw error;}
      bucket={tokens:capacity,at:time,expires:time+windowMs};buckets.set(key,bucket);
    }
    bucket.tokens=Math.min(capacity,bucket.tokens+Math.max(0,time-bucket.at)*capacity/windowMs);bucket.at=time;bucket.expires=time+windowMs;
    if(bucket.tokens<1){const error=new RequestError('Too many requests. Please wait before trying again.',429);error.retryAfter=Math.max(1,Math.ceil((1-bucket.tokens)*windowMs/capacity/1000));throw error;}
    bucket.tokens--;return true;
  }
  return {take,sweep};
}

function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function fields(value,allowed){
  if(!object(value)||Object.keys(value).some(key=>!allowed.includes(key)))throw new RequestError('Unexpected request fields.');
}
const schemas={
  '/api/session':['mode','seed','days','patientId','difficulty'],
  '/api/prepare':['mode','seed','days','patientId','difficulty','selection','requestId'],
  '/api/preparation/cancel':[],
  '/api/turn':['question','requestId','expectedTurn'],
  '/api/assessment':['rationale','explained'],
  '/api/guide':['expectedHash','state'],
  '/api/finish':['reasoning']
};
export function validateRequest(path,value){
  fields(value,schemas[path]??[]);
  if(path==='/api/session'||path==='/api/prepare'){
    for(const key of ['mode','patientId','difficulty','requestId'])if(Object.hasOwn(value,key)&&typeof value[key]!=='string')throw new RequestError('Invalid case configuration.');
    for(const key of ['seed','days'])if(Object.hasOwn(value,key)&&!Number.isSafeInteger(value[key]))throw new RequestError('Invalid case configuration.');
  }
  if(path==='/api/prepare')fields(value.selection,['mode','disorderId']);
  if(path==='/api/turn'&&(!Number.isSafeInteger(value.expectedTurn)||value.expectedTurn<0))throw new RequestError('Invalid turn number.');
  if(path==='/api/finish')fields(value.reasoning,['hypothesis','support','alternatives','missing','next']);
  if(path==='/api/guide'){
    fields(value.state,['items','hypothesisId','alternatives','nextStep','reviewed']);
    if(!object(value.state.items)||Object.keys(value.state.items).length>100||typeof value.state.reviewed!=='boolean')throw new RequestError('Invalid interview notes.');
    for(const entry of Object.values(value.state.items))fields(entry,['status','turnId','note']);
  }
  return value;
}

export function sessionCookie(req){
  const matches=(req.headers.cookie??'').split(';').map(part=>part.trim()).filter(part=>part.startsWith('psychlab_session='));
  if(matches.length>1)throw new RequestError('Invalid session cookie.',400);
  const value=matches[0]?.slice('psychlab_session='.length);
  if(value&&!/^[a-f0-9]{64}$/.test(value))throw new RequestError('Session expired or unavailable. Start a new interview.',401);
  return value||undefined;
}

export async function readJsonBody(req,path){
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))throw new RequestError('JSON content is required.',415);
  if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity')throw new RequestError('Encoded request bodies are not supported.',415);
  if(Number(req.headers['content-length'])>32768)throw new RequestError('Request too large.',413);
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>32768)throw new RequestError('Request too large.',413);chunks.push(chunk);}
  let value;
  try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{throw new RequestError('Invalid JSON.');}
  return validateRequest(path,value);
}
