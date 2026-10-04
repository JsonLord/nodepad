---
name: design-test
description: Turn a "Run a research sprint" verdict (promising but under-evidenced) into the cheapest experiment that would close the gap, a concrete validating test with a hypothesis, method, sample, effort, and pass/fail threshold. Use when decision-readiness returns Run a research sprint, or when the user asks "how do we validate this", "what's the cheapest test", "how do we de-risk this bet", or has a promising idea with thin first-party evidence. Designs the test; its results feed back into gather-evidence. Do NOT use to pull existing data (that is gather-evidence) or to judge sufficiency (that is decision-readiness).
---

# Design Test

When a bet is promising but under-evidenced (a **Run a research sprint** verdict), the answer isn't to build or to drop it, it's to run the cheapest experiment that would move Confidence past the gate. This skill designs that experiment. It is the bridge that *generates new first-party signal*, where `gather-evidence` only pulls existing data.

## When to run

After `decision-readiness` returns **Run a research sprint** (or **Do not commit yet** with a clear hypothesis), or when the user asks how to validate / de-risk a bet. Read the open gaps from `.product-eval/<scope>/decisions-log.md`, those are exactly what the test must close.

## Workflow

### 1. Name the riskiest assumption
From the gaps, find the single assumption that, if wrong, kills the bet (e.g. "clients miss the email because of spam" vs "they just ignore it"). Test that, not everything.

### 2. Pick the cheapest method that could disconfirm it
Match the assumption to the lightest test that could prove it *wrong* (see `references/experiment-patterns.md`): fake-door / smoke test, landing page + ad, concierge / Wizard-of-Oz, 5-10 interviews, a survey, an A/B test, or an instrumentation change. Prefer lowest cost and fastest signal.

### 3. Set a falsifiable threshold *before* running
State what result counts as pass vs fail, a specific number and window (e.g. "≥15% of ~200 landing visitors leave an email in 2 weeks; below 8% kills it"). No post-hoc goalposts.

### 4. Spec the test
Output: hypothesis · method · audience and sample size · what to instrument · effort/cost · duration · pass/fail threshold. Keep it the smallest test that would change the decision.

### 5. Close the loop
The test produces new first-party evidence (strength 4-5). When results are in, feed them through `gather-evidence`, then re-run `decision-readiness`, Confidence should move, and the bet becomes Decide-now or gets killed honestly.

## Output

A one-page test spec (riskiest assumption · method · sample · instrumentation · effort · duration · pass/fail threshold) plus the explicit "what result would change the decision." Log it in `.product-eval/<scope>/decisions-log.md`. End with `Next move:` and tell the user to run the test, then feed the results back as evidence for a new readiness call.
