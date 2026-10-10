PSYCHLAB — ADAPTION EXAMPLE IMPROVEMENT

Adaption improves an occasional batch of fictional examples. Featherless still
answers interviews. Adaption is never called from a live interview request.
The examples guide expression and factual discipline; they do not retrain the
hosted Featherless model or become new facts about the current patient.

SECURE KEY
Run-Adaption.ps1 loads %LOCALAPPDATA%/PsychLab/adaption.credential.xml, encrypted
for the current Windows account. It sends the key only to the official Adaption
API. The key is not put in arguments, browser code, datasets or output files.
The launcher restores its original environment after the command finishes.
Featherless has its own separate saved credential and remains independent.

ONE BATCH, STEP BY STEP
Run these from the PsychLab project folder. Labels identify immutable batches;
choose a new label only for an intentionally new experiment, not a timeout.

1. Verify saved key with a read-only API request:
   .\psych-simulator-foundation\adaption\Run-Adaption.ps1 -Action check

2. Verify the 25 authored examples locally, with no provider call:
   node psych-simulator-foundation/adaption/build-examples.mjs --check
   Read data/review-notes.txt and source-examples.json.

3. Upload the fictional examples without starting adaptation:
   .\psych-simulator-foundation\adaption\Run-Adaption.ps1 -Action upload -Label pilot-25
   .\psych-simulator-foundation\adaption\Run-Adaption.ps1 -Action status -Label pilot-25
   Wait for awaiting_input and exactly 25 rows. The upload uses the documented
   structured ingestion flow with no column mapping; awaiting_input will not
   adapt itself. Upload only this curated dataset, never saved user History.

4. Request the quote:
   .\psych-simulator-foundation\adaption\Run-Adaption.ps1 -Action estimate -Label pilot-25
   Credits are Adaption units, not dollars. Account conversion is not inferred.
   A quote does not start the adaptation run and can differ from final billing.

5. Launch only the quoted batch after deciding its cost is acceptable:
   .\psych-simulator-foundation\adaption\Run-Adaption.ps1 -Action run -Label pilot-25 -MaxCredits 1
   Replace 1 with the accepted quoted ceiling. This local launch check rejects
   stale (>24h), changed or excessive quotes; it is not an account billing cap.
   Rows are limited to 25. No expansion, web grounding, or automatic retries.
   A persisted idempotency key and launch-attempt record prevent duplicate runs.

6. Check the existing job, then download once it is terminal:
   .\psych-simulator-foundation\adaption\Run-Adaption.ps1 -Action status -Label pilot-25
   .\psych-simulator-foundation\adaption\Run-Adaption.ps1 -Action download -Label pilot-25
   Failed jobs may expose partial output. It remains unapproved evidence.

7. Prepare a local review, inspect EVERY candidate against its original facts,
   record explicit semantic decisions and compile approved examples:
   node psych-simulator-foundation/adaption/prepare-review.mjs --label pilot-25
   node psych-simulator-foundation/adaption/compile-pack.mjs --label pilot-25
   The compilation command requires completed review decisions with pinned
   hashes; it does not itself perform clinical or semantic validation.
   Raw Adaption outputs stay unchanged. Example facts use EX_ IDs and names
   are anonymized in the runtime pack; this transformation is recorded.

8. Compare using the independent 36-case matrix (billable Featherless calls):
   .\psych-simulator-foundation\adaption\Compare-Examples.ps1 -Variant baseline -Label pilot-25 -Live
   .\psych-simulator-foundation\adaption\Compare-Examples.ps1 -Variant candidate -Pack <approved-pack-path> -Label pilot-25 -Live
   Omit -Live for a dry run. Existing evidence cannot be overwritten.
   The source dataset was written without reading held-out test questions.
   Review actual delivered text and rejected candidates, not just API approval.

ACTIVATION AND ROLLBACK
Status: NOT ACTIVATED. The full release comparison and independent reviews are
still pending. Start-PsychLab.ps1 still launches live/server.mjs; the prepared
live/launch-psychlab.mjs bootstrap is not yet the normal launcher entrypoint.

Approved examples are still candidates until a comparison supports activation:
no unsupported delivered claims, no hard regressions, at least one improved
case, no decrease in average quality, and estimated interview cost growth <=20%.
Missing provider token usage prevents claiming the cost gate passed.
Prefer the verified release procedure below: release-activation.mjs recomputes
all release gates and binds the exact model, planning setting, runtime sources,
pack, evaluations, reviews, matrices and saved decision in active-release.json.
The prepared bootstrap verifies those bindings again at each launch. A missing
or invalid selection uses the normally configured Featherless model without
optional examples or answer planning. Saved DPAPI credentials are unchanged.

For that bootstrap, PSYCHLAB_EXAMPLE_GUIDANCE_PACK=off explicitly disables the
release model selection, examples and planning, while preserving the manifest.
Removing the setting permits verification again on the next launch. A file-path
override is ignored; it cannot bypass release verification or replace the bound
pack. /api/status exposes release.status (active, absent, invalid or disabled)
and pathOverrideIgnored when applicable. None of these changes reload or interrupt
an interview already running in memory.

Legacy direct server.mjs startup, including the current Windows launcher, can
still load active-pack.json or an explicit PSYCHLAB_EXAMPLE_GUIDANCE_PACK path.
This is a manual/staging path: merely copying a pack does not verify a full release
or select its evaluated model. On that legacy path, off disables examples only;
also unset PSYCHLAB_ANSWER_PLANNING to return from a staging planning experiment.
Do not use manual pack copying as the release activation procedure.

The writer/auditor receive at most two relevant examples (1,600 bytes), and
examples are omitted first if the existing 12,000-byte input cap is reached.
No extra live model calls are added. Current per-call output caps are CORTEX
640, LANGUAGE 320 and AUDITOR 192 tokens; reported usage determines estimates.

AFTER THE FIRST PILOT
The original 36 interview cases and eight transfer cases are now regression
sets: they informed fixes and must not be described as unseen tests again.
The separate 16-case grounding-generalization matrix was authored before its
first live run. After a result informs a fix, reruns of that matrix are also
regression evidence, not a new independent test.

New comparison labels use their own pinned reviews and cannot overwrite the
pilot evidence. Run an additional matrix with -Generalization, using label
<label>-generalization; -Transfer uses label <label>-transfer. Reviews must be
named <label>-review-baseline.json, <label>-review-candidate.json,
<label>-review-transfer.json and <label>-review-generalization.json.
node psych-simulator-foundation/adaption/compare-results.mjs <label>
requires all 36 + 36 + 8 + 16 cases and matching source/model/pack hashes.
Every generalization case must pass, with actual examples reaching at least
one completed writer call. A failed preliminary matrix is enough to keep the
pack inactive; do not pay for a larger comparison just to bypass that failure.

The grounded writer now distinguishes missing case information from a real
patient's indecision, amnesia or denial. The existing auditor may correct
citations using only facts already permitted for that turn, without rewriting
the answer or making another model call. Local checks run again on the final
citation set. Personality style, example biographies, frequency inflation and
unrecorded effects of coping habits remain outside the permitted evidence.

STAGING ANSWER PLANS AND THE RELEASE COMPARISON (2026-10-09)
Answer planning remains a staging experiment, disabled by default. -Planned
passes the explicit answerPlanning flag to the evaluation provider. Only for an
isolated staging server, PSYCHLAB_ANSWER_PLANNING=1 enables the same path at startup;
unset it for the default path. This switch does not activate an example pack,
change the saved model or establish that the experiment has passed its gates.

The planner partitions the question and cites exact canonical source text for
each supported part. Local validation derives the evidence IDs and answer route
from those parts. A separate Case note identifies unauthored requested details;
it is app information, not patient speech or checklist evidence. The writer
receives selected, validated source excerpts and generic instructions to state
that evidence, without the original leading question or unknown requested values.
Difficulty may defer known information, which must not be relabeled missing.
Planning still uses at most three provider calls, with 640/320/192 output-token
caps and the same 12,000
input-byte limit. Exact quotes establish provenance, not semantic correctness;
the independent answer audit and review of actual responses remain necessary.

The planned path also has a conservative local source-excerpt repair. When an
otherwise valid nonsocial draft contains a detected causal connective, its causal
sentence must match a complete selected source sentence after narrow normalization
of case, whitespace, terminal punctuation and unambiguous contractions. Internal
punctuation, speaker quotations and numeric punctuation remain significant.
If it does not match, the repair replaces the draft with the complete permitted
writer excerpts in their existing order, separated by paragraphs. It does not
splice clauses, invent connecting text, expand to undisclosed facts or truncate
an oversized assembly; an empty or oversized assembly fails without delivery.
The same exact-excerpt repair runs if the draft omits an ID required by a disclosed
direct-answer request. It does not require optional missing-detail context. This
is a conservative coverage trigger, not an entailment check: a complete answer
with an omitted citation may be replaced, while merely listing all IDs cannot
prove that the answer used their evidence or addressed the question.
The resulting reply and citations still undergo the same factual guards and
semantic audit. The trace retains the raw draft, reason and exact source assembly.
This adds no provider call or paid retry. It can replace legitimate paraphrases
and reduce naturalness; it addresses detected causal links, not every possible
unsupported claim, selection mistake or question misunderstanding.
Ambiguous since/as and common cause, result, make/help and enable/allow wording
are deliberately conservative triggers. Temporal statements and ordinary action
paraphrases can also trigger exact source rendering; this is a quality tradeoff.

For a new release label beginning release-, the CLI retains the old 16-case
grounding matrix as regression and requires a distinct 16-case release matrix.
Do not inspect the fresh matrix to tune prompts. Run it once implementation and
the preceding regression work are stable. A result that informs a later fix is
no longer fresh evidence. Use a new label for an intentional experiment and keep
all earlier failures. Omit -Live to preview the selected matrix and call ceiling.

From the PsychLab project folder, substitute a new release label and pack path:
  $runner = ".\psych-simulator-foundation\adaption\Compare-Examples.ps1"
  $pack = ".\psych-simulator-foundation\adaption\runs\pilot-25-approved-pack.json"
  & $runner -Variant baseline -Label release-example -Planned -Live
  & $runner -Variant candidate -Pack $pack -Label release-example -Planned -Live
  & $runner -Variant candidate -Pack $pack -Label release-example-transfer -Transfer -Planned -Live
  & $runner -Variant candidate -Pack $pack -Label release-example-regression -Generalization -Planned -Live
  & $runner -Variant candidate -Pack $pack -Label release-example-generalization -ReleaseGeneralization -Planned -Live
Replace release-example with a new label using lowercase letters/numbers/hyphens.
The optional -Model exact/model-id applies only to this run and needs a verified
local pricing entry. It does not rewrite the saved Featherless credential.

Review each saved run independently, with exact evaluation and record hashes:
  release-example-review-baseline.json
  release-example-review-candidate.json
  release-example-review-transfer.json
  release-example-review-regression.json
  release-example-review-generalization.json
Then run:
  node psych-simulator-foundation/adaption/compare-results.mjs release-example
This release command requires 36 baseline + 36 candidate + 8 transfer + 16 old
grounding regression + 16 fresh release cases (112 total), identical runtime and
model settings, answer planning enabled in every run, and the same candidate pack.
Both 16-case sets must pass independently, with examples reaching a completed
writer call in each. Blocked ordinary questions fail usefulness. The source and
matrix hashes must still match the current files; this command never activates
the pack or changes the saved model. Existing activation and cost gates remain.

PREPARED VERIFIED RELEASE SELECTION (NOT YET ACTIVATED)
Only after the full comparison and independent reviews support a passing decision,
run these from the PsychLab project folder with the actual release label:
  node psych-simulator-foundation/adaption/release-activation.mjs --check --label release-example --pack runs/pilot-25-approved-pack.json
The check is local and read-only. It recomputes the gates rather than trusting an
activate flag, checks exact evaluation bytes against their reviews, and requires
the current runtime and pack to match the reviewed evidence. Relative --pack
paths are resolved from the adaption folder. No provider call is made.

An explicit selection for the next launch is a separate operation:
  node psych-simulator-foundation/adaption/release-activation.mjs --activate --label release-example --pack runs/pilot-25-approved-pack.json
This writes active-release.json only after the same verification. It refuses to
overwrite an existing selection. The approved pack stays at its verified path;
copying it to active-pack.json is not required. Project-relative evidence paths
allow the project to move when all required files and their exact bytes are kept.
To inspect selection status without writing:
  node psych-simulator-foundation/adaption/release-activation.mjs

After a confirmed release, Start-PsychLab.ps1 must be switched from server.mjs to
launch-psychlab.mjs before normal startup can use this selection. That launcher
change is still pending. The bootstrap applies the reviewed model in memory only;
it does not rewrite the saved key/model. Activation and off rollback affect the
next launch, not a running server. See "Release activation guide.txt" for details.

RECOVERY
After a timeout, use status for the SAME label/dataset ID. Do not start a new
batch because a status check timed out. A run-attempt marker is written before
the paid POST. Ambiguous outcomes require inspecting the saved state and the
Adaption dashboard; they are not retried automatically. A .lock file after a
crash may be removed only after verifying the owning process has stopped.
Presigned storage URLs and API bodies are not printed. Local runs/*.json files
record dataset/run IDs, quote, status, hashes, usage and fictional evidence.

TESTING
node --test psych-simulator-foundation/adaption/tests/*.test.mjs
node --test psych-simulator-foundation/live/tests/*.test.mjs
These automated tests do not call a provider. Live comparisons are explicitly
separate and must be interpreted as small development samples, not clinical
validation or proof that future replies cannot invent details.

Official API references and exact wire-field notes: official-API-notes.txt.
