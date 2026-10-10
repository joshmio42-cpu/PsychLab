import {spawn} from 'node:child_process';
import {loadEnvFile} from 'node:process';
import {fileURLToPath} from 'node:url';
import {requireRuntime,productionEnvironment,disableInspector} from './runtime.mjs';

disableInspector();
requireRuntime();
const root=fileURLToPath(new URL('../',import.meta.url));
try{loadEnvFile(fileURLToPath(new URL('../.env.local',import.meta.url)));}
catch(error){if(error.code!=='ENOENT')throw new Error('Could not load the repository .env.local file.');}
const env=productionEnvironment();
env.PSYCHLAB_PORT||='8770';
const server=fileURLToPath(new URL('../psych-simulator-foundation/live/server.mjs',import.meta.url));
const child=spawn(process.execPath,['--disable-sigusr1',server],{cwd:root,env,stdio:'inherit',windowsHide:true});
child.on('error',()=>{console.error('PsychLab could not start. Check the Node runtime and local configuration.');process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{if(!child.killed)child.kill(signal);});
child.on('exit',code=>{process.exitCode=code??0;});
