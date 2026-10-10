import {readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {requireRuntime,productionEnvironment,disableInspector} from './runtime.mjs';

disableInspector();requireRuntime();
if(process.argv.slice(2).some(arg=>arg!=='--security'))throw new Error('Supported option: --security');
const root=fileURLToPath(new URL('../',import.meta.url));
const groups=['psych-simulator-foundation/live/tests','psych-simulator-foundation/adaption/tests','psych-simulator-foundation/personality_system/tests','psych-simulator-foundation/engineering','scripts/tests'];
const security=new Set(['browser-security.test.mjs','history.test.mjs','http-security.test.mjs','http.test.mjs','launcher-security.test.mjs','model.test.mjs','public-access.test.mjs','client.test.mjs','workflow.test.mjs','packaging.test.mjs','privacy.test.mjs']);
const tests=[];
for(const group of groups){
  for(const name of (await readdir(join(root,group))).sort()){
    if(name.endsWith('.test.mjs')&&(!process.argv.includes('--security')||security.has(name)))tests.push(join(root,group,name));
  }
}
const env=productionEnvironment();
// Tests must never acquire an account's credentials or opt into a live run.
for(const name of Object.keys(env))if(/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(name)||/^(?:PSYCHLAB_|FEATHERLESS_|ADAPTION_)/i.test(name))delete env[name];
const preload=new URL('./offline-fetch.mjs',import.meta.url).href;
const child=spawn(process.execPath,['--disable-sigusr1','--import',preload,'--test',...tests],{cwd:root,env,stdio:'inherit',windowsHide:true});
child.on('error',()=>{console.error('Offline tests could not start.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
