import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {disorderOptions,getDisorder,compatibleDisorders,createDisorderPremise,additionalSources,disorderEvidence} from '../disorders.mjs';
import {patientOptions,patientProfile} from '../patients.mjs';

const make=(id,patient='jordan',days=28,seed=42)=>createDisorderPremise({disorderId:id,profile:patientProfile(patient),days,seed});
const statements=p=>JSON.stringify({opening:p.opening,facts:p.baselineFacts,patterns:p.dailyPatterns,communicationStyle:p.communicationStyle});

test('runtime catalogue covers all researched candidates with distinct ICD comparisons and none',()=>{
 const research=JSON.parse(readFileSync(new URL('../../../research/mental-disorder-selection-2026-10-08/02-Disorder-catalogue.json',import.meta.url),'utf8'));
 assert.deepEqual(disorderOptions().map(x=>x.id).sort(),research.entries.map(x=>x.id==='no_disorder'?'none':x.id).sort());
 assert.equal(disorderOptions().filter(x=>x.classification==='DSM-5-TR').length,65);
 assert.match(getDisorder('cptsd').classification,/ICD/);
 assert.match(getDisorder('gaming').classification,/ICD/);
 assert.equal(new Set(disorderOptions().map(x=>x.id)).size,68);
});

test('all eligible patient cases have bounded, deterministic, distinct authored material',()=>{
 for(const option of patientOptions()){
  const profile=patientProfile(option.id);
  for(const condition of compatibleDisorders(profile.lifeStage))for(const days of [1,28,90]){
   const args={disorderId:condition.id,profile,days,seed:4294967295};
   const a=createDisorderPremise(args),b=createDisorderPremise(args);
   assert.deepEqual(a,b,`${option.id}/${condition.id}/${days}`);
   assert.ok(a.opening);
   if(condition.id==='none')continue;
   assert.equal(a.baselineFacts.length,4);
   assert.ok(a.dailyPatterns.length>=2);
   assert.ok(Buffer.byteLength(JSON.stringify(a.baselineFacts))<3500,'one selected case stays compact');
   assert.ok(a.dailyPatterns.every(x=>x.startDay>=1&&x.endDay<=days));
   assert.ok(a.sourceIds.length);
   assert.ok(a.reviewNotes.some(x=>/not a clinically approved case/.test(x)));
  }
 }
 const profiles=['mdd','gad','ocd','adhd','ptsd','autism','schizophrenia','insomnia'];
 assert.equal(new Set(profiles.map(id=>make(id).baselineFacts[1].response)).size,profiles.length);
});

test('age scope prevents adult formulations for toddlers without declaring all possible clinical ages',()=>{
 const toddler=compatibleDisorders('Toddler').map(x=>x.id);
 assert.ok(toddler.includes('none')&&toddler.includes('autism')&&toddler.includes('arfid'));
 for(const id of ['bpd','alcohol','mdd','insomnia','gender_dysphoria']){
  assert.ok(!toddler.includes(id));
  assert.throws(()=>make(id,'mika'),/life stage/);
 }
 assert.ok(make('autism','mika').reviewNotes.some(x=>/not an assertion about all clinically possible ages/.test(x)));
});

test('the no-disorder option adds no invented clinical symptoms or early health history',()=>{
 for(const option of patientOptions()){
  const none=make('none',option.id);
  assert.deepEqual(none.baselineFacts,[]);
  assert.deepEqual(none.dailyPatterns,[]);
  assert.match(none.opening,/everyday|recent routines/);
 }
});

test('patient-facing statements omit the selected condition name and diagnosis shorthand',()=>{
 for(const option of patientOptions())for(const condition of compatibleDisorders(option.lifeStage)){
  if(condition.id==='none')continue;
  const content=statements(make(condition.id,option.id)).toLowerCase();
  const name=condition.name.replace(/\s*\([^)]*\)/g,'').replace(/\s*—.*$/,'').toLowerCase();
  assert.ok(!content.includes(name),`${option.id}/${condition.id} revealed its full label`);
  assert.doesNotMatch(content,/\b(?:adhd|ocd|ptsd|dmdd|arfid|bpd|dsm-5|icd-11)\b/);
 }
});

test('caregiver material attributes observation rather than giving the child an adult inner voice',()=>{
 for(const patient of ['mika','leo'])for(const d of compatibleDisorders(patientProfile(patient).lifeStage)){
  const p=make(d.id,patient);
  assert.match(p.opening,/caregiver/);
  assert.doesNotMatch(statements(p),/I earn|my employer|my work deadline|I feel abandoned|I am in love|\b\d{1,3}[- ]year[- ]old\b/);
  for(const pattern of p.dailyPatterns)assert.match(pattern.interpretation,/private interpretation is unknown/);
 }
});

test('short diary windows retain pre-existing chronic and developmental history',()=>{
 for(const id of ['adhd','autism','pdd','gad','hoarding','bpd','ocpd']){
  const one=make(id,'jordan',1),long=make(id,'jordan',90);
  assert.equal(one.baselineFacts[0].response,long.baselineFacts[0].response);
  assert.match(one.baselineFacts[0].response,/years|childhood|school|months|adolescence/);
 }
});

test('acute episodes and resolved brief episodes do not silently fill a longer diary',()=>{
 const activeDays=p=>Array.from({length:90},(_,i)=>i+1).filter(day=>p.dailyPatterns.some(x=>day>=x.startDay&&day<=x.endDay));
 assert.equal(activeDays(make('acute_stress','jordan',90)).length,14);
 assert.equal(activeDays(make('delirium','jordan',90)).length,3);
 const brief=make('brief_psychotic','jordan',90);
 assert.equal(activeDays(brief).length,7);
 assert.ok(activeDays(brief).every(day=>day<=83));
 assert.ok(make('brief_psychotic','jordan',1).dailyPatterns.every(x=>x.endDay<x.startDay));
 assert.match(brief.baselineFacts[0].response,/returned to my earlier/);
});

test('cyclic symptoms carry an explicit intermittent schedule and authored menstrual context',()=>{
 const p=make('pmdd','riley',90);
 assert.match(p.baselineFacts[0].response,/I have menstrual cycles/);
 assert.ok(p.dailyPatterns.every(x=>x.cycleDays===28&&x.activeCycleDays===7));
 assert.ok(p.reviewNotes.some(x=>/not inferred from the patient name or gender/.test(x)));
});

test('communication differences keep the correct narrator and support needs',()=>{
 const preschool=make('selective_mutism','leo');
 assert.match(preschool.communicationStyle,/caregiver/);
 assert.match(preschool.baselineFacts[1].response,/do not treat the silence as deliberate refusal/);
 const school=make('selective_mutism','sam');
 assert.match(school.communicationStyle,/written/);
 assert.match(school.baselineFacts[1].response,/does not mean I can speak aloud/);
 assert.match(make('language','sam').communicationStyle,/short sentences/);
});

test('validation and fresh projections prevent corrupt or cross-session premise data',()=>{
 assert.throws(()=>getDisorder('not-real'),/Unknown/);
 for(const days of [0,91,1.5])assert.throws(()=>make('gad','jordan',days),/1 to 90/);
 for(const seed of [-1,4294967296,2.5])assert.throws(()=>make('gad','jordan',28,seed),/Seed/);
 const a=disorderOptions();a[0].stages.length=0;
 assert.ok(disorderOptions()[0].stages.length>0);
 const original=make('gad');original.baselineFacts[0].response='corrupted';
 assert.notEqual(make('gad').baselineFacts[0].response,'corrupted');
 const sourceIds=new Set(JSON.parse(readFileSync(new URL('../../../research/mental-disorder-selection-2026-10-08/04-Source-register.json',import.meta.url),'utf8')).sources.map(x=>x.id));
 additionalSources.forEach(x=>sourceIds.add(x.id));
 for(const d of disorderOptions())assert.ok(getDisorder(d.id).sourceIds.every(id=>sourceIds.has(id)));
});

test('case evidence resolves in its own namespace and cannot be confused with personality sources',()=>{
 const selected=disorderEvidence(['S01','S57','S58','S59','S01']);
 assert.equal(selected.namespace,'psychlab.disorder-research.2026-10-08');
 assert.equal(selected.sources.length,4);
 assert.match(selected.sources[0].title,/DSM-5 table of contents/);
 assert.ok(selected.sources.every(s=>s.reference===`${selected.namespace}:${s.id}`&&s.url.startsWith('https://')&&s.usedFor));
 selected.sources[0].title='changed';
 assert.match(disorderEvidence(['S01']).sources[0].title,/DSM-5 table of contents/);
 for(const option of patientOptions())for(const condition of compatibleDisorders(option.lifeStage)){
  const premise=make(condition.id,option.id);
  assert.equal(disorderEvidence(premise.sourceIds).sources.length,new Set(premise.sourceIds).size);
 }
 assert.deepEqual(disorderEvidence([]).sources,[]);
 assert.throws(()=>disorderEvidence(['S999']),/Unknown disorder evidence/);
 assert.throws(()=>disorderEvidence(null),/list of source IDs/);
});
