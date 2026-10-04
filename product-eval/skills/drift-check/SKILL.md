---
name: drift-check
description: "Compare an investigation's CURRENT state against an EARLIER SNAPSHOT of itself and report what moved between those two points in time: problem-statement drift, evidence added or retired, Value/Confidence score movement, theme or narrative reframing, and whether confidence is genuinely accumulating or just churning. Use when the user says \"what changed since last month\", \"has this drifted\", \"compare this to the prior version\", \"is the confidence trajectory improving\", or wants to audit a scope before re-deciding. Reads scoped snapshots and git history and runs the cross-stage consistency checks. Do NOT use for finding patterns or trends WITHIN the current evidence set, that is synthesize; nor for reviewing a product-metrics dashboard, that is a metrics review. This is specifically a then-vs-now diff of the investigation. No daemon; runs on demand or on a schedule."
---

# Drift Check

Compare the current state of an investigation scope against a prior snapshot and report what moved. There is no running process: this reads the versioned files (`.product-eval/<scope>/snapshots/` and git history) on demand.

## Workflow

### 1. Pick scope and baseline
Choose the investigation scope and the baseline to compare against, a prior snapshot in `.product-eval/<scope>/snapshots/`, or a git ref.

### 2. Diff the artifacts
- **Problem statement**: has it drifted from the evidence that supports it?
- **Evidence**: items added or removed; total weight change; anything newly retired as stale (e.g. by a changelog check).
- **Themes**: new, faded, or merged.
- **Scores**: Value and Confidence movement, with drivers.
- **Brief / narrative**: has the framing been reworded or reframed?

### 3. Run consistency checks
Apply the cross-stage consistency checks from `../pressure-test/references/critic-checklist.md`: problem-statement drift, persona drift, vanity-metric creep, scope vs evidence proportionality, and circular reversals in the decisions log.

### 4. Report the confidence trajectory
The key signal: is evidence accumulating (Confidence rising as real data arrives) or are you spinning (churn without new evidence)? Say which.

## Output

A short "what moved since <baseline>" summary: scores up/down with drivers, evidence added/retired, problem or narrative drift flags, consistency violations, and the confidence trajectory. Append it to the decisions log. End with `Next move:` and recommend re-running readiness, refreshing evidence, or updating the brief/build brief if the decision changed.

## Scheduled use

Can run as a weekly scheduled task, "what moved this week across my investigations", as a digest, not a service. Offer to set one up when the user tracks an investigation over time.
