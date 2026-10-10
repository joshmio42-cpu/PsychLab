import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {freeze,ruleTrace} from '../models/registry.mjs';

export const reference=freeze(JSON.parse(readFileSync(new URL('./reference.json',import.meta.url),'utf8')));
export function seededRandom(seed){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Seed must be an unsigned 32-bit integer.');
  let n=seed;
  return ()=>{n=(n+0x6D2B79F5)>>>0;let t=Math.imul(n^(n>>>15),1|n);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
}
export function cholesky(matrix){
  const n=matrix.length;
  if(!n||matrix.some(row=>!Array.isArray(row)||row.length!==n))throw new Error('Expected square covariance matrix.');
  const L=Array.from({length:n},()=>Array(n).fill(0));
  for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
    if(!Number.isFinite(matrix[i][j])||!Number.isFinite(matrix[j][i])||Math.abs(matrix[i][j]-matrix[j][i])>1e-10)throw new Error('Covariance must be finite and symmetric.');
    let residual=matrix[i][j];for(let k=0;k<j;k++)residual-=L[i][k]*L[j][k];
    if(i===j){if(residual<=0)throw new Error('Covariance must be positive definite.');L[i][j]=Math.sqrt(residual);}
    else L[i][j]=residual/L[j][j];
  }
  return L;
}
export function samplePopulation({count=10,seed=42}={}){
  if(!Number.isInteger(count)||count<1||count>100000)throw new Error('Count must be an integer from 1 to 100000.');
  const random=seededRandom(seed),d=reference.domains.length,L=cholesky(reference.correlation);
  const normal=()=>Math.sqrt(-2*Math.log(1-random()))*Math.cos(2*Math.PI*random());
  const profiles=[];let attempts=0;
  while(profiles.length<count){
    if(++attempts>count*100)throw new Error('Rejection budget exhausted.');
    const z=Array.from({length:d},normal);
    const values=L.map((row,i)=>reference.means[i]+reference.standard_deviations[i]*row.reduce((sum,a,j)=>sum+a*z[j],0));
    if(values.some(x=>x<reference.bounds[0]||x>reference.bounds[1]))continue;
    profiles.push({id:`partial-${seed}-${profiles.length+1}`,status:'EXPERIMENTAL partial trait profile',
      domains:Object.fromEntries(reference.domains.map((name,i)=>[name,values[i]])),facets:null,schema:null,motive:null,
      referenceId:reference.id,interpretation:'Synthetic domain scores; no clinical or demographic inference; not a full identity'});
  }
  return {version:'population-0.1.0',seed,count,attempts,rejected:attempts-count,referenceId:reference.id,
    evidence:ruleTrace('R-POP'),scope:reference.distribution_assumption,profiles};
}
export function populationDiagnostics(population){
  const rows=population.profiles.map(p=>reference.domains.map(k=>p.domains[k])),n=rows.length,d=reference.domains.length;
  if(n<2)throw new Error('At least two profiles required for sample covariance.');
  const means=Array.from({length:d},(_,i)=>rows.reduce((s,r)=>s+r[i],0)/n);
  const covariance=Array.from({length:d},(_,i)=>Array.from({length:d},(_,j)=>rows.reduce((s,r)=>s+(r[i]-means[i])*(r[j]-means[j]),0)/(n-1)));
  const sd=covariance.map((r,i)=>Math.sqrt(r[i]));
  const correlation=covariance.map((r,i)=>r.map((x,j)=>x/(sd[i]*sd[j])));
  const meanError=means.map((v,i)=>v-reference.means[i]),sdError=sd.map((v,i)=>v-reference.standard_deviations[i]);
  let maxCorrelationError=0;for(let i=0;i<d;i++)for(let j=0;j<i;j++)maxCorrelationError=Math.max(maxCorrelationError,Math.abs(correlation[i][j]-reference.correlation[i][j]));
  return {n,seed:population.seed,rejectionFraction:population.rejected/population.attempts,domains:reference.domains,
    targetMeans:reference.means,means,meanError,targetSD:reference.standard_deviations,standardDeviations:sd,sdError,
    targetCorrelation:reference.correlation,correlation,maxCorrelationError,
    interpretation:'Descriptive numerical comparison only. Published moments are pre-truncation inputs. Rejection changes them; no empirical validity pass is claimed.',
    externalValidation:'NOT PERFORMED',jointPersonalityCoverage:'Only five trait domains; schemas, motives and facets are null.'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const count=Number(process.argv[2]??10),seed=Number(process.argv[3]??42),result=samplePopulation({count,seed});
  if(process.argv[4])writeFileSync(process.argv[4],JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  process.stdout.write(JSON.stringify(count>1?populationDiagnostics(result):{count,seed,scope:result.scope},null,2)+'\n');
}
