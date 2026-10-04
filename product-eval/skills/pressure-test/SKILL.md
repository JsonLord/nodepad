---
name: pressure-test
description: "Use when the user wants an existing plan attacked rather than built, they have a roadmap, plan, PRD, bet, or strategy and want you to find what's wrong with it before they commit. Triggers on any adversarial-critique intent: tear it apart, find the holes, poke holes, play devil's advocate, stress-test, pressure-test, challenge the assumptions, what are we missing / not seeing, where will this break, why might this fail, talk me out of this, red-team it. The defining signal is skeptical scrutiny of a decision the user is about to make. Surfaces thin evidence, hidden or unexamined assumptions, wrong scope, and drift, then returns blocking issues, suggestions, strengths, and a ready/needs-fixes/not-ready verdict. Do NOT use for generating new ideas, brainstorming directions, writing or updating a plan/PRD/roadmap, or reviewing metrics and status updates, this only critiques something that already exists."
---

# Pressure Test

Adversarial review of an **existing** plan, roadmap, PRD, bet, or strategy, find what's wrong before the user commits. This is `critique` pointed at a whole artifact: it runs the same independent adversarial engine, so there is one critic, not two.

## Workflow

1. Take in the artifact and its supporting evidence/scores from `.product-eval/<scope>/`.
2. Run **`critique`** on it: the multi-lens panel (skeptical customer, competitor, CFO, engineer, contrarian, security) plus the `critic-checklist.md` checks (evidence→solution, solution→ship, cross-stage consistency) and a **scope-mode** recommendation (Expand / Hold / Reduce). Run it independently (a fresh-context subagent; a different model if available) so it does not rubber-stamp.
3. Hunt counter-evidence and force hidden assumptions into the open; check that metrics are not vanity and that success criteria are falsifiable.
4. Terminate each point as resolved / open (→ a gap routed to `gather-evidence`) / contested (→ logged dissent), never argue to consensus.

## Output

Blocking issues (with fixes), suggestions, strengths, a scope-mode call, and an overall **ready / needs fixes / not ready** verdict. Append the findings to `.product-eval/<scope>/decisions-log.md`. Lead with the verdict and the blocking issues. End with `Next move:` and recommend fixing the blockers, writing the decision memo, making the build brief, or using critique if the artifact is only a finding/problem statement rather than a full plan.
