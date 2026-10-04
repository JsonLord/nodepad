---
name: prioritize-backlog
description: Rank opportunities or backlog items by evidence-backed Value and Confidence bands, storing exact 0-100 scores for audit. Use when the user says "prioritize my backlog", "rank these", "what should we build next", "score these opportunities", or hands over a list of problems/features to sequence. This is the Rank opportunities outcome, distinct from updating a roadmap's Now/Next/Later. Falls back to proxies when data is thin and flags lower confidence.
---

# Prioritize Backlog

Score and rank a set of problems or opportunities so the user knows what to build next and why. Produce a defensible ranking with explicit reasoning, not a gut order. In chat, show bands and recommendations first; store exact numbers in scope files.

## Workflow

### 1. Gather the items and their context

Take the list to rank (from the user, from problem-framed themes, or from `.product-eval/<scope>/`). Read `.product-eval/<scope>/context.md` for the north-star metric and personas, and `.product-eval/<scope>/sources.md` for the confidence ceiling. If business context is missing, ask only the few questions needed to score (north star, primary personas) and proceed.

**Preflight (data contract).** When ranking themes already written to `.product-eval/<scope>/`, validate `themes.md` against the conformance preflight in `DATA-CONTRACT.md` (Validation) first (members resolve to real evidence, `total_weight` matches the members, `confidence_band` is consistent with `confidence`). On a failure, stop and report the file, field, and violation rather than scoring malformed input.

### 2. Score Value per item

Using `references/scoring-framework.md`, score four dimensions (each 0-25, summed). Store the exact 0-100 `value` and `value_band`; show the band in chat.

- **Persona weight**: buyer vs admin vs end-user vs edge case.
- **Funnel location**: retention/activation rank highest; advocacy lowest.
- **Frequency**: how often the affected users hit this.
- **Competitive pressure**: from "customers leaving" down to "no pressure".

When first-party data is missing, use the proxies in the reference (complaints as a drop-off proxy, sales objections as a conversion proxy, competitor investment as a gap proxy) and mark those scores as lower confidence.

### 3. Score Confidence per item, report as a band

Confidence reflects how well-supported the item is by evidence: count of independent evidence items, diversity of source types, their strength (1-5), recency, and how much is first-party. Store the exact 0-100 `confidence` for audit and calibration, but present `confidence_band` in chat (Low / Moderate / High). Respect the ceiling from `.product-eval/<scope>/sources.md`. Signal strength is an input to Confidence, not a separate verdict.

### 4. Apply the recommendation matrix

Map each item's (Value, Confidence) to a recommendation using the matrix in the reference: *Decide now / Run a research sprint / Do not commit yet / Deprioritize.* High value + low confidence means "research more", not "drop", keep these visible.

### 5. Rank and present

Order by recommendation tier first, then Value band within tier. Present a scannable ranked table: item, Value band, Confidence band, recommendation, one-line rationale. Call out the few items worth acting on now and the few to deprioritize. Put exact point scores only in an audit note or the scope file.

### 6. Record and offer next step

Write `.product-eval/<scope>/scores.md` with exact scores, bands, and reasoning, and log the ranking in `.product-eval/<scope>/decisions-log.md`, using the score and decisions-log schemas in the data contract (`DATA-CONTRACT.md`). Offer to decide on the top item or pressure-test the resulting shortlist. Honor user score overrides, but require a one-sentence reason and log it.

## Output

A ranked table with bands, recommendations, and a short "act on these / hold these" summary. Keep exact math and internal paths out of the chat unless asked. End with `Next move:` and recommend deciding on the top item, pressure-testing the shortlist, rendering a scorecard, or writing the report the user asked for.
