# Validation record — 5 October 2026

**Software verification: 76 checks pass. Psychological validity: not established.**

The combined Node suite contains 39 passing checks: 10 personality-module checks, 20 live-controller/model/HTTP checks and 9 existing agent checks. The foundation's separate deterministic suite passes all 37 checks. Provider tests use an explicitly injected mock; no paid/live model request or human study was performed.

Commands, from the foundation directory:

```powershell
node --test personality_system/tests/*.test.mjs live/tests/*.test.mjs engineering/agents.test.mjs
node engineering/test.mjs
node personality_system/validation/experiments.mjs
```

Coverage includes bounded and scoped learning; positive/negative/unknown feedback; duplicate-event handling; rate and reliability sensitivity; no input mutation; unchanged short-run traits and values; context-dependent competing goals; registry references; reproducibility; matrix validity; population dependence; hidden data boundaries; unchanged Alex scoring; and frozen histories. Completed reviewer output contains the source registry; model prompts and learner reports do not contain identity variables or that registry.

## Population diagnostics

Seed 42; published five-domain summary moments; whole-vector rejection at 1–5. Full matrices and differences are in [experiments.json](experiments.json). These are descriptive comparisons against the same source used for construction, not independent validation.

| Profiles | Rejected proposals | Maximum absolute mean error | Maximum absolute SD error | Maximum absolute correlation error |
|---:|---:|---:|---:|---:|
| 10 | 9.09% | 0.2157 | 0.0538 | 0.7334 |
| 100 | 7.41% | 0.1916 | 0.0638 | 0.1385 |
| 1,000 | 10.87% | 0.0774 | 0.0734 | 0.0767 |
| 10,000 | 11.60% | 0.0669 | 0.0692 | 0.0519 |

Small samples are noisy; larger samples still retain systematic truncation distortion. Increasing count does not fix a misspecified joint distribution. The unit test's loose regression tolerances detect broken sampling code; they are not a scientific acceptance threshold. No match of item-level distributions, tails, demographics, schemas or motives is claimed.

## Constructed sensitivity and ablation runs

Thirty alternating feedback observations (two successes, one failure, repeated), starting at .5, produce final cousin expectations .5000, .5727, .6080 and .6272 for learning rates 0, .02, .04 and .08. The friend's expectation stays .5 throughout. This demonstrates rate sensitivity and target isolation; it cannot identify a realistic learning rate.

At tension .3, the work probability changes from .530 to .425 when the goal contribution is removed. In the deliberately constructed support scenario with cousin expectation .8, probability of talking is .623 with all terms, .485 without goals and .563 without the belief term. These ablations expose the model's authored dependencies; they do not validate the choice equation.

## Remaining empirical gates

No parameter recovery, held-out human-data fit, human trajectory comparison, cross-cultural calibration, instrument invariance test, clinician review or educational outcome evaluation has been completed. All executable psychological mechanisms retain **EXPERIMENTAL** status. The organizing architecture and relationship scoping are **THEORETICALLY MOTIVATED**, and the proposed long-term development module is **SPECULATIVE** and unimplemented.

Next: acquire appropriate joint and repeated-measures data with reuse rights; preregister external benchmarks; test simpler alternatives; fit parameters with uncertainty; evaluate held-out prediction and cultural/age transfer. Do not promote a mechanism's status solely because these engineering checks pass.
