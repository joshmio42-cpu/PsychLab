import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,copyFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,resolve,sep} from 'node:path';

test('publication scanner accepts blank examples and rejects accidental secrets without printing values',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'psychlab-privacy-'));
  t.after(async()=>{const target=resolve(directory),parent=resolve(tmpdir());assert.ok(target.startsWith(parent+sep)&&target.slice(parent.length+1).startsWith('psychlab-privacy-'));await rm(target,{recursive:true,force:true});});
  await mkdir(join(directory,'scripts'));
  await copyFile(new URL('../check-privacy.mjs',import.meta.url),join(directory,'scripts/check-privacy.mjs'));
  await writeFile(join(directory,'.env.example'),'FEATHERLESS_API_KEY=\nFEATHERLESS_MODEL=\n');
  const run=()=>spawnSync(process.execPath,[join(directory,'scripts/check-privacy.mjs'),'--all'],{cwd:directory,encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(run().status,0);
  const fake='sk-'+Array(33).fill('Z').join('');
  await writeFile(join(directory,'accidental.txt'),fake);
  const rejected=run();assert.equal(rejected.status,1);assert.match(rejected.stderr,/service-token/);assert.ok(!rejected.stderr.includes(fake));
  await writeFile(join(directory,'accidental.txt'),'safe original fictional research');
  await writeFile(join(directory,'.env.local'),'FEATHERLESS_API_KEY=\n');
  const privateFile=run();assert.equal(privateFile.status,1);assert.match(privateFile.stderr,/private-or-unreviewed-file/);
});
