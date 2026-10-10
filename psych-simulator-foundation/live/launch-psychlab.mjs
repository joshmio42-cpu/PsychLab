// The normal launcher may point here after release verification. This module
// never edits saved credentials, restarts another server or reloads live state.
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {loadActiveRelease} from '../adaption/release-activation.mjs';
import {createApp} from './server.mjs';
import {createFeatherless} from './model.mjs';
import {ECONOMY} from './usage.mjs';

export async function createReleaseConfiguredApp({foundationRoot,manifestPath,providerOptions={},controllerOptions={},configuredExampleGuidancePath=process.env.PSYCHLAB_EXAMPLE_GUIDANCE_PACK,createAppImpl=createApp}={}){
 const override=typeof configuredExampleGuidancePath==='string'?configuredExampleGuidancePath.trim():'';
 // Preserve the documented opt-out. A file-path override is intentionally not
 // loaded here: only the release manifest may select a verified pack/model.
 const release=override==='off'?{status:'disabled',reason:'PSYCHLAB_EXAMPLE_GUIDANCE_PACK=off disables the reviewed release, optional examples and answer planning.'}:await loadActiveRelease({foundationRoot,manifestPath});
 const active=release.status==='active';
 const provider=createFeatherless({...providerOptions,...(active?{model:release.model}:{}),answerPlanning:active&&release.answerPlanning===true});
 const app=await createAppImpl({provider,exampleGuidance:active?release.pack:null,controllerOptions});
 const selection=active?{status:'active',label:release.label,model:release.model,answerPlanning:true}:{status:release.status,reason:release.reason,answerPlanning:false};
 if(override&&override!=='off')selection.pathOverrideIgnored=true;
 const status=app.controller.status.bind(app.controller);
 app.controller.status=()=>({...status(),release:structuredClone(selection)});
 return {...app,release:selection};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const port=Number(process.env.PSYCHLAB_PORT||8771);
 if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid PSYCHLAB_PORT.');
 const {server,controller,release}=await createReleaseConfiguredApp({controllerOptions:{sessionCallLimit:Number(process.env.PSYCHLAB_SESSION_CALL_LIMIT??ECONOMY.sessionCalls),processCallLimit:Number(process.env.PSYCHLAB_PROCESS_CALL_LIMIT??ECONOMY.processCalls)}});
 if(release.status==='invalid')console.warn(`Reviewed release was not enabled: ${release.reason} Using the saved model without optional examples or answer planning.`);
 if(release.pathOverrideIgnored)console.warn('A pack path override was ignored. Normal startup only loads an examples pack from a verified release selection.');
 server.listen(port,'127.0.0.1',()=>console.log(`PsychLab local interview: http://127.0.0.1:${port}/\nFeatherless: ${controller.status().providerReady?'configured (not yet verified)':'not configured'}\n${release.status==='active'?`Reviewed release: ${release.label} · ${release.model}`:release.status==='disabled'?'Reviewed release disabled by the off setting; using the saved model without examples or answer planning.':'Using the saved model without an activated release.'}\nCase and transcript held in server memory; no public deployment.`));
}
