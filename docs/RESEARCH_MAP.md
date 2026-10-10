# PsychLab research and evidence map

This repository preserves the research, authored design, software checks, model evaluations, and earlier prototype materials that led to the current application. They serve different purposes. A source registry is not clinical validation; a passing code check is not a successful live answer; and a completed evaluation is not automatically an approved release.

Start with the [current README](../README.md) and [judge's walkthrough](JUDGES_GUIDE.md), then use this map to inspect a claim.

## Read the evidence in layers

| Layer | What it contains | How to use it |
|---|---|---|
| Public references | Citation metadata, links, access notes, and permissions or usage cautions. | Check the original source and the exact claim it can support. |
| Authored interpretation | Case premises, interview prompts, mechanism distinctions, and design decisions. | Identify the step from a source to a fictional educational formulation. |
| Executable assumptions | Simulation equations, parameters, state transitions, and rendering rules. | Read the stated inference gaps; these are not fitted clinical models. |
| Software verification | Deterministic and mock-provider checks of contracts, boundaries, and UI behavior. | Reproduce behavior in code; do not infer live-model or human validity. |
| Live-response evidence | Actual provider replies, usage, pinned runtime hashes, and saved reviews. | Check the tested revision, review criteria, failures, and whether cases informed subsequent fixes. |
| Human validation | Prepared clinician and learner-review materials. | Recognize that preparing a protocol does not mean the study or expert approval occurred. |

## Foundation: the original case and learning workflow

The foundation introduced the authored Alex case, an interview-to-reasoning workflow, a fixed fictional GAD-7 response set, and an evidence-linked report. Its documents describe the earlier milestone and must not be treated as a complete description of today's live app.

| Resource | Contents |
|---|---|
| [Foundation Handbook](../psych-simulator-foundation/Foundation%20Handbook.pdf) | Historical design and review package. |
| [Original case](../psych-simulator-foundation/data/case-a01.json) | Eighteen authored fact blocks and the fixed fictional assessment material. |
| [Foundation source register](../psych-simulator-foundation/data/sources.json) | Eleven sources, their intended uses, and rights notes. |
| [Rubric](../psych-simulator-foundation/data/rubric.json) | Five review domains; software output does not certify competence. |
| [Clinician review form](../psych-simulator-foundation/review/clinician-review-form.txt) | Structured review of plausibility, alternatives, assessment consistency, and fairness. |
| [Learner walkthrough protocol](../psych-simulator-foundation/review/student-walkthrough.txt) | Prepared usability protocol, explicitly marked not conducted in the saved record. |
| [Historical browser rehearsal](../psych-simulator-foundation/prototype/dist/) | Scripted UI served by `npm run demo`. Its browser includes case material intentionally. |

The prototype's [scoring module](../psych-simulator-foundation/prototype/dist/core.mjs) is also imported by current code. Preserving this folder is a functional requirement as well as a historical choice.

## Personality, identity, and simulation

The personality module separates stable traits, relationship-specific expectations, motives, situation-dependent goals, and authored behavior rules. Its 36-source registry and 14 mechanism records expose the relationship between research and implementation without claiming that the implementation is empirically calibrated.

| Resource | What to inspect |
|---|---|
| [Module overview](../psych-simulator-foundation/personality_system/README.md) | Scope, integration, diagnostics, and known limitations. |
| [Literature review](../psych-simulator-foundation/personality_system/research/literature_review.md) | Research distinctions and interpretation. |
| [Source registry](../psych-simulator-foundation/personality_system/evidence/sources.json) | Bibliographic metadata and access caveats. |
| [Mechanisms](../psych-simulator-foundation/personality_system/evidence/mechanisms.json) | Fourteen mechanisms with evidence and implementation status. |
| [Evidence map](../psych-simulator-foundation/personality_system/evidence/evidence_map.json) | Traceable links from implementation rules to mechanisms and references. |
| [Model contract](../psych-simulator-foundation/personality_system/docs/model_contract.md) | State ownership, equations, authored parameter provenance, and inference gaps. |
| [Authored parameters](../psych-simulator-foundation/personality_system/data/authored_parameters.json) | Numerical engineering assumptions, not measured human coefficients. |
| [Identity implementation](../psych-simulator-foundation/personality_system/models/identity.mjs) | Goals, actions, and learning from structured observations. |
| [Validation results](../psych-simulator-foundation/personality_system/validation/reports/results.md) | Experimental diagnostics and their scope. |
| [Partial population sampler](../psych-simulator-foundation/personality_system/population/generator.mjs) | Separate statistical prototype with intentionally incomplete profiles. |

The population sampler does not initialize the live patients and is not a validated population generator. Unknown facets, schemas, and motives remain explicit. The recent-history simulation is not a model of lifetime development or real patient prognosis.

## The four dated research collections

### Case selection and life-stage compatibility

Directory: [mental-disorder-selection-2026-10-08](../research/mental-disorder-selection-2026-10-08/)

- [Readable research report](../research/mental-disorder-selection-2026-10-08/01-Research-report.html)
- [Structured catalogue](../research/mental-disorder-selection-2026-10-08/02-Disorder-catalogue.json)
- [Source register](../research/mental-disorder-selection-2026-10-08/04-Source-register.json)
- [Search method and gaps](../research/mental-disorder-selection-2026-10-08/05-Search-method-and-gaps.txt)
- [Age, history, and future design](../research/mental-disorder-selection-2026-10-08/03-Age-history-and-future-design.txt)

The runtime catalogue contains 68 options: 65 DSM-5-TR-labelled educational candidates, two separately labelled ICD-11 comparisons, and No disorder. Compatibility filters prevent every option from appearing at every life stage. This is an authored teaching catalogue, not a validated diagnostic case bank or a reproduction of the licensed manual.

Current integration lives in [disorders.mjs](../psych-simulator-foundation/live/disorders.mjs), [patients.mjs](../psych-simulator-foundation/live/patients.mjs), and [live data](../psych-simulator-foundation/live/data/). The disorder research register and runtime register have different historical counts; their entries overlap.

### Interview guidance

Directory: [interview-guidance-2026-10-08](../research/interview-guidance-2026-10-08/)

- [Readable research guide](../research/interview-guidance-2026-10-08/01-Research-guide.html)
- [Standard interview research](../research/interview-guidance-2026-10-08/standard-research.txt) and [structured broad guidance](../research/interview-guidance-2026-10-08/standard-guidance.json)
- [Part A](../research/interview-guidance-2026-10-08/part-a-research.txt), [Part B](../research/interview-guidance-2026-10-08/part-b-research.txt), and [Part C](../research/interview-guidance-2026-10-08/part-c-research.txt), with adjacent structured JSON files

The project contains 67 condition guides, 334 condition-specific checkpoints, and 17 broad interview prompts. The condition-guide source lists contain 108 distinct URLs; URLs are not a count of independent clinical studies. Guides include course, original questions, alternatives, assessment references, and interpretation cautions. Assessment links do not remove instrument-specific requirements.

Current integration: [interview-guide.mjs](../psych-simulator-foundation/live/interview-guide.mjs) and [interview-feedback.mjs](../psych-simulator-foundation/live/interview-feedback.mjs). A checklist match is a lead for interpretation, not a diagnostic criterion proven satisfied.

### Natural conversation and individuality

Directory: [natural-conversation-2026-10-08](../research/natural-conversation-2026-10-08/)

- [Research notes](../research/natural-conversation-2026-10-08/01-Research-notes.txt)
- [Profile-language choices](../research/natural-conversation-2026-10-08/02-Profile-language.txt)
- [Authored-background expansion](../research/natural-conversation-2026-10-08/Authored-backgrounds-expansion.txt)
- [Implementation notes](../research/natural-conversation-2026-10-08/05-Implementation-notes.txt)
- [Review and limits](../research/natural-conversation-2026-10-08/07-Review-and-limits.txt)
- [Session cost notes](../research/natural-conversation-2026-10-08/09-Session-cost-estimates.txt)

Saved JSON evaluations and diagnostics retain actual provider responses and model-specific failures. All eight profiles have twelve stable authored personal facts, with relationships, interests, earlier experiences, preferences, and wishes separated from the chosen condition. Time scope matters: a usual activity is not proof of current enjoyment, and an earlier example is not a new recent event.

Current integration: [individuality.mjs](../psych-simulator-foundation/live/individuality.mjs), [interview-style.mjs](../psych-simulator-foundation/live/interview-style.mjs), and [conversation.mjs](../psych-simulator-foundation/live/conversation.mjs).

### Memory, feedback, factual checks, and cost

Directory: [interview-improvements-2026-10-08](../research/interview-improvements-2026-10-08/)

- [Implementation and verification](../research/interview-improvements-2026-10-08/Implementation-and-verification.txt)
- [Combined evaluation review](../research/interview-improvements-2026-10-08/Combined-evaluation-review.txt)
- [Full validation run](../research/interview-improvements-2026-10-08/final-validation.json) and [its review](../research/interview-improvements-2026-10-08/final-validation-review.json)
- [Targeted follow-up](../research/interview-improvements-2026-10-08/final-followup.json) and [its review](../research/interview-improvements-2026-10-08/final-followup-review.json)
- [Long-interview evidence](../research/interview-improvements-2026-10-08/long-validated-memory.json) and [its review](../research/interview-improvements-2026-10-08/long-validated-memory-review.json)

The saved 34-acceptable/two-blocked summary combines a full run with seven targeted follow-ups under different file hashes. It is explicitly not a fresh 36-case pass. Earlier failures remain inspectable, including unsupported emotional benefit, chronology errors, and an invalid inference from task completion to distress.

The long-interview evidence demonstrates a bounded source-memory behavior in a fictional test. It does not establish general memory reliability, language coverage, or clinical validity.

## Offline Adaption experiments and release evidence

Start with [the workflow](../psych-simulator-foundation/adaption/README.txt), [pilot results](../psych-simulator-foundation/adaption/RESULTS-2026-10-09.txt), and [development status](../psych-simulator-foundation/adaption/DEVELOPMENT-STATUS-2026-10-09.txt).

The 25-example pilot yielded 21 reviewed, approved examples. Four were rejected. Approved examples may guide expression and factual discipline; they do not become evidence about a current patient and do not retrain the hosted response model. Adaption is not called from a live interview request.

The pack remains **inactive**. A later v153 known regression passed 16/16, while the wider comparison passed 24/36 baseline and 23/36 candidate and failed a hard-regression gate. Higher total quality did not override that failure. Transfer and reserved fresh cases were not run for that failed revision. The saved v154 development note does not claim a completed live evaluation.

Inspect [the saved run artifacts](../psych-simulator-foundation/adaption/runs/) for raw evaluations, independent review records, hashes, partial runs, and gate results. Preserve the distinction between complete, partial, copied, regression, and previously unseen evidence. A copied artifact does not represent a new run or additional provider usage.

The [release activation guide](../psych-simulator-foundation/adaption/Release%20activation%20guide.txt) and [release tooling](../psych-simulator-foundation/adaption/release-activation.mjs) explain the intended evidence requirements. They are prepared infrastructure, not proof that a release has passed.

## Current software and security verification

The prepared repository's [validation record](VALIDATION.md) reports **476 tests: 475 passed, 0 failed, one expected skip** for the excluded project-local Windows runtime. The focused security suite reports **53 tests: 52 passed, 0 failed, the same skip**. These are publication-copy results, separate from the source record below. The record also describes the local startup and privacy checks and identifies unverified deployment/provider boundaries.

The [source security-hardening test log](../work/psychlab-security-tests-2026-10-10.txt) records 471 passing automated checks. The [security checklist](../psych-simulator-foundation/live/Security%20review%20and%20checklist.txt) describes the implemented boundaries and the controls that are inapplicable because the application has no database, password-registration flow, upload endpoint, or webhook handler.

Run `npm test` and `npm run test:security` in the prepared repository for a fresh result. These use local fixtures and mocked providers. Run `npm run check:privacy` to inspect the packaged files for accidentally included sensitive configuration and identifiers.

Security checks and source scans reduce specific risks; they do not certify production readiness, a live Cloudflare policy, or legal compliance. The hosted identity provider, local machine, deployment settings, and future data-handling changes remain separate trust boundaries.

## Preservation and interpretation notes

- Relative paths retain the original project layout so source records and code can be followed together.
- The source package includes historical builders, diagnostic scripts, review records, and failed evaluations. Their presence does not make them ordinary startup commands.
- Historical development notes and usage totals describe their own revisions. They should not be substituted for a fresh run of this checkout.
- Research counts overlap. Do not add the foundation, personality, disorder, and guide counts and describe the sum as unique studies.
- Case text, equations, and interview prompts include authored choices. Source links do not imply organizational affiliation or clinical endorsement.
- Rights and usage notes remain attached to third-party references. The full licensed DSM-5-TR is not bundled, and no new rights to third-party instruments are granted here.
- Clinical case approval and learner-outcome validation remain future work. A prepared form, a generated report, and an automated pass are not substitutes for those reviews.
