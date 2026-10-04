---
name: calibrate
description: Tune and validate the scoring constants (evidence-weight base, diversity factors, gate threshold, crispness bars) against past decisions with known outcomes. Use when the user says "calibrate", "tune the thresholds", "validate the scoring", "the confidence numbers feel off", or has a set of past decisions to check the model against. Reports mismatches and recommended constant changes; never silently changes them.
---

# Calibrate

Check the scoring system against reality. Take past decisions whose outcomes you know, recompute their weight / Confidence / Value / verdict under the current constants, compare to what actually happened, and recommend constant adjustments. The constants ship as heuristics, this is how they earn their numbers.

## Scope, calibration is local, never global

The plugin ships **universal default constants** that every install gets. Calibration does **not** edit those: it writes a **local override profile** (`.product-eval/calibration.yml`) owned by this team/product and read on top of the defaults. So tuning is team-scoped: it travels in your repo, survives plugin updates, and never imposes one team's idiosyncrasies on everyone else's install. The shipped defaults themselves change only between plugin versions, maintained centrally.

## Inputs

A set of **calibration cases**: ideally pulled from your own `decisions-log.md` once its entries have known outcomes (the log accumulates them as you use the tool; you append how each call turned out), or provided directly (see the template in `references/calibration.md`). Each case has the evidence available at decision time (source types, strengths, recency), the decision made, and the outcome, recorded as whether the **problem turned out real** (`problem_was_real`, the calibration target) and, as context only, whether the shipped solution worked (`solution_outcome`). You don't need data upfront, run on the shipped defaults until ~10 decisions have closed.

## Workflow

1. For each case, reconstruct the evidence and compute weight (evidence-quality rubric), Confidence (the scoring-framework formula), and Value; derive the verdict from the matrix.
2. Label each case against whether the **problem turned out real** (`outcome.problem_was_real`), not whether the shipped solution worked:
   - **True positive**: model said Decide now, the problem was confirmed real.
   - **False positive**: model said Decide now, the problem was refuted (over-confident, tighten).
   - **False negative**: model said Run a research sprint / Deprioritize, the problem was confirmed real (under-confident, loosen).
   - **True negative**: model held back, the problem was indeed not real or not worth it.
   Treat `outcome.solution_outcome` as context, not a label input: a real problem can ship a failed solution, and tuning the scoring for that would punish it for the wrong thing.
3. Tally the confusion matrix and identify the dominant error direction.
4. Recommend constant changes, **one lever at a time**: with the expected effect (see the tuning table in the reference).
5. Propose an updated **calibration profile** and, on the user's approval, write it to `.product-eval/calibration.yml` (the local override: see the reference) plus a short calibration report. **Never edit the shipped rubric files**: they stay universal for every install; only the local profile changes.

## Output

The confusion matrix, the dominant error, and a ranked list of recommended constant changes with rationale. Note honestly that small samples are directional, treat as guidance until there are ~10+ cases, and change one lever per round so you can attribute the effect. End with `Next move:` and recommend accepting one local calibration change, collecting more closed decisions, or re-running a high-impact scope with the proposed profile.
