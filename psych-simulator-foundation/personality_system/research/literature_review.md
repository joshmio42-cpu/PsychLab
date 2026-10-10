# IDENTITY: research foundation and implementation decisions

Research date: 5 October 2026. Scope: the existing interview simulator, with a dedicated personality module. This report was written before the implementation described below. It is a targeted literature synthesis, not a preregistered systematic review or an empirical validation of PsychLab.

## 1. Architecture

IDENTITY owns relatively persistent dispositions, learned beliefs and valued goals. Separate **TRAIT**, **SCHEMA** and **MOTIVE** because a tendency, an expectation and a desire are different explanations. Being sociable does not imply expecting a particular friend to be supportive, and wanting contact does not imply choosing it in every situation.

The [cognitive-affective personality system (Mischel & Shoda, 1995)](https://pubmed.ncbi.nlm.nih.gov/7740090/) motivates situation-dependent response patterns; [Cybernetic Big Five Theory (DeYoung, 2015)](https://doi.org/10.1016/j.jrp.2014.07.004) distinguishes broad dispositions from goals, interpretations and strategies. These are organizing theories, not validated executable specifications. Neither establishes PsychLab's coefficients.

## 2. Search and appraisal

Searches covered Big Five measurement and replication, trait states, HEXACO, temperament, impulsivity, domain-specific risk, persistence, self/relational schemas, efficacy, attachment, social learning, attribution, needs, values, goal systems, cultural measurement and longitudinal change. Sources were compared across author teams and methods. Meta-analyses, original experiments, longitudinal studies, measurement papers and author/university resources were prioritized. Popular summaries were excluded from the evidence registry.

The registry records what was actually accessible: original publication abstracts, indexed original-paper excerpts and selected full-text sections. Some PMC/publisher full-text requests were blocked; this review does not claim full-text appraisal of every paper. Missing sample sizes, author lists or metadata remain null or explicitly partial. Search date is not publication date. This is a broad foundation with targeted quantitative extraction, not an exhaustive review through 2026; citation chaining, recent replications and formal risk-of-bias assessment remain necessary.

## 3. Trait structure and evidence

Use a five-domain, fifteen-facet **catalog**, following [Soto & John (2017)](https://www.colby.edu/wp-content/uploads/2013/08/Soto_John_2017.pdf). Store measured scores separately from model parameters. Unmeasured facets stay null. No questionnaire items are copied. The domain sampler uses Study 3's Internet-sample summary statistics, not clinical norms.

[Fleeson & Gallagher (2009)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2791901/) found substantial within-person state variation across 15 experience-sampling studies. Traits constrain distributions of responses; they should not select a fixed line of dialogue. [Soto's replication project (2019)](https://pubmed.ncbi.nlm.nih.gov/30950321/) replicated many trait–outcome associations, generally with smaller effects than the originals. Neither result licenses deterministic trait-to-behavior rules.

Consider [HEXACO (Ashton & Lee, 2007)](https://pubmed.ncbi.nlm.nih.gov/18453460/) as an alternative measurement family. Its changes extend beyond adding honesty–humility; do not combine overlapping scales by summing them. Childhood temperament evidence ([Compas et al., 2004](https://pubmed.ncbi.nlm.nih.gov/15028538/)) informs developmental questions but does not directly calibrate an adult character.

## 4. Complementary dispositions and overlaps

[Cyders & Smith (2008)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2705930/) distinguish emotion-related urgency from sensation seeking and deficient planning/perseverance. Novelty preference is a candidate extension, not a synonym for openness or impulsivity. [Weber et al. (2002)](https://business.columbia.edu/sites/default/files-efs/imce-uploads/CDS/dospert%202002.PDF) distinguish risk domains and perceived risk from willingness to act. Keep social, recreational and financial risk separate when evidence is collected.

[Credé et al. (2017)](https://pubmed.ncbi.nlm.nih.gov/27845531/) report substantial overlap between grit and conscientiousness; adding both as independent persistence bonuses would double-count related information. Social sensitivity can concern threat appraisal, rejection expectations, affiliation or emotion-related responding. It is not one calibrated universal scalar. The existing `threatSensitivity` remains a labeled authored adapter, with no conversion from a Big Five score.

## 5. Schema structure

Schemas need a **target and proposition**: self-worth; capability for a specified task; expected availability of a named relationship; general beliefs about others; perceived control in a domain. Separate expectation strength, observations supporting it and uncertainty about it. A simulation belief on [0,1] is not a psychometric attachment score.

[Markus (1977)](https://web.stanford.edu/~hazelm/cgi-bin/wordpress/wp-content/uploads/2011/02/1977_Markus_Self-Schemata-and-Processing-Information-About-the-Self.pdf) links self-schemas with processing self-relevant information. [Baldwin (1992)](https://www.selfesteemgames.mcgill.ca/research/baldwnpsybull.pdf) organizes relational schemas around self, other and interaction scripts. [Fraley et al. (2011)](https://web-research-design.net/PDF/FHV%26B2011.pdf) provide evidence for relationship-specific attachment representations. Consequently, support from a cousin must not automatically repair expectations about a friend, or transform a global self-concept.

## 6. Efficacy, attribution and self-esteem

[Bandura et al. (1977)](https://pubmed.ncbi.nlm.nih.gov/15093/) connect mastery-related experiences, efficacy expectations and behavior in a specific experimental setting. Efficacy is domain-specific; it is not self-esteem. [Vancouver et al. (2001)](https://pubmed.ncbi.nlm.nih.gov/11519645/) challenge an unconditional positive efficacy→performance assumption. Performance can change efficacy, while efficacy's prospective effects depend on task and analysis level. Do not turn confidence into a guaranteed success bonus.

[Weiner (1985)](https://doi.org/10.1037/0033-295X.92.4.548) distinguishes perceived locus, stability and controllability of causes. An unexplained cancellation supports uncertainty; it does not establish intentional rejection. Store alternative interpretations without treating hidden WORLD information as knowledge available to the client.

[Harris & Orth (2020)](https://pubmed.ncbi.nlm.nih.gov/31556680/) find reciprocal longitudinal associations between relationships and self-esteem. Their pooled coefficients are not per-event learning rates. Global self-esteem remains unscored in this implementation.

## 7. Motivation structure

Separate enduring **values**, psychological **need experiences**, current **goals**, and the **activation** of those goals in a situation. [Ryan & Deci (2000)](https://pubmed.ncbi.nlm.nih.gov/11392867/) distinguish autonomy, competence and relatedness. Security and recognition may be goals/values, but are not extra basic needs established by that three-need theory. Their [intrinsic/extrinsic account](https://pubmed.ncbi.nlm.nih.gov/10620381/) distinguishes forms of regulation; externally oriented action can be personally endorsed.

[Chen et al. (2015)](https://doi.org/10.1007/s11031-014-9450-1) examine need satisfaction and frustration across four cultures. Frustration should not simply be computed as one minus satisfaction. [Baumeister & Leary (1995)](https://pubmed.ncbi.nlm.nih.gov/7777651/) support belonging as a broad motivational concern, not a requirement that every person seek contact whenever possible.

## 8. Goals, values and conflict

[Situated expectancy-value theory (Eccles & Wigfield, 2020)](https://doi.org/10.1016/j.cedpsych.2020.101859) distinguishes expectancy, interest, utility, attainment and cost. [Goal systems theory (Kruglanski et al., 2002)](https://doi.org/10.1016/S0065-2601(02)80008-9) allows shared means and competing ends. [Elliot & Thrash (2002)](https://doi.org/10.1037/0022-3514.82.5.804) link approach/avoidance dispositions with goals without equating them.

For Jordan, reliability can favor finishing a task while recovery favors pausing; connection can favor talking while recovery favors resting. Availability constrains choices before goal utility is evaluated. Neither motive disappears when the other wins. Values persist while activation changes by event. The implementation's utility table and probability weights are experimental design choices; they have not been estimated from those theories.

[Schwartz et al. (2012)](https://pubmed.ncbi.nlm.nih.gov/22823292/) describe a circular organization of values with compatibility and conflict. Use it as a structural hypothesis, not an exact negative-correlation rule or a mutually exclusive personality type.

## 9. Dependence between variables

[Parks-Leduc et al. (2015)](https://pubmed.ncbi.nlm.nih.gov/24963077/) synthesize associations between traits and values; they remain distinguishable constructs. [Fischer & Boer (2015)](https://pubmed.ncbi.nlm.nih.gov/25142346/) show contextual variation in such relationships. These literatures may share primary studies: two meta-analyses are not automatically two independent replications.

We do not have a verified joint dataset measuring all proposed traits, schemas, motives, ages and contexts. Filling those gaps with independent random scores, or a causal graph made from separate pairwise correlations, would fabricate structure. Preserve unknowns and record the missing calibration explicitly.

[Molenaar (2004)](https://doi.org/10.1207/s15366359mea0204_1) explains why between-person relationships generally cannot substitute for within-person dynamics. Population covariance and daily learning require different data and validation.

## 10. Population design

Implement the simplest supported prototype: seeded correlated normal draws in five domain dimensions using a published covariance matrix, rejecting complete vectors outside the original 1–5 scale. Retain full vectors to preserve dependence better than independent clipping. Truncation still changes means, variances and correlations; report that distortion. Continuous draws approximate aggregated scores and do not reproduce item-level discreteness.

The numerical reference is an adult convenience sample, not a population census. A seed produces reproducibility, not authenticity. Every row states **partial trait profile**, with schemas, facets and motives uncalibrated. Jordan's authored identity is not secretly replaced by one of these rows. Generate 10, 100, 1,000 or 10,000 profiles without claiming a validated full synthetic population.

Next methods depend on better evidence: empirical multivariate resampling if joint data and reuse rights are available; hierarchical models if adequate age/culture strata are measured; copulas if measured marginals and dependence justify them; mixtures only if replicated subgroup structure improves held-out fit. Avoid invented personality clusters. Add longitudinal models only with repeated within-person measurements.

## 11. Cultural and age limits

[Gurven et al. (2013)](https://doi.org/10.1037/a0030841) challenge simple universal transfer of a Big Five instrument's factor structure in a Tsimane sample. Measurement, language, response styles and sampling matter. Failure to recover the same factors does not imply absence of individual differences. The current sampler is not calibrated for Filipino participants, children, clinical groups or every cultural setting. Jordan's age of 26 is authored; no demographic stereotypes or inferred ethnicity determine their scores.

Before local calibration: use suitable translations, cognitive interviews, measurement-invariance checks and representative recruitment. Do not apply a sex, ethnicity or age multiplier based on convenience-sample averages.

## 12. Development and timescales

FAST: activation and emotional state can differ by situation. MEDIUM: task/relationship beliefs can respond to evidence, but no universal duration or learning constant is established here. SLOW: traits and long-term values require longer observations; slow does not mean immutable.

[Bleidorn et al. (2022)](https://pubmed.ncbi.nlm.nih.gov/35834197/) synthesize stability and change across the lifespan, revising some earlier rank-order stability conclusions. [Schwaba & Bleidorn (2018)](https://pubmed.ncbi.nlm.nih.gov/28509384/) show heterogeneous individual change trajectories over years. [Roberts et al. (2017)](https://pubmed.ncbi.nlm.nih.gov/28054797/) find trait-measure change during interventions averaging about 24 weeks, using mixed study designs. None supplies a valid daily trait decrement after one cancellation.

Keep traits and values fixed during this 28–90-day authored demonstration. This is an engineering scope choice, not a scientific claim that short-term trait change is impossible. Months/years development requires a future calibrated module and explicit life context; no fake lifetime simulation is introduced.

## 13. Experience and learning

[Will et al. (2017)](https://elifesciences.org/articles/28098) model social feedback, prediction errors and self-esteem within a laboratory task. This supports investigating learning models, not transferring fitted task parameters to everyday support expectations.

The initial experimental schema rule is `new = old + learningRate × reliability × (observation − old)`, applied only to observed feedback from the relevant relationship. Defaults are authored and separately labeled. Evidence records are unique by event ID; repeated replay of a memory cannot create new independent evidence. Ambiguous cancellations have no observed support outcome, so no support-expectancy update occurs. A later credible failure to provide promised support could support a negative update; the current world does not author such an outcome.

Keep salience, emotional significance and memory accessibility as future tested moderators. Multiplying them together now would create unidentifiable parameters. Broad schema generalization, attribution-dependent learning and trait development remain proposals, not hidden implemented features.

## 14. CORTEX connection

CORTEX receives event observations, relevant relationship expectation, body state and retrieved memories. It produces an interpretation with uncertainty plus an appraisal. It does not receive hidden causes. The current four interpretations and pressure equation remain authored placeholders. IDENTITY supplies scoped expectations; CORTEX cannot write trait or schema values. Appraisal coefficients remain experimental even though their inputs refer to recognizable constructs.

## 15. AFFECT connection

AFFECT owns tension and mood burden, not traits. It receives appraisal and returns a bounded state. The existing decay, carryover and recovery constants are explicitly retained as uncalibrated. Distinguish trait negative emotionality, a current emotional state and a clinical symptom measure. No diagnosis or screening score is calculated from these model values.

## 16. MNEMOSYNE connection

MNEMOSYNE stores observation, interpretation, action outcome and subjective experience separately, with event identity. Retrieval remains a simple last-two matching-event rule. This is computational scaffolding, not a validated account of autobiographical memory. The IDENTITY learning ledger cites actual experienced outcomes, preventing replay from being counted twice. Memory bias, forgetting and reconsolidation need separate evidence and experiments before implementation.

## 17. SOCIAL connection

SOCIAL chooses among feasible actions using event-relevant goal contributions, scoped expectation and current tension. The trace records alternatives, probability, random draw, selected action, contributing variables and mechanism IDs. WORLD resolves consequences; success is not asserted by the LLM. Motive activation can change without rewriting enduring values.

## 18. Evidence strength, disagreements and limits

Use separate fields for evidence about a construct and validation of a computational rule. **VALIDATED** requires matching population/task and external empirical tests. **PARTIALLY VALIDATED** needs some relevant empirical tests with material gaps. **THEORETICALLY MOTIVATED** covers a proposed structure. **EXPERIMENTAL** covers executable uncalibrated rules. **SPECULATIVE** covers untested extensions. Passing software tests does not promote a psychological rule to validated. Confidence labels are engineering judgments, never scientific probabilities.

Conflicts to preserve: [Deci et al. (1999)](https://selfdeterminationtheory.org/wp-content/uploads/2014/04/1999_DeciKoestnerRyan_Meta.pdf) and [Cameron et al. (2001)](https://pmc.ncbi.nlm.nih.gov/articles/PMC2731358/) differ in conclusions about rewards and intrinsic motivation; task interest, reward contingency and analytic grouping matter. No generic reward penalty is implemented. Efficacy can relate differently to performance across designs and levels. Broad personality structure transfers imperfectly across settings. Trait stability coexists with change. Realistic-sounding dialogue cannot resolve these disagreements.

## 19. Validation programme and open questions

Engineering checks now: registry references resolve; state is bounded; event replay is idempotent; learning is relationship-specific; unknown outcomes do not become rejection; traits and values remain stable; seeds reproduce results; provider/client projections exclude hidden state. Population diagnostics compare generated moments with published targets and expose truncation error. Sensitivity and ablation runs check which authored coefficients control behavior.

Empirical gates still required: held-out distribution fit including tails; replication of measured associations in an appropriate sample; parameter recovery from known synthetic trajectories; comparison with no-learning and alternative-learning models; prediction on held-out repeated observations; calibration across culture/age; invariance and missing-data analysis; externally reviewed educational usefulness. Known-group comparisons must use defensible measured groups, not demographic stereotypes.

Open questions: Can positive-only authored feedback identify a learning rate? No. What data identify both learning and observation noise? How should evidence generalize across relationships? Which goals are actually accessible in each situation? Are within-person changes distinguishable from measurement error? Do richer models outperform simpler ones? What local sampling and instrument rights are available? No universal full-personality covariance, developmental equation or human-realism score has been established.

## 20. Roadmap and traceability contract

1. Register sources, constructs, disagreements, evidence levels and numerical provenance.
2. Implement scoped beliefs, context-dependent competing goals and deterministic trace links inside the existing engine; keep LLM output outside the state transition API.
3. Provide a separate partial-trait population sampler and diagnostics, explicitly experimental.
4. Collect or license appropriate joint and repeated-measures data; preregister benchmarks and calibration choices.
5. Fit and compare schema, motivation and developmental models; seek independent review before stronger claims or wider deployment.

Trace chain: selected behavior → contributing variable paths → versioned rule and coefficient provenance → mechanism → source-specific finding → original publication. The registry must also expose the gap where a theory motivates a relationship but does not estimate the executable rule. No scientific citation is used to disguise an authored constant.
