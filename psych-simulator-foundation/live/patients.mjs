// Fictional scenario authoring, not developmental norms or calibrated age effects.
import {patientIndividuality} from './individuality.mjs';
const rows=[
 ['mika','Mika','Toddler',true,7,'caregiver','playmate','putting toys in a basket with help','a planned play visit changed','sitting together with a caregiver','playing with blocks'],
 ['leo','Leo','Preschool child',true,14,'caregiver','playmate','getting ready for a preschool activity','a playdate was postponed','sharing a picture book with a caregiver','drawing with crayons'],
 ['sam','Sam','School-age child',false,28,'caregiver','friend','finishing a school worksheet','a playground game with a friend was postponed','asking a caregiver for help with a school activity','drawing a picture'],
 ['riley','Riley','Adolescent',false,28,'trusted adult','friend','preparing a school group project','a plan to meet a friend after school changed','talking with a trusted adult about school','listening to music'],
 ['jordan','Jordan','Young adult',false,28,'cousin','friend','finishing a routine work task','a friend cancelled a planned catch-up','talking with a cousin','sketching'],
 ['avery','Avery','Adult',false,28,'sibling','friend','organizing household errands around work','a plan to meet a friend changed','talking with a sibling about a busy week','reading'],
 ['robin','Robin','Older adult',false,28,'friend','neighbor','preparing materials for a community activity','a visit with a neighbor was postponed','talking with a friend about community plans','gardening'],
 ['alex','Alex','Young adult',false,28,'sibling','friend','balancing study and part-time work','a plan to meet a friend changed','talking with a sibling','listening to music']
];
const profiles=rows.map(([id,name,lifeStage,caregiver,defaultDays,supportTarget,planTarget,task,change,support,hobby])=>({id,name,lifeStage,caregiver,defaultDays,supportTarget,planTarget,task,change,support,hobby}));
export function patientProfile(id='jordan'){
 const p=profiles.find(x=>x.id===id);if(!p)throw new Error('Unknown patient profile.');return {...p,individuality:patientIndividuality(id)};
}
export function patientOptions(){return profiles.map(p=>({id:p.id,name:p.name,lifeStage:p.lifeStage,mode:'generated',defaultDays:p.defaultDays,interviewWith:p.caregiver?'Caregiver':'Patient',description:patientIndividuality(p.id).summary,communicationPreview:patientIndividuality(p.id).preview}));}
export function scenario(p){
 const caregiver=p.caregiver;
 const lead=caregiver?`I am ${p.name}'s caregiver. `:'';
 const background=caregiver?`${lead}${p.name} is in the ${p.lifeStage.toLowerCase()} stage. I can describe observed routines and play, including ${p.hobby}. I cannot directly report their private thoughts.`:`My name is ${p.name}. I am in the ${p.lifeStage.toLowerCase()} stage. My usual routines include ${p.task}, and my interests include ${p.hobby}.`;
 const events=[
 {kind:'task',load:.6,connection:0,observation:caregiver?`${p.name} had a routine involving ${p.task}.`:`I had a task involving ${p.task}.`,interpretation:caregiver?'I observed the routine; their private interpretation is unknown.':p.id==='sam'?'I wanted to finish, but it felt like a lot to do.':'I wanted to complete the task, although it felt demanding.'},
 {kind:'cancelled',load:.35,connection:-.4,observation:caregiver?`For ${p.name}, ${p.change}; no reason was explained.`:`For me, ${p.change}; no reason was explained.`,interpretation:caregiver?'I cannot infer what they thought about the changed plan.':'I did not know why the plan changed. I wondered what had happened.'},
 {kind:'support',load:.1,connection:.65,observation:caregiver?`${p.name} had an opportunity for ${p.support}.`:`I had an opportunity for ${p.support}.`,interpretation:caregiver?'I could observe whether they accepted the interaction, not their internal beliefs.':'I thought accepting some support might help.'},
 {kind:'quiet',load:.05,connection:0,observation:caregiver?`${p.name} had unstructured time with a caregiver nearby.`:'I had some free time without a new commitment.',interpretation:caregiver?'Their private thoughts during this activity are unknown.':'I could choose one of my usual activities or take a rest.'}
 ].map(e=>({...e,world:e.kind==='cancelled'?'Another person had a scheduling conflict.':'An ordinary authored opportunity was available.'}));
 const outcomes=caregiver?{
 work:`${p.name} took part in the routine with help.`,pause:`${p.name} paused the routine and the caregiver offered a break.`,seek_support:`${p.name} accepted the caregiver's support.`,rest:`${p.name} had a quiet break with the caregiver nearby.`,reschedule:`${p.name} joined an alternative play activity offered by the caregiver.`,withdraw:`${p.name} stayed near the caregiver instead of joining the activity.`,sketch:`${p.name} spent time ${p.hobby}.`
 }:{work:`I completed the task involving ${p.task}.`,pause:'I paused the task and left it unfinished that day.',seek_support:`I accepted support by ${p.support}, and felt listened to.`,rest:'I took a quiet break.',reschedule:`I asked my ${p.planTarget} about another time; no new date was agreed that day.`,withdraw:'I did not follow up about the changed plan that day.',sketch:`I spent some time ${p.hobby}.`};
 return {background,events,outcomes,opening:caregiver?`${lead}I would like to discuss their recent routines, play and responses to changes.`:`I would like to talk about my recent routines, changes in plans and how I have responded.`,speaker:caregiver?`${p.name}'s caregiver`:p.name};
}
