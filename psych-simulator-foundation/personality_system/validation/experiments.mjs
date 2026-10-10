import {writeFileSync,mkdirSync} from 'node:fs';
import {samplePopulation,populationDiagnostics} from '../population/generator.mjs';
import {createIdentity,activateMotives,chooseAction,learnFromObservation} from '../models/identity.mjs';

const population=[10,100,1000,10000].map(count=>populationDiagnostics(samplePopulation({count,seed:42})));
const learning=[0,.02,.04,.08].map(learningRate=>{
  let i=createIdentity();const trajectory=[];
  for(let day=1;day<=30;day++){i=learnFromObservation(i,{eventId:`day-${day}`,relationship:'cousin',supportObserved:day%3===0?0:1},{learningRate}).identity;trajectory.push(i.schema.relationships.cousin.supportExpected);}
  return {learningRate,feedback:'Two successes followed by one failure, repeated; constructed sensitivity scenario',trajectory,friendExpectation:i.schema.relationships.friend.supportExpected};
});
const actionAblations=['task','support','cancelled','quiet'].map(kind=>{
  const i=activateMotives(createIdentity(),kind).identity;
  // Artificially changed belief for sensitivity only, not an inferred person or population.
  i.schema.relationships.cousin.supportExpected=.8;
  const run=(goalWeight,beliefWeight)=>chooseAction(i,kind,.3,.5,{goalWeight,beliefWeight}).activeProbability;
  return {kind,full:run(.3,.2),noGoals:run(0,.2),noBelief:run(.3,0),neither:run(0,0)};
});
const report={date:'2026-10-05',scope:'Engineering diagnostics and constructed scenarios only',population,learning,actionAblations,
  externalValidation:'NOT PERFORMED',parameterRecovery:'NOT PERFORMED',humanDataFit:'NOT PERFORMED',
  conclusion:'Published moments inform sampling; truncation error is exposed. Sensitivity demonstrates parameter influence, not psychological realism.'};
mkdirSync(new URL('./reports/',import.meta.url),{recursive:true});
writeFileSync(new URL('./reports/experiments.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
writeFileSync(new URL('../data/example_partial_profiles.json',import.meta.url),JSON.stringify(samplePopulation({count:10,seed:42}),null,2)+'\n');
process.stdout.write(JSON.stringify({population:population.map(p=>({n:p.n,rejection:p.rejectionFraction,maxMeanError:Math.max(...p.meanError.map(Math.abs)),maxSDError:Math.max(...p.sdError.map(Math.abs)),maxCorrelationError:p.maxCorrelationError})),learningFinal:learning.map(x=>({rate:x.learningRate,final:x.trajectory.at(-1)})),actionAblations},null,2)+'\n');
