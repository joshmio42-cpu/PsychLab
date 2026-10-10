from pathlib import Path
import json
from archive_workspace import archive_workspace
ROOT=archive_workspace()
p=ROOT/'work/foundation/build.py'
s=p.read_text(encoding='utf-8')
replacements={
"'publisher':'Instrument developer form hosted by CPFT NHS learning'":"'publisher':'GAD-7 form hosted by Oxford Health NHS Foundation Trust'",
"'version':'Public PDF form; item wording independently cross-checked; accessed 2026-10-05'":"'version':'IAPT Minimum Data Set PDF, page 1; accessed 2026-10-05'",
"'url':'https://learning.cpft.nhs.uk/mod/resource/view.php?id=24718'":"'url':'https://www.oxfordhealth.nhs.uk/wp-content/uploads/sites/16/2019/07/MDS-TSP-PDF.pdf'",
"'use':'Form wording verification pending reliable retrieval; local item wording must be checked by reviewer before learner release.'":"'use':'Seven English items, two-week instruction and response labels verified against the NHS-hosted form. No other measures in the PDF are reproduced.'",
"English seven-item form; wording verification pending":"English seven-item form cross-checked with S11",
"The prototype intentionally labels instrument items by number until the exact standard form has been reliably retrieved and checked. Its seven response values and scoring are implemented. S11 records the form-retrieval gap rather than pretending the wording has been verified.":"The seven English item texts, instruction and response labels were cross-checked against the NHS-hosted form in S11. Only GAD-7 is reproduced under the permission in S5/S6; no other questionnaire or host branding is copied. Clinical interpretation and item-response consistency still need qualified review.",
"No instrument item wording is currently displayed because exact-form verification is pending.":"The seven item texts and fixed responses are displayed after the learner explains the purpose. These are fictional client responses, not a personal screening.",
"Live administration is gated on exact-form verification, reviewer approval of response consistency, user explanation and the chosen delivery method.":"Live administration is gated on reviewer approval of response consistency, user explanation and the chosen delivery method.",
"supervised learner pilot after clinical/wording fixes and usability review":"supervised learner pilot after clinical fixes and usability review",
"Exact GAD-7 form wording still needs final checking; only the authored numeric responses are exposed.":"GAD-7 wording is cross-checked with an NHS-hosted form; fictional responses still need expert review.",
}
for a,b in replacements.items():
    if a not in s: print('Missing replacement',a[:60])
    s=s.replace(a,b)
p.write_text(s,encoding='utf-8')
exec(compile(s,str(p),'exec'))
out=ROOT/'outputs/psych-simulator-foundation'
case=json.loads((out/'data/case-a01.json').read_text(encoding='utf-8'))
case['gad7']['instruction']='Over the last 2 weeks, how often have you been bothered by any of the following problems?'
case['gad7']['items']=['Feeling nervous, anxious or on edge','Not being able to stop or control worrying','Worrying too much about different things','Trouble relaxing','Being so restless that it is hard to sit still','Becoming easily annoyed or irritable','Feeling afraid as if something awful might happen']
case['gad7']['response_labels']=['Not at all','Several days','More than half the days','Nearly every day']
case['gad7']['attribution']='GAD-7: Spitzer, Kroenke, Williams and colleagues; developed with support from Pfizer. Reuse permission: S5/S6. Item text: S11.'
(out/'data/case-a01.json').write_text(json.dumps(case,ensure_ascii=False,indent=2),encoding='utf-8')
d=json.loads((out/'prototype/dist/data.json').read_text(encoding='utf-8'));d['case']=case
(out/'prototype/dist/data.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
p=out/'prototype/dist/index.html';s=p.read_text(encoding='utf-8').replace('Exact questionnaire wording is pending final verification, so item numbers are shown in this prototype. Scoring and reuse references are in the reviewer guide.','English item wording is cross-checked with an NHS-hosted form. Fictional responses and educational interpretation still need clinical review. Scoring and reuse references are in the reviewer guide.').replace('exact assessment wording and response consistency','assessment response consistency')
p.write_text(s,encoding='utf-8')
p=out/'prototype/dist/app.mjs';s=p.read_text(encoding='utf-8').replace("function ask(id){if", "function ask(id){$('error').hidden=true;if")
s=s.replace("const a=administer(session,data.case,$('rationale').value,$('explained').checked);", "const a=administer(session,data.case,$('rationale').value,$('explained').checked);$('error').hidden=true;")
target="node('p','Use alongside interview evidence. The simulated client is not a validated test respondent.'));"
replacement=target+"box.append(node('p',data.case.gad7.instruction));data.case.gad7.items.forEach((item,i)=>{const row=node('div',undefined,'datum');row.append(node('strong',`${i+1}. ${item}`),node('span',`${data.case.gad7.response_labels[a.values[i]]} (${a.values[i]})`));box.append(row);});box.append(node('p',data.case.gad7.attribution,'small'));"
assert target in s
s=s.replace(target,replacement);p.write_text(s,encoding='utf-8')
print('Verified form text incorporated')
