# Data Contract

The file shapes every skill reads and writes inside an investigation scope at `.product-eval/<scope>/`. Keeping these stable is what lets skills hand off reliably. Files are markdown with YAML front-matter (or YAML lists), human-readable and machine-parseable.

All paths below are relative to `.product-eval/<scope>/`, except `.product-eval/calibration.yml`, which is workspace-level. Exact computed fields (`weight`, `confidence`, `value`) are stored for audit, calibration, and scorecards. User-facing output should lead with bands and verdicts, not bare point estimates.

## context.md (front-matter)
```yaml
---
scope: tula-q3-eval
job: evaluate            # explore | evaluate | validate | pressure-test | draft
stage: evaluate          # sets the crispness bar: explore = lenient, evaluate/validate = strict
product: "one-line description"
north_star: "metric"
personas: [admin, end_user, buyer]
updated: 2026-06-26
---
```

## evidence/<id>.md (one file per item)
```yaml
---
id: E1
claim: "state the pain, not the solution"
source_type: product_analytics      # taxonomy below
source_ref: "Amplitude › Activation funnel"
persona: [client]
funnel_stage: activation
impact_type: activation
strength: 5                # 1-5 (evidence-quality rubric)
recency_days: 20
weight: 12                 # computed: base-by-strength × recency factor (evidence-quality rubric)
person_id: null
account_id: acct_acme      # if identity-resolved
corroborated_by: [E2]
stale: false               # true if a changelog/release supersedes it
---
optional quote / notes
```
`source_type` taxonomy: product_analytics, support_ticket, sales_call, churn_survey, customer_interview, internal_data, internal_observation, feature_request, app_review, community_post, social_media, competitor_analysis, market_research, blog_or_article.

## identities.md (list)
```yaml
- entity: acct_acme
  grain: account                 # person | account
  matched_records: [intercom:org_812, hubspot:acct_55, amplitude:grp_acme]
  method: email_domain           # email | user_id | email_domain | fuzzy
  match_confidence: high         # high | medium | low
```

## themes.md (list)
```yaml
- id: T1
  name: "problem-framed, 5-10 words"
  members: [E1, E2]
  personas: [client]
  distinct_accounts: 9
  total_weight: 19
  source_types: [product_analytics, support_ticket]
  trend: up                      # emerging | up | flat | down | regression
  corroboration: cross-source
  contradictions: []
  confidence: 67                 # computed (scoring-framework Confidence formula)
  confidence_band: moderate      # low | moderate | high; preferred for chat output
  gaps: ["spam vs ignored?", "funnel confound: agency-abandoned projects"]
```

## scores.md (list)
```yaml
- problem: T1
  value: 72                      # 0-100 (scoring-framework: persona + funnel + frequency + competitive)
  value_inputs: {persona: 15, funnel: 22, frequency: 25, competitive: 10}
  value_band: high               # low | moderate | high; preferred for chat output
  confidence: 67                 # 0-100 (scoring-framework Confidence formula)
  confidence_band: moderate      # low | moderate | high; preferred for chat output
  recommendation: "Run a research sprint"   # ranking tier from the score-to-recommendation matrix
  rationale: "short reasoning"
  override: null                 # {field, to, reason} if a human overrides
```

## decisions-log.md (append-only entries)
```yaml
- date: 2026-06-26
  item: T1
  event: readiness               # readiness | override | critique | drift | doc
  verdict: "Run a research sprint"
  confidence: 67
  confidence_band: moderate
  evidence: [E1, E2]
  open: ["spam vs ignored", "funnel confound"]
  contested: []
  note: "short note"
  outcome:                         # optional; appended later once the bet has closed, read by calibrate
    problem_was_real: confirmed    # confirmed | refuted | partial (the calibration target)
    solution_outcome: succeeded    # succeeded | failed | mixed (context only, does not tune constants)
```

`outcome` is added to a `readiness` entry only when the result is known (often a quarter later). `calibrate` reads it to score the constants: it tunes against `problem_was_real`, never `solution_outcome`. See the calibrate reference.

## calibration.yml (workspace-level, optional)

Lives at `.product-eval/calibration.yml`, workspace/product level, **not** per-scope. Overrides the shipped scoring defaults for this team/product; written by `calibrate`, read by the scoring skills on top of the defaults (anything omitted → shipped default). Schema in the calibrate reference. Absent → the universal defaults apply.

## Computed fields, single sources of truth
- `strength` (1-5) and `weight`, `skills/decision-readiness/references/evidence-quality.md`.
- `confidence` (0-100), `skills/prioritize-backlog/references/scoring-framework.md` (the Confidence formula); stored exactly, displayed as `confidence_band` (Low/Moderate/High) with an optional bounded ±10 logged adjustment, and overridable via `.product-eval/calibration.yml`.
- `value` (0-100) and the recommendation matrix, same scoring-framework reference; store exact `value`, display `value_band` in chat.

Keep these schemas **additive**: skills may add fields, but must not rename or remove the ones above.

## Validation (preflight conformance check)

Skills trust each other's files. A malformed `evidence/`, `themes.md`, or `scores.md` must fail **loudly**, not degrade a downstream skill silently. So every consuming skill runs this preflight on the files it is about to read, and if any check fails it **stops and reports the exact file, field, and violation** rather than guessing past it or proceeding on a partial read. The checks are mechanical (no judgement), so a team can also run them as a script; this section is the single source of truth for what "conformant" means.

**Band rule (used everywhere):** `band(x)` = Low if `x < 40`, Moderate if `40 <= x <= 69`, High if `x >= 70`. A stored `*_band` that disagrees with its stored number is a violation.

**`evidence/<id>.md`**
- Required keys present: `id`, `claim`, `source_type`, `strength`, `weight`, `stale`.
- `id` is unique across the folder and matches the filename (`E1` in `E1.md`).
- `source_type` is in the taxonomy above; `strength` is an integer 1 to 5; `weight` is a number `>= 0`; `recency_days` (if present) is a non-negative integer; `stale` is a boolean.
- Every id in `corroborated_by` / `contradicts` resolves to a real evidence file.
- `person_id` / `account_id`, when not null, resolve to an entity in `identities.md`.

**`themes.md`**
- Each theme has a unique `id`, a `name`, and a non-empty `members` list; every member resolves to a real evidence id.
- `total_weight` equals the sum of member weights within rounding tolerance (`+/- 1`).
- `source_types` is a subset of the taxonomy and is consistent with the members' source types.
- `confidence` is present (0 to 100) and `confidence_band` satisfies the band rule.
- Every id in `contradictions` resolves to a real evidence id.

**`scores.md`**
- Each entry's `problem` resolves to a theme id in `themes.md`.
- `value` is 0 to 100 and `value_inputs` (`persona + funnel + frequency + competitive`) sums to `value`.
- `value_band` and `confidence_band` satisfy the band rule.
- `confidence` equals the same item's `confidence` in `themes.md` (one source of truth; readiness reads, it does not recompute a different number).
- `recommendation` is one of the four verdicts (Decide now / Run a research sprint / Do not commit yet / Deprioritize) and matches what the score-to-recommendation matrix produces from (`value`, `confidence`), unless `override` is set and carries a reason.
- `override` is null or has `{field, to, reason}`.

**`decisions-log.md`**
- Append-only: existing entries are never edited or deleted, only added to.
- Each entry has `date`, `item`, `event`, `verdict`; `verdict` is in the four-verdict vocabulary; `event` is one of readiness / override / critique / drift / doc.
- Every id in `evidence` / `contested` resolves to a real evidence id; `confidence_band` satisfies the band rule.
- If `outcome` is present: `problem_was_real` is one of confirmed / refuted / partial, and `solution_outcome` (if present) is one of succeeded / failed / mixed.

**Cross-file**
- Every theme referenced by `scores.md` and `decisions-log.md` exists in `themes.md`.
- `context.md` front-matter is present and has at least `scope`, `job`, `stage`.

A passing preflight means the files are structurally sound and internally consistent; it does **not** vouch for whether the evidence is true. These checks are also implemented as an optional script, `scripts/validate_scope.py` (run `python scripts/validate_scope.py .product-eval/<scope>/`; needs PyYAML, exits non-zero on any violation), for CI or a pre-commit hook. `examples/activation-q3/` is a conformant fixture to test the checks against.
