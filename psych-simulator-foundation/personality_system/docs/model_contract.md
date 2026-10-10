# State, evidence and integration contract

## Ownership

IDENTITY owns traits, relationship beliefs, values and activated goals. CORTEX proposes an appraisal; AFFECT owns current emotion; MNEMOSYNE records observations and subjective interpretations; SOCIAL chooses among authored available actions; WORLD resolves authored outcomes. The engine alone commits the next day after bounds checks. Model-generated language is outside this update interface.

`models/identity.mjs` exposes four main operations: `createIdentity`, `activateMotives`, `chooseAction`, `learnFromObservation`. Inputs are structured engine data, not text from the language model. These functions return proposals rather than mutating their inputs. `supportExpectation` requires a known relationship; a null relationship uses a neutral computational baseline solely for the choice equation.

Each observation has an event ID. Identical repeated feedback cannot update twice; conflicting feedback under an existing event ID is rejected. Null feedback does not enter the learning ledger. Reliability is an authored weight in [0,1], not measured certainty. The observation count is not a confidence interval. Current schema learning only models support availability, not attachment style, self-worth or all beliefs.

## Equations and parameter origin

All entries below are engineering assumptions. Research motivates distinctions and possible directions; it does not estimate these constants.

| Rule | Current computation | Provenance |
|---|---|---|
| R-INIT | threat adapter .55; relationship expectation .5; connection/reliability .7, autonomy .6, recovery .5 | Authored Jordan profile |
| R-GOAL | activation = priority × event relevance; utility = sum(activation × action fit) | Authored relevance/fit table in parameters JSON |
| R-CHOICE | clamp(.5 + .3 × utility difference + .2 × (expectation − .5) − .25 × tension) | Unfitted probabilistic decision scaffold |
| R-LEARN | expectation += .08 × reliability × prediction error | Experimental transfer from task-learning ideas; max rate .08 |
| R-BODY | energy = clamp(previous × .6 + .35 − draw × .18) | Existing physiology placeholder |
| R-MEMORY | retrieve last two matching event kinds | Existing retrieval placeholder |
| R-APPRAISAL | pressure = clamp(load × .45 + threat × .2 + (1−energy) × .15 + mean recalled pressure × .1 − relevant support expectation × .15) | Existing pressure formula; support subtraction only for the cousin's supportive event |
| R-AFFECT | tension = clamp(previous × .6 + pressure × .4); burden = clamp(previous × .9 + tension × .1) | Existing affect placeholder |
| R-OUTCOME | rest/sketch/received support reduce tension by .08 | Authored outcomes; burden currently uses pre-recovery tension |
| R-TRAIT-HOLD | no change in traits or enduring values | Short-demo scope, not empirical zero-change estimate |
| Subjective wording | post-recovery tension > .35 selects hesitant wording | Rendering assumption, not a clinical cutpoint |

The world still samples four event types uniformly and has no authored failed support interaction. Thus the default story supplies only positive support-learning evidence, and cannot identify asymmetric learning or a negative-update parameter. Direct negative feedback is supported and tested by the module, but is not fabricated into Jordan's world. Events, energy, emotion and consequences remain simplistic.

## Reading a trace

Inspect `snapshot.trace[day].steps` in the reviewer result. SOCIAL includes alternatives, each goal's utility contribution, the probability terms, draw and selected action. Its `evidence` entries identify rule, mechanism, evidence status, source IDs and the inference gap. IDENTITY includes before/after expectation, prediction error and update reason. MNEMOSYNE stores the event ID that connects outcome and learning.

Resolve rule IDs with `explainRules` or the `personalityEvidence` bundle returned by the existing gated reviewer endpoint. `snapshot.personalityEvidence.digest` fingerprints the source registry, mechanism registry, evidence map, catalog and authored identity parameters. The engine version identifies legacy numerical rules. These values are part of the frozen snapshot hash.

Example: choosing to talk → `motive.activation.connection` and cousin expectation → R-GOAL/R-RELATION/R-CHOICE → the respective mechanism records → finding summaries → original source URLs. The trace states explicitly where the executable equation has no fitted empirical support.

## Population boundaries

Five domain draws share a correlated latent Gaussian vector. Complete vectors outside [1,5] are rejected. This prevents out-of-range scores but alters moments and tails. There is no adjustment pretending to recover the exact published distribution. Profiles are continuous approximations, not actual questionnaire response patterns. Counts up to 100,000 are an engineering capacity, not a claim of statistical representativeness.

No transform converts these domain scores into the threat adapter, relationship beliefs or motive weights. Such a transform would require appropriate joint data and empirical validation. A partial profile is deliberately not accepted as a complete IDENTITY object.

## Migration and compatibility

Live engine version changes from `life-history-0.1.0` to `life-history-0.2.0`. The old global `schema.supportExpected` is replaced by `schema.relationships.<actor>.supportExpected`; old motive scalars move to `motive.values`. Histories and hashes consequently change for the same seed. Previously exported snapshots remain historical records and are not silently rewritten. New process startup loads the registry once; restart to load changed research files. Existing sessions in an older process retain their older implementation.

The hosted/static prototype, canonical Alex case and handbook are not rewritten. The live HTTP allowlist does not serve research or identity files. Reviewer evidence remains behind the existing completed-session gate. No live model quality or deployed integration is claimed.
