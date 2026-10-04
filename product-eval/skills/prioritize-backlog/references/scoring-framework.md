# Scoring Framework Reference

How Value and Confidence are calculated for problems, and how they map to a recommendation.

## Two scores, two questions

- **Value (0-100):** "If this problem is real, how big is it?", about potential impact, not certainty.
- **Confidence (0-100):** "How sure are we that this problem is real and worth acting on?", about evidence quality and coverage.

These are deliberately separate. Store exact numbers in `.product-eval/<scope>/scores.md` for audit and calibration, but lead user-facing output with bands and recommendations. High value + low confidence = research more. Low value + high confidence = real but not worth building for.

## Value inputs (each 0-25, summed to 100)

**Persona weight (0-25):** Buyer = 25, Admin activation = 20, End-user core = 15, End-user secondary = 10, Edge case = 5.

**Funnel location (0-25):** Retention = 25, Activation = 22, Conversion = 18, Expansion = 15, Engagement = 10, Advocacy = 5.

**Frequency (0-25):** Every user every time = 25, Most users at key moments = 20, Significant segment regularly = 15, Some users sometimes = 10, Rare = 5.

**Competitive pressure (0-25):** Customers leaving over it = 25, Competitors solved it = 20, Competitors building it = 15, Expectation forming = 10, No pressure = 5.

## Confidence (0-100)

Confidence is **computed**, not guessed, so it is reproducible. It builds on total evidence weight (W, deduplicated), source-type diversity, and unresolved contradictions. Recency and first-party-ness are already inside W via the weight rubric, do not double-count them.

```
base       = 100 × (1 − e^(−W / 14))      # saturating; W = total evidence weight (deduped)
diversity  = 0.7 if 1 source type, 0.9 if 2, 1.0 if 3+
penalty    = min(0.3, 0.1 × number_of_unresolved_material_contradictions)
Confidence = clamp( base × diversity × (1 − penalty), 0, 100 )
```

Reference points for `base` (no contradictions): W=8 → 44; W=12 → 58; W=19 → 74; W=26 → 84; W=40 → 94. Interpolate if you can't evaluate the exponential exactly.

Always show the computation, e.g. *"Confidence 67 = base 74 (W=19) × 0.9 (2 source types) × 1.0 (no contradictions)."* A single-source case (diversity 0.7) is capped well below a multi-source one at the same weight, by design, so the gate rewards diversity, not just volume.

The constant 14, the diversity steps, and the penalty are **shipped defaults**, universal across installs. A team can override them for their product via a local `.product-eval/calibration.yml` profile (written by `calibrate`): read the defaults, then apply that profile if present. The defaults themselves change only between plugin versions, never edit them per-install.

## Report bands, not points

The computed number places a band, report the band, not false precision. Map Value and Confidence to labels:

- **Low** (< 40)
- **Moderate** (40-69)
- **High** (≥ 70)

Display e.g. "Value: High; Confidence: Moderate (~60-70)", not "Value: 72; Confidence: 67" in normal chat. The point estimate is computed for placement and calibration; the band is what you present and decide on, so a 2-point wobble never flips a verdict.

## Bounded, logged adjustment

The structured inputs can't see everything, a known-flaky dashboard, a biased sample, a contradiction that resolves on a careful read. After computing the base Confidence you MAY apply **one adjustment of up to ±10 points** for such context. It is not a free hand:

- State the reason and record it in the decisions log (e.g. "−8: the 41% drop comes from a dashboard with a known double-counting bug").
- Cap it at ±10; it may shift the band, which is the point.
- Show the math: "base 74 → 66 after −8 (flaky source)".

This keeps judgment dynamic where it genuinely adds value, while the number stays reproducible and auditable everywhere else.

Always explain the score. Example: "Confidence 72: 12 independent sources across 3 channel types (strong diversity), majority from the last 4 months (recent), but no first-party quantitative data (gap)."

Signal strength (1-5) is an **input** to Confidence, assessed per evidence item and per data source. It does not by itself decide anything.

## Score-to-recommendation matrix

One vocabulary, shared with `decision-readiness`:

| Value | Confidence | Recommendation |
|---|---|---|
| 40+ | High (70+) | **Decide now**: worth building and well-supported |
| 70+ | Moderate (40-69) | **Run a research sprint**: high value, needs more proof |
| 40-69 | Moderate (40-69) | **Run a research sprint**: promising; firm up both |
| 40+ | Low (<40) | **Do not commit yet**: too unproven to act on |
| below 40 | any | **Deprioritize**: prize too small to pursue |

## Proxies when data is thin

When first-party data is missing, score from proxies and mark the result lower confidence:

- Most complaints → drop-off proxy
- Sales objections → conversion proxy
- Churn reasons → retention proxy
- Competitor investment areas → gap proxy

## Ranking criteria (when scores tie or for a quick first pass)

By weight: north-star proximity > persona importance > journey stage > competitive urgency > estimated breadth.

## Overrides

Users may override a score. When they do: require a one-sentence reason, log it in the decisions log, and respect it, but note any discrepancy with the computed score.

## Anti-patterns

- Don't generate items from thin air, trace each to business context or evidence.
- Don't list features as problems.
- Don't be exhaustive, a focused 5-8 ranked items beats 30.
- Don't assume the user's priorities, present the reasoning; they decide.
