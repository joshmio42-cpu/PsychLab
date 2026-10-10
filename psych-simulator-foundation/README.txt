PSYCHOLOGICAL INTERVIEW SIMULATOR FOUNDATION
Prepared 2026-10-05 | version 0.1.0

Start with Foundation Handbook.pdf. Open prototype/dist/index.html through a local web server, or use the published private rehearsal:
https://example.invalid/archived-demo
Owner access only; the downloadable reviewer materials can be used separately. The rehearsal uses fixed authored responses, not a live AI model. Hidden case data is deliberately included for review; this is not an exam deployment.

Contents
data/ case, rubric, sources, fixtures and checklist status
review/ clinician form, student protocol and sample debrief
engineering/ prompts, provider adapter and automated checks
prototype/ guided rehearsal source and private Site configuration

Run local preview with Python 3: python -m http.server 8765 --directory prototype/dist
Then open http://localhost:8765 in a browser.
Run checks: node engineering/test.mjs

Current limitations
Qualified case review and a real student session are pending. The user can arrange a reviewer. GAD-7 wording is cross-checked with an NHS-hosted form; fictional responses still need expert review. Live provider calls and generative feedback are not enabled. No data retention beyond the current tab; reset/reload discards the session, while report downloads remain on your device.

Technical direction
Use a server-held Featherless credential and selected model ID for the supplied provider adapter. Never put a key or hidden case in a browser bundle. A validated fact-ID list does not guarantee semantic fidelity. Do the proposed adversarial and clinical review before a live learner pilot.

Event submission
Working AI capability, public demo video, source repository/README and screenshots or test access are still needed. The guided rehearsal alone is not a completed AI hackathon entry. Do not claim APA endorsement, clinical validation, or measured educational benefit. Preserve sources and third-party notices.

Agent integration (local update, 2026-10-05)
Interview topics now pass through deterministic agent modules. Open Reviewer guide > Inspect interview agents for the trace. See design/Interview agent integration.txt for scope and boundaries. Run node --test engineering/agents.test.mjs for agent checks. The handbook, ZIP and published Site remain pre-agent snapshots.

Experimental AI interview (local update, 2026-10-05)
The live/ folder adds a server-held case, reproducible 28-day generated history, free-text Featherless routing/rendering/audit, and a frozen interview snapshot. Start with live/README.txt. Alex remains the authored baseline; generated Jordan has no invented GAD-7 score. No real provider call or public deployment has been verified.

Personality research (local update, 2026-10-05)
Start with personality_system/README.md and research/literature_review.md inside
that module. A 36-source registry informs the TRAIT / SCHEMA / MOTIVE design.
Live Jordan now has relationship-specific learning, competing contextual goals
and evidence-linked reviewer traces. Population generation is a separate partial
trait prototype with explicit distribution diagnostics. The scientific validity
of executable dynamics remains unestablished; 76 engineering checks pass.
