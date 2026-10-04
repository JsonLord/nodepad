---
name: gather-evidence
description: Pull product evidence from connected sources, CSV uploads, and the web; then normalize, identity-resolve, strength-rate, and weight it into scoped evidence items. Use when the user says "gather evidence", "pull the tickets/reviews/analytics", "find signal for this problem", "collect data on X", or as part of Rank opportunities / Decide on one bet. Writes evidence items and a resolved identity map that synthesize and decision-readiness consume.
---

# Gather Evidence

Retrieve product-relevant data for a problem or area and turn it into normalized, identity-resolved, strength-rated, weighted evidence items. This is the Problem Scout, retrieval and grading, not theming (that is `synthesize`).

## When to run

After source setup. Read `.product-eval/<scope>/sources.md` for what's available, the join keys per source, and the confidence ceiling. If it is missing, run source discovery for this scope first.

## Workflow

### 1. Set retrieval hypotheses

Don't dump everything. Decide where to look: walk the metric tree (acquisition→advocacy), the user journey, the personas, and competitive gaps, and form "where would pain show up?" hypotheses. Retrieve against those.

### 2. Retrieve from each available source

**Connectors vary: probe, don't assume.** Before bulk-pulling, make one cheap call to learn a source's actual shape (list its operations; pull one recent item; inspect the fields), then build the real query around what you see. If a connected source won't return data, climb the **adaptive fetch ladder** in `references/fetch-strategies.md`, relax the query, try an alternate operation, re-read the tool schema and re-parameterize, or fall back to a broad pull + local filter, diagnosing each failure (auth / empty / schema / permission / rate-limit) and retrying at most ~3 times per failure class before handing back to the user. Record the working access pattern so later pulls are one step.

- **Connectors**: query each source's search/list tools with targeted filters (time window, status, tags, keywords from the hypotheses): support tickets, CRM PFRs and lost-deal reasons, GitHub issues, analytics funnels, error groups. Paginate or sample large sources, but capture totals even when sampling.
- **CSV / uploads**: parse exports directly.
- **Web**: search reviews, community, and competitor sources for external signal.

**Stopping rule:** sample rather than exhaust: pull a representative recent set per source (default ~30-50 items, or until new items stop surfacing new themes, theme saturation), but always capture totals so volume/frequency signals survive. **When a fetch is blocked or a source is unavailable:** do not work around it, note the gap explicitly, treat that source as missing (which lowers reachable Confidence), and ask the user to paste or upload the data (CSV / export / text). Never substitute an alternative fetch method for a blocked one.

### 3. Normalize into evidence items

For each item record: claim (state the pain, not the solution), `source_type`, `persona`, `funnel_stage`, `impact_type`, `timestamp`, `raw_metric`, and `raw_link`. Follow the claim-extraction rules in `references/signal-analysis.md`, and write each item to the evidence-card schema in the data contract (`DATA-CONTRACT.md`, plugin root).

### 4. Resolve identities

Apply the identity ladder in `../discover-sources/references/identity-resolution.md`, using the join keys recorded in `.product-eval/<scope>/sources.md`: stitch the same person/account across sources, write `.product-eval/<scope>/identities.md` (method + confidence per merge), and tag each evidence item with `person_id` / `account_id`. Dedup so one user across channels is one voice, not several. Keep identifiers readable so the same entity stitches across systems into a holistic picture; data handling (retention, redaction, `.gitignore`) is the user's own governance call, per that reference.

### 5. Rate strength and compute weight

Rate each item 1-5 (`references/signal-analysis.md` plus the evidence-quality rubric) and compute its weight (base-by-strength × recency). These feed the sufficiency gate and Confidence downstream.

### 6. Filter signal from noise

Apply the signal hierarchy: keep tier-1 (migration stories, workarounds, specific complaints) over vague mentions; exclude competitor marketing, paid/incentivized reviews, bots, and stale items. When signals are thin, widen the search (proxies, adjacent areas, competitor gaps) and mark items as emerging/lower-confidence.

### 7. Validate freshness against changelogs

Before finalizing, freshness-check the competitive and gap evidence. Fetch the relevant changelogs / release notes, competitor `/changelog`, `/releases`, "What's New", GitHub releases, release-notes RSS, and the company's own changelog. For each piece of evidence, compare its date against shipped changes touching the same capability: if a release post-dates the evidence and addresses it, mark the evidence **stale / superseded**, decay its weight, and raise a contradiction flag for `synthesize`. Treat a changelog as a factual freshness check (not pain evidence, and not the same as competitor marketing), and remember a shipped feature isn't necessarily a good one, so a hit downgrades a table-stakes gap rather than auto-killing a differentiation play.

### 8. Write and hand off

Write `.product-eval/<scope>/evidence/*` and `.product-eval/<scope>/identities.md`. Summarize what was found (counts by source, distinct accounts after dedup, notable clusters, anything retired as stale) and hand the evidence to the ranking or decision flow for problem-framed synthesis.

## Output

A short summary, items found, distinct users/accounts after dedup, source mix, anything striking, plus the written evidence. Keep internal paths out of chat unless asked. Note honestly that it rates evidence as described, not ground truth. End with `Next move:` and route toward problem-framed synthesis/ranking for broad decisions, or readiness for one named bet.
