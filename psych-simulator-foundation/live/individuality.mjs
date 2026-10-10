// Authored people, independent of diagnosis, seed and interview difficulty.
// Goal weights are narrative simulation settings, not measured personality scores.
// Small-talk details are authored fiction, not observations from real cases.
// Usual hobbies and their origins do not establish present enjoyment or ability.
export const PROFILE_BACKGROUND_VERSION='authored-backgrounds-1.0.0';
const PEOPLE={
 mika:{
  summary:'Block towers, picture books and familiar routines.',preview:'Their caregiver describes one thing they noticed at a time.',style:'Speak as Mika’s caregiver, using short, everyday observations. Separate what you saw from what you cannot know. Show that style in the answer; explain communication preferences only when asked.',
  goal:'I’d like Mika to be comfortable joining in a little bit of play, with help if needed.',
  interests:'Mika often picks the blocks, or brings me a picture book to look at together.',
  communication:'It’s easier if I describe one thing I’ve noticed at a time. I can’t really say what Mika is thinking.',
  relationships:'Mika brings me a familiar book to look at together. On play visits, I stay close and help Mika join in.',
  smallTalk:[
   {label:'Usual block play and picture-book details',response:'Mika’s usual choices are blocks for little towers and picture books with animals in them.'},
   {label:'Caregiver’s reason for sharing books and blocks',scope:'usual',response:'I follow Mika’s lead with those. If Mika brings a book over, I sit down and look at it together. It gives us something to do together.'}
  ],
  priorities:{connection:.8,reliability:.4,autonomy:.6,recovery:.7},
  opening:'I’d like to talk about how Mika’s getting on day to day.'
 },
 leo:{
  summary:'Crayon pictures, make-believe shops and choosing the next activity.',preview:'Their caregiver talks through what happened, in order.',style:'Speak as Leo’s caregiver. Describe observed actions in everyday words and in the order they happened; do not claim to know Leo’s thoughts or feelings. Explain communication preferences only when asked.',
  goal:'I’d like Leo to join in at preschool, but still get a choice about how to start.',
  interests:'Leo goes for the crayons and sets things out to play shops.',
  communication:'I usually start with what happened first, then go from there. I can tell you what Leo did, but not exactly what Leo was thinking.',
  relationships:'Leo points things out to a familiar caregiver when they look at picture books. At playdates, I offer two things they could do together and let Leo choose.',
  smallTalk:[
   {label:'Usual drawing subjects and pretend-shop details',response:'Leo usually draws houses and sets out toy fruit for the pretend shop.'},
   {label:'Caregiver’s reason for joining the pretend-shop game',scope:'usual',response:'I use the shop game to give Leo a couple of choices—what to put out, and what I should pretend to buy.'}
  ],
  priorities:{connection:.6,reliability:.45,autonomy:.85,recovery:.6},
  opening:'There are a few things I’ve noticed in Leo’s day-to-day routine that I’d like to talk about.'
 },
 sam:{
  summary:'Drawing comic characters and joining playground games.',preview:'Sam finds examples and one question at a time helpful.',style:'Use simple, everyday words without baby talk. Use a short example only when one is recorded. If asked several things at once, ask which one to answer first. Show communication preferences through delivery rather than reciting them.',
  goal:'I want to finish my picture for the class display. And I want to be able to join a game on the playground.',
  interests:'I usually draw comic characters, then make up a little story to go with the picture.',
  communication:'Can you ask me one thing at a time? It’s easier if I can give you an example.',
  relationships:'If I get stuck, I ask the person who looks after me for help. I like taking turns with my friend to pick the game.',
  smallTalk:[
   {label:'Usual comic characters and drawing details',response:'I usually draw robots or animals wearing silly hats.'},
   {label:'How making up comic stories became a hobby',response:'I started making up stories because the picture didn’t have to be the end. I could decide what happened next.'}
  ],
  priorities:{connection:.75,reliability:.55,autonomy:.8,recovery:.5},
  opening:'I want to talk about how things have been lately.'
 },
 riley:{
  summary:'Music playlists, school projects and having a say in plans.',preview:'Riley likes direct questions and a moment to find the words.',style:'Concise and thoughtful, without forced slang or stereotyped teenage hostility. Answer direct questions plainly. Do not keep announcing the need for time; mention it only when relevant or asked.',
  goal:'I want to do my part in the school project and have more say over how I use my time.',
  interests:'Usually, I put playlists together and compare songs with a friend.',
  communication:'Just ask me directly, and give me a second to work out how to say it. I don’t like people finishing my sentences.',
  relationships:'My friend and I share music. If I need help with a school decision, there’s an adult I trust, but I want them to hear what I think too.',
  smallTalk:[
   {label:'Usual music genres and playlist themes',response:'Mostly pop and indie. I usually separate the quiet songs from the ones with a faster beat.'},
   {label:'How making playlists became a hobby',response:'I got into playlists because changing the order can make the same songs feel different. That was the interesting part for me.'}
  ],
  priorities:{connection:.65,reliability:.55,autonomy:.9,recovery:.55},
  opening:'There’s some everyday stuff I’d like to talk through. I might need a second to find the words.'
 },
 jordan:{
  summary:'Sketching, reliable routines and quiet conversations.',preview:'Jordan takes a moment to think and finds examples easier to explain.',style:'Thoughtful, but use ordinary spoken language rather than polished self-analysis or elaborate metaphors. Be clear about uncertainty. Use examples only from recorded facts. Show this style in delivery; do not repeatedly announce communication preferences.',
  goal:'I’d like to set aside an evening for sketching regularly and still keep up with the everyday stuff.',
  interests:'Usually, I sketch ordinary things and keep the drawings in a notebook.',
  communication:'Give me a second to think. It’s easier if I can give you an example.',
  relationships:'I like a quiet chat with my cousin. With my friend, I’d rather agree on a time and a plan than leave it up in the air.',
  smallTalk:[
   {label:'Usual sketching subjects and materials',response:'Mugs and plant pots, mostly, or whatever’s on the table. I usually use a pencil.'},
   {label:'How sketching everyday objects became a hobby',response:'I started with things that were already around me. I didn’t need a special setup; there was always something I could draw.'}
  ],
  priorities:{connection:.7,reliability:.7,autonomy:.6,recovery:.5},
  opening:'I’ve been thinking about how things are going day to day. I’d like to talk it through.'
 },
 avery:{
  summary:'Reading, keeping in touch and balancing shared responsibilities.',preview:'Avery often explains things with an example, then comes back to the main point.',style:'Warm and conversational, without stock reassurance or therapist language. Use a practical example only when recorded. Let the style come through in the answer; explain communication preferences only when asked.',
  goal:'I want sharing the everyday jobs to feel a bit easier, and to have time to read without letting anyone down.',
  interests:'Usually, I read when I get a quiet moment. Talking about books is my sort of thing too.',
  communication:'I’ll often give an example to explain what I mean. It helps to stop and work out the main point together.',
  relationships:'I like checking in with my sibling. I want to do my part, but I’d like to be able to ask for help too.',
  smallTalk:[
   {label:'Usual book genres',response:'Usually mysteries and short stories. Those are the ones I tend to pick up.'},
   {label:'How reading mysteries and short stories became a hobby',response:'With mysteries, I got interested in trying to work out the ending before I reached it. Short stories were something I could finish in a shorter sitting.'}
  ],
  priorities:{connection:.9,reliability:.8,autonomy:.45,recovery:.6},
  opening:'I’d like to talk about how I’m managing day to day and making time for the things I care about.'
 },
 robin:{
  summary:'Gardening, community activities and doing familiar tasks independently.',preview:'Robin likes a clear question and enough time to finish an example.',style:'Use ordinary, descriptive speech without stereotyped older-adult language, assumed memory loss or exaggerated formality. Use practical examples only from recorded facts. Explain communication preferences only when asked.',
  goal:'I want to keep taking part in a community activity and keep doing the bits of gardening I enjoy.',
  interests:'Gardening is one of my usual interests—looking after the plants and seeing how the garden changes.',
  communication:'Ask me a clear question and let me finish. I find it easier to explain with an example.',
  relationships:'I like talking over community plans with my friend and having my neighbor visit. I’d rather people ask before taking over something I’m doing.',
  smallTalk:[
   {label:'Usual plants and gardening activities',response:'Herbs in pots and a few flowers are my usual things. Looking after those has been my part of the gardening.'},
   {label:'How gardening became a hobby',response:'I started with a pot of herbs. Seeing new growth was what got me interested in keeping at it.'}
  ],
  priorities:{connection:.7,reliability:.55,autonomy:.85,recovery:.7},
  opening:'I’d like to talk about how my routines have been lately, and how I’m getting on with the things I care about.'
 },
 alex:{
  summary:'Music, study plans and breaking responsibilities into manageable steps.',preview:'Alex likes direct questions, short answers and practical next steps.',style:'Practical and concise, with ordinary contractions. Match the length to the question and do not turn a casual answer into a personal essay. Show communication preferences through delivery rather than repeatedly explaining them.',
  goal:'I want a plan for study and part-time work that I can actually keep up with, with some time left for music.',
  interests:'Usually, I’ll put on a favorite album and listen to it all the way through.',
  communication:'A direct question works best for me. If it’s a big one, breaking it up helps.',
  relationships:'I talk things through with my sibling when there’s a practical problem. With my friend, I’d rather make a plan than decide everything at the last minute.',
  smallTalk:[
   {label:'Usual music and album-listening habits',response:'Usually instrumental music or albums with a lot of guitar. I tend to play the tracks in order.'},
   {label:'Why listening to whole albums became a hobby',response:'I got curious about how the songs fit together. That’s why I started listening to whole albums instead of just individual tracks.'}
  ],
  priorities:{connection:.5,reliability:.85,autonomy:.8,recovery:.55},
  opening:'I’d like to talk through how things have been going and what I want to work on.'
 }
};
// These are stable background facts, not events generated inside the frozen diary.
// 'past' records happened before the simulated window; 'wish' records are intentions,
// never evidence that the activity occurred. No record establishes present health.
const BACKGROUNDS={
 mika:[
  {id:'P07',label:'Caregiver arrangement of books and toys',scope:'usual',keywords:['routine','basket','books','tidying'],domains:['support'],response:'I keep Mika’s blocks in a low basket and put a couple of picture books beside it. When we put things away, I hold the basket.'},
  {id:'P08',label:'Earlier observed block-and-animal play example',scope:'past',keywords:['example','blocks','animal','play'],domains:['support'],response:'At an earlier play session, Mika put a toy animal beside a short block tower. I put another animal nearby, and Mika moved it next to the first.'},
  {id:'P09',label:'Caregiver response when Mika brings a book',scope:'usual',keywords:['relationship','together','book','caregiver'],domains:['support'],response:'When Mika brings me an animal book, I sit beside them and name the animals they point to. I let Mika turn the pages.'},
  {id:'P10',label:'Caregiver way of offering activity choices',scope:'preference',keywords:['choice','help','play'],domains:['support','communication'],response:'I prefer to offer Mika a book or the blocks and wait to see which they reach for. I don’t choose for them straight away.'},
  {id:'P11',label:'Caregiver practical example of helping with tidying',scope:'usual',keywords:['help','routine','tidy','toys'],domains:['support'],response:'For putting toys away, I put a block in the basket myself, then hold out another. That is how I usually show Mika what we’re doing.'},
  {id:'P12',label:'Caregiver wish for a shared play visit',scope:'wish',keywords:['plan','future','visit','playmate'],domains:['goals'],response:'I’d like to arrange a short play visit with blocks set out and space for me to stay close. That’s a plan I have, not a visit that’s already happened.'}
 ],
 leo:[
  {id:'P07',label:'Caregiver setup for Leo’s drawing and pretend shop',scope:'usual',keywords:['routine','crayons','paper','shop'],domains:['support'],response:'I usually set out paper and crayons at a small table. For Leo’s shop game, I put the toy fruit in a basket beside it.'},
  {id:'P08',label:'Earlier observed house-drawing example',scope:'past',keywords:['example','house','drawing','window'],domains:['support'],response:'On an earlier drawing day, Leo drew a house, pointed to the empty wall and asked me to add a window. Leo colored around it afterward.'},
  {id:'P09',label:'Caregiver role in Leo’s pretend shop',scope:'usual',keywords:['relationship','together','shop','fruit'],domains:['support'],response:'When we play shops, Leo sets out the toy fruit and I pretend to be the customer. I ask what’s for sale and wait for Leo to show me.'},
  {id:'P10',label:'Caregiver preference for advance notice at activity changes',scope:'preference',keywords:['change','notice','choice','transition'],domains:['support','communication'],response:'I prefer to tell Leo what activity is coming next, then offer a small choice, such as which crayons to put away first.'},
  {id:'P11',label:'Caregiver example of sharing an activity without taking over',scope:'usual',keywords:['help','drawing','choices','taking over'],domains:['support'],response:'If I’m joining a drawing activity, I ask Leo whether to draw on my own paper or add something to theirs. I wait for an answer before joining in.'},
  {id:'P12',label:'Caregiver wish for a pretend-shop playdate',scope:'wish',keywords:['future','plan','playdate','shop'],domains:['goals'],response:'I’d like to try a short playdate with the toy shop ready, so Leo can choose a role at the start. We haven’t carried out that plan yet.'}
 ],
 sam:[
  {id:'P07',label:'Usual drawing supplies and keeping unfinished pictures',scope:'usual',keywords:['routine','pencils','folder','drawing'],domains:['goals'],response:'I keep my drawings in a folder with some colored pencils. If a picture isn’t finished, I leave it at the front so I can find it again.'},
  {id:'P08',label:'Earlier robot-comic drawing example',scope:'past',keywords:['example','comic','robot','hat'],domains:['goals'],response:'In an older comic I drew, a robot’s hat was too big and covered its eyes. In the next picture, another robot helped lift the hat up.'},
  {id:'P09',label:'Sharing drawing ideas with a friend',scope:'usual',keywords:['friend','relationship','comic','together'],domains:['support'],response:'My friend and I sometimes suggest what could happen in each other’s pictures. We take turns choosing an idea, so it isn’t just my story.'},
  {id:'P10',label:'Preference for help that leaves room to try',scope:'preference',keywords:['help','choice','mistake','caregiver'],domains:['support','communication'],response:'If I’m stuck on a picture, I want someone to show me a way to start and then let me try. I don’t want them to finish the whole thing for me.'},
  {id:'P11',label:'Usual way to break a drawing project into parts',scope:'usual',keywords:['plan','task','drawing','steps'],domains:['goals'],response:'For a comic, I usually draw the character first, then the things around it, then add words. I can leave the words until another time.'},
  {id:'P12',label:'Wish for a future comic without claiming it is finished',scope:'wish',keywords:['future','wish','comic','animals'],domains:['goals'],response:'I’d like to make a little comic about animals running a hat shop. I’ve got the idea, but I haven’t drawn that comic yet.'}
 ],
 riley:[
  {id:'P07',label:'Usual way of saving and sorting song suggestions',scope:'usual',keywords:['routine','music','songs','playlist'],domains:['goals'],response:'I keep song suggestions in one playlist before sorting them into the quiet or faster ones. That way I don’t have to decide where everything goes straight away.'},
  {id:'P08',label:'Earlier example of changing a playlist’s opening',scope:'past',keywords:['example','playlist','order','opening'],domains:['goals'],response:'For an earlier playlist, I tried a quiet song first, then moved a faster one to the start. I kept both versions while I compared the order.'},
  {id:'P09',label:'How Riley and a friend share music recommendations',scope:'usual',keywords:['friend','relationship','recommendation','music'],domains:['support'],response:'My friend and I send each other a song and say which bit to listen for, like a guitar part or the way the chorus starts.'},
  {id:'P10',label:'Preference for a say in school-project decisions',scope:'preference',keywords:['school','project','choice','adult','autonomy'],domains:['goals','communication'],response:'With a school project, I’d rather someone ask which part I want to take before assigning me one. I still want us to agree on what each person is doing.'},
  {id:'P11',label:'Usual way of asking a trusted adult for project help',scope:'usual',keywords:['help','adult','school','project','support'],domains:['support'],response:'When I ask a trusted adult about a school decision, I usually explain the options I’m considering and ask them to help me think through those.'},
  {id:'P12',label:'Wish for a future shared playlist',scope:'wish',keywords:['future','plan','friend','playlist'],domains:['goals'],response:'I’d like to make a playlist with my friend where we alternate picking the tracks. We haven’t put that one together yet.'}
 ],
 jordan:[
  {id:'P07',label:'Usual sketching setup and keeping unfinished drawings',scope:'usual',keywords:['routine','notebook','pencil','drawing','setup'],domains:['goals'],response:'I keep a pencil tucked into my sketchbook and leave unfinished drawings in it. I don’t need to clear a big space to get the notebook out.'},
  {id:'P08',label:'Earlier mug sketch as a concrete drawing example',scope:'past',keywords:['example','mug','sketch','handle'],domains:['goals'],response:'In an earlier drawing, I sketched a mug from the side and then turned it to try the handle from another angle. Both sketches stayed on the same page.'},
  {id:'P09',label:'What Jordan shares in quiet chats with a cousin',scope:'usual',keywords:['cousin','relationship','chat','drawing','support'],domains:['support'],response:'In a quiet chat with my cousin, I sometimes show a page from my sketchbook. I’d rather they ask about it than feel they have to praise it.'},
  {id:'P10',label:'Preference for agreeing on concrete plans with a friend',scope:'preference',keywords:['friend','plans','time','place','change'],domains:['support','communication'],response:'When I make plans with my friend, I prefer to agree on a time and place. If something changes, I’d like a message so I know where things stand.'},
  {id:'P11',label:'Usual way of starting an ordinary task',scope:'usual',keywords:['routine','task','list','steps','work'],domains:['goals'],response:'For an ordinary task, I usually write down the first thing that needs doing and start with that. I prefer a short list I can actually look back at.'},
  {id:'P12',label:'Wish for a future series of everyday-object sketches',scope:'wish',keywords:['future','wish','sketch','notebook','objects'],domains:['goals'],response:'I’d like to fill a few notebook pages with the same ordinary objects seen from different angles. That’s something I want to try, not a finished set of drawings.'}
 ],
 avery:[
  {id:'P07',label:'Usual reading setup and keeping a place in a book',scope:'usual',keywords:['routine','reading','bookmark','book'],domains:['goals'],response:'I keep a bookmark in whatever I’m reading, so I can put it down without losing the page. I don’t set myself a page target.'},
  {id:'P08',label:'Earlier mystery-reading example',scope:'past',keywords:['example','mystery','ending','reading'],domains:['goals'],response:'With an earlier mystery, I wrote down my guess before the ending and checked it afterward. I’d guessed the wrong person, but I could see which clue I’d missed.'},
  {id:'P09',label:'How Avery and a sibling talk about shared practical help',scope:'usual',keywords:['sibling','relationship','help','errands','support'],domains:['support'],response:'When I check in with my sibling about a busy week, I find it easier to name a particular errand I could use help with than to say everything is too much.'},
  {id:'P10',label:'Preference for clear agreements about shared household jobs',scope:'preference',keywords:['household','jobs','responsibility','plans'],domains:['goals','communication'],response:'For shared household jobs, I prefer to agree who is doing what and when. I don’t want us both assuming the other person will handle the same errand.'},
  {id:'P11',label:'Usual way of grouping errands',scope:'usual',keywords:['routine','errands','list','practical','steps'],domains:['goals'],response:'I usually put errands that can be done on the same trip together on a list. If a job can wait, I mark that instead of treating them all as urgent.'},
  {id:'P12',label:'Wish for a future discussion of a short story',scope:'wish',keywords:['future','wish','friend','story','reading'],domains:['goals'],response:'I’d like to choose a short story with a friend and talk about what each of us noticed. We haven’t chosen the story for that yet.'}
 ],
 robin:[
  {id:'P07',label:'Usual gardening setup and plant labels',scope:'usual',keywords:['routine','herbs','pots','labels','garden'],domains:['goals'],response:'I put labels in the herb pots and keep the small gardening tools together. I prefer being able to find the things I need without asking someone to fetch them.'},
  {id:'P08',label:'Earlier herb-pot gardening example',scope:'past',keywords:['example','herb','mint','pot','gardening'],domains:['goals'],response:'One of my earlier herb pots was mint. I put a label in it and watched for new leaves; that small pot was enough of a project to start with.'},
  {id:'P09',label:'What Robin and a neighbor usually talk about on visits',scope:'usual',keywords:['neighbor','relationship','visit','plants','support'],domains:['support'],response:'When my neighbor visits, plants are one of the things we talk about. I might point out a pot I’ve been looking after and ask about theirs.'},
  {id:'P10',label:'Preference for being asked before practical help is given',scope:'preference',keywords:['help','independence','choice','taking over'],domains:['support','communication'],response:'If someone wants to help with a task, I prefer them to ask which part would help. I want a say in what I do myself and what we do together.'},
  {id:'P11',label:'Usual way of preparing for a community activity',scope:'usual',keywords:['community','activity','materials','plan','friend'],domains:['goals','support'],response:'For a community activity, I usually check with my friend about the materials before getting things together. I prefer a clear job to guessing what might be needed.'},
  {id:'P12',label:'Wish for a future labeled herb-pot arrangement',scope:'wish',keywords:['future','wish','garden','herbs','pots'],domains:['goals'],response:'I’d like to put a few labeled herb pots together so visitors can see what each one is. That arrangement is an idea I haven’t set up yet.'}
 ],
 alex:[
  {id:'P07',label:'Usual way of keeping study and work tasks visible',scope:'usual',keywords:['routine','study','work','list','tasks'],domains:['goals'],response:'I keep study tasks and work shifts on the same list, then mark what has a fixed time. I prefer seeing the commitments together before adding anything else.'},
  {id:'P08',label:'Earlier comparison of album opening tracks',scope:'past',keywords:['example','album','music','opening','tracks'],domains:['goals'],response:'With a couple of albums I listened to before, I compared how their opening tracks led into the next song. I made a note about the order rather than rating every track.'},
  {id:'P09',label:'How Alex asks a sibling for practical help',scope:'usual',keywords:['sibling','relationship','help','plan','support'],domains:['support'],response:'When I talk through a practical problem with my sibling, I usually show them the options I’ve already thought of and ask what I might have missed.'},
  {id:'P10',label:'Preference for plans that leave room around commitments',scope:'preference',keywords:['plans','friend','time','study','work'],domains:['goals','communication'],response:'I prefer making plans with a friend after checking my study and work commitments. I don’t want to agree to something and only then work out whether it fits.'},
  {id:'P11',label:'Usual way of dividing a study task',scope:'usual',keywords:['study','task','steps','start','plan'],domains:['goals'],response:'For a study task, I usually write the next concrete step, such as opening the reading and choosing a section. A short next step is easier to plan around than the whole assignment.'},
  {id:'P12',label:'Wish for a future album conversation with a friend',scope:'wish',keywords:['future','wish','friend','album','music'],domains:['goals'],response:'I’d like to pick an album with a friend and compare which track we think holds it together. We haven’t picked the album for that yet.'}
 ]
};
export function patientIndividuality(id){
 const person=PEOPLE[id];if(!person)throw new Error('Unknown patient individuality.');
 return structuredClone({...person,profileVersion:PROFILE_BACKGROUND_VERSION,backgroundFacts:BACKGROUNDS[id]});
}
export function personalFacts(person){
 return [
  {id:'P01',label:'Personal goals and what matters',scope:'wish',domains:['goals'],response:person.goal},
  {id:'P02',label:'Usual interests and hobbies, not current enjoyment',scope:'usual',domains:['goals','support'],response:person.interests},
  {id:'P03',label:'Communication preferences',scope:'preference',domains:['communication'],response:person.communication},
  {id:'P04',label:'Relationships and preferred support',scope:'usual',domains:['support'],response:person.relationships},
  ...(person.smallTalk??[]).map((fact,index)=>({id:`P${String(index+5).padStart(2,'0')}`,label:fact.label,scope:fact.scope??(index===0?'usual':'past'),domains:['goals','support'],response:fact.response})),
  ...(person.backgroundFacts??[]).map(fact=>({...fact,keywords:[...fact.keywords],domains:[...fact.domains]}))
 ].map(fact=>({...fact,provenance:'authored-fiction',...(fact.scope==='past'?{timeframe:'before-simulation'}:{}),sources:[]}));
}
