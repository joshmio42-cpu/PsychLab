# Publication-copy validation

Prepared 10 October 2026. This record describes the separate GitHub-ready repository, not a deployment or clinical validation.

## Automated software checks

The full package test command is:

```sh
npm test
```

Result on Windows with Node **24.21.0**: **476 tests, 475 passed, 0 failed, 1 skipped**. The [full test log](validation-tests.txt) is included. The skipped check needs a downloaded project-local Windows runtime, which is intentionally excluded from the publication copy. The source working project had already passed its separate 471-check suite with that runtime installed; its retained log is in `work/psychlab-security-tests-2026-10-10.txt`.

The additional package tests cover the scripted demo's asset boundary, private-file and cross-origin denial, production child-process environment, the offline fetch guard, and the publication scanner. Tests use mock providers and local HTTP servers; no paid provider request was performed. A test preload blocks external `fetch` calls, and the runner removes inherited provider secrets before invoking test processes.

The security subset, `npm run test:security`, also passed: **53 tests, 52 passed, 0 failed, 1 skipped** for the same absent local runtime. The prepared GitHub Actions workflow pins its action revisions, requests read-only repository permission and runs checks on Windows and Ubuntu. The workflow has **not** run on GitHub because the repository has not been uploaded; Ubuntu execution is configured, not claimed as verified here.

## Startup smoke checks

- `npm run demo` starts the explicitly scripted historical rehearsal, serves its expected assets, and refuses private files or live API paths.
- `npm start` starts the current application without a provider key and reports that no live provider is configured.
- Private configuration requests return 404; hostile-origin requests return 403.
- Smoke checks used fresh local ports and stopped only their newly started processes. No existing PsychLab session or public deployment was restarted.
- The historical Python builders parse successfully and now require an explicit separate archival output workspace before writing.

These checks verify reproducible local startup and boundary behavior. They do not verify a provider account, paid live AI response, public Cloudflare login, email delivery or current hosted endpoint.

## Publication privacy checks

Two different reviews were used: the included heuristic scanner and an independent comparison against privately retained known account/workstation identifiers. The private marker list itself is not published. No known API credential, private identifier, personal account email, real signed download URL or original workstation path remained in the inspected publication files.

The 28-page foundation handbook is byte-identical to the reviewed source PDF and contains no detected private metadata or account links. Forty-four retained images contain project UI or rendered handbook pages; Cloudflare account screenshots are excluded. Original source resources were preserved except the exclusions and metadata redactions listed in [the publication inventory](publication-inventory.json).

Run `npm run check:privacy` before staging changes, and see [the privacy guide](PRIVACY_AND_PUBLICATION.md) for the stronger folder-export check and its limits. Recognizable test credentials and adversarial signed-URL placeholders are explicitly fictional; the scanner's only special-case exception is the exact reviewed dummy signature in one test.

## Security and research evidence

The earlier security-hardening work included a focused Codex Security Standard scan of five application boundaries. It recorded zero remaining reportable findings with **partial coverage**, including a warning that code changed during remediation and the scan's initial snapshot was not an immutable final deployment digest. The [retained security checklist](../psych-simulator-foundation/live/Security%20review%20and%20checklist.txt) documents implementation, assumptions and controls that do not apply to the current architecture.

This publication pass does not claim a new exhaustive penetration test. Saved model experiments, unsuccessful release gates, uncalibrated simulation assumptions and missing clinical/learner validation remain visible in [the research map](RESEARCH_MAP.md). No simulation, software test count or source citation is presented as evidence of medical effectiveness.
