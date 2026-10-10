import {close as closeInspector} from 'node:inspector';

export function requireRuntime(){
  const [major,minor]=process.versions.node.split('.').map(Number);
  if(major!==24||minor<21)throw new Error('Use Node.js 24.21.0 or a newer Node 24 LTS patch.');
}

export function productionEnvironment(source=process.env){
  const env={...source};
  for(const name of Object.keys(env))if(['NODE_ENV','NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_TLS_REJECT_UNAUTHORIZED'].includes(name.toUpperCase()))delete env[name];
  env.NODE_ENV='production';
  return env;
}

export function disableInspector(){
  closeInspector();
}
