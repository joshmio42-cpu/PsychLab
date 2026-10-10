import http from 'node:http';
import {createPublicAccess} from './public-access.mjs';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createController,RequestError} from './controller.mjs';
import {createFeatherless,ModelError} from './model.mjs';
import {BudgetError,ECONOMY} from './usage.mjs';
import {loadExampleGuidancePack} from './example-guidance.mjs';
import {createRequestLimiter,readJsonBody,sessionCookie} from './http-security.mjs';

export async function loadConfiguredExampleGuidance({configuredPath=process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK,defaultPath=fileURLToPath(new URL('../adaption/active-pack.json',import.meta.url))}={}){
  const override=typeof configuredPath==='string'?configuredPath.trim():'';
  if(override==='off')return null;
  // The offline review/evaluation process alone creates this opt-in artifact.
  // Its absence preserves the existing baseline on every ordinary startup.
  return loadExampleGuidancePack(override||defaultPath);
}

const assets=new Map([['/',['index.html','text/html; charset=utf-8']],['/app.mjs',['app.mjs','text/javascript; charset=utf-8']],['/style.css',['style.css','text/css; charset=utf-8']]]);
function send(res,status,value){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));}
export async function createApp({provider=createFeatherless(),baseline,controllerOptions={},exampleGuidance=null,publicAccess=null,rateLimitOptions={}}={}){
  baseline??=JSON.parse(await readFile(new URL('../data/case-a01.json',import.meta.url),'utf8'));
  const controller=createController({baseline,provider,exampleGuidance,...controllerOptions});
  const limiter=createRequestLimiter(rateLimitOptions);
  const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    res.setHeader('X-Frame-Options','DENY');res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
    try{
      limiter.take('ingress',1200);
      const port=req.socket.localPort;
      const allowed=[`127.0.0.1:${port}`,`localhost:${port}`];
      const isPublic=Boolean(publicAccess&&req.headers.host===publicAccess.host);
      let identity=null;
      if(isPublic){
        identity=await publicAccess.authenticate(req.headers['cf-access-jwt-assertion']);
        if(!identity||typeof identity.id!=='string'||!identity.id)throw new RequestError('Sign in through PsychLab Access.',403);
        allowed.push(publicAccess.host);
        res.setHeader('Strict-Transport-Security','max-age=31536000');
      }else if(['cf-access-jwt-assertion','cf-connecting-ip','x-forwarded-host','x-forwarded-proto'].some(name=>req.headers[name]!==undefined)){
        throw new RequestError('Invalid proxy host.',403);
      }
      const requestOrigin=isPublic?publicAccess.origin:`http://${req.headers.host}`;
      const secureCookie=isPublic?'; Secure':'';
      if(!allowed.includes(req.headers.host))throw new RequestError('Invalid host.',403);
      if(!req.url.startsWith('/')||req.url.startsWith('//'))throw new RequestError('Invalid request target.');
      const url=new URL(req.url,`http://${req.headers.host}`),path=url.pathname,id=sessionCookie(req);
      if(!['GET','POST','DELETE'].includes(req.method))throw new RequestError('Method not allowed.',405);
      if(req.headers.origin&&req.headers.origin!==requestOrigin)throw new RequestError('Same-origin request required.',403);
      if(path.startsWith('/api/')&&req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'&&req.headers['sec-fetch-site']!=='none')throw new RequestError('Same-origin request required.',403);
      if(req.method!=='GET'){
        if(req.headers.origin!==requestOrigin||req.headers['x-psychlab']!=='1')throw new RequestError('Same-origin request required.',403);
      }
      const owner=identity?`access:${identity.id}`:'local';
      limiter.take(`requests:${owner}`,300);
      if(req.method==='GET'&&assets.has(path)){
        const [file,type]=assets.get(path);const data=await readFile(new URL(`public/${file}`,import.meta.url));res.writeHead(200,{'Content-Type':type});res.end(data);return;
      }
      if(req.method==='GET'&&path==='/api/status')return send(res,200,{...controller.status(),permissions:{review:!isPublic||identity.isAdmin===true}});
      // Only a verified identity can act on its own session; possession of a
      // session cookie alone cannot cross accounts or local/public boundaries.
      if(path.startsWith('/api/'))controller.assertOwner(id,owner);
      if(req.method==='POST'&&(path==='/api/session'||path==='/api/prepare'))limiter.take(`create:${owner}`,12);
      if(req.method==='POST'&&path==='/api/turn')limiter.take(`turn:${owner}`,30);
      if(path==='/api/review'){
        if(isPublic&&identity.isAdmin!==true)throw new RequestError('Reviewer permission is required.',403);
        limiter.take(`review:${owner}`,10);
      }
      if(req.method==='POST'&&path==='/api/prepare'){
        const created=controller.prepare(await readJsonBody(req,path),id,owner);
        res.setHeader('Set-Cookie',`psychlab_session=${created.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200${secureCookie}`);
        return send(res,202,{preparation:created.preparation});
      }
      if(req.method==='GET'&&path==='/api/preparation')return send(res,200,controller.preparation(id));
      if(req.method==='POST'&&path==='/api/preparation/cancel'){
        await readJsonBody(req,path);const result=controller.cancelPreparation(id);
        res.setHeader('Set-Cookie',`psychlab_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`);
        return send(res,200,result);
      }
      if(req.method==='GET'&&path==='/api/session')return send(res,200,controller.read(id));
      if(req.method==='POST'&&path==='/api/session'){
        const created=controller.create(await readJsonBody(req,path),id,owner);
        res.setHeader('Set-Cookie',`psychlab_session=${created.id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200${secureCookie}`);
        return send(res,201,created.view);
      }
      if(req.method==='DELETE'&&path==='/api/session'){
        controller.remove(id);res.setHeader('Set-Cookie',`psychlab_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}`);return send(res,200,{cleared:true});
      }
      if(req.method==='POST'&&path==='/api/turn')return send(res,200,await controller.ask(id,await readJsonBody(req,path)));
      if(req.method==='POST'&&path==='/api/assessment')return send(res,200,controller.assess(id,await readJsonBody(req,path)));
      if(req.method==='POST'&&path==='/api/guide')return send(res,200,controller.saveGuide(id,await readJsonBody(req,path)));
      if(req.method==='POST'&&path==='/api/finish')return send(res,200,controller.finish(id,await readJsonBody(req,path)));
      if(req.method==='GET'&&path==='/api/report')return send(res,200,controller.report(id));
      if(req.method==='GET'&&path==='/api/review')return send(res,200,controller.review(id));
      send(res,404,{error:'Not found.'});
    }catch(e){
      const known=e instanceof RequestError||e instanceof ModelError||e instanceof BudgetError;
      if(e instanceof RequestError&&e.clearSessionCookie)res.setHeader('Set-Cookie',`psychlab_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${publicAccess&&req.headers.host===publicAccess.host?'; Secure':''}`);
      if(e.status===429)res.setHeader('Retry-After',String(e.retryAfter??60));
      // Never serialize error objects, stacks, request bodies, tokens or keys.
      if(!req.complete){res.setHeader('Connection','close');res.once('finish',()=>req.destroy());}
      if(!res.headersSent)send(res,known?e.status:500,{error:known?e.message:'The request could not be completed.'});
      else res.end();
    }
  });
  const sweeper=setInterval(()=>{controller.sweep();limiter.sweep();},60000);sweeper.unref();
  server.on('close',()=>{clearInterval(sweeper);controller.close();});
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=1000;
  return {server,controller};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const port=Number(process.env.PSYCHLAB_PORT||8770);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PSYCHLAB_PORT.');
  const exampleGuidance=await loadConfiguredExampleGuidance();
  if(process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK?.trim()&&process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK.trim()!=='off'&&!exampleGuidance)console.warn('Optional interview examples could not be loaded; using the existing grounded prompts.');
  let accessConfig=null;
  try{accessConfig=JSON.parse(await readFile(new URL('public-access.json',import.meta.url),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const publicAccess=createPublicAccess(accessConfig);
  const {server,controller}=await createApp({publicAccess,exampleGuidance,controllerOptions:{sessionCallLimit:Number(process.env.PSYCHLAB_SESSION_CALL_LIMIT??ECONOMY.sessionCalls),processCallLimit:Number(process.env.PSYCHLAB_PROCESS_CALL_LIMIT??ECONOMY.processCalls)}});
  server.listen(port,'127.0.0.1',()=>console.log(`PsychLab local interview: http://127.0.0.1:${port}/\nFeatherless: ${controller.status().providerReady?'configured (not yet verified)':'not configured'}\nCase and transcript held in server memory. ${publicAccess?'Domain access requires verified Cloudflare identity.':'Local access only.'}`));
}
