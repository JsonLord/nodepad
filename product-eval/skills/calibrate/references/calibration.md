# Calibration reference

## Case template (from your `decisions-log.md` once outcomes are known, or `calibration/cases.md`)
```yaml
- id: case-01
  problem: "the one-liner that was decided on"
  evidence:                 # what was actually available at decision time
    - {source_type: product_analytics, strength: 5, recency_days: 20}
    - {source_type: support_ticket,    strength: 4, recency_days: 30}
  decision_made: "Decide now"        # what was actually decided
  outcome:
    problem_was_real: confirmed      # confirmed | refuted | partial -- THE calibration target
    solution_outcome: succeeded      # succeeded | failed | mixed -- context only, does NOT tune constants
  notes: "problem confirmed real (activation +12pp once addressed); shipped solution also worked"
```

`problem_was_real` is what `calibrate` tunes against, because Confidence predicts whether the problem is real and worth acting on. `solution_outcome` is recorded for context only: a real problem can still ship a solution that flops for build or go-to-market reasons, and letting that move the constants would punish the scoring for the wrong thing.

## Method

For each case: recompute `weight` (evidence-quality rubric), `Confidence` (scoring-framework formula), and `Value` (scoring-framework), then read the verdict from the recommendation matrix. Label each TP / FP / FN / TN against **`outcome.problem_was_real`** (confirmed counts as a real problem, refuted as not, partial as a judgment call), never against `solution_outcome`. The dominant error direction over `problem_was_real` tells you which way to move the constants.

## The calibration profile (config, not code)

Tuned values live in a **local override profile**, never in the shipped rubric. The plugin reads its universal defaults, then applies this file if present:

```yaml
# .product-eval/calibration.yml, overrides the shipped scoring defaults for THIS team/product.
# Written by `calibrate` from your closed decisions. Travels in your repo; survives plugin updates.
version: 1
updated: 2026-06-28
based_on_cases: 14
confidence:
  k: 16                                                # default 14, raised: defaults ran hot (FP-heavy)
  diversity: {one: 0.65, two: 0.9, three_plus: 1.0}    # default 0.7 / 0.9 / 1.0
gate:
  weight_threshold: 14                                 # default 12
crispness:
  evaluate_pass: 60                                    # default 60
  explore_pass: 40                                     # default 40
notes: "Tuned on 14 closed decisions, Q1-Q2 2026."
```

Anything omitted falls back to the shipped default. Scope it to the workspace/product, one team, one product's evidence patterns; investigations into very different domains can keep separate profiles.

## Tuning levers (change one at a time; write the new value to the profile)

| Symptom | Lever | Profile key |
|---|---|---|
| Confidence too high everywhere | raise k (14 → 18) so it saturates slower | `confidence.k` |
| Good bets stuck at Run a research sprint | lower k, or lower the gate weight threshold | `confidence.k` / `gate.weight_threshold` |
| Single-source bets passing that shouldn't | lower the 1-type diversity factor (0.7 → 0.6) | `confidence.diversity.one` |
| Many weak items inflating weight | lower the low-strength base weights (advanced) | propose in report |
| Crispness blocking real problems | lower the stage bar (60 → 55) | `crispness.evaluate_pass` |

## Guardrails

- Change **one** lever, then re-run the cases, so you can attribute the effect.
- Small samples are directional; don't overfit to fewer than ~10 cases.
- The shipped rubric holds the **universal defaults**: never edit it. Write tuned values to `.product-eval/calibration.yml`; the skill proposes, the human approves.
- Watch both error types: tightening to kill false positives will create false negatives. Aim for the balance your context wants (a founder may tolerate more false positives than an enterprise PM).
