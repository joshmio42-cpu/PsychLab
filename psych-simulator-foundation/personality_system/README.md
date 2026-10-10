# Personality System

Research foundation and initial integration for the existing PsychLab interview simulator. Start with [the literature review](research/literature_review.md).

- **36 sources** in [the source registry](evidence/sources.json), with access notes and missing metadata left explicit.
- **14 mechanism records** in [the mechanism registry](evidence/mechanisms.json), separating evidence from implementation status.
- **TRAIT / SCHEMA / MOTIVE** definitions in [the construct catalog](data/constructs.json).
- Explicit [authored parameters](data/authored_parameters.json), [trace mappings](evidence/evidence_map.json) and [model contract](docs/model_contract.md).
- A separate [partial-trait population sampler](population/generator.mjs) using [published summary statistics](population/reference.json).
- [Validation results](validation/reports/results.md) and [diagnostics](validation/reports/experiments.json).

The live simulator imports this module. Jordan now has scoped relationship expectations, an observation ledger, situation-dependent goal activation, competing action utilities and source-linked behavior traces. Unknown constructs remain null. Traits and values are held fixed over the short demonstration; this is not a calibrated lifetime-development model. Alex's authored baseline remains unchanged.

After completing a live interview, **Show reviewer trace** includes the research registry and the frozen history. The model receives allowed fictional facts, not hidden personality values or permission to update them. The previous static reviewer rehearsal is a separate historical implementation; these changes apply to the local live simulator.

From `psych-simulator-foundation`:

```powershell
node --test personality_system/tests/*.test.mjs live/tests/*.test.mjs engineering/agents.test.mjs
node engineering/test.mjs
node personality_system/validation/experiments.mjs
node personality_system/population/generator.mjs 10000 42
```

The last command prints moment diagnostics without saving all profiles. To save a new JSON dataset, add a destination path as the third argument; existing files are refused. Counts from 1 to 100,000 are accepted. Every profile explicitly leaves facets, schemas and motives null. [Ten example profiles](data/example_partial_profiles.json) are supplied for inspection. This sampler does not initialize Jordan and is not a validated population generator.

No new dependencies, external requests, questionnaire administration, provider credentials or deployment are introduced by this module. Existing Featherless setup remains in `../live/README.txt`. All executable psychological dynamics remain **EXPERIMENTAL**; passing code checks does not establish human validity.
