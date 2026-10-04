---
name: critique
description: "Use when someone wants existing thinking attacked, graded, or handed to fresh eyes, not written or summarized. The point is to break the artifact, not produce it. It owns three intents: a skeptical outside read of conclusions, findings, themes, a synthesis, a brief, or a FAQ, from someone who was not in the room; running those findings past hostile lenses (a wary customer, CFO, engineer, competitor) to see where they collapse; and grading a problem statement or one-liner (right altitude, names a real persona, or vague mush) with a score and what is missing. Reach for it on 'give this a fresh adversarial read', 'put this in front of a skeptical X', 'score how crisp this problem statement is', 'poke holes', 'red-team this'. Do not use it to create or restate the artifact. Attacking a whole plan, roadmap, or PRD routes through pressure-test; this skill owns findings, syntheses, problem statements, and panels."
---

# Critique

Run an independent adversarial review of an artifact, evidence, a theme, a problem one-liner, a score, a brief, or a FAQ. The entire value is **independence**: critique never grades work it produced, and never argues to agreement. Run it as a fresh pass (a subagent with its own context; a different model where available).

## Independence (mandatory, read first)

Run as a separate pass with its own context, ideally a different model, so the agent that produced a finding never grades it. A critic sharing the author's context tends to rubber-stamp, which defeats the purpose. Treat the author's reasoning as something to attack, not a position to defend. State in the output that it ran independently.

**Mechanism:** spawn each critic/lens pass as a Task-tool subagent (a general-purpose agent) whose context contains only the artifact under review plus the relevant rubric, not the author's reasoning chain. For high-stakes reviews, prefer a different model. The bounded panel rounds are driven by the parent: collect each subagent's findings, let the author revise, then re-spawn fresh subagents for the next round.

## Three modes, pick by what's under review

### 1. Transition critic (default, lightweight)

Run at any stage handoff (evidence → themes → problem → score → plan). Apply the relevant checks in `../pressure-test/references/critic-checklist.md` plus the always-on cross-stage consistency checks. Return blocking issues (with fixes), suggestions, strengths, and overall readiness (ready / needs fixes / not ready). Every flag must be actionable.

### 2. Crispness grader (for a problem one-liner)

Score the problem statement on the dimensions in `references/crispness-rubric.md` (0-10 each), total it, and **block on any dimension scoring 0**. Return the lowest-scoring dimensions and a one-line rewrite that lifts them. Scale the bar to the stage, an exploratory founder one-liner needs altitude and a named persona, not yet a measured consequence. Flag, don't tyrannize.

### 3. Multi-lens panel (heavy; for a brief, a FAQ, or a high-stakes finding)

Convene the lenses in `references/lenses.md`, skeptical customer, competitor, economics/CFO, feasibility/engineer, contrarian, security/legal (only where relevant). Each lens attacks the answers or findings it owns. Run **bounded rounds (max 3)**; stop early when a round raises no new substantive issue. Terminate every point into one of three states, **never "consensus"**:

- **Resolved**: answered and backed by evidence that clears the gate.
- **Open**: needs data the panel lacks → emit a specific gap question (with where to look) routed to `gather-evidence`. Do not argue it closed.
- **Contested**: a genuine unresolved disagreement → log it as a recorded risk for the human to weigh.

## Calibration

The critic flags; it does not block everything. Match severity to stage: early discovery tolerates thin evidence (flag as a gap); a commit decision does not. An over-eager critic that demands strength-5 proof from a day-one idea is miscalibrated.

## Relationship to pressure-test

`pressure-test` is the entry point for attacking a whole existing artifact (a plan/roadmap/PRD/bet), it runs this engine. `critique` is the general form, usable at any transition, for crispness, or as the panel. One adversarial engine; `pressure-test` is its plan-level door.

## Record

Append findings, the crispness score, and any open/contested items to the investigation's `decisions-log.md`. Critique informs; it does not silently edit the artifact.

## Output

Lead with the verdict. Modes 1-2: blocking / suggestions / strengths / readiness (plus the crispness score and rewrite). Mode 3: each point tagged resolved / open / contested, lead with the count in each state, open items carrying their gap question, contested items carrying the dissent. End with `Next move:` and recommend revising the artifact, gathering the named missing evidence, or pressure-testing it if it is a plan/roadmap/PRD.
