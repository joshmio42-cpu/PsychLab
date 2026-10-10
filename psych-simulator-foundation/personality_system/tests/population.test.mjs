import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cholesky,samplePopulation,populationDiagnostics,reference} from '../population/generator.mjs';
test('Cholesky reconstructs a known covariance and rejects malformed matrices',()=>{
  const matrix=[[4,2],[2,3]],L=cholesky(matrix);
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)assert.ok(Math.abs(L[i].reduce((s,x,k)=>s+x*L[j][k],0)-matrix[i][j])<1e-12);
  for(const invalid of [[],[[1,2]],[[1,2],[2,1]],[[1,NaN],[NaN,1]],[[1,0],[.2,1]]])assert.throws(()=>cholesky(invalid));
});
test('Sampler preserves reproducibility and explicitly incomplete profiles',()=>{
  const a=samplePopulation({count:10,seed:4});assert.deepEqual(a,samplePopulation({count:10,seed:4}));assert.notDeepEqual(a,samplePopulation({count:10,seed:5}));
  for(const p of a.profiles){assert.equal(p.schema,null);assert.equal(p.motive,null);assert.equal(p.facets,null);for(const v of Object.values(p.domains))assert.ok(v>=1&&v<=5);}
  for(const count of [0,-1,1.5,100001])assert.throws(()=>samplePopulation({count}));
  assert.throws(()=>samplePopulation({seed:-1}));
});
test('10000 profiles exhibit target dependence; diagnostics disclose truncation error',()=>{
  const p=samplePopulation({count:10000,seed:42}),d=populationDiagnostics(p);
  assert.equal(p.profiles.length,10000);assert.equal(new Set(p.profiles.map(x=>x.id)).size,10000);
  assert.ok(p.rejected>0);assert.ok(d.correlation[0][3]<-.2);assert.ok(d.correlation[1][2]>.15);
  // Loose engineering regression limits: explicitly NOT an empirical validation gate.
  assert.ok(d.maxCorrelationError<.10);assert.ok(Math.max(...d.meanError.map(Math.abs))<.15);
  assert.equal(d.externalValidation,'NOT PERFORMED');assert.equal(reference.sample.n,1000);
});
