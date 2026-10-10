// Publication preflight: prints rule names and locations, never matched values.
// A heuristic scanner cannot prove that every secret or personal fact is absent.
import {readdir,readFile,lstat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,relative,extname,basename,sep} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const all=process.argv.includes('--all');
const skip=new Set(['.git','node_modules','.runtime','__pycache__']);
async function walk(directory){
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    if(skip.has(entry.name))continue;
    const path=resolve(directory,entry.name);
    if(entry.isDirectory())files.push(...await walk(path));else files.push(relative(root,path).split(sep).join('/'));
  }
  return files;
}
const git=all?null:spawnSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8',windowsHide:true});
const files=[...new Set(git?.status===0?git.stdout.split('\0').filter(Boolean):await walk(root))].sort();
const rules=[
  ['private-key',/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['service-token',/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{24,}|AKIA[A-Z0-9]{16})\b/g],
  ['signed-session-token',/\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{30,}\b/g],
  ['personal-email',/\b[A-Za-z0-9._%+-]+@(?:gmail|hotmail|outlook|yahoo|icloud|protonmail)\.[A-Za-z]+\b/gi],
  ['workstation-path',/\b[A-Za-z]:[\\/]+Users[\\/]+[^\\/\s"'<>]+/g],
  ['personal-site',/https?:\/\/(?!example\.)[a-z0-9.-]+\.chatgpt\.site\b/gi],
  ['signed-download',/[?&]X-Amz-(?:Signature|Security-Token|Credential)=[A-Za-z0-9%/+_-]{20,}/gi],
  ['embedded-bearer',/\bBearer\s+(?!\$\{|mock|test|example|REDACTED)[A-Za-z0-9._-]{24,}/gi],
  ['literal-service-key',/\b(?:FEATHERLESS_API_KEY|ADAPTION_API_KEY|OPENAI_API_KEY)\s*[:=]\s*["']?(?!\$|mock|test|example|your|REDACTED)[A-Za-z0-9_-]{24,}/g],
];
const findings=[];let textFiles=0,binaryFiles=0;
const media=new Set(['.png','.jpg','.jpeg','.pdf']);
for(const file of files){
  const path=resolve(root,file);
  if(!path.startsWith(resolve(root)+sep)){findings.push({file,rule:'outside-repository'});continue;}
  const stat=await lstat(path);
  if(stat.isSymbolicLink()){findings.push({file,rule:'symlink-needs-review'});continue;}
  const name=basename(file);
  if((name.startsWith('.env')&&!['.env.example','.env.template'].includes(name))||name==='public-access.json'||/\.(?:credential\.xml|pem|key|p12|pfx|heapsnapshot|heapprofile|zip|gz)$/i.test(name)||file.includes('/.openai/')||file.startsWith('.openai/')){
    findings.push({file,rule:'private-or-unreviewed-file'});continue;
  }
  if(stat.size>50*1024*1024){findings.push({file,rule:'large-file-needs-review'});continue;}
  const bytes=await readFile(path);
  if(media.has(extname(file).toLowerCase())){binaryFiles++;continue;}
  if(bytes.includes(0)){findings.push({file,rule:'unreviewed-binary'});continue;}
  textFiles++;const text=bytes.toString('utf8');
  for(const [rule,pattern] of rules){
    pattern.lastIndex=0;let match;
    while((match=pattern.exec(text))!==null){
      // Exact reviewed adversarial fixture; this is not a credential/signature.
      if(rule==='signed-download'&&file==='psych-simulator-foundation/adaption/tests/client.test.mjs'&&match[0]===`?X-Amz-Signature=${['private','signed','value'].join('-')}`)continue;
      findings.push({file,line:text.slice(0,match.index).split('\n').length,rule});
    }
  }
  if(!file.includes('/tests/')&&extname(file)==='.json'){
    let document;try{document=JSON.parse(text);}catch{findings.push({file,rule:'invalid-json'});continue;}
    const visit=value=>{
      if(!value||typeof value!=='object')return;
      for(const [key,item] of Object.entries(value)){
        if(/^(?:datasetId|runId|run_id|idempotencyKey|idempotency_key|accountId|account_id)$/i.test(key)&&typeof item==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item))findings.push({file,rule:'remote-account-identifier'});
        visit(item);
      }
    };visit(document);
  }
}
if(findings.length){
  for(const finding of findings)console.error(`${finding.file}${finding.line?':'+finding.line:''}: ${finding.rule}`);
  console.error(`Publication check failed: ${findings.length} potential issues. Matched values are intentionally hidden.`);process.exitCode=1;
}else console.log(`Publication check passed: ${textFiles} text files; ${binaryFiles} separately reviewed images/PDFs. No configured secret/PII patterns found. Manual review is still required for future content.`);
