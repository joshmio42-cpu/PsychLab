import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
// Exercise the exact browser storage implementation without loading the DOM app.
const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8').split('// HISTORY_STORE_START')[1].split('// HISTORY_STORE_END')[0].split('\n').slice(1).join('\n');
const api=runInNewContext(source+'\n({readHistory,saveHistory,deleteHistory})');
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
const session=(requestId='r1')=>({brief:{hash:'same-case',name:'Jordan',mode:'generated',hidden:'never save'},turns:[{id:'T1',requestId,question:'Hello?',reply:'Hello.',kind:'answer',secret:'never save'}],apiKey:'never save',trace:'never save'});
test('Save survives reload, updates one interview, and separates interviews with same seed',()=>{
  const s=storage(),a=session();api.saveHistory(s,a,'2026-10-08T00:00:00Z');
  a.turns.push({id:'T2',requestId:'r2',question:'More?',reply:'Yes.',kind:'answer'});api.saveHistory(s,a,'2026-10-08T01:00:00Z');
  assert.equal(api.readHistory(s).length,1);assert.equal(api.readHistory(s)[0].turns.length,2);
  api.saveHistory(s,session('different'));assert.equal(api.readHistory(s).length,2);
  assert.ok(!JSON.stringify(api.readHistory(s)).includes('never save'));
  const reloaded=runInNewContext(source+'\n({readHistory})');assert.equal(reloaded.readHistory(s).length,2);
});
test('Delete removes only the selected archive and unchanged autosaves preserve timestamps',()=>{
  const s=storage(),a=session();const first=api.saveHistory(s,a,'2026-10-08T00:00:00Z');
  assert.equal(api.saveHistory(s,a,'2026-10-08T02:00:00Z').updatedAt,first.updatedAt);
  api.saveHistory(s,session('second'));api.deleteHistory(s,first.id);assert.equal(api.readHistory(s).length,1);
});
test('Malformed storage and quota errors surface without silently deleting archives',()=>{
  let writes=0;const corrupt={getItem:()=>'{bad',setItem:()=>writes++};assert.throws(()=>api.saveHistory(corrupt,session()));assert.equal(writes,0);
  const full={getItem:()=>null,setItem:()=>{throw new Error('quota exceeded');}};assert.throws(()=>api.saveHistory(full,session()),/quota/);
  const s=storage();for(let n=0;n<50;n++)api.saveHistory(s,session(`r${n}`));assert.throws(()=>api.saveHistory(s,session('new')),/full/);assert.equal(api.readHistory(s).length,50);
});
test('Caregiver speaker and life stage survive saving without losing older archives',()=>{
  const s=storage();api.saveHistory(s,session('legacy'));
  const child=session('child');child.brief.name='Mika';child.brief.lifeStage='Toddler';child.brief.speaker="Mika's caregiver";
  api.saveHistory(s,child);
  const records=api.readHistory(s);assert.equal(records[0].speaker,"Mika's caregiver");
  assert.equal(records[0].lifeStage,'Toddler');assert.equal(records[1].name,'Jordan');
});
