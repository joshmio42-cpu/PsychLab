from pathlib import Path
import json, collections, html
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,KeepTogether
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4

from archive_workspace import archive_workspace
ROOT=archive_workspace(); OUT=ROOT/'outputs/psych-simulator-foundation'
read=lambda f:json.loads((OUT/f).read_text(encoding='utf-8'))
sections=read('data/handbook-sections.json');sources=read('data/sources.json');case=read('data/case-a01.json');rubric=read('data/rubric.json');tests=read('data/validation-results.json')
groups=[
('Purpose and scope',[
('Choose first audience','Done','Adult psychology trainees; Project brief.'),
('Define main learning objective','Done','Evidence gathering and justified provisional reasoning; Project brief.'),
('Write one-sentence problem description','Done','Repeatable practice linking conversation to reasoning and feedback; Project brief.'),
('Define educational simulation and formative feedback','Done','Brief, visible prototype notice and report labels.'),
('Set boundaries for fictional clients and claims','Done','Brief, simulation contract, README and interface.'),
('Confirm healthcare prompt fit','Done','Healthcare interaction training rationale; event source S9.')]),
('Reference foundation',[
('Select authoritative references','Done','11-entry source register including clinical, instrument and event sources.'),
('Distinguish the two APA organizations','Done','Evidence section and S3/S4.'),
('Record title publisher version date and use','Done','data/sources.json; linked appendix.'),
('Verify reproduction permissions','Done','GAD-7 permission S5/S6; NHS-hosted form S11; no full DSM text copied.'),
('Map references to case and rubric','Done','Fact-level and rubric-level source IDs in JSON.'),
('Identify qualified reviewer','Prepared','User can arrange reviewer; name and qualifications not yet supplied.'),
('Label content without expert review','Done','Case, rubric, handbook and prototype are marked review pending.')]),
('Fictional cases',[
('Start with one adult case','Done','CASE-A01, 18 authored fact blocks; expansion concepts only.'),
('Define background strengths and communication independently','Done','Alex case guide, F16 and F17.'),
('Specify symptoms duration severity and function','Done','F02-F07; authored two-week questionnaire values.'),
('Document relevant histories','Done','F08-F15 and F18; medical unknowns explicitly preserved.'),
('Include alternatives and distinguishing evidence','Done','Case guide alternatives and focused interview domains.'),
('Define absent unknown and out-of-scope facts','Done','Unknown list, explicit fictional negatives, simulation contract.'),
('Write learner referral note','Done','case.referral and visible interview brief.'),
('Write hidden case guide and learning points','Done','Handbook and data/case-a01.json.'),
('Review stereotypes and cultural assumptions','Prepared','Initial authoring check performed; independent qualified review pending.')]),
('Simulation behavior',[
('Separate fixed facts from flexible wording','Done','Simulation contract and patient prompt.'),
('Define disclosure rules','Done','Opening volunteered in live design; authored topic answers in rehearsal.'),
('Allow reasonable question variants','Prepared','Live prompt specifies this; free-text model testing not run.'),
('Define believable emotional expression','Done','Case affect and simulation contract; not validated with a model.'),
('Prevent invented facts contradictions and diagnosis leakage','Prepared','Scripted values fixed and tested; live semantic protection remains unverified.'),
('Define leading repeated and adversarial responses','Done','Prompt rules and adversarial test list; live behavior pending.'),
('Handle topics outside the authored case','Done','Unknown topic rejection tested; live prompt requires explicit flag.'),
('Separate patient from tutor','Done','Architecture, separate prompt files and separate report logic.')]),
('Assessments',[
('Choose one relevant instrument','Done','GAD-7 for adult fictional anxiety presentation.'),
('Verify permissions population administration and scoring','Done','S5-S7 and S11; synthetic-response limitation documented.'),
('Preserve required standard wording','Done','Seven English items and instruction cross-checked with S11.'),
('Author case-consistent responses','Prepared','Seven values authored; qualified item-by-item clinical review pending.'),
('Calculate scores by explicit rules','Done','Deterministic 0-21 scoring; boundaries and invalid inputs tested.'),
('Explain result and limitations','Done','Assessment panel, specification and debrief.'),
('Require learner rationale','Done','Rationale and explanation control; invalid submissions rejected.')]),
('Evaluation rubric',[
('Define five evaluation domains','Done','rubric.json; coverage communication reasoning assessment next steps.'),
('Describe observable rating anchors','Done','0-3 anchors plus NR; clinician review form.'),
('Require transcript-cited feedback','Done','Evaluator specification and exact evidence export in rehearsal.'),
('Distinguish missed questions from conclusions','Done','Rubric and example debrief.'),
('Judge only from evidence obtained','Done','Disclosed-fact ledger; no hidden assessment test passes.'),
('Credit alternatives and uncertainty','Done','Reasoning anchors and structured submission fields.'),
('Avoid rewarding guessing or question count','Done','Coverage is descriptive; no automatic competence score.'),
('Include strengths improvements and follow-ups','Prepared','Example debrief and evaluator contract prepared; personalized AI feedback pending.'),
('Mark ratings formative and unvalidated','Done','Report, guide and prompt labels.'),
('Prepare example report','Done','review/sample-debrief.txt and handbook example.')]),
('Validation',[
('Walk through with a psychology student','Needs external action','Protocol ready; no real learner session conducted.'),
('Ask clinician or educator to review','Needs external action','Reviewer pack ready; user will arrange review. No message sent.'),
('Test strong incomplete and leading interviews','Prepared','Three fixture packages executed for logic; actual free-text and clinical scoring pending.'),
('Check feedback distinguishes sessions appropriately','Prepared','Coverage differs as expected; clinical rating discrimination requires human/live model review.'),
('Test consistency leakage stereotypes and fabrication','Prepared','Deterministic checks done; live adversarial matrix ready, not run.'),
('Repeat evaluation to test stability','Prepared','Deterministic reports stable; repeated generative ratings not tested.'),
('Establish release criteria and limitations','Done','Clinical, pilot and live-model gates in handbook.')]),
('Technical foundation',[
('Define complete session flow','Done','Guided interview to assessment reasoning and report works locally.'),
('Choose builder and model provider','Done','Custom web app; Featherless candidate provider; exact model pending benchmark.'),
('Separate case and rubric from transcript','Done','Data and state separated. Server-only protection required for live release.'),
('Separate evaluator from patient role','Done','Independent prompt specifications and deterministic report component.'),
('Store versions with sessions','Prepared','Case/rubric/source versions in report; live model version and persistence pending.'),
('Keep API keys on server','Prepared','Server-only adapter; no key present or exposed. Live server integration pending.'),
('Define retention deletion and access','Done','Memory-only rehearsal; reset/reload clears; private review hosting planned.'),
('Use fictional data','Done','All case and fixture material authored; no patient records.'),
('Confirm credits expiry publishing and costs','Needs external action','Public offers researched earlier; account-specific redemption and cost benchmark pending.'),
('Handle failed or interrupted sessions','Prepared','Load and input failures handled; live adapter rejects errors; recovery/idempotency design pending implementation.')]),
('Hackathon deliverable',[
('Prioritize one reliable case','Done','One authored case and guided loop; no speculative extra cases.'),
('Keep first version text-based','Done','Text-only accessible browser interface.'),
('Prepare working demo repository and README','Prepared','Guided review demo, local source and README ready. Live AI and GitHub publication pending.'),
('Record required public demo video','Needs external action','Three-minute storyboard prepared; no recording or upload yet.'),
('Explain references AI evaluation and limitations','Done','Handbook, prompts, source register and README.'),
('Credit sources tools and reviewers accurately','Done','Source IDs and tool roles credited; no reviewer approval claimed.'),
('Reserve time and credits for final testing','Prepared','Manila delivery plan and credit reserve policy drafted; account balance unconfirmed.')])]
checklist=[]
for gi,(group,items) in enumerate(groups,1):
 for ii,(task,status,evidence) in enumerate(items,1):checklist.append({'id':f'{gi}.{ii}','group':group,'task':task,'status':status,'evidence':evidence})
counts=dict(collections.Counter(x['status'] for x in checklist))
(OUT/'data/checklist-status.json').write_text(json.dumps({'date':'2026-10-05','counts':counts,'meaning':'Done means the named foundation artifact or stated deterministic behavior exists, not clinical validation. Prepared means design or partial implementation exists with remaining work. Needs external action requires a human, account access, recording or later publication.','items':checklist},ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'Checklist Status.txt').write_text('FOUNDATION CHECKLIST STATUS\n2026-10-05\n'+str(counts)+'\n\nDone refers to the named artifact or tested behavior, not clinical validation. Prepared items still need the work stated.\n\n'+'\n\n'.join(f"{x['id']} [{x['status']}] {x['task']}\n{x['evidence']}" for x in checklist),encoding='utf-8')

styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='CoverTitle',fontName='Helvetica-Bold',fontSize=28,leading=33,spaceAfter=22,textColor=colors.HexColor('#102D4B')))
styles.add(ParagraphStyle(name='SectionTitle',fontName='Helvetica-Bold',fontSize=22,leading=27,spaceAfter=18,textColor=colors.HexColor('#102D4B')))
styles.add(ParagraphStyle(name='BodyClean',fontName='Helvetica',fontSize=10.5,leading=15.4,spaceAfter=13,textColor=colors.HexColor('#27384A')))
styles.add(ParagraphStyle(name='SmallClean',fontName='Helvetica',fontSize=8.5,leading=12,spaceAfter=8,textColor=colors.HexColor('#44576B')))
styles.add(ParagraphStyle(name='Label',fontName='Helvetica-Bold',fontSize=10,leading=14,spaceAfter=8,textColor=colors.HexColor('#245F7F')))
E=html.escape
def para(s,sty='BodyClean'):return Paragraph(E(s),styles[sty])
story=[]
story += [Spacer(1,32),para('PSYCHOLOGICAL INTERVIEW SIMULATOR','Label'),para('Foundation handbook','CoverTitle'),para('A reviewable starting point for a fictional clinical interview and evidence-based debrief.'),Spacer(1,15)]
story += [para('Prepared 5 October 2026  |  Version 0.1.0','Label'),para('This package turns the foundation checklist into concrete decisions, one complete authored case, an assessment specification, a feedback rubric, a guided rehearsal and a review plan. It is ready for your educator or clinician to inspect.'),para('The working prototype is scripted. Live AI behavior, clinical realism and learner benefit have not been validated. The user can arrange a qualified reviewer; no review has yet occurred.'),para(f"Checklist status: {counts.get('Done',0)} done, {counts.get('Prepared',0)} prepared or partial, {counts.get('Needs external action',0)} need external action. Automated checks: {tests['passed']} passed, {tests['failed']} failed. These checks cover deterministic logic and a mocked provider, not clinical performance."),Spacer(1,15),para('Use this package','Label'),para('Read the project brief and case guide first. Give the reviewer the source register, rubric and review form. Try the guided rehearsal, then use the checklist appendix to plan the live AI integration and learner pilot.'),para('Companion files: README.txt, Checklist Status.txt, review forms, JSON case and source data, prompt specifications, tests and prototype source.','SmallClean'),PageBreak()]
for title,paras in sections:
 story.append(para(title,'SectionTitle'))
 for p in paras:story.append(para(p))
 story.append(PageBreak())
story.append(para('Assessment item reference','SectionTitle'))
story.append(para(case['gad7']['instruction']))
story.append(para('These are the fictional client\'s fixed responses. The learner is not being screened.'))
for i,item in enumerate(case['gad7']['items']):
 story.append(para(f'{i+1}. {item}','Label'))
 v=case['gad7']['responses'][i];story.append(para(f"{case['gad7']['response_labels'][v]} ({v})"))
story += [para('Total 15 of 21. Severe anxiety symptom band. Functional difficulty: Very difficult, not included in the sum. A screen is not a diagnosis.'),para(case['gad7']['attribution'],'SmallClean'),PageBreak()]
for start in [0,3]:
 story.append(para('Rubric anchors' + (' continued' if start else ''),'SectionTitle'))
 for r in rubric[start:start+3]:
  story.append(para(r['name'],'Label'))
  for a in r['anchors']:story.append(para(a,'SmallClean'))
  story.append(para('NR: insufficient evidence or qualified review not yet performed.','SmallClean'))
 story.append(PageBreak())
for gi,(group,items) in enumerate(groups,1):
 story.append(para(f'Checklist {gi}  {group}','SectionTitle'))
 for ii,(task,status,evidence) in enumerate(items,1):
  story.append(KeepTogether([para(f'{gi}.{ii}  {task}','Label'),para(status.upper()+'  |  '+evidence,'BodyClean')]))
 story.append(PageBreak())
for start in range(0,len(sources),4):
 story.append(para('Source register' + (' continued' if start else ''),'SectionTitle'))
 for s in sources[start:start+4]:
  story.append(para(s['id']+'  '+s['title'],'Label'))
  story.append(para(s['publisher']+'. '+s['version'],'SmallClean'))
  story.append(para(s['use']+' '+s['rights'],'SmallClean'))
  story.append(Paragraph('<link href="'+E(s['url'],quote=True)+'" color="#165e82">Open source</link>',styles['SmallClean']))
 if start+4<len(sources):story.append(PageBreak())

def page(canvas,doc):
 canvas.saveState();canvas.setFillColor(colors.HexColor('#617185'));canvas.setFont('Helvetica',8);canvas.drawString(44,25,'Psychological Interview Simulator | Foundation 0.1.0 | Review pending');canvas.drawRightString(A4[0]-44,25,str(doc.page));canvas.restoreState()
doc=SimpleDocTemplate(str(OUT/'Foundation Handbook.pdf'),pagesize=A4,rightMargin=44,leftMargin=44,topMargin=42,bottomMargin=46,title='Psychological Interview Simulator Foundation Handbook',author='Project foundation prepared with AI assistance')
doc.build(story,onFirstPage=page,onLaterPages=page)
print(json.dumps({'checklist':counts,'items':len(checklist),'tests_passed':tests['passed'],'pdf':str(OUT/'Foundation Handbook.pdf')}))
