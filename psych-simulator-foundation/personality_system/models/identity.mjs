import {constructs,parameters,ruleTrace} from './registry.mjs';

export const IDENTITY_VERSION='identity-0.1.0';
const clamp=x=>Math.max(0,Math.min(1,x));
const rounded=x=>Math.round(x*1e6)/1e6;
function unit(value,name){if(!Number.isFinite(value)||value<0||value>1)throw new Error(`${name} must be in [0,1].`);return value;}
const nullFields=keys=>Object.fromEntries(keys.map(k=>[k,null]));

export function createIdentity(){
  const prior=parameters.initial.supportExpectation;
  return {version:IDENTITY_VERSION,status:'EXPERIMENTAL',origin:'Authored Jordan profile; not a population draw or measured person',
    traits:{domains:nullFields(Object.keys(constructs.traits.domains)),facets:nullFields(Object.values(constructs.traits.domains).flat()),
      threatSensitivity:parameters.initial.threatSensitivity,scoreStatus:'Unmeasured domains/facets; threatSensitivity is an authored adapter, not a validated scale'},
    schema:{selfWorth:null,taskEfficacy:{},worldControl:null,
      relationships:Object.fromEntries(['cousin','friend'].map(actor=>[actor,{supportExpected:prior,observations:0,uncertainty:'Uncalibrated authored prior; no credible interval'}])),learningLedger:[]},
    motive:{values:structuredClone(parameters.initial.values),activation:{},context:null,
      needs:Object.fromEntries(['autonomy','competence','relatedness'].map(n=>[n,{satisfaction:null,frustration:null}])),regulation:null},
    timescales:{traits:'held fixed in short demo',values:'held fixed in short demo',schema:'observed feedback only',activation:'per event'}};
}

export function supportExpectation(identity,actor){
  if(actor===null)return .5; // Neutral computational baseline, not a belief about all people.
  if(!Object.hasOwn(identity.schema.relationships,actor))throw new Error('Unknown relationship target.');
  return unit(identity.schema.relationships[actor].supportExpected,'support expectation');
}

export function activateMotives(identity,eventKind){
  if(!Object.hasOwn(parameters.context,eventKind))throw new Error('Unknown event kind.');
  const context=parameters.context[eventKind],next=structuredClone(identity);
  next.motive.context=eventKind;
  next.motive.activation=Object.fromEntries(Object.entries(context.relevance).map(([goal,relevance])=>[goal,rounded(unit(identity.motive.values[goal],goal)*relevance)]));
  return {identity:next,trace:{...ruleTrace('R-GOAL'),context:eventKind,activation:next.motive.activation,
    enduringValuesChanged:false,coefficientProvenance:parameters.provenance}};
}

export function chooseAction(identity,eventKind,tension,draw,{goalWeight=parameters.choice.goalWeight,beliefWeight=parameters.choice.beliefWeight,relationship}={}){
  unit(tension,'tension');unit(draw,'draw');unit(goalWeight,'goal weight');unit(beliefWeight,'belief weight');
  if(draw===1)throw new Error('Draw must be less than 1.');
  if(!Object.hasOwn(parameters.context,eventKind)||identity.motive.context!==eventKind)throw new Error('Activate motives for this event before choosing an action.');
  const context={...parameters.context[eventKind],...(relationship!==undefined?{relationship}:{})},activation=identity.motive.activation;
  const contributions=Object.fromEntries(context.alternatives.map(action=>[action,Object.fromEntries(Object.entries(activation).map(([goal,value])=>[goal,value*context.fit[action][goal]]))]));
  const utilities=Object.fromEntries(Object.entries(contributions).map(([action,goals])=>[action,Object.values(goals).reduce((a,b)=>a+b,0)]));
  const difference=utilities[context.alternatives[0]]-utilities[context.alternatives[1]];
  const expectation=supportExpectation(identity,context.relationship),p=parameters.choice;
  const terms={intercept:p.intercept,goal:goalWeight*difference,expectation:beliefWeight*(expectation-.5),tension:-p.tensionWeight*tension};
  const activeProbability=clamp(Object.values(terms).reduce((a,b)=>a+b,0));
  return {available:[...context.alternatives],activeProbability,draw,selected:context.alternatives[draw<activeProbability?0:1],
    goalContributions:contributions,utilities,relationship:context.relationship,expectation,probabilityTerms:terms,
    variablePaths:['motive.values','motive.activation',...(context.relationship?[`schema.relationships.${context.relationship}.supportExpected`]:[]),'emotion.tension'],
    evidence:[ruleTrace('R-GOAL'),ruleTrace('R-RELATION'),ruleTrace('R-CHOICE')],coefficientProvenance:parameters.provenance};
}

export function learnFromObservation(identity,{eventId,relationship,supportObserved,reliability=parameters.learning.defaultReliability},{learningRate=parameters.learning.rate}={}){
  if(typeof eventId!=='string'||!eventId.trim()||eventId.length>100)throw new Error('Valid event ID required.');
  unit(reliability,'reliability');unit(learningRate,'learning rate');
  if(learningRate>parameters.learning.maxSingleUpdate)throw new Error('Learning rate exceeds the conservative authored per-event limit.');
  const next=structuredClone(identity),trace={...ruleTrace('R-LEARN'),eventId,relationship,learningRate,reliability,changed:false};
  // Unknown feedback must not be interpreted as failure or rejection.
  if(supportObserved===null)return {identity:next,trace:{...trace,reason:'No observed support outcome'}};
  unit(supportObserved,'support observation');
  const before=supportExpectation(identity,relationship);
  if(relationship===null)throw new Error('Observed feedback requires a named relationship.');
  const fingerprint=JSON.stringify({relationship,supportObserved,reliability});
  const previous=identity.schema.learningLedger.find(e=>e.eventId===eventId);
  if(previous){
    if(previous.fingerprint!==fingerprint)throw new Error('An event ID cannot be reused with conflicting evidence.');
    return {identity:next,trace:{...trace,reason:'Previously processed observation; no repeated learning'}};
  }
  const predictionError=supportObserved-before;
  const after=rounded(clamp(before+learningRate*reliability*predictionError));
  next.schema.relationships[relationship].supportExpected=after;
  next.schema.relationships[relationship].observations++;
  const record={eventId,fingerprint,relationship,supportObserved,reliability,learningRate,before,after,predictionError,ruleId:'R-LEARN'};
  next.schema.learningLedger.push(record);
  return {identity:next,trace:{...trace,before,after,predictionError,changed:before!==after,reason:'Observed relationship-specific feedback',
    variablePath:`schema.relationships.${relationship}.supportExpected`,coefficientProvenance:parameters.provenance}};
}
