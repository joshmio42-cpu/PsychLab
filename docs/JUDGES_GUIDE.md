# PsychLab: guide for judges

**Track: AI + Healthcare.** PsychLab gives healthcare and psychology learners a place to practice asking questions, following uncertainty, and connecting conclusions to a fictional person's account. The intended contribution is clearer healthcare conversations through supervised practice. Clinical benefit and learning efficacy remain unproven.

Start with [the project README](../README.md). This guide separates what you can reproduce without credentials from what requires a real model connection.

## A quick evaluation route

| Available time | Suggested action |
|---|---|
| Two minutes | Read the problem, architecture, and evidence table in the README. Check the active/staging distinction. |
| Five minutes, no key | Run the scripted rehearsal below. Inspect the research map and a saved evaluation review. |
| Ten minutes, configured provider | Run a current free-text interview, link evidence, finish the debrief, and inspect the usage display. |
| Technical review | Run `npm test`, `npm run test:security`, and `npm run check:privacy`; follow source links below. |

## Reproduce the original learning workflow without a key

From the repository root, with the pinned Node runtime available:

```sh
npm run demo
```

Open **http://127.0.0.1:8780**. The page identifies itself as a guided review prototype and labels replies **SCRIPTED RESPONSE**. It serves the historical `prototype/dist/` application. It is useful for checking the original learning workflow, not for judging current live AI response quality or the newer eight-profile interface.

1. In **Interview**, choose **Opening** and press **Ask this question**.
2. Ask **Timeline** and **Daily life**. Notice that the transcript assigns turn IDs and preserves an inspectable authored response.
3. Optionally open **Assessment**. Explain the assessment's purpose and acknowledge its two-week timeframe and limits before revealing the fixed fictional GAD-7 response set. This is a simulated client's result, not a personal screening or learner grade.
4. Open **Reasoning** and write a provisional impression or a decision to defer. Fill in evidence, alternatives, uncertainties, and next questions using the account you actually opened.
5. Press **Finish and review evidence**. Inspect topic coverage, exact conversation evidence, and the explicit `NR` ratings. Download the report if useful.
6. Open **Reviewer guide** to inspect the authored case and deterministic agent trace. The historical demo deliberately includes case data in the browser; it is not a blind examination deployment.

Reloading resets this historical rehearsal's tab state. Its behavior differs from the current app's saved browser History. No provider connection, token expenditure, or generative response is involved.

## Inspect the current application

Run:

```sh
npm start
```

Open **http://127.0.0.1:8770**. Without a key, choose a fictional profile, days, seed, difficulty, and case selection, then prepare a frozen history. The interface explains that AI answers need server configuration.

For live responses, privately copy the root `.env.example` to `.env.local`, add your own Featherless key and accessible model ID, and restart `npm start`. Requests can incur provider charges. The repository includes no account credentials or free-credit guarantee.

### Suggested live walkthrough

Choose Jordan, Standard difficulty, 14 recent days, and a named compatible case. A named case makes the demonstration easy to explain; Random is useful for separately checking that the learner is not told the target label during the interview.

| Step | Example action | What to examine |
|---|---|---|
| Prepare | Press **Prepare frozen history**, choose a case, and start preparation. | The preparation phases run locally. A stable record exists before the conversation. |
| Open the account | Ask “What would you like to talk about today?” | Natural patient wording is constrained by recorded evidence. Exact wording may vary. |
| Learn about the person | Ask “What do you usually enjoy doing?” | Personal interests are authored separately from clinical presentation. |
| Follow the response | Ask about a change, its timing, or an example that the actual reply supports. | A usual interest is not automatic evidence of current enjoyment; missing details should remain missing. |
| Record evidence | Link one checklist observation to an answered turn and explain its meaning. | A turn reference makes reasoning inspectable but does not certify the interpretation. |
| Reflect | Complete the five reasoning fields and finish. | The debrief shows useful questions, unanswered areas, evidence-link gaps, and next steps. |
| Inspect the record | Refresh, open History, and download the debrief. | Disclosed content and notes persist as described, while hidden traces are not archived. |

An unsupported or ambiguous question may receive a boundary or be blocked. Keep that outcome visible and explain it. A new live run is not guaranteed to reproduce a saved successful response.

Reviewer traces are available only after completion and when the server grants reviewer permission. Public users without that explicit permission receive their own debrief but not the privileged trace.

## A three-to-five-minute presentation

| Time | Show | Explain |
|---|---|---|
| 0:00–0:30 | The setup screen | Learners need practice moving from a person's account to clear, evidence-based follow-up. All cases are fictional. |
| 0:30–1:10 | Selection and preparation | Personality, biography, and clinical presentation are distinct; the history is frozen before dialogue. |
| 1:10–2:10 | Two or three interview turns | State whether this is a real model call or the historical scripted rehearsal. Follow the actual response rather than promising a particular answer. |
| 2:10–3:00 | Notes and debrief | Connect a claim to a turn, show an alternative and an unanswered question, and explain why ratings remain ungraded. |
| 3:00–3:40 | Architecture and evidence | Explain the router/writer/auditor, local checks, and saved evaluation failures. The optional Adaption pack remains inactive. |
| 3:40–4:10 | Limits and next step | Qualified review and supervised learner evaluation are still needed. The goal is better practice, not automated diagnosis. |

Use this timing as a presentation aid, not a claim about an event-imposed video duration. A recorded demo should keep credentials and personal data out of view and identify any edited or prerecorded live responses clearly.

## How to examine the five judging criteria

The supplied ForgeHacks participant packet assigns equal weight to five criteria. These pointers make the project's claims checkable; they are not a self-awarded score.

| Criterion, 20% each | PsychLab's contribution | Evidence to inspect |
|---|---|---|
| Real-world impact and relevance | Practice clearer healthcare questions, uncertainty, and evidence-based reasoning with fictional cases. | End-to-end workflow; [prepared learner walkthrough protocol](../psych-simulator-foundation/review/student-walkthrough.txt). No participant outcome is claimed. |
| Technical implementation and AI use | Live evidence selection, patient wording, and support auditing, with a stable source record and explicit resource limits. | [Model adapter and roles](../psych-simulator-foundation/live/model.mjs), [controller](../psych-simulator-foundation/live/controller.mjs), [local engine](../psych-simulator-foundation/live/engine.mjs). |
| Innovation and creativity | A conversation anchored to a frozen, inspectable history; personal identity separated from the teaching condition; traceable learner reasoning. | [Identity contract](../psych-simulator-foundation/personality_system/docs/model_contract.md), [conversation memory](../psych-simulator-foundation/live/conversation.mjs), [debrief logic](../psych-simulator-foundation/live/interview-feedback.mjs). |
| Execution and completeness | Reproducible local review, current free-text integration, notes, debrief, exports, tests, and explicit release boundaries. | Run the commands; inspect [live tests](../psych-simulator-foundation/live/tests/) and [development status](../psych-simulator-foundation/adaption/DEVELOPMENT-STATUS-2026-10-09.txt). |
| Presentation and communication | A clearly identified problem, demonstrable workflow, source map, and separation of current features, historical evidence, and future work. | [README](../README.md), this walkthrough, and [research map](RESEARCH_MAP.md). |

## Evidence worth checking closely

- The prepared repository's [validation record](VALIDATION.md) reports **476 tests: 475 passed, 0 failed, one expected local-runtime skip**. Its security subset reports **53 tests: 52 passed, 0 failed, the same skip**. Startup was checked locally; paid provider calls and remote CI execution were not part of this pass.
- The source project's [471-check log](../work/psychlab-security-tests-2026-10-10.txt) records software checks with local fixtures and mocked providers. Rerun the packaged checkout to obtain its fresh result.
- The [earlier 34/36 observation](../research/interview-improvements-2026-10-08/Combined-evaluation-review.txt) is explicitly a composite, not a fresh single run.
- The [v153 record](../psych-simulator-foundation/adaption/DEVELOPMENT-STATUS-2026-10-09.txt) distinguishes a passing 16-case known regression from a wider failed comparison: 24/36 baseline, 23/36 candidate, with a hard regression.
- The [Adaption pilot](../psych-simulator-foundation/adaption/RESULTS-2026-10-09.txt) approved 21 of 25 candidate examples after review. The pack is still inactive because release gates were not met.
- The [model contract](../psych-simulator-foundation/personality_system/docs/model_contract.md) labels authored coefficients and inference gaps. A research citation is not calibration of an equation.

## Clear AI disclosure

In a live interview, Featherless-hosted models perform the routing, wording, and support-audit roles. Local code generates and freezes the case and constructs the debrief. The optional Adaption work is an offline experiment and is not active in the default live flow. Codex supported development, review, packaging, and documentation.

The historical demo has no generative AI connection. Saved transcripts are evaluation artifacts, not live responses. No clinical endorsement, measured educational benefit, deployed public endpoint, or approved optional release is claimed.

## Submission completeness

The participant packet calls for the project/problem description, selected track, a demo video **or** live link, the code repository, and an honest account of what works and what does not. This repository supplies source and local review instructions; it does not by itself establish that a video or hosted demo has been submitted. Build-window eligibility and actual submission details must be reported by the entrant from their own records.
