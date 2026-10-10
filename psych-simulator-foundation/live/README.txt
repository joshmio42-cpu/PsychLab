PSYCHLAB — SIMULATE, FREEZE, INTERVIEW
Local experimental implementation, 2026-10-05

2026-10-10: Security startup and access configuration
Install the pinned Node 24.21.0 LTS runtime once from this directory:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-PsychLabRuntime.ps1
Then use Open PsychLab.cmd or Setup PsychLab.cmd. The installer downloads only
the project's runtime, verifies the pinned official SHA-256 and OpenJS publisher
signature, and leaves global Node, PATH and running servers unchanged. The launcher
checks the binary checksum at each start and disables inherited debug/trace options.
To update later, review the current official Node 24 release, update .node-version
and runtime-lock.json with its official SHA-256 values, rerun the installer and
run the test suite before using the new runtime. The application has no npm packages.
https://nodejs.org/en/download
https://nodejs.org/dist/v24.21.0/SHASUMS256.txt

public-access.json is private local configuration and is now ignored by Git.
public-access.example.json documents its format. Signed Access identity claims
authorize allowlisted users; untrusted email headers never grant access. Keep the
Cloudflare Access login method configured to verify the user's email. Public
reviewer permissions require an explicit adminEmails subset of emails; omitted
adminEmails grants no public reviewer privileges. Existing user configuration is
preserved, so no public reviewer is implicitly added by this update.
These changes take effect at the next launch. No live server is restarted here.

2026-10-09: Answer planning is staging only
Status: NOT ACTIVATED. Full release gates and independent reviews are pending.
Start-PsychLab.ps1 still launches server.mjs. The prepared launch-psychlab.mjs
bootstrap and verified release manifest are not yet used by the normal launcher.
The new answerPlanning path is disabled by default. Evaluations enable it with
Compare-Examples.ps1 -Planned; an isolated staging server can opt in at startup
with PSYCHLAB_ANSWER_PLANNING=1. Unset that variable for the default path. This
does not activate the Adaption pack, change the saved model or claim a passing
release. See ../adaption/README.txt for the full release comparison commands.

In this experiment CORTEX divides a question into requests and cites exact source
text. Local validation derives route IDs and separates supported information from
unrecorded details before LANGUAGE writes patient speech. Missing details appear
as a separate Case note. The note survives History and downloads, but is marked
as app information and is not patient evidence. Difficulty can defer known details;
it does not make them unknown. An exact source quote alone does not prove the
planner understood the question, so response auditing and independent review are
still required. The maximum remains three provider calls per turn. Current output
caps are 640 tokens for CORTEX, 320 for LANGUAGE and 192 for AUDITOR (1,152 total
allowed, not a measured charge). Input remains capped at 12,000 bytes per call.

The planned writer receives selected, validated source excerpts and generic
instructions to state their evidence, without the original leading question or
unknown requested values. A conservative local repair checks detected causal
sentences in an otherwise valid nonsocial draft. If such a sentence does not
match a complete selected source sentence after narrow normalization, it replaces
the draft with the complete permitted writer excerpts, in their existing order
and separated by paragraphs. Quotes, internal punctuation, numbers, negation and
qualifiers are retained; no causal link or connecting clause is invented. Empty
or oversized assemblies fail without delivery rather than being truncated.
The same repair also runs when a draft omits a source ID required by a disclosed
direct-answer request. Optional missing-detail context is not mandatory. This
coverage trigger can also replace a complete answer that merely omitted a
citation; listed citations alone do not prove the text used all required evidence.
The final reply and citations still pass through the same factual guards and
semantic audit. The reviewer trace retains the raw draft, reason and exact source
assembly. No extra provider call or paid retry is added. This conservative repair
may replace a legitimate paraphrase and make wording less natural. It is not a
general factual guarantee: missed causal wording, other unsupported claims, and
incorrect source selection remain possible and require review.
The detector deliberately treats ambiguous since/as and common cause, result,
make/help and enable/allow wording conservatively. Temporal statements and
ordinary action paraphrases can therefore also trigger exact source rendering.

Release labels starting release- require the original 36-case comparison and
8-case transfer set, the old 16-case grounding regression set, and a separate
16-case release generalization set. Every set and its pinned review are required;
the old 16 cases are not fresh evidence after they informed fixes.

2026-10-08: Interview quality, memory, debrief and cost update
All eight patients have 12 stable personal facts, including earlier examples,
relationships, preferences and wishes. These are authored fictional details,
independent of the selected disorder, seed and recent-day window. Their time scope
travels with the source so a past example cannot silently become a recent event.
The conversation now retains a compact ledger of source IDs from the whole session
and retrieves earlier topics for callbacks. It does not send the entire transcript,
learn new case facts from generated replies or add a memory-summarization API call.
Long prompts trim optional context before hitting the 12,000-byte input cap;
the question and canonical answer evidence are never truncated to fit.
Independent checks cover selected invented names, emotional benefits, health
assertions, numbers and timing, alongside the semantic support audit. They reduce
errors but do not prove every sentence true. English topic/day retrieval is tested;
equivalent callbacks in other languages are not comprehensively supported.
Closed non-factual acknowledgments can use a local check, saving one model call;
substantive replies retain the separate semantic support audit.
After Finish, the debrief highlights actual questions and replies, unanswered areas,
follow-up prompts and evidence-link gaps. Turn references such as T2 make reasoning
traceable; this is not an automatic diagnosis or clinical-competence grade.
The sidebar, History and downloads include estimated interview cost in USD from
reported input/output tokens and versioned public model rates. Missing usage or
unknown rates remain explicit; estimates are not provider invoices or dollar caps.
Memory, profile preparation and local debrief feedback add no AI calls. The existing
60 calls/interview and 300 calls/server-run limits are unchanged. Current completion
limits are listed in the 2026-10-09 staging update above.
See ../../research/interview-improvements-2026-10-08/ for live evaluation evidence.

2026-10-08: Conversational replies, difficulty and individual patients
Choose Beginner, Standard or Challenging during setup. Difficulty changes how much
of the same frozen history is disclosed at once. All eight profiles now have their
own goals, usual interests, communication preferences and relationship facts, with
authored priorities in the local personality rules. Authored hobby and background
facts support concrete casual follow-ups. Preparation adds no model calls.
Replies now paraphrase permitted facts in ordinary speech, with factual guards and
a separate support audit. Greetings and acknowledgments stay brief; they are not
clinical evidence. Usual interests do not prove current enjoyment. See "Difficulty
and individuality.txt" and ../../research/natural-conversation-2026-10-08/ for the
research, implementation choices and evaluation records.

REMEMBER YOUR KEY (Windows, added 2026-10-08)
Run Setup PsychLab.cmd once. Enter the key privately and press Enter to accept
the recommended model. This saves the key encrypted with Windows DPAPI under
%LOCALAPPDATA%/PsychLab/featherless.credential.xml, outside the project. It can
normally be decrypted only by this Windows account on this computer. The model
ID is not secret. Never share the credential file.
After setup, run Open PsychLab.cmd each time, then visit http://127.0.0.1:8771/.
Keep its window open. If another server occupies the port, stop that server first
with Ctrl+C. Saving credentials does not reconfigure an already running server.
The launcher defaults to port 8771 unless PSYCHLAB_PORT is explicitly set.
To replace the saved key, run Setup PsychLab.cmd again. To forget it, run:
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-PsychLab.ps1 -Forget
The -Configure flag alone still offers temporary entry without saving. -Remember
prompts and saves; no flags load the saved credential when no environment key is
present. Existing environment key/model settings take precedence on normal launch.
Tested encryption, reload, environment restoration and removal with a dummy key.

2026-10-08 update: Personality and mind context now reaches the response model.
Economy mode limits input size and output tokens, keeps the three-call checked
answer flow, and shows usage. Default caps are 60 call attempts per interview and
300 per server run. See "Agent AI and usage guide.txt" for the current details.

Start from psych-simulator-foundation/live with Node 22 or later:
  node server.mjs
Open http://127.0.0.1:8770/
Without provider settings, history preparation works and the UI explains why AI
answers are unavailable. The staged planning path's exceptional source-excerpt
repair is described above and recorded explicitly in its reviewer trace.

To enable Featherless, copy .env.example to .env.local and fill it privately in a
local editor, then start:
  node --env-file=.env.local server.mjs
Windows alternative without saving a key to disk:
  .\Start-PsychLab.ps1 -Configure
This prompts for the key with hidden input and an exact model ID, then starts Node.
Stop any server already using port 8770 before starting the configured instance.
Never paste the key into chat, browser code, Git, reports, screenshots or archives.
FEATHERLESS_MODEL must be an exact model ID accessible to your account. List model
IDs using Featherless's authenticated GET /v1/models endpoint or their dashboard.
The Windows setup prompt now defaults to Qwen/Qwen2.5-72B-Instruct. An existing
saved configuration or complete explicit environment configuration is used when
the launcher starts. This model choice is reversible: run Setup PsychLab.cmd,
enter the same key privately and choose another exact model ID, then restart.
Changing the model does not require creating or rotating an API key.
Documentation checked: https://featherless.ai/docs/completions
                       https://featherless.ai/docs/api-reference-models

Implemented flow
Choose from eight generated profiles spanning Toddler to Older adult. Alex is now
also selectable with a generated case; the old authored Alex case remains available
through the legacy API and tests. Generated histories support 1–90 recent days within the
selected life stage; they do not age a patient from birth. Toddler and preschool
profiles use caregiver interviews. See "Patient life stages.txt" for profiles,
developmental references, and the limits of these authored scenarios.
The seed controls local simulation, not provider output. A frozen SHA-256
snapshot identifies the private history. The new preparation flow shows an opaque
session reference so a mystery label cannot be looked up using a known seed/hash.
Interview questions cannot advance time, edit
that history or teach new facts to the client. The identity profile is initialized;
this does not simulate a lifetime or establish developmental causality.

Jordan's world samples four authored daily event types: ordinary work task,
cancelled plan, offer of support, quiet evening. PHYSIOLOGY proposes energy;
MNEMOSYNE retrieves prior similar observations; CORTEX proposes an interpretation;
AFFECT updates tension/mood burden; SOCIAL samples from available actions; WORLD
resolves authored consequences. IDENTITY updates support expectations only after
observed support. The engine validates bounds and commits the day. Memory retains
subjective interpretation separately from world truth. Functioning counts actual
task outcomes. The disorder selection adds separately authored earlier course,
symptom experiences and functional impacts to CORTEX and the daily memory. These
facts inform the response model but do not turn generic numerical tension/energy
readouts into disease severity or change a personality type based on a diagnosis.
Every coefficient in engine.mjs
is an unvalidated authored modeling assumption, not a clinical formula. Symptom
history fields are model readouts, not validated symptom measurements.
The tension-to-subjective-expression threshold (.35) is also an authored rendering
assumption, not a clinical cutpoint. Only the resulting subjective wording is made
available to the client renderer; numerical state stays in the reviewer trace.

In the default path, CORTEX classifies the current turn and selects up to four
catalog facts. Difficulty limits disclosure to four, two or one relevant facts.
Recent conversation helps resolve a follow-up; previous generated replies never
become new evidence. LANGUAGE receives the permitted facts, previous questions,
fact-based topic context and a compact read-only personality/mind projection. It
normally produces brief conversational paraphrases. The staged planned path uses
the selected excerpts and exceptional source-excerpt repair described above.
The projection guides expression without authorizing new facts. Caregiver and
supported-written perspectives are preserved. A greeting is not an invitation to
repeat the complaint, and a direct new question takes priority over the old topic.
AUDITOR separately checks support and relevance. Strict shape and fact-ID checks
and narrow checks for consequential inventions are deterministic; semantic checking
is fallible and needs human review. The model
cannot invoke tools or mutate the world. Ambiguous, unauthored or emergency input
can produce labeled system boundary messages. Emergency classification is NOT a
validated detector; this prototype must not be used for real emergency handling.
An unavailable detail uses one routing call and the explicit system message "That
detail isn’t available for this interview." It does not invent forgetfulness,
refusal or an answer in the patient's voice. Social replies carry no clinical facts
and cannot be selected as checklist evidence. Both supported answers and generated
social replies normally use three serial model calls, with 30 seconds per call,
no automatic paid retries and no streaming before validation. Output allowances
are CORTEX 640, LANGUAGE 320 and AUDITOR 192 tokens; session/process caps remain
60/300 call attempts. Requested and
returned model IDs, prompt version, token usage when available and call timing are
stored in the reviewer trace; no dollar cost is fabricated. A seed alone does not
reproduce AI text. Exact accepted text and traces are retained for this session.

Isolation and retention
Browser history update, 2026-10-08: History saves disclosed questions and replies
automatically in localStorage, with a manual Save conversation button. Open,
download or delete saved transcripts using History. These read-only copies survive
server restarts and Clear session. They are specific to this browser and origin
(host/port), and clearing browser data removes them. Up to 50 conversations are
kept; storage failures are shown without silently evicting saved conversations.
Optional interaction metadata preserves social/unavailable labels in new archives;
older archives without that field remain readable. History is a transcript, not
proof of a diagnosis or a source of new case facts. No keys, hidden case state,
reviewer traces or assessments are archived by History.
Download conversation remains available when browser storage cannot save.

The HTTP server binds only to 127.0.0.1, checks Host and Origin, and uses an opaque
HttpOnly SameSite session cookie. It serves only three allowlisted public assets.
Hidden cases, sources, environment values and traces are not static browser files.
The full reviewer trace requires the same session and a completed interview.
Sessions live only in server memory, expire after two hours of inactivity, and are
deleted by Clear or server restart. Reload reconnects to the existing session.
There are at most 64 sessions and 80 turns per session. One question runs at a time.
An identical successful request ID returns its previous result; mismatches reject.
Clear cancels any in-flight provider call. Failed requests leave the question in
the UI and do not add a turn. Refresh conversation reconciles a lost response.
This is a local single-user review tool, not a hosted multi-user authorization model.
Questions and allowed fictional context are sent to Featherless only after setup
and an Ask action. Provider retention/account settings still require verification.

Assessment and feedback
The legacy authored Alex API retains fixed GAD-7 scoring and wording. All eight
profiles in the new preparation flow have no GAD-7 values: generating a history
does not authorize inventing a validated screen score.
Both modes collect learner reasoning and export disclosed conversation evidence.
The completed debrief also reveals the selected case formulation. All five ratings
remain NR. An AI evaluator and clinical classification are not implemented.

Run checks from the foundation directory:
  node --test live/tests/*.test.mjs engineering/agents.test.mjs
  node engineering/test.mjs
The second command regenerates the historical deterministic fixture records.
The 2026-10-08 automated suite passed 130 checks. Automated model tests use an explicit
injected MOCK provider. That day's Qwen/Qwen2.5-72B-Instruct live sample completed
16 turns without request errors: 46 calls, 34947 input tokens and 1071 output tokens.
At the published US$0.37/US$0.40 per million input/output token rates, that sample
estimates US$0.01336 (about 1.34 US cents). This is not an account billing guarantee.
Rate source: https://featherless.ai/models/Qwen/Qwen2.5-72B-Instruct
Separate transcripts and earlier failures remain in the natural-conversation
research folder. Some accepted prose still included minor unsupported flourishes,
such as "interesting shapes"; the model audit is fallible. Zero request errors
does not mean every fact was validated. Neither the suite nor this small sample
establishes reliability across all cases, educational efficacy or clinical validity.

Hosting
The existing Site remains a static reviewer rehearsal. This local Node server
cannot be deployed as static files. A hosted migration requires a Sites-supported
Worker/controller, compatible session storage, secrets and explicit reviewer/learner
access control. No deployment or sharing change is claimed for this implementation.
The original handbook and ZIP remain historical snapshots.

Personality research integration (life-history-0.2.0, 2026-10-05)
The dedicated ../personality_system module contains the literature review,
36-source registry, construct catalog and versioned experimental mechanisms.
Jordan now has separate cousin/friend expectations, unique-event learning and
competing goals activated by context. Receiving support updates only the relevant
relationship, using a bounded prediction-error rule. A cancellation with unknown
reason does not count as observed rejection. Trait/facet measures stay unmeasured;
traits and values do not drift during this short demo. Some coefficients now live
in personality_system/data/authored_parameters.json. All remain uncalibrated.
Completed-session reviewer output includes source-linked rules and the research
registry. Allowed client facts still exclude numerical identity and hidden causes.
The separate population sampler generates partial trait profiles only; it does not
replace Jordan or invent joint schema/motive distributions. See the module README
for diagnostics and tests. Restart the local server to use the updated engine.

Optional Adaption example guidance (2026-10-09)
The separate ../adaption folder contains a private saved-key connector, a curated
25-example fictional dataset, estimate-first batch tools, semantic review and
independent before/after evaluation. Adaption is never called per interview turn.
Approved examples guide the writer/auditor but never become current patient
facts. Maximum 2 examples / 1,600 bytes, discarded first at the input cap; no
extra model calls. See ../adaption/README.txt and its runs/decision evidence.

The preferred release mechanism is prepared but NOT ACTIVATED. The local
../adaption/release-activation.mjs CLI offers --check for read-only verification
and --activate for an explicit next-launch selection after all full release gates
pass. It verifies the saved decision by recomputing the gates, then pins the exact
model, planning setting, runtime sources, pack, evaluations, reviews and matrices
in ../adaption/active-release.json. No existing selection is overwritten. The
pack stays at its verified path; copying active-pack.json is not required.
See ../adaption/README.txt for commands and required independent reviews.

launch-psychlab.mjs rechecks that manifest on every launch and exposes the outcome
in /api/status under release. Missing or invalid bindings use the normally
configured Featherless model without optional examples or answer planning.
PSYCHLAB_EXAMPLE_GUIDANCE_PACK=off disables the release model selection, examples
and planning and reports status disabled. It preserves the manifest; removing
the setting permits verification again on the next launch. Other values in that
variable are ignored pack-path overrides, reported as pathOverrideIgnored=true;
they cannot bypass the verified release. The saved DPAPI key/model is unchanged.
Neither activation nor rollback interrupts or changes an existing interview.

The Windows launcher still targets server.mjs and must be switched to the prepared
bootstrap only after a confirmed release. Direct server.mjs startup is the legacy
manual/staging path: it can load ../adaption/active-pack.json or an explicit pack
path, and missing/invalid packs leave existing prompts in use. On that path off
disables examples only; also unset PSYCHLAB_ANSWER_PLANNING to disable staging
planning. Manual pack loading does not establish full release verification or
select the evaluated model. Prefer the verified mechanism for a future release.
