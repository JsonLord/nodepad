---
name: write-brief
description: "Use when the user wants the human-facing decision document for a problem or bet that has been investigated, to align people on it or to force a choice. Covers three shapes: a narrative or report (problem, why now, impact, and the ask), a hard-questions FAQ, or a decision or options memo that weighs several options (including do-nothing), recommends one, and states the ask. Trigger on phrasing like 'write the brief', 'draft the brief', 'opportunity brief', 'the narrative', 'the FAQ', 'decision memo', 'options memo', 'recommendation memo', 'weigh options and recommend one', or after a decision passes the readiness gate. This is the leadership decision artifact, rendered from existing evidence and scores, NOT an engineering PRD, spec, acceptance criteria, status update, competitive battlecard, or metrics review. Refuses to invent metrics."
---

# Write Brief

Produce the human decision artifact for a decided problem or bet, in the requested style. Narrative and FAQ styles persuade and align humans around the problem, why now, impact, and ask; memo style forces a yes/no or option choice with a recommendation and explicit ask. It is not an implementation spec. Each style renders from the same `.product-eval/<scope>/` content (problem, evidence, themes, scores, decision). Never invent metrics, owners, or dates, write "Not provided in input" instead.

## Preconditions

The brief is gated on `decision-readiness`. **Check the item's latest verdict in `.product-eval/<scope>/decisions-log.md`**: if there is no passing (Decide-now) verdict, or the latest outcome is "Run a research sprint", do not produce a confident brief. Say so, and offer a "decision-readiness brief" that states the gaps and points to `design-test` for the cheapest validating test instead.

Also run the conformance preflight in `DATA-CONTRACT.md` (Validation) on the scope files you render from; if `scores.md`, `themes.md`, or `decisions-log.md` fails a check, report the violation rather than rendering a brief from inconsistent data.

## Styles, `--style narrative | faq | memo | both`

### narrative / report
A flowing readout: problem → why now → proposed solution → customer & business impact → success metrics → the ask. Prose, not bullets; one quantified claim early; explicit before/after; no unsupported roadmap commitments. Optional press-release voice (write it as if already shipped). Structure and starters in `references/opportunity-brief.md`.

### faq
The hard-questions version, the completeness gate. Answer the question bank in `references/opportunity-brief.md` (problem, customer, timing, alternatives, limitations, out-of-scope, failure modes, success metrics, one-way doors, …). This version is also the scaffold the `critique` lens-panel attacks before the doc is "done".

### memo
A decision-oriented memo that forces a yes/no or option choice by a deadline, for *driving a decision*, not persuading. Headings in order: purpose & decision requested (one sentence + deadline) · executive summary (customer + business impact) · current state & evidence (each claim with source + strength) · root cause · options considered (≥3 incl. do-nothing; table `Option | Summary | Benefits | Tradeoffs | Key risk | Why not selected`) · recommended strategy (falsifiable success/failure criteria) · metrics scorecard (`Metric | Baseline | Target | Owner | Date`) · economics if relevant · risks/dependencies/mitigations (owner + close date) · the ask (concrete, owner- and time-bound). Run `critique` on the recommendation's falsifiability and whether do-nothing is honestly weighed.

### both
Narrative as the readout, FAQ as the backing appendix.

## Workflow

1. Load the decided problem, its evidence, scores, and verdict from the scope.
2. Render the requested style(s) from `references/opportunity-brief.md`.
3. Put evidence in appendices, not in marketing claims; cite source + strength.
4. Run `critique` (panel mode) on the FAQ and tag each answer resolved / open / contested before calling it done.
5. Export to docx/pdf if asked (read the docx/pdf skills). Write to `.product-eval/<scope>/docs/`.

## Output

The brief in the requested style plus the critique summary (resolved / open / contested counts). Lead with the one-paragraph essence. End with `Next move:` and recommend resolving open FAQ items, pressure-testing the plan if commitment risk remains, or turning the approved decision into a build brief.
