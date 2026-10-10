// This serves the historical scripted reviewer rehearsal, not a live AI model.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {requireRuntime,disableInspector} from './runtime.mjs';

const files=new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/index.html',['index.html','text/html; charset=utf-8']],
  ['/app.mjs',['app.mjs','text/javascript; charset=utf-8']],
  ['/core.mjs',['core.mjs','text/javascript; charset=utf-8']],
  ['/agents.mjs',['agents.mjs','text/javascript; charset=utf-8']],
  ['/style.css',['style.css','text/css; charset=utf-8']],
  ['/data.json',['data.json','application/json; charset=utf-8']]
]);
export function createDemoServer(){
  const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cross-Origin-Resource-Policy','same-origin');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const reject=status=>{res.writeHead(status,{'Content-Type':'text/plain; charset=utf-8'});res.end(status===404?'Not found.':'Request rejected.');};
    try{
      const allowed=[`127.0.0.1:${req.socket.localPort}`,`localhost:${req.socket.localPort}`];
      if(!allowed.includes(req.headers.host))return reject(403);
      if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return reject(403);
      if(req.headers['sec-fetch-site']&&!['same-origin','none'].includes(req.headers['sec-fetch-site']))return reject(403);
      if(!['GET','HEAD'].includes(req.method))return reject(405);
      const asset=files.get(new URL(req.url,`http://${req.headers.host}`).pathname);
      if(!asset)return reject(404);
      const [name,type]=asset;
      const data=await readFile(new URL(`../psych-simulator-foundation/prototype/dist/${name}`,import.meta.url));
      res.writeHead(200,{'Content-Type':type,'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    }catch{if(!res.headersSent)reject(500);else res.end();}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxRequestsPerSocket=1000;
  return server;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  disableInspector();requireRuntime();
  const port=Number(process.env.PSYCHLAB_DEMO_PORT||8780);
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PSYCHLAB_DEMO_PORT.');
  const server=createDemoServer();
  server.on('error',()=>{console.error('Scripted demo could not start. Check that its local port is available.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`SCRIPTED historical reviewer demo: http://127.0.0.1:${port}/\nAuthored responses only; no AI or API key. The fictional case is visible in the browser.`));
}
