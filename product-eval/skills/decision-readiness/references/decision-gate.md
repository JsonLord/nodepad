# Decision Gate Reference

The two-stage gate that decides whether a bet is ready. Stage 1 is binary and blocking; Stage 2 is the graded verdict.

## Stage 1, sufficiency gate (binary, blocking)

The bet is **not ready** if ANY of these fail. Report which floor failed and the specific fix.

- **Total Evidence Weight ≥ 12** (see the evidence-weight rubric), this replaces a raw item count, so quality counts, not volume. Roughly: one strong first-party finding plus corroboration, or several solid moderate items.
- At least **one item rated strength 3+** (a quality floor, weight cannot be bought with many weak items).
- Evidence comes from **more than one independent source type** (diversity floor, dedup same-user/account first, so one voice across channels is not mistaken for several).
- A **non-vague problem statement** exists (passes the altitude test).

These are intentionally hard. Weight is computed on *deduplicated, independent* evidence. A bet that fails any floor cannot be "Decide now" no matter how high Value looks.

## Stage 2, confidence verdict (graded)

If Stage 1 passes, compute Confidence with the formula in `../../prioritize-backlog/references/scoring-framework.md` (show the computation in audit detail), apply any **bounded ±10 adjustment** (logged, with a reason) for context the inputs miss, and report it as a **band**: Low (<40) / Moderate (40-69) / High (≥70), not a bare point. Combine the band with Value and read the outcome:

| Condition | Outcome | Meaning |
|---|---|---|
| Gate passed + Confidence 70+ | **Decide now** | Enough credible, diverse evidence to commit |
| Gate passed + Confidence 40-69 | **Run a research sprint** | Promising; get the specific missing proof first |
| Gate failed, or Confidence below 40 | **Do not commit yet** | Not enough to decide; do not commit |

**Confidence drives the verdict.** Value sizes the prize; Confidence earns the right to act on it. A high-Value, low-Confidence bet should become a research sprint, not a Go.

## Confidence ceiling

Read `.product-eval/<scope>/sources.md`. If the connected source types cannot, even at best, produce strength-3+ first-party diversity, the reachable Confidence is capped (Moderate). Say so explicitly: "Your current sources cap this at Moderate Confidence. To reach Decide now, add [source]." Never report a Confidence the sources can't support.

## Gap questions, format

Every non-"Decide now" outcome must include specific gaps, each with where to look and which source closes it. Good:

- "Do product analytics confirm a drop-off at the permissions step?, check Amplitude/GA4 funnels, or connect them."
- "Have enterprise customers raised this, or only SMB?, segment the support tickets."
- "Is this still true since the Q2 UI change?, check ticket recency."
- "Is the competitor's solution genuinely better or just different?, read their docs and recent G2 reviews."

Avoid generic "needs more research", always name the where and the which-source.

## What this gate does NOT do

It rates the **credibility, diversity, and recency of evidence as described**: it does not verify that a cited number is true. "Enough data to decide" means "enough credible, diverse, recent evidence per the rubric," not "objectively correct." Keep that honesty visible to the user.
