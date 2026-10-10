import {readFileSync} from 'node:fs';

// Catalogue summaries come from the saved 2026-10-08 research pack. All case
// narratives below are original fiction, not quoted criteria or approved cases.
const CATALOGUE=JSON.parse(readFileSync(new URL('./data/disorder-catalogue.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const SOURCE_REGISTER=JSON.parse(readFileSync(new URL('./data/disorder-sources.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const clone=x=>structuredClone(x);
export const DISORDER_DATA_VERSION='authored-case-premises-1.0.0';
export const additionalSources=[
 {id:'S57',title:'APA: What is schizophrenia?',url:'https://www.psychiatry.org/patients-families/schizophrenia/what-is-schizophrenia',accessed:'2026-10-08',usedFor:'Public comparison of brief, intermediate and longer psychotic courses; not a complete diagnostic assessment.'},
 {id:'S58',title:'NHS: Selective mutism',url:'https://www.nhs.uk/mental-health/conditions/selective-mutism/',accessed:'2026-10-08',usedFor:'Allow written responses or caregiver communication; do not represent situational inability to speak as deliberate refusal.'},
 {id:'S59',title:'Worcestershire Acute Hospitals NHS Trust: What is functional neurological disorder?',url:'https://www.worcsacute.nhs.uk/leaflets/what-is-functional-neurological-disorder-fnd/',accessed:'2026-10-08',usedFor:'Involuntary motor symptoms and positive neurological assessment; symptoms cannot be confirmed from text alone.'}
];
export function disorderOptions(){return CATALOGUE.map(({id,name,description,classification,stages})=>({id,name,description,classification,stages:[...stages]}));}
export function getDisorder(id){const found=CATALOGUE.find(x=>x.id===id);if(!found)throw new Error('Unknown disorder selection.');return clone(found);}
export function compatibleDisorders(lifeStage){return disorderOptions().filter(x=>x.stages.includes(lifeStage));}
// This source namespace is independent of the personality-model registry, which
// uses similar short IDs. Keep it separate in reviewer output and exports.
export function disorderEvidence(sourceIds){
 if(!Array.isArray(sourceIds))throw new Error('Disorder evidence requires a list of source IDs.');
 const sources=[...new Set(sourceIds)].map(id=>{
  const found=SOURCE_REGISTER.sources.find(source=>source.id===id);
  if(!found)throw new Error(`Unknown disorder evidence source: ${id}.`);
  return {...clone(found),reference:`${SOURCE_REGISTER.namespace}:${id}`};
 });
 return {namespace:SOURCE_REGISTER.namespace,caseDataVersion:DISORDER_DATA_VERSION,sources};
}

// Each row authors a course, characteristic experiences, functional impact,
// two diary observations and an opening concern. These are deliberately distinct
// accounts; no global tension score is treated as a diagnostic threshold.
// Earlier-history facts are independent of the user's recent diary length.
const ROWS={
 adhd:[
  'Since my early school years, keeping track of tasks has been difficult at home and in learning settings. This pattern has continued for years, including the months before this diary.',
  'I lose track of multi-step directions, misplace things I need and interrupt before I mean to. I can stay involved longer in an activity that interests me.',
  'I need reminders to finish everyday responsibilities, and missed steps cause problems even when I want to do them.',
  'I started a routine task, got pulled toward another activity and needed a reminder to return.',
  'I noticed I had interrupted someone and asked them to finish what they were saying.',
  'keeping track of things and finishing what I start'
 ],
 autism:[
  'My family describes differences in how I joined conversations, handled changes and responded to sounds from early childhood, well before this diary.',
  'Clear direct language helps me. Unexpected changes and crowded, noisy places can be overwhelming; familiar interests and predictable routines are enjoyable.',
  'I can take part more comfortably when plans are explained ahead of time and there is a quieter place available.',
  'A plan changed without warning, and I asked for a clear explanation of what would happen next.',
  'Background noise made it harder to follow a conversation, so I moved somewhere quieter.',
  'making everyday situations easier to navigate'
 ],
 learning:[
  'Reading accurately and fluently has been difficult since my school years. Targeted reading help for more than six months before this diary did not remove those difficulties.',
  'I understand spoken explanations more easily than a page I have to read myself. Reading unfamiliar words is slow and tiring.',
  'Written instructions take extra time, although I can explain ideas and do practical activities.',
  'I reread a written instruction several times and asked someone to explain it aloud.',
  'I understood an example when it was demonstrated, after struggling to get it from the written page.',
  'why reading still takes so much effort'
 ],
 language:[
  'My family noticed difficulties understanding and putting together sentences during early childhood. I have needed communication support over time, not just during this diary.',
  'Long instructions are hard to follow. I sometimes know what I want to explain but cannot find or organize the words.',
  'Short sentences, pictures and time to respond help me take part in everyday conversations.',
  'I asked for a long instruction to be broken into shorter steps.',
  'I used a picture and a few words to explain something I could not describe in a long sentence.',
  'getting enough time and support to explain myself'
 ],
 idd:[
  'My family describes support needs in learning and everyday skills from childhood. A developmental assessment is mentioned in my history, but its scores and report are not available here.',
  'I learn routines through repeated practice and clear steps. I can make choices about familiar activities and ask for help with new ones.',
  'I need ongoing help with unfamiliar multi-step daily tasks, while keeping choices and familiar skills of my own.',
  'I practiced one step of a familiar routine with support.',
  'I chose an activity I enjoy and asked for help with a new part of it.',
  'the support that helps me do everyday things'
 ],
 tourette:[
  'Repeated movements and sounds began during my school years and have come and gone for more than a year before this diary.',
  'I have repeated shoulder movements and brief throat sounds that I do not intend to make. Trying to hold them back is uncomfortable.',
  'The movements and sounds can interrupt an activity, and being watched makes participation uncomfortable.',
  'A repeated shoulder movement interrupted a routine activity.',
  'I made repeated throat sounds during a conversation and asked for a moment to continue.',
  'the movements and sounds that keep interrupting me'
 ],
 mdd:[
  'For four months, including the time before this diary, I have felt low and lost interest on most days. This is different from how I usually was before that period.',
  'Sleep is broken, energy is low, concentrating takes effort and I am hard on myself. Activities I usually enjoy feel much less rewarding.',
  'Everyday responsibilities take much longer, and I have pulled back from people and hobbies I care about.',
  'I set aside time for something I normally enjoy but felt little interest once I began.',
  'After broken sleep, I struggled to concentrate on a routine task.',
  'feeling low and losing interest in things'
 ],
 pdd:[
  'Low mood and low energy have been my usual experience for several years, including well before this diary. There have been better days, but no long return to my earlier baseline.',
  'I often feel discouraged, have little confidence and find it hard to make decisions. I still keep some routines going.',
  'I manage some obligations but have cut back on enjoyable activities and find ordinary days an effort.',
  'I completed a familiar routine while feeling the same discouragement that has been around for a long time.',
  'I found it hard to choose between two ordinary plans because I expected neither to go well.',
  'a low feeling that has been around for a long time'
 ],
 dmdd:[
  'Since earlier childhood, adults at home and school have described severe outbursts several times a week and irritability between them. This has continued for over a year before this diary.',
  'Small frustrations can build into a large outburst, and I often still feel cross afterward rather than returning to my usual calm.',
  'The pattern has disrupted both school activities and family routines. The account is not a series of distinct high-energy episodes.',
  'A small change in a routine led to shouting and a long pause before I could rejoin.',
  'Even on a day without an outburst, I felt cross during ordinary interactions.',
  'getting so upset and staying cross afterward'
 ],
 pmdd:[
  'I have menstrual cycles. Across several cycles before this diary, marked mood changes have occurred before bleeding and eased afterward; daily tracking across future cycles is still needed.',
  'During that part of the cycle I feel unusually irritable, tearful and overwhelmed, with trouble concentrating. There are clearer intervals at other times.',
  'The recurring difficult interval disrupts relationships and responsibilities; the same level of difficulty is not present every day of the month.',
  'In the premenstrual interval, I became unusually tearful during an ordinary conversation.',
  'In that same interval, concentration was difficult and I postponed part of a routine task.',
  'mood changes that seem connected with my cycle'
 ],
 bipolar1:[
  'Before this diary, I had a distinct eight-day period of unusually high energy, very little need for sleep, racing plans and behavior that seriously disrupted my life. I needed hospital care then; afterward I returned to a steadier routine.',
  'During that past period I felt unusually capable, talked much more and committed to far more than I could manage. I am not reporting a new high-energy episode in this diary.',
  'I am rebuilding routines and relationships affected by that earlier period. The current focus is keeping track of sleep and manageable commitments.',
  'I checked my recent sleep pattern while deciding how much to take on.',
  'I discussed a manageable plan with someone who had noticed the earlier change in my behavior.',
  'understanding a past period when my energy and behavior changed dramatically'
 ],
 bipolar2:[
  'Before this diary, I had several weeks of low mood and lost interest, and a separate five-day period of noticeably higher energy, less need for sleep and more talk and activity. I remained out of hospital during the higher-energy period.',
  'The higher-energy period was a clear change noticed by others. I do not describe a past period with the severe disruption that required hospital care; my recent difficulty has been low mood.',
  'Recent low energy and reduced interest have made everyday tasks and enjoyable activities harder.',
  'I struggled to get started on a usual activity while remembering that my energy had been very different during an earlier period.',
  'I reviewed a sleep note with someone close to me to help explain the separate earlier and recent periods.',
  'different stretches of low mood and unusually high energy'
 ],
 cyclothymia:[
  'For several years before this diary I have had stretches of extra energy and stretches of low mood, with few long settled intervals. The authored history does not describe a full severely disruptive high-energy episode or a full depressive episode.',
  'The changes unfold across stretches of days rather than switching every hour. My confidence, sleep and activity shift with those stretches.',
  'The uneven rhythm makes it difficult to keep plans and routines consistent.',
  'I compared the activity and sleep notes from two different stretches of days.',
  'I adjusted a routine plan because my energy had not been as steady as I expected.',
  'a long-running uneven rhythm in mood and energy'
 ],
 gad:[
  'For more than eight months before the interview I have worried on most days about several parts of life, including responsibilities, people close to me and everyday mistakes.',
  'The worry is hard to stop even when I want to. I feel tense, get tired and have trouble settling to sleep.',
  'Worry and repeated reassurance-seeking interrupt ordinary responsibilities and time I want to enjoy.',
  'I moved from one worry about a routine task to another worry about someone close to me.',
  'At bedtime I kept going over several things that might go wrong the next day.',
  'worries that move from one thing to another and are hard to stop'
 ],
 panic:[
  'Unexpected episodes of intense fear began six months before this interview. Since the first episodes, I have spent months worrying about another one and changing activities to avoid being caught unprepared.',
  'An episode can come on suddenly without an obvious threat, with a pounding heart, breathlessness and fear that something terrible is happening. Medical explanations have not been settled in this account.',
  'I have started avoiding ordinary outings and checking where I could get help.',
  'I changed a planned outing because I was afraid of having another sudden episode away from home.',
  'A sudden spell of pounding heart and intense fear interrupted an otherwise ordinary moment.',
  'sudden frightening episodes and the worry between them'
 ],
 social_anxiety:[
  'For more than a year before this diary I have feared being judged in conversations and group situations. I want contact with people, but the fear gets in the way.',
  'I worry that others will notice my discomfort or think I have said something foolish. I review conversations afterward.',
  'I avoid speaking up and miss chances to join activities even when I would like to participate.',
  'I had something to contribute in a group but stayed quiet because I feared being judged.',
  'After a conversation I repeatedly went over what I had said and worried about how it sounded.',
  'fear of being judged when I am around people'
 ],
 specific_phobia:[
  'For more than a year before this diary, lifts have prompted strong fear and avoidance. The fear is much larger than I want it to be and has limited where I go.',
  'Seeing a lift or anticipating using one brings immediate fear. I take stairs or avoid the trip when I can.',
  'I have missed activities or needed long detours to avoid the feared situation.',
  'I took a long stair route to avoid using a lift.',
  'The thought of a planned visit involving a lift made it hard to focus on the rest of the day.',
  'a particular fear that keeps limiting where I go'
 ],
 agoraphobia:[
  'For over a year before this diary I have avoided crowded public places and public transport because escape or help might be difficult if I became overwhelmed.',
  'The fear is about being unable to leave or get help, rather than about people judging me. Having someone familiar nearby makes going out easier.',
  'I have shortened trips, declined outings and relied on accompaniment for ordinary activities.',
  'I declined a crowded journey because I feared I could not leave easily.',
  'I planned an outing around where I could get out and whether someone could accompany me.',
  'feeling unable to go places where leaving or getting help seems difficult'
 ],
 separation:[
  'For eight months before the interview, being apart from someone close to me has prompted strong distress and repeated worry that something might happen to them.',
  'I want frequent reassurance about where they are and whether they are safe. Being apart interferes with ordinary activities I used to manage.',
  'I delay leaving for activities or repeatedly seek contact instead of joining in.',
  'Before an ordinary separation, I repeatedly asked when we would be together again.',
  'I struggled to join a planned activity while worrying about the person I was apart from.',
  'how hard it has become to be apart from someone close'
 ],
 selective_mutism:[
  'For several months before this diary I have been able to speak freely at home with familiar people but unable to speak in some learning and unfamiliar social settings. It has lasted beyond settling into a new setting.',
  'When speech gets stuck, I cannot simply make it happen. In this text interview I can communicate through short written replies; that does not mean I can speak aloud in the same situation.',
  'It is hard to ask for help or show what I know in those settings, even though I speak in comfortable situations.',
  'I answered a question by pointing or writing when I could not say it aloud.',
  'At home with someone familiar, I spoke about an activity I enjoyed.',
  'getting help communicating when my voice feels stuck'
 ],
 ocd:[
  'For many months before this diary, unwanted doubts about having failed to secure things have led to repeated checking that takes up substantial time.',
  'I do not want the doubts. I feel driven to check again even after I have already checked, and the relief does not last.',
  'Repeated checking makes me late and cuts into activities I want to do.',
  'I went back to check a closed door again despite remembering checking it already.',
  'I tried to move on with an activity, but an unwanted doubt pulled my attention back toward checking.',
  'unwanted doubts and the checking I feel pushed to do'
 ],
 bdd:[
  'For many months before this diary I have spent a great deal of time preoccupied with a feature of my appearance that others say they barely notice.',
  'I repeatedly check reflections, compare my appearance and seek reassurance. The concern feels hard to set aside.',
  'I delay leaving home and avoid being seen because of the preoccupation.',
  'Repeatedly checking my reflection delayed a planned activity.',
  'I avoided a social opportunity because I was preoccupied with how a feature of my appearance looked.',
  'an appearance concern that is taking over too much of my day'
 ],
 hoarding:[
  'For years before this diary I have found discarding possessions intensely difficult, and items have accumulated until some living areas cannot be used as intended.',
  'I fear losing something I might need or something important about an item. Decisions about letting things go become overwhelming.',
  'Clutter interferes with using the home and inviting people in; it is not simply a collection I keep organized.',
  'I tried to clear a usable surface but could not decide which items I could let go.',
  'I changed a plan to have someone visit because the space was hard to use.',
  'possessions and decisions about letting them go'
 ],
 hair_pulling:[
  'For many months before this diary I have repeatedly pulled hair, noticed visible changes and tried unsuccessfully to stop.',
  'Sometimes I notice an urge first and sometimes I become aware after I have started. I feel distressed about the pattern rather than wanting its consequences.',
  'I spend time hiding the affected area and have avoided activities because I feel embarrassed.',
  'During a quiet activity I noticed that I had started pulling hair again.',
  'I tried to stop the behavior and felt discouraged when the urge returned.',
  'a repeated behavior involving my hair that I have had trouble stopping'
 ],
 skin_picking:[
  'For many months before this diary I have repeatedly picked my skin, left sore areas and made unsuccessful attempts to stop.',
  'I sometimes notice the urge and at other times only realize after I have begun. The behavior and its effects upset me.',
  'Sore areas and time spent checking or hiding them interfere with activities.',
  'I noticed that I had begun picking a spot during an ordinary quiet moment.',
  'I covered a sore area and changed a plan because I was worried others would notice.',
  'a repeated skin-related behavior that has been difficult to stop'
 ],
 ptsd:[
  'A serious traffic collision involving threatened injury happened a year before this interview. For months afterward, unwanted reminders, avoidance and feeling on guard have disrupted my life.',
  'Memories intrude when I do not want them, sleep is disturbed and reminders of the collision can feel overwhelming. I avoid some routes and feel less connected with people.',
  'Travel and ordinary activities have become restricted by reminders and alertness.',
  'A sound resembling the collision brought an unwanted memory and made me step away from a routine activity.',
  'I took a different route to avoid a reminder and found it hard to settle afterward.',
  'unwanted reminders and feeling on guard since a frightening event'
 ],
 acute_stress:[
  'A serious traffic collision involving threatened injury happened fourteen days before this interview. The unusual reactions began afterward; they were not present earlier in the diary window.',
  'Since the collision I have had intrusive reminders, disturbed sleep, avoidance of reminders and moments when things feel distant or unreal.',
  'These recent reactions have interrupted travel, concentration and ordinary routines.',
  'A reminder of the recent collision interrupted what I was doing and made me feel intensely on edge.',
  'I avoided a reminder of the collision and struggled to concentrate afterward.',
  'new reactions since a frightening event two weeks ago'
 ],
 adjustment:[
  'An ongoing disruption to a familiar routine began two months before this interview. Distress and difficulty coping began soon afterward; the practical consequences are still continuing.',
  'I feel upset and preoccupied with that change and find it harder to settle into everyday activities. The history does not establish another full syndrome.',
  'The continuing change has disrupted concentration, routines and plans with other people.',
  'A reminder of the changed routine made it hard to focus on a planned activity.',
  'I asked someone for help dealing with the practical consequences of the ongoing change.',
  'coping with a recent change that still affects everyday life'
 ],
 grief:[
  'Someone very close to me died eighteen months before this interview. Strong yearning and preoccupation have remained central to daily life; my own family and cultural context matter in understanding this.',
  'I find it hard to take in the loss, feel disconnected and have trouble rejoining meaningful activities. Sadness is not the only part of it.',
  'The continuing preoccupation and difficulty reengaging have substantially restricted everyday life.',
  'A familiar reminder brought prolonged yearning and made it difficult to continue an ordinary activity.',
  'I wanted to join an activity but struggled with feeling disconnected from life without the person who died.',
  'how hard it has been to live with a lasting loss'
 ],
 dpdr:[
  'For many months before this diary I have had recurring periods of feeling detached from myself or as though the surroundings are unreal.',
  'The sensations are disturbing, but I know they are a feeling rather than proof that the world has actually changed.',
  'The episodes interrupt concentration and make ordinary activities feel difficult to stay involved in.',
  'During a routine activity I felt as though I was watching myself from a distance, while knowing it was a sensation.',
  'My surroundings felt strangely unreal for a while, even though I knew where I was.',
  'disturbing feelings of detachment while knowing they are feelings'
 ],
 dissociative_amnesia:[
  'Since a distressing event several months before this diary, I have had a specific gap in autobiographical memory for the event and the following evening. Earlier life and current everyday knowledge are preserved in this authored account.',
  'I can describe the boundary of the gap but cannot fill it in. Another person has told me we talked that evening; I do not remember that conversation.',
  'Not knowing that part of my own history is distressing and has made related conversations difficult.',
  'A question about the missing evening came up, and I said honestly that I could not recall it.',
  'I remembered an ordinary current activity while noticing that the earlier specific gap remained.',
  'a particular gap in my memory that I cannot explain'
 ],
 did:[
  'For years before this diary I have experienced discontinuities in my sense of self and recurrent gaps for everyday actions. A support person has described marked changes that I do not fully recall.',
  'I sometimes find notes or completed activities that I cannot remember doing. My memories are limited to the authored account; missing periods are not available for me to invent.',
  'The gaps and changes make following through on plans difficult. No violent behavior or hidden traumatic story is assumed.',
  'I found a note about an ordinary plan and could not remember writing it.',
  'Someone mentioned an everyday conversation I could not recall, and I explained that the memory was missing.',
  'gaps in everyday memory and changes in my sense of self'
 ],
 somatic:[
  'For more than a year before this diary I have had distressing recurring bodily discomfort and spent a great deal of time worrying about and responding to it.',
  'The discomfort is real to me. Repeated checking and concern about what it means take up much of my attention; medical findings are not available in this account.',
  'Time spent monitoring symptoms and seeking reassurance interferes with other responsibilities and activities.',
  'Bodily discomfort drew my attention repeatedly away from a routine activity.',
  'I spent a long time checking and worrying about a symptom instead of doing something I had planned.',
  'bodily symptoms and how much of my day the concern takes up'
 ],
 illness_anxiety:[
  'For over a year before this diary I have been preoccupied with the possibility of a serious illness, even during periods with little bodily discomfort.',
  'Ordinary sensations set off illness fears. Reassurance helps only briefly, and I repeatedly check for signs of disease.',
  'Checking and worry take time away from responsibilities and enjoyable activities.',
  'A minor ordinary sensation led me to repeatedly check for signs of a feared illness.',
  'After seeking reassurance I felt calmer briefly, then returned to the same health worry.',
  'health fears that keep returning even with few symptoms'
 ],
 fnd:[
  'Intermittent movement difficulties began several months before this diary and have affected daily activities. A neurological assessment is part of the referral history; its detailed findings are not available in this simulation.',
  'I experience episodes of leg weakness that are not under my voluntary control. I cannot establish their cause from the way they feel.',
  'The movement difficulty has interrupted getting around and routine activities; the account does not establish an examination or test result.',
  'A period of leg weakness interrupted an ordinary activity and I sought practical support.',
  'I planned a routine activity around the help I might need if the movement difficulty returned.',
  'movement symptoms that have been disrupting everyday activities'
 ],
 anorexia:[
  'For many months before this diary I have restricted food and become preoccupied with weight and shape. A clinician documented low weight relative to my health and developmental context; no numerical weight or target is supplied.',
  'Eating more brings intense fear of weight gain, and I have difficulty recognizing how much the restriction has affected me.',
  'Food-related rules and low energy interfere with shared meals, concentration and usual activities.',
  'An ordinary shared meal brought distress about eating and I struggled to participate.',
  'Low energy interrupted an activity while food-related worries occupied my attention.',
  'food worries and how they have affected my life'
 ],
 bulimia:[
  'For several months before this diary I have had recurring episodes of eating with a sense of lost control, followed by attempts to compensate. The pattern is distressing and has been kept private.',
  'Weight and shape strongly affect how I judge myself. I feel ashamed afterward; the interview does not need details of harmful methods or quantities.',
  'The cycle interferes with time, relationships and shared meals.',
  'After a loss-of-control eating episode I felt distressed and preoccupied with trying to compensate, without describing a method.',
  'I avoided a shared meal because I feared becoming caught in the same cycle.',
  'a distressing cycle around eating that has been hard to talk about'
 ],
 binge_eating:[
  'For several months before this diary I have had repeated episodes of eating with a sense of lost control and marked distress afterward. Regular compensatory behavior is not part of this authored history.',
  'During episodes I find it hard to stop and afterward I feel ashamed. The concern is the loss of control and distress, not a numerical food or weight target.',
  'The pattern affects shared meals, time and how comfortable I feel with people.',
  'A loss-of-control eating episode left me distressed and reluctant to join a planned activity.',
  'I worried about another episode and found it difficult to focus on an ordinary routine.',
  'repeated loss of control around eating and the distress afterward'
 ],
 arfid:[
  'A narrow range of accepted food textures has limited eating for many months before this diary. The pattern has made meals away from familiar routines very difficult.',
  'Some textures feel intolerable and I have difficulty trying unfamiliar foods. Weight or appearance goals are not driving this authored account.',
  'Food restriction substantially interferes with shared meals and activities; growth or nutritional test results are not supplied.',
  'A meal included an unfamiliar texture, and I struggled to take part with the others.',
  'I needed a familiar food option to join a planned activity involving a meal.',
  'food textures and how restricted eating affects ordinary activities'
 ],
 enuresis:[
  'After the ordinary toilet-learning stage, repeated nighttime wetting has continued for many months before this diary. Developmental and medical details beyond that account still need assessment.',
  'The wetting happens during sleep and is not something I choose. I feel uncomfortable talking about it.',
  'I worry about overnight activities and need help managing bedding and routines without blame.',
  'I woke to wet bedding and dealt with the practical cleanup with support.',
  'I worried about an overnight activity because I did not want anyone to notice the problem.',
  'a nighttime problem that is hard to talk about'
 ],
 encopresis:[
  'After learning to use the toilet, repeated bowel accidents and uncomfortable constipation have continued for many months before this diary. Medical assessment details are not provided.',
  'The accidents are upsetting and are not a deliberate choice. I sometimes avoid the toilet because passing stool has been uncomfortable.',
  'Worry about accidents has affected participation and I need calm practical help rather than blame.',
  'A bowel accident interrupted an ordinary activity and I needed practical support.',
  'I worried about using the toilet because it had been uncomfortable before.',
  'bowel accidents and discomfort that affect everyday activities'
 ],
 insomnia:[
  'For more than six months before the interview I have struggled to fall asleep or stay asleep on several nights each week despite allowing time and a suitable place to sleep.',
  'I feel tired rather than unusually energized after little sleep, and become preoccupied with how the next night will go.',
  'Daytime concentration, energy and usual responsibilities have suffered.',
  'After lying awake for a long time, I struggled to stay focused on a routine daytime task.',
  'I woke repeatedly during the night even though I had allowed enough time to sleep.',
  'poor sleep and how it affects the next day'
 ],
 odd:[
  'For more than eight months before this interview, repeated angry arguments and refusal around ordinary requests have caused problems with adults outside as well as inside my family.',
  'I often feel annoyed and argue when asked to do things. The pattern needs context; it is not a claim that one disagreement or asserting a need is a disorder.',
  'The repeated conflict has disrupted shared routines and relationships.',
  'An ordinary request led to a prolonged argument and delayed a shared activity.',
  'I stayed annoyed after a disagreement and found it hard to rejoin a cooperative task.',
  'arguments and angry feelings that keep disrupting things'
 ],
 conduct:[
  'Over the year before this diary there have been repeated incidents of taking others\' property, damaging belongings and breaking important agreed rules. These were separate incidents, not one disagreement.',
  'I can describe what happened without being reduced to those behaviors. The reasons, effects on others and circumstances need careful discussion.',
  'Trust and participation in shared activities have been affected, and I have responsibilities to help repair the harm.',
  'I discussed the effect of an earlier damaged belonging and a plan to repair what I could.',
  'A conflict about an agreed rule brought up the consequences of earlier repeated incidents.',
  'repeated behavior that has harmed trust and caused problems'
 ],
 alcohol:[
  'During the year before this diary, drinking repeatedly went beyond what I intended, efforts to cut back failed and responsibilities and relationships were affected.',
  'Cravings and time organized around drinking compete with other goals. Intoxication and withdrawal are not assumed from this history alone.',
  'I have missed commitments and continued drinking despite knowing it was causing problems.',
  'An urge to drink distracted me from a planned responsibility.',
  'I spoke about a missed commitment and an unsuccessful earlier attempt to cut back on drinking.',
  'drinking that has become hard to control'
 ],
 cannabis:[
  'During the year before this diary, cannabis use repeatedly exceeded my plans, efforts to reduce it were unsuccessful and daily commitments were affected.',
  'Urges to use and time spent around use compete with other goals. No current intoxication or withdrawal state is authored.',
  'I have continued using despite recurring problems with commitments and people close to me.',
  'An urge to use cannabis pulled my attention away from a planned activity.',
  'I discussed an earlier unsuccessful attempt to reduce use and a commitment I had missed.',
  'use that has become difficult to control and gets in the way'
 ],
 opioid:[
  'During the year before this diary I repeatedly used opioids outside the agreed medical plan, found efforts to reduce use unsuccessful and experienced consequences for responsibilities and relationships.',
  'Cravings and obtaining or using the substance compete with other goals. Prescribed use alone is not the basis of this authored concern.',
  'I have missed commitments and continued use despite harm. Current intoxication, overdose or withdrawal is not authored.',
  'An urge to use distracted me from an ordinary responsibility.',
  'I described a missed commitment and difficulty keeping an earlier plan to change use.',
  'a pattern of substance use that has become hard to control'
 ],
 stimulant:[
  'During the year before this diary I repeatedly used stimulants outside an agreed medical plan, could not keep limits I set and continued despite problems in everyday life.',
  'Craving and time spent around use compete with responsibilities. Taking medication as directed is not the pattern described here.',
  'Use has interfered with commitments and relationships; no current intoxication or withdrawal episode is authored.',
  'An urge to use disrupted attention to a planned task.',
  'I reflected on a failed attempt to keep a limit and its effect on an ordinary commitment.',
  'substance use that keeps overtaking plans I make'
 ],
 sedative:[
  'During the year before this diary I repeatedly used sedating medication outside the agreed medical plan, exceeded my intended use and could not sustain attempts to reduce it.',
  'Urges to use and repeated use despite problems have become central concerns. This is not simply prescribed medication taken as directed.',
  'The pattern has disrupted daily responsibilities and relationships. No acute intoxication or withdrawal state is authored.',
  'An urge to use interrupted an ordinary activity.',
  'I discussed an unsuccessful earlier attempt to change use and its consequences for a commitment.',
  'use of sedating medication that has become difficult to control'
 ],
 tobacco:[
  'During the year before this diary I repeatedly returned to tobacco despite attempts to stop and continued use despite recognizing consequences.',
  'Cravings interrupt my attention and routines. My earlier efforts to cut back have been difficult to maintain.',
  'Time, spending and plans have become organized around opportunities to use tobacco.',
  'A craving interrupted my concentration during a routine activity.',
  'I changed an ordinary plan around an opportunity to use tobacco and felt frustrated about the pattern.',
  'repeatedly returning to tobacco when I want to change'
 ],
 gambling:[
  'Over the year before this diary, gambling became harder to control, attempts to stop failed and I kept returning after losses.',
  'I spend time preoccupied with gambling and have tried to hide how much it has affected me. The account does not provide betting methods or amounts.',
  'Money concerns, missed commitments and damaged trust have accumulated.',
  'An urge to return to gambling distracted me from a planned responsibility.',
  'I discussed a missed commitment and money worry connected with earlier gambling.',
  'gambling that keeps pulling me back despite the consequences'
 ],
 schizophrenia:[
  'Changes began over a year before this diary, including hearing speech others did not hear, strong unusual beliefs and a marked loss of initiative. There was an extended active period followed by continuing difficulties.',
  'I sometimes hear a voice when no speaker is present and find it hard to organize thoughts. What I experience is reported as my perception, not as proof of an outside event.',
  'Concentration, routines and contact with people have declined from my earlier level. My interests and goals still matter.',
  'I heard brief speech that the person nearby said they did not hear, and it interrupted my activity.',
  'I needed extra time and support to organize the steps of an ordinary task.',
  'changes in experiences and everyday functioning that have been going on a long time'
 ],
 schizophreniform:[
  'Hearing speech others do not hear, unusual beliefs and trouble organizing activities began about three months before this interview. These experiences were not part of my earlier baseline.',
  'I sometimes hear a voice without an identifiable speaker and lose the thread of what I am trying to do. The course is still being understood.',
  'Everyday functioning has changed substantially during these recent months.',
  'I heard brief speech others nearby did not hear and paused an activity.',
  'I lost the thread of a routine task and asked for help organizing the next step.',
  'unfamiliar experiences and difficulties that began a few months ago'
 ],
 brief_psychotic:[
  'Fourteen days before this interview I began hearing speech others did not hear and became markedly confused in conversation. The episode lasted a week; during the last week I returned to my earlier everyday baseline.',
  'I am discussing a recent resolved episode, not reporting continuing voices throughout the diary. Its cause and medical or substance exclusions have not been settled here.',
  'The episode temporarily disrupted my routines and relationships; I want to understand what happened.',
  'During the brief episode, speech that others did not hear interrupted what I was doing.',
  'During that episode, I lost track of a conversation and needed support to finish an ordinary routine.',
  'a short, confusing episode that has now settled'
 ],
 delusional:[
  'For over a year before this diary I have held a strong belief that someone is deliberately interfering with my correspondence, despite others telling me they have not found evidence of it.',
  'The concern feels convincing to me. It is presented as my belief, not as a confirmed fact about other people; most other conversations and routines remain organized.',
  'Checking correspondence and conflict about the belief have affected relationships while many other activities remain intact.',
  'I checked an ordinary message because I believed someone might have interfered with it; no interference was established.',
  'A conversation became difficult when another person did not share my explanation of a missing message.',
  'a concern about interference that people around me do not share'
 ],
 schizoaffective:[
  'Across the past year I had extended periods of severe low mood and reduced interest together with hearing speech others did not hear. There was also a separate three-week period of those perceptual experiences without prominent mood symptoms.',
  'Low mood occupied much of the overall course, but the perceptual experiences were not confined to those periods. The timeline is an authored account needing full assessment.',
  'Both changes in mood and unusual perceptual experiences have interfered with everyday functioning.',
  'Low mood made a routine difficult while I also experienced brief speech others did not hear.',
  'I described the separate earlier period when similar perceptual experiences occurred without the same low mood.',
  'how changes in mood and unusual experiences have overlapped over time'
 ],
 delirium:[
  'My support person says my attention and awareness changed suddenly three days before this interview during an acute physical illness. Earlier in the diary I was at my usual baseline.',
  'I have trouble keeping track of a conversation, and it varies over the day. I cannot reliably reconstruct every confused period; collateral and medical assessment are needed.',
  'The sudden change has interrupted ordinary functioning and led to medical review. This is a medically supervised fictional encounter.',
  'During the acute illness, I lost track of a short conversation and needed it repeated.',
  'During the acute illness my attention was clearer for a while, then became difficult to sustain again.',
  'a recent sudden change that has made it hard to keep track of things'
 ],
 mild_ncd:[
  'Over the year before this diary I and someone close to me noticed a decline in remembering recent plans compared with my own earlier ability. Formal test findings and a cause are not provided.',
  'I repeat a question or forget a recent arrangement, but reminders and lists let me manage my usual responsibilities independently.',
  'I need more effort and compensating strategies, while everyday independence is largely maintained.',
  'I used a written reminder to complete a routine plan independently after forgetting it briefly.',
  'I asked about a recent arrangement again, then checked my notes to organize the next step.',
  'changes in memory compared with how I used to manage'
 ],
 major_ncd:[
  'Over the year before this diary there has been a clear decline from my earlier memory and everyday abilities, described by me and someone close to me. Formal test findings and a cause are not provided.',
  'I lose track of recent plans and cannot consistently manage some previously familiar multi-step responsibilities without help.',
  'I now need another person to help manage important daily responsibilities, while retaining preferences, interests and decisions I can make.',
  'I needed another person to guide a familiar multi-step task I previously managed alone.',
  'I chose an activity I enjoy while someone helped me organize the necessary steps.',
  'changes in memory and the help I now need with familiar tasks'
 ],
 bpd:[
  'Since adolescence and across years before this diary, intense emotions, an uncertain sense of myself and unstable close relationships have caused difficulties in more than one setting.',
  'Small signs of distance can bring strong fears of being left. My feelings and view of myself can shift sharply, but I still have personal goals and strengths.',
  'The longstanding pattern complicates relationships and keeping routines steady. Self-harm or violence is not automatically part of this authored history.',
  'A delayed reply brought a strong fear of being left and made it hard to focus on a planned activity.',
  'After an intense exchange I tried to explain what I needed and return to an ordinary routine.',
  'intense feelings and recurring difficulties in close relationships'
 ],
 avoidant_pd:[
  'Since adolescence and across years before this diary, fear of criticism and feelings of inadequacy have limited close relationships, new activities and everyday opportunities.',
  'I want connection but hold back unless I feel sure of being accepted. The pattern extends across settings, not just one stressful week.',
  'I decline opportunities and keep distance despite wishing I could participate more.',
  'I declined a new activity because I expected criticism even though I wanted to join.',
  'I waited for reassurance of acceptance before sharing something personal in a conversation.',
  'a longstanding habit of holding back for fear of rejection'
 ],
 ocpd:[
  'For years before this diary I have relied on rigid standards about order, rules and getting things exactly right across several parts of life.',
  'I become absorbed in details, struggle to delegate and find flexibility uncomfortable. This account is about an enduring style, not unwanted intrusive thoughts and checking rituals.',
  'Perfection and control delay finishing tasks and create conflict in shared activities.',
  'I kept revising small details of a routine task until it was difficult to finish.',
  'I struggled to share responsibility because another person wanted to do a familiar task differently.',
  'rigid standards that make it hard to finish things or work with others'
 ],
 gender_dysphoria:[
  'For more than a year before this diary I have experienced persistent distress related to a mismatch between my experienced gender and aspects of my body or how I am treated socially.',
  'Being addressed in a way that does not fit me and certain body-related situations can be upsetting. My gender itself is not an illness.',
  'The distress has interfered with participation and concentration; affirming social support is a resource I value.',
  'Being addressed in a way that did not fit my gender made it hard to stay engaged in an activity.',
  'I felt more comfortable participating when someone used the way of addressing me that I requested.',
  'distress about how my gender and everyday experience fit together'
 ],
 cptsd:[
  'Repeated interpersonal threats in an earlier period ended more than a year before this diary. Since then, reminders, avoidance and feeling on guard have coexisted with persistent difficulty regulating emotion, a negative view of myself and trouble trusting relationships.',
  'I have unwanted reminders and also feel lasting shame and disconnection. The account does not invent graphic events or make the threats current.',
  'The lasting difficulties affect routines, self-confidence and closeness with people.',
  'A reminder of the earlier threats interrupted an activity and made it hard to settle.',
  'Even in a calm conversation I struggled with shame and trusting another person enough to accept support.',
  'lasting reactions and relationship difficulties after earlier repeated threats'
 ],
 gaming:[
  'For over a year before this diary I have found it difficult to control gaming, repeatedly prioritized it over other activities and continued despite significant consequences.',
  'I lose track of plans to stop and return to gaming when I intended to do something else. Enjoying games alone is not the concern.',
  'Sleep, responsibilities and relationships have been affected by the pattern.',
  'I continued gaming past a plan to stop and missed an ordinary commitment.',
  'An urge to return to gaming competed with time I had set aside for another valued activity.',
  'gaming that keeps displacing other important parts of my life'
 ]
};

// Child-caregiver variants report observable behavior and recorded collateral.
// They never place an adult autobiographical voice inside a young child.
const CARE={
 autism:[
  'Since early development, we have noticed differences in how the child joins shared attention, communicates preferences and handles changes or sensory input. This history began before the recent diary.',
  'I observe repeated play routines, distress with some unexpected changes and sensitivity to loud sounds. I cannot directly report the child\'s private thoughts.',
  'Predictable steps, communication support and a quieter space help participation in play and daily routines.',
  'An unexpected change to a familiar play routine was followed by visible distress; I explained the next step.',
  'Loud background noise interrupted shared play, and we moved to a quieter space.',
  'communication, play routines and support with changes'
 ],
 language:[
  'Since early language development, the child has had difficulty understanding longer messages and using words together. These concerns were present before the recent diary.',
  'I observe difficulty following a long instruction and expressing a need in words. Pictures, gestures and short steps are helpful; language and hearing assessments are not reproduced here.',
  'Communication support is needed to join routines and to make needs understood.',
  'During a routine, the child needed a long instruction broken into shorter steps.',
  'The child used a gesture and a picture to make a choice that was difficult to express in words.',
  'the support that helps the child understand and communicate'
 ],
 idd:[
  'The child has needed additional support in learning and everyday skills since early development. A developmental assessment was requested before this diary, but no intellectual test score or confirmed assessment result is authored.',
  'I observe that learning a new routine takes repeated supported practice. The child still expresses preferences and has familiar activities they enjoy.',
  'The child needs help with multiple everyday learning and practical routines; the required level needs proper developmental assessment.',
  'The child practiced one familiar routine step with repeated demonstration and support.',
  'The child chose a preferred activity and needed help with an unfamiliar step.',
  'the child\'s learning and everyday support needs'
 ],
 separation:[
  'For many months before this diary, separation from a familiar caregiver has involved persistent distress that substantially interrupts participation, beyond the child\'s own earlier pattern.',
  'I observe repeated clinging, crying and difficulty joining familiar activities when separation is expected. These observations do not tell me exactly what the child thinks.',
  'The child has missed ordinary play or preschool activities because leaving the caregiver is so difficult.',
  'Before a familiar caregiver left, the child clung and cried and had difficulty joining the activity.',
  'The child needed prolonged support around an expected separation during a familiar routine.',
  'distress around separation and its effect on participation'
 ],
 selective_mutism:[
  'For several months before this diary, the child has spoken freely with familiar people at home but has not been able to speak in preschool and some unfamiliar settings. This continued beyond the first settling-in period.',
  'I observe a marked difference across settings. Pointing or gestures sometimes allow a response; I do not treat the silence as deliberate refusal.',
  'The child has difficulty asking for help or joining spoken activities in those settings. I am the caregiver speaker in this interview.',
  'In preschool the child responded with a gesture instead of speech during a familiar activity.',
  'At home with a familiar caregiver the child spoke about a preferred activity.',
  'the difference between speaking at home and in other settings'
 ],
 rad:[
  'Before entering the current stable caregiving arrangement, the child experienced prolonged severely insufficient care. Earlier records describe repeated absence of a consistent caregiver to meet comfort and basic support needs.',
  'When distressed, the child seldom seeks comfort and often shows little response when comfort is offered. These are observed patterns, not a claim about the child\'s feelings toward people.',
  'Comforting routines and shared engagement remain difficult. The earlier care history is deliberate case background, not inferred from a current tantrum.',
  'After an ordinary upset, the child did not approach the familiar caregiver for comfort.',
  'The caregiver offered comfort during distress and observed only a limited response.',
  'difficulty seeking and accepting comfort in a now-stable caregiving setting'
 ],
 dsed:[
  'Before the current stable caregiving arrangement, records describe prolonged severely insufficient care and repeated changes without a consistent caregiver. The social approach pattern was noticed before this diary.',
  'I observe unusually ready approach to unfamiliar adults and little checking back with the familiar caregiver. The account does not assume the child\'s private motives.',
  'Close supervision is needed in shared spaces while a stable and supportive relationship is built.',
  'In a shared space the child approached an unfamiliar adult readily and did not check back first.',
  'The child moved toward an unfamiliar visitor without the usual pause to look toward the familiar caregiver.',
  'how the child approaches unfamiliar people and checks back with caregivers'
 ],
 arfid:[
  'For many months before this diary the child has accepted only a narrow range of food textures, and this has substantially disrupted ordinary shared meals and activities.',
  'I observe distress with unfamiliar textures and refusal of many foods. I cannot infer a private body-image concern; no such concern is authored here.',
  'A familiar food option is often needed to participate. Growth measurements and nutritional assessment findings are not supplied.',
  'An unfamiliar texture at a meal was followed by visible distress and difficulty participating.',
  'The caregiver arranged a familiar food option so the child could join a shared activity.',
  'restricted eating and its effect on shared meals and activities'
 ]
};

// The school-age variant can speak about its own observable behavior while
// attributing early care information to a caregiver rather than invented recall.
ROWS.dsed=[
 'My caregiver says that early records describe a long period without consistent care before my current stable home. Adults have noticed the way I approach unfamiliar people over time.',
 'I sometimes go up to unfamiliar adults very readily without first checking with my caregiver. I cannot personally recall all of the earlier care history.',
 'My caregiver stays close in shared spaces and helps me practice checking back.',
 'I approached an unfamiliar adult in a shared space without checking back with my caregiver.',
 'My caregiver reminded me to check back before joining an unfamiliar visitor.',
 'how I approach new people and the support my caregiver gives'
];

function seedOrder(seed){let value=(seed^0x91e10da5)>>>0;value=Math.imul(value^(value>>>16),0x21f0aaad);return (value>>>0)%2;}
function windowFor(id,days){
 if(id==='acute_stress')return {startDay:Math.max(1,days-13),endDay:days,onsetDaysBeforeInterview:14};
 if(id==='adjustment')return {startDay:Math.max(1,days-59),endDay:days,onsetDaysBeforeInterview:60};
 if(id==='schizophreniform')return {startDay:Math.max(1,days-89),endDay:days,onsetDaysBeforeInterview:90};
 if(id==='brief_psychotic')return {startDay:Math.max(1,days-13),endDay:Math.max(0,days-7),onsetDaysBeforeInterview:14,resolvedDaysBeforeInterview:7};
 if(id==='delirium')return {startDay:Math.max(1,days-2),endDay:days,onsetDaysBeforeInterview:3};
 return {startDay:1,endDay:days,onsetDaysBeforeInterview:null};
}

export function createDisorderPremise({disorderId='none',profile,days=28,seed=42}={}){
 const item=getDisorder(disorderId);
 if(!profile||!item.stages.includes(profile.lifeStage))throw new Error('This case is not authored for the selected life stage.');
 if(!Number.isInteger(days)||days<1||days>90)throw new Error('History must contain 1 to 90 days.');
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Seed must be an integer from 0 to 4294967295.');
 const caregiver=!!profile.caregiver;
 const common={id:item.id,name:item.name,description:item.description,classification:item.classification,sourceIds:[...item.sourceIds],version:DISORDER_DATA_VERSION};
 if(disorderId==='none')return {...common,baselineFacts:[],opening:caregiver?`I am ${profile.name}'s caregiver. I would like to talk about their everyday routines and support.`:'I would like to talk about my recent routines, ordinary stresses and what helps me.',dailyPatterns:[],timeline:{startDay:1,endDay:days},communicationStyle:caregiver?'Caregiver observations; do not invent child thoughts.':'Use the patient\'s ordinary voice.',reviewNotes:['No disorder is assigned. This is ordinary variation, not a clinical declaration that a person has no possible condition.','Only ordinary profile events are simulated. No clinical symptom premise or diagnostic threshold is applied.']};
 const row=(caregiver?CARE:ROWS)[disorderId];
 if(!row)throw new Error('An authored account is missing for this case and perspective.');
 const [course,experiences,impact,a,b,concern]=row;
 const timeline=windowFor(disorderId,days);
 const communicationStyle=caregiver?'Speak as the caregiver; describe observable behavior and attributed records, never direct access to the child\'s thoughts.':disorderId==='selective_mutism'?'This is the patient\'s supported written account. Use short written replies; never claim fluent speech in the affected setting.':['language','idd'].includes(disorderId)?'Use clear short sentences, one idea at a time. Do not caricature speech or fabricate cognitive test scores.':'Use this individual patient\'s own voice and life-stage context, without a stereotyped personality or an automatic diagnostic label.';
 const observations=seedOrder(seed)?[b,a]:[a,b];
 const patterns=observations.map((observation,i)=>({
  label:i?'Recent experience and participation':'Recent experience and routine',
  observation:caregiver?`${profile.name}: ${observation}`:observation,
  interpretation:caregiver?'I can describe what I observed, but their private interpretation is unknown.':'This is my account of the experience; its cause is not established by this moment alone.',
  experience:caregiver?'I noticed how participation and the support needed changed in that situation.':'The experience affected how I took part in that moment.',
  impact,
  startDay:timeline.startDay,endDay:timeline.endDay,
  ...(disorderId==='pmdd'?{cycleDays:28,activeCycleDays:7,cycleAnchor:'The last diary day is an authored premenstrual day; prior cycles are fictional scheduling, not a physiological prediction.'}:{})
 }));
 const baselineFacts=[
  {label:'Earlier course and onset',domains:['timeline','history'],response:course},
  {label:'Experiences described',domains:['presenting','context'],response:experiences},
  {label:'Effect on everyday activities',domains:['function','goals'],response:impact},
  {label:'Personal routines and support',domains:['support','goals'],response:caregiver?`${profile.name} is in the ${profile.lifeStage.toLowerCase()} stage. Their familiar activities include ${profile.hobby}; support is shaped around ${profile.task}.`:`I am in the ${profile.lifeStage.toLowerCase()} stage. My usual interests include ${profile.hobby}. I want to take part in ${profile.task}, with support from my ${profile.supportTarget}.`}
 ];
 if(['brief_psychotic','schizophreniform','schizophrenia','schizoaffective','delusional'].includes(disorderId))common.sourceIds=[...new Set([...common.sourceIds,'S57'])];
 if(disorderId==='selective_mutism')common.sourceIds=[...new Set([...common.sourceIds,'S58'])];
 return {...common,baselineFacts,opening:caregiver?`I am ${profile.name}'s caregiver. I would like to discuss ${concern}.`:`I would like to talk about ${concern}.`,dailyPatterns:patterns,timeline,communicationStyle,
  reviewNotes:[
   'Original fictional formulation informed by public research summaries; not a clinically approved case, diagnosis engine or complete DSM criteria set.',
   `Research history anchor: ${item.historyRequirement}`,
   `Research limitation: ${item.reviewLimit}`,
   'Life-stage eligibility is this authored case scope, not an assertion about all clinically possible ages. No numerical age, birthday or age-gate verification is inferred from a broad stage.',
   'Earlier authored course stays separate from the recent 1–90 day diary. The seed changes diary selection/order, not diagnostic criteria, personality identity or past-history truth.',
   'Medical, substance, developmental and other exclusions remain unknown except where explicitly authored. A selected label is a case-author intent, not a conclusion proven by interview text.',
   ...(disorderId==='pmdd'?['Menstrual context is explicitly authored for this fictional variant; it is not inferred from the patient name or gender. Cycle scheduling is a fictional example, not a medical prediction.']:[]),
   ...(disorderId==='delirium'?['This is an acute, medically supervised fictional encounter; uncertain recollection needs collateral. Do not turn it into an ordinary unsupervised long interview or invent a medical cause.']:[]),
   ...(disorderId==='idd'&&caregiver?['Early developmental support needs do not establish intellectual developmental disorder without the missing developmental assessment. This is a referral formulation, not an invented diagnosis or IQ.']:[]),
   ...(disorderId==='fnd'?['A text account cannot reproduce positive neurological examination findings; do not claim the selected formulation is confirmed.']:[])
  ]};
}
