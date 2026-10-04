---
name: synthesize
description: "Use when turning gathered evidence (research, tickets, reviews, interview notes, analytics, or weighted evidence items in a folder) into a small set of problem-framed themes or clusters. Also use when someone has a vague observation, complaint, or signal (e.g. 'users keep dropping off in signup') and wants it shaped into a real, crisp problem statement at the right altitude. Triggers on: cluster or group evidence into problems, find the themes or recurring patterns, see what is trending over time, frame this up, is this the right problem, what should we actually build, or feeding candidates into prioritization. Reads scoped evidence, clusters by underlying problem (not topic), detects trends and corroboration, reasons about confidence, names gaps, and writes buildable problem statements that prioritize-backlog can score. Not for gathering or scoring evidence, only for making sense of evidence already collected, or framing a loose pain into a structured problem."
---

# Synthesize

Turn a pile of evidence items into a small set of problem-framed themes, with trend and corroboration analysis, explained confidence, and specific gaps. This is the place where raw evidence becomes buildable problem candidates; do not make users wait for a separate "themes, then problems" step.

## When to run

After evidence gathering. Read `.product-eval/<scope>/evidence/*` (already identity-deduped and weighted).

**Preflight (data contract).** Before clustering, run the conformance preflight in `DATA-CONTRACT.md` (Validation) on `evidence/*`. If an item is malformed (missing `strength` or `weight`, an unknown `source_type`, a dangling `corroborated_by`), stop and report the exact file and field rather than theming around it.

## Workflow

### 1. Cluster into problem-themes

Group evidence by *problem*, not topic: same pain + same persona + same context, ideally from 2+ source types. Method in `references/synthesis.md`: for modest corpora use LLM map-reduce (extract a normalized claim per item, cluster the claims, label each as a problem, not a solution); for large corpora pre-aggregate or embed-and-cluster, then label. Typical result is 2-5 problem candidates; more than 7 means splitting too finely; only 1 means evidence too narrow.

Then **frame each at the right altitude**: the problem-statement formula *[persona] cannot [job] [context] because [root cause], resulting in [business consequence]*, splitting too-broad themes (by persona / journey step / severity / frequency) and lifting too-narrow ones to the underlying problem. In early exploration, return the best-current framing with gaps; for evaluate/validate work, run the **crispness grader** (`critique`) as a gate and rewrite any dimension scoring 0. See `references/problem-framing.md`.

### 2. Detect trends and patterns

Per theme: volume over time (WoW/MoM) and the signal-count bands (3-5 emerging, 6-12 established, 13+ well-known, 50+ fundamental or recent regression). A sudden spike usually signals a recent regression. Record cross-source corroboration, including internal↔external triangulation, and surface contradictions (e.g. analytics show 78% completion while a vocal cluster complains) rather than smoothing them.

### 3. Reason about confidence

For each theme, compute and explain confidence from total evidence weight, source diversity, recency, and contradictions, never just a number ("Confidence 72: 12 items across 3 source types, recent, but no first-party quantitative data").

### 4. Write gaps

Frame specific gap questions, each with where to look and which source would close it.

### 5. Write and hand off

Write `.product-eval/<scope>/themes.md`: per theme, name (problem-framed), member evidence IDs, affected personas, distinct accounts, average strength, total weight, trend, corroboration, contradictions, exact confidence plus confidence band, and gaps, following the theme schema in the data contract (`DATA-CONTRACT.md`). Hand the framed problem candidates directly to `prioritize-backlog` for scoring.

## Output

A scannable problem-candidate list (problem statement, trend, confidence band, top gap) plus the written themes. Lead with the strongest candidate. Do not make build recommendations here, that is the scoring step's job. End with `Next move:` and recommend ranking the candidates, or running readiness on the strongest single bet if the user is already trying to commit.
