# Reading the archive without confusing it with the current app

The repository intentionally preserves the project's development trail, including failed experiments and superseded drafts. The root README describes the current publication copy. Historical documents keep their original dates and claims so changes can be traced.

| Folder/material | Status |
| --- | --- |
| `psych-simulator-foundation/live/` | Current free-text application and security protections |
| `psych-simulator-foundation/prototype/dist/` | Historical scripted rehearsal; also supplies a scoring dependency used by the live controller |
| `Foundation Handbook.pdf`, foundation data, engineering and review forms | Original 0.1.0 design/reviewer package; some statements predate the live integration |
| `research/` | Dated original notes, citations, authored catalogues, screenshots and model evaluations |
| `adaption/data/` and `adaption/runs/` | Offline datasets and retained experiments, including unsuccessful release gates |
| `work/` | Development utilities, evaluation runners and historical test evidence |
| Root handoff/project-map/debrief text | Sanitized historical orientation and fictional exercise material |

## Scripts with effects

`npm test` runs offline mock/local tests. It does not execute paid evaluation runners, regenerate the historical foundation, activate a model release, or deploy anything.

The `work/run-*` and Adaption scripts can contact a paid provider when explicitly configured. They are research tools, not prerequisites for trying the application. Read their arguments and budget gates before running them. The `work/conversation-qa-server.mjs` diagnostic utility deliberately records fictional provider responses; it is not the production launcher and must never be used for real patient information.

The Python scripts in `work/foundation/` are preserved historical document/site builders. Their original machine paths have been removed. They require an explicitly selected archival output workspace and optional Python document dependencies; they are not part of setup, CI or the normal app. Regenerating these older materials does not update the live implementation or establish a new validated release.

Do not activate a release from redacted historical remote-job metadata. Current release activation requires a complete fresh set of matching runtime/model/pack hashes, evaluations and reviews. An approved example pack by itself is insufficient.

## Evidence labels

- A passing deterministic/mock test supports a software contract, not clinical accuracy.
- A live model transcript is a recorded sample, not a general reliability estimate.
- A reference explains design rationale, not the truth of an authored fictional patient's history.
- An old screenshot documents the UI at that date, not the final current test state.
- A sanitized path or remote-job ID is a publication placeholder; substantive evaluation conclusions remain visible.

The original remote URLs, cloud account configuration, Git history and private packaging material remain outside this repository.
