import {isEvidenceTurn} from './interview-guide.mjs';

export const FEEDBACK_VERSION='interview-feedback-1.0.0';

// Authored source-to-prompt links, not diagnostic criteria or keyword classifiers.
// A source can touch only one part of a compound checkpoint. A match supplies a
// lead to review against the exact reply; it never marks the checkpoint satisfied.
export const FOCUSED_SOURCE_MAP={
 adhd:{attention:['B02'],activity_impulse:['B02'],childhood_course:['B01'],settings_impact:['B01','B03'],alternatives:[]},
 autism:{communication:['B01'],patterns:['B02'],sensory:['B02'],development:['B01'],support:['B03','B04','P04']},
 learning:{domain:['B02'],help:['B01'],course:['B01'],impact:['B03'],access:[]},
 language:{understanding:['B02'],expression:['B02'],early_history:['B01'],language_context:[],participation:['B03']},
 idd:{learning_reasoning:['B01','B02'],practical:['B03'],conceptual_social:[],development:['B01'],context_strengths:['B02','B04']},
 tourette:{motor_vocal:['B01','B02'],onset_course:['B01'],experience:['B02'],impact:['B03'],other_causes:[]},
 mdd:{mood_interest:['B01','B02'],episode_course:['B01'],associated:['B02'],impact:['B03'],safety:[],mood_history:[]},
 pdd:{long_course:['B01'],better_intervals:['B01'],associated:['B02'],episodes:[],impact_safety:['B03']},
 dmdd:{outbursts:['B01','B02'],between:['B02'],timeline:['B01'],settings:['B01','B03'],episodic:['B03']},
 pmdd:{cycle:['B01'],mood_pattern:['B02'],other_phases:['B02','B03'],impairment:['B03'],records_context:[]},
 bipolar1:{baseline_change:['B01','B02'],sleep_activity:['B01','B02'],course:['B01'],severity:['B01','B03'],exclusions:[]},
 bipolar2:{depression:['B01','B03'],hypomania:['B01','B02'],duration_sleep:['B01'],mania_history:['B02'],timeline_context:['B01']},
 cyclothymia:{highs:['B01','B02'],lows:['B01','B02'],continuity:['B01'],full_episodes:['B01'],impact_causes:['B03']},
 gad:{domains:['B01'],control:['B02'],course:['B01'],body_sleep:['B02'],impact_causes:['B03']},
 panic:{attack:['B02'],unexpected:['B01','B02'],aftermath:['B01','B03'],course:['B01'],physical_context:[]},
 social_anxiety:{evaluation:['B02'],situations:['B01'],avoidance:['B03'],course:['B01'],impact:['B03']},
 specific_phobia:{trigger:['B01','B02'],response:['B02'],avoidance:['B02'],persistence:['B01'],impact_context:['B03']},
 agoraphobia:{escape:['B02'],situations:['B01','B02'],companion:['B03'],course:['B01'],impact_context:['B03']},
 separation:{attachment:['B01','B02'],contexts:['B02'],body_sleep:[],course:['B01'],impact:['B03']},
 selective_mutism:{settings:['B01','B02'],course:['B01'],communication:['B02'],language_hearing:[],impact:['B03']},
 ocd:{intrusions:['B01','B02'],rituals:['B02'],function:['B02'],burden:['B03'],meaning:['B02']},
 bdd:{concern:['B01','B02'],preoccupation:['B01'],responses:['B02'],impact:['B03'],distinction_safety:[]},
 hoarding:{discarding:['B01','B02'],meaning:['B02'],space:['B01','B03'],course_acquisition:['B01'],impact_safety:['B03']},
 hair_pulling:{pulling_loss:['B01','B02'],awareness:['B02'],stopping:['B01'],impact:['B03'],alternatives:[]},
 skin_picking:{lesions:['B01','B02'],context:['B02'],stopping:['B01'],impact:['B03'],medical:[]},
 ptsd:{exposure:['B01'],intrusion:['B02'],avoidance:['B02'],mood_arousal:['B02'],impact:['B03']},
 acute_stress:{event_window:['B01'],intrusion:['B02'],detachment:['B02'],avoidance_arousal:['B02'],needs:['B03']},
 adjustment:{stressor:['B01'],timing:['B01'],reaction:['B02'],context:['B03'],alternatives:[]},
 grief:{loss:['B01'],longing:['B02'],meaning:['B02'],participation:['B03'],context_safety:[]},
 rad:{comfort_seeking:['B02'],comfort_response:['B02'],interaction:['B02'],care_history:['B01'],development:['B03']},
 dsed:{unfamiliar:['B02'],checking:['B02'],leaving:[],care_history:['B01'],context:['B03']},
 dpdr:{experience:['B01','B02'],reality:['B02'],course:['B01'],impact:['B03'],context:[]},
 dissociative_amnesia:{gaps:['B01','B02'],preserved:['B01'],onset:['B01'],impact:['B03'],medical:[]},
 did:{continuity:['B01','B02'],memory:['B02'],course:['B01'],impact:['B03'],context:[]},
 somatic:{symptoms:['B01','B02'],meaning:['B02'],time:['B02'],course:['B01','B03'],medical:[]},
 illness_anxiety:{fear:['B01','B02'],symptom_burden:['B02'],checking:['B02'],avoidance:[],course_impact:['B01','B03']},
 fnd:{symptom:['B01','B02'],course:['B01'],impact:['B03'],examination:[],coexisting:[]},
 anorexia:{intake:['B01'],weight_fear:['B02'],self_evaluation:['B01'],health:['B01'],life:['B03']},
 bulimia:{binge:['B01'],after:['B01','B02'],pattern:['B01'],self_worth:['B02'],harm:['B03']},
 binge_eating:{episode:['B01','B02'],context:['B02'],distress:['B02'],frequency:['B01'],compensation:['B01','B03']},
 arfid:{restriction:['B01','B02'],driver:['B02'],consequences:['B03'],motivation:['B02'],medical_context:[]},
 enuresis:{pattern:['B01','B02'],development:['B01'],urinary:[],bowel_sleep:[],impact:['B03']},
 encopresis:{soiling:['B01','B02'],constipation:['B01','B02'],toileting:['B01'],health:[],impact:['B03']},
 insomnia:{difficulty:['B01'],opportunity:['B01'],duration:['B01'],daytime:['B03'],alternatives:[]},
 odd:{irritability:['B01','B02'],conflict:['B02'],context:['B01'],impact:['B03'],alternatives:[]},
 conduct:{events:['B01'],pattern:['B01'],context:[],impact_safety:['B03'],collateral:[]},
 alcohol:{use_pattern:['B01','B02'],control:['B01','B02'],impact:['B03'],withdrawal:[],context:[]},
 cannabis:{pattern:['B01'],control:['B01','B02'],impact:['B03'],effects:[],risk:[]},
 opioid:{treatment_context:['B02'],control:['B01','B02'],impact:['B03'],dependence:['B02'],overdose:[]},
 stimulant:{exposure:['B01'],control:['B01','B02'],cycle:[],impact:['B03'],medical:[]},
 sedative:{medications:['B01'],control:['B01','B02'],impact:['B03'],withdrawal:[],co_use:[]},
 tobacco:{products:['B01','B03'],craving:['B02'],change:['B01','B02'],withdrawal:[],impact:['B03']},
 gambling:{pattern:['B01'],chasing:['B01'],impact:['B03'],disclosure:['B02'],mood_safety:[]},
 schizophrenia:{experiences:['B01','B02'],communication:['B02'],function:['B03'],timeline:['B01'],exclusions:[]},
 schizophreniform:{onset:['B01'],symptoms:['B01','B02'],function:['B03'],mood:[],exclusions:[]},
 brief_psychotic:{onset:['B01'],symptoms:['B01'],recovery:['B01','B02'],mood:[],exclusions:[]},
 delusional:{meaning:['B01','B02'],context:[],impact:['B03'],broader_symptoms:['B02'],course:['B01']},
 schizoaffective:{psychosis:['B01'],mood:['B01'],independent:['B01','B02'],proportion:['B02'],exclusions:[]},
 delirium:{baseline:['B01'],fluctuation:['B02'],medical:['B01','B03'],medicines:[],quiet_form:[]},
 mild_ncd:{change:['B01','B02'],independence:['B02','B03'],collateral:['B01'],course:['B01'],alternatives:[]},
 major_ncd:{domains:['B01','B02'],dependence:['B02','B03'],course:['B01'],collateral:['B01'],medical:[]},
 bpd:{relationship:['B01','B02'],emotions:['B02'],self:['B01','B02'],safety:[],longitudinal:['B01','B03']},
 avoidant_pd:{avoidance:['B01','B03'],self_view:['B01'],closeness:['B02'],course_impact:['B01','B03']},
 ocpd:{perfection:['B01','B02'],control:['B02'],relationships:['B03'],course:['B01','B02']},
 gender_dysphoria:{language:['P01'],distress:['B01','B02'],course:['B01'],impact:['B03'],support:['P04','B03']},
 cptsd:{trauma_context:['B01'],ptsd_features:['B01','B02'],regulation:['B01'],self_relationship:['B01','B02'],impact:['B03']},
 gaming:{control:['B01','B02'],priorities:['B01'],consequences:['B01','B03'],course:['B01','B03'],context:[]}
};

const GENERAL_CASE_TOPICS={
 development:['adhd','autism','learning','language','idd','tourette','rad','dsed'],
 mood:['mdd','pdd','dmdd','pmdd','bipolar2','cyclothymia'],
 energy:['bipolar1','bipolar2','cyclothymia'],
 anxiety:['gad','panic','social_anxiety','specific_phobia','agoraphobia','separation','selective_mutism'],
 repetition:['ocd','bdd','hoarding','hair_pulling','skin_picking'],
 stress:['ptsd','acute_stress','adjustment','grief','dpdr','dissociative_amnesia','did','cptsd'],
 body:['somatic','illness_anxiety','fnd','anorexia','bulimia','binge_eating','arfid','enuresis','encopresis','insomnia'],
 substances:['alcohol','cannabis','opioid','stimulant','sedative','tobacco','gambling','gaming'],
 perception:['schizophrenia','schizophreniform','brief_psychotic','delusional','schizoaffective'],
 cognition:['delirium','mild_ncd','major_ncd'],
 context:['odd','conduct','bpd','avoidant_pd','ocpd','gender_dysphoria']
};
const BASELINE_MAP={goals:['F01','F17'],course:['F02'],function:['F07'],mood:['F12'],energy:['F12'],anxiety:['F03','F04','F13'],repetition:['F14'],stress:['F08','F14'],perception:[],cognition:['F06'],body:['F05','F06'],substances:['F10','F11'],development:[],context:['F08','F09'],safety:['F15'],strengths:['F16'],collateral:['F18']};

export function checkpointSources(snapshot,guide){
 const available=new Set(snapshot.facts.map(f=>f.id));
 const general=snapshot.mode==='baseline'?BASELINE_MAP:{
  goals:['G01','P01'],course:['B01'],function:['G04','B03'],context:['G02'],strengths:['P04','B04']
 };
 const caseId=snapshot.caseSelection?.id;
 if(snapshot.mode!=='baseline')for(const [topic,cases] of Object.entries(GENERAL_CASE_TOPICS))if(cases.includes(caseId))general[topic]=[...(general[topic]??[]),'B01','B02'];
 return Object.fromEntries(guide.checklist.map(item=>{
  const ids=item.id.startsWith('focus_')?FOCUSED_SOURCE_MAP[caseId]?.[item.id.slice(6)]??[]:general[item.id.replace(/^common_/,'')]??[];
  return [item.id,[...new Set(ids)].filter(id=>available.has(id))];
 }));
}

export function interviewFeedback({snapshot,guide,state,turns,reasoning,ended=false}){
 if(!ended)return null;
 const facts=new Map(snapshot.facts.map(f=>[f.id,f]));
 const evidence=turns.filter(t=>isEvidenceTurn(t)&&t.factIds?.some(id=>facts.has(id)));
 const mappings=checkpointSources(snapshot,guide);
 const coveredIds=new Set(evidence.flatMap(t=>t.factIds.filter(id=>facts.has(id))));
 const seen=new Set(),usefulQuestions=[];
 for(const turn of evidence){
  const newIds=turn.factIds.filter(id=>facts.has(id)&&!seen.has(id));
  turn.factIds.forEach(id=>seen.add(id));
  if(!newIds.length)continue;
  usefulQuestions.push({turnId:turn.id,question:turn.question,reply:turn.reply,
   sources:newIds.map(id=>({id,label:facts.get(id).label})),
   checkpointLeads:guide.checklist.filter(c=>mappings[c.id].some(id=>newIds.includes(id))).map(c=>({id:c.id,label:c.label})),
   interpretation:'New source material was used in this reply. Check the quotation: a reply may cover only part of a source or checkpoint.'});
 }
 const unknowns=[],evidenceGaps=[];
 for(const checkpoint of guide.checklist){
  const ids=mappings[checkpoint.id],entry=state.items?.[checkpoint.id]??{status:'unasked',turnId:'',note:''};
  const found=ids.filter(id=>coveredIds.has(id)),linked=evidence.find(t=>t.id===entry.turnId);
  const matched=linked?.factIds.filter(id=>ids.includes(id))??[];
  if(!found.length||['uncertain','unasked'].includes(entry.status))unknowns.push({checkpointId:checkpoint.id,label:checkpoint.label,
   reason:!ids.length?'No authored source is mapped to this checkpoint. It remains unknown in this exercise.':!found.length?'No source linked to this checkpoint was obtained in the interview.':entry.status==='uncertain'?'You marked this area unclear. The linked source does not settle your uncertainty.':'Related source material surfaced, but you have not recorded what this checkpoint establishes. Review the exact reply and its unanswered parts.',
   question:checkpoint.question,nextStep:!ids.length?'Document the limit and seek an appropriate additional account, record or supervised assessment. Do not turn unavailable information into a negative finding.':'Ask this follow-up and compare the answer with the original account.'});
  if(['supported','absent'].includes(entry.status)){
   if(!linked)evidenceGaps.push({checkpointId:checkpoint.id,label:checkpoint.label,turnId:entry.turnId||null,issue:'No factual interview turn is linked to this conclusion.',nextStep:'Link the relevant reply or mark the checkpoint unclear.'});
   else if(!matched.length)evidenceGaps.push({checkpointId:checkpoint.id,label:checkpoint.label,turnId:linked.id,issue:'The linked reply cites no source mapped to this checkpoint.',nextStep:`Review ${linked.id} and explain the relevant evidence, choose another reply, or leave this checkpoint unclear.`});
   if(!entry.note?.trim())evidenceGaps.push({checkpointId:checkpoint.id,label:checkpoint.label,turnId:entry.turnId||null,issue:'The observation has no explanation of how the quoted evidence supports it.',nextStep:'Explain the connection and what the reply does not establish.'});
   if(entry.status==='absent')evidenceGaps.push({checkpointId:checkpoint.id,label:checkpoint.label,turnId:entry.turnId||null,issue:'A source link does not prove absence. An unmentioned feature is still unknown.',nextStep:'Check for an explicit, relevant negative account and its timeframe; otherwise mark this unclear.'});
  }
 }
 const support=reasoning?.support??'';
 // Only explicit references are parsed. No keyword, length or target-label
 // heuristic attempts to judge the meaning or correctness of a learner claim.
 const cited=[...new Set(support.match(/\bT[1-9]\d*\b/g)??[])];
 const factualRefs=cited.filter(id=>evidence.some(t=>t.id===id));
 const invalidRefs=cited.filter(id=>!factualRefs.includes(id));
 const conclusionReview={
  statement:reasoning?.hypothesis??'',supportingTurnIds:factualRefs,
  gaps:[...(!cited.length?['Your supporting explanation names no interview turns. Add references such as T2 with the specific observation you are using.']:[]),...(invalidRefs.length?[`${invalidRefs.join(', ')} do not identify factual patient-history answers in this interview.`]:[]),...(evidenceGaps.length?[`${evidenceGaps.length} checklist evidence-link issues need review before you rely on those observations.`]:[]),...(unknowns.length?[`${unknowns.length} checkpoints remain without mapped interview material or are marked unclear. Consider how each affects your impression.`]:[])],
  status:'The wording and clinical validity of your conclusion have not been graded. Valid turn references are traceable evidence, not confirmation of the conclusion.'
 };
 return {version:FEEDBACK_VERSION,perspective:snapshot.interviewPerspective==='caregiver'?`${snapshot.speaker} supplies observations; these do not establish the child’s private experience.`:'Feedback uses the patient’s disclosed account.',
  usefulQuestions,unknowns,evidenceGaps,conclusionReview,
  limitations:['Source mappings are authored teaching links, not a diagnostic scoring rule. A compound checkpoint can contain unanswered parts even when source material is linked.',
   'Only new source IDs are counted in the question highlights. Repeated questions may still clarify meaning; greetings and unavailable details receive no case-evidence credit.',
   'The exact reply can disclose less than its source paragraph. AI grounding checks can miss errors; review quotations and seek qualified feedback.',
   'No diagnostic correctness, competence rating, severity score or safety clearance is inferred. Missing information is unknown, not absent.']};
}
