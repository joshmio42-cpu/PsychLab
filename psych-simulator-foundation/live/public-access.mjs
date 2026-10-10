import {createPublicKey,verify} from 'node:crypto';

const KEY_TTL=300000,REFRESH_INTERVAL=30000,MAX_JWKS_BYTES=65536;
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const email=value=>typeof value==='string'&&value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const identifier=value=>typeof value==='string'&&value.length>0&&value.length<=256&&!/[\s\x00-\x1f\x7f]/.test(value);
function decode(part){
  if(!/^[A-Za-z0-9_-]+$/.test(part))throw new Error('Invalid token encoding.');
  const bytes=Buffer.from(part,'base64url');
  if(bytes.toString('base64url')!==part)throw new Error('Invalid token encoding.');
  return bytes;
}
async function readKeys(response){
  if(!response.ok||!response.body)throw new Error('Access keys unavailable.');
  const chunks=[];let size=0;
  for await(const chunk of response.body){
    size+=chunk.length;if(size>MAX_JWKS_BYTES)throw new Error('Invalid Access keys.');chunks.push(chunk);
  }
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!record(body)||!Array.isArray(body.keys)||body.keys.length===0||body.keys.length>32)throw new Error('Invalid Access keys.');
  const keys=new Map();
  for(const jwk of body.keys){
    if(!record(jwk)||!identifier(jwk.kid)||keys.has(jwk.kid)||jwk.kty!=='RSA'||jwk.d!==undefined||(jwk.alg!==undefined&&jwk.alg!=='RS256')||(jwk.use!==undefined&&jwk.use!=='sig')||(jwk.key_ops!==undefined&&(!Array.isArray(jwk.key_ops)||!jwk.key_ops.includes('verify'))))throw new Error('Invalid Access keys.');
    const key=createPublicKey({key:jwk,format:'jwk'});
    if(key.asymmetricKeyType!=='rsa'||key.asymmetricKeyDetails.modulusLength<2048)throw new Error('Invalid Access keys.');
    keys.set(jwk.kid,key);
  }
  return keys;
}

// Cloudflare Access's signed email claim is verified by its identity provider.
// A browser-supplied email header is never an identity or a permission grant.
export function createPublicAccess(config,{fetchKeys=fetch,now=()=>Date.now()}={}){
  if(config===null||config===undefined)return null;
  let origin,issuer;
  try{origin=new URL(config.origin);issuer=new URL(config.issuer);}catch{throw new Error('Invalid public Access configuration.');}
  if(!record(config)||origin.protocol!=='https:'||origin.origin!==config.origin||issuer.protocol!=='https:'||issuer.origin!==config.issuer||!/^[-a-z0-9]+\.cloudflareaccess\.com$/.test(issuer.hostname)||issuer.port||!identifier(config.audience)||!Array.isArray(config.emails)||config.emails.length===0||config.emails.length>256||!config.emails.every(email)||!Array.isArray(config.adminEmails??[])||!(config.adminEmails??[]).every(email))throw new Error('Invalid public Access configuration.');
  const emails=new Set(config.emails.map(x=>x.toLowerCase()));
  const admins=new Set((config.adminEmails??[]).map(x=>x.toLowerCase()));
  if([...admins].some(value=>!emails.has(value)))throw new Error('Access administrators must be approved users.');
  // Copy mutable config values so later edits cannot change the trust boundary.
  const audience=config.audience;
  let keys=new Map(),expires=0,nextRefresh=0,pending=null;
  async function refresh(){
    if(pending)return pending;
    if(now()<nextRefresh)return false;
    nextRefresh=now()+REFRESH_INTERVAL;
    pending=Promise.resolve().then(async()=>{
      try{
        const response=await fetchKeys(`${issuer.origin}/cdn-cgi/access/certs`,{signal:AbortSignal.timeout(5000),redirect:'error'});
        keys=await readKeys(response);expires=now()+KEY_TTL;return true;
      }catch{return false;}
    }).finally(()=>{pending=null;});
    return pending;
  }
  async function authenticate(token){
    try{
      if(typeof token!=='string'||token.length>16000)return null;
      const parts=token.split('.');if(parts.length!==3)return null;
      const header=JSON.parse(decode(parts[0]));
      const claims=JSON.parse(decode(parts[1]));
      const signature=decode(parts[2]);
      const seconds=now()/1000;
      if(!record(header)||!record(claims)||header.alg!=='RS256'||!identifier(header.kid)||header.crit!==undefined||header.b64!==undefined||claims.iss!==issuer.origin||claims.type!=='app'||!identifier(claims.sub)||!Array.isArray(claims.aud)||!claims.aud.every(x=>typeof x==='string')||!claims.aud.includes(audience)||!Number.isFinite(claims.exp)||claims.exp<=seconds||(claims.nbf!==undefined&&(!Number.isFinite(claims.nbf)||claims.nbf>seconds))||(claims.iat!==undefined&&(!Number.isFinite(claims.iat)||claims.iat>seconds+30))||!email(claims.email)||!emails.has(claims.email.toLowerCase())||(claims.email_verified!==undefined&&claims.email_verified!==true))return null;
      if(now()>=expires){if(!await refresh())return null;}
      else if(!keys.has(header.kid)){await refresh();}
      const key=keys.get(header.kid);if(!key)return null;
      if(!verify('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),key,signature)||claims.exp<=now()/1000)return null;
      return {id:`${issuer.origin}:${claims.sub}`,subject:claims.sub,email:claims.email.toLowerCase(),isAdmin:admins.has(claims.email.toLowerCase())};
    }catch{return null;}
  }
  return {origin:origin.origin,host:origin.host,authenticate,async authorize(token){return Boolean(await authenticate(token));}};
}
