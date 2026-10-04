---
name: discover-sources
description: "Map what product-data sources a user can draw on, connectors, tools, files, offline systems, and the decision-confidence ceiling those sources allow. Use when the intent is discovery and setup of the evidence base itself: \"what data do I have / could connect\", \"scan/inventory my sources\", \"is X hooked up\", \"where could product insights come from\", \"how confident could any decision be given my data\", or starting a new project before any framing or prioritizing. Do NOT use when the user wants you to actually work the data they already have, pulling, summarizing, grading, or reporting on tickets, reviews, surveys, metrics, scorecards, or trends. Those are analysis and reporting tasks, not source discovery. The trigger is \"what evidence exists and how good can it get,\" not \"analyze the evidence.\" Produces a source map plus a confidence ceiling."
---

# Discover Sources

Inventory where product-relevant data lives for this user, map each source to the kind of evidence it can produce and the maximum strength that evidence can reach, and record the resulting decision-confidence ceiling. This is the foundation every other skill reads.

## When to run

Run this first in a new project, or whenever the user asks what data they have or could connect. If `.product-eval/<scope>/sources.md` already exists, read it and offer to refresh rather than starting over.

## Workflow

### 1. Scan three surfaces

No single discovery surface is reliable, so check all three:

1. **Live tools**: Look at which MCP tools / connectors are actually callable in this session right now, including any that are present but require authentication. This is the most authoritative signal for "what can be pulled today." List what you find.
2. **Registry**: If a connector registry is available (e.g. `search_mcp_registry`), search it for product-data categories the user does not yet have connected, so they can be suggested with a one-click connect.
3. **Catalog-prompted**: Walk the categories in `references/source-catalog.md` and ask the user about offline or non-connectable sources. For anything that cannot be connected, offer CSV / file upload as the on-ramp.

Do not assume a source is unavailable just because one surface is silent. (It is common for a registry to report nothing while live connectors are in fact present.)

**Probe to confirm, don't just detect.** A tool being present is not proof it returns data. For each detected connector, make one cheap probe call (pull a single recent item) and tag the source **reachable / needs-auth / empty / blocked**; when it works, note the access pattern that worked (tool · operation · params) so `gather-evidence` reuses it. See `../gather-evidence/references/fetch-strategies.md`.

### 2. Map every found source to an evidence role

For each source the user has or uploads, record, using `references/source-catalog.md`:

- the **evidence role** it plays (e.g. first-party quantitative, support-ticket cluster, third-party qualitative),
- the **maximum evidence strength** it can yield (1-5),
- which **metric-tree branch** it illuminates (acquisition, activation, engagement, retention, expansion, advocacy),
- the **join keys** it exposes (email, user_id, domain, username) for identity resolution, see `references/identity-resolution.md`, so the same person or account can be linked across sources later. Note whether a CDP or identity graph is present.

### 3. Compute the confidence ceiling

The set of connected sources caps how confident any decision can become. Determine the ceiling honestly:

- Only third-party / indirect sources (reviews, community, market tools, feature requests) → ceiling is **Moderate**; decisions will tend to land at *Run a research sprint* or *Do not commit yet*.
- At least one strong first-party quantitative source (product analytics, logs) plus corroboration from another source type → ceiling can reach **Decide now**.

State the ceiling plainly and name the single highest-leverage source the user could add to raise it.

### 4. Write the source map

Write `.product-eval/<scope>/sources.md` (create `.product-eval/<scope>/` if it does not exist) with: the sources found per surface, the role/strength/branch mapping, the join keys per source (and whether a CDP or identity graph is present), each source's probe status (reachable / needs-auth / empty / blocked) and working access recipe, coverage gaps, the confidence ceiling, and the top 1-2 suggested connectors to add. Every other skill reads this file and degrades gracefully against it.

### 5. Recommend the next step

Tell the user what they can and cannot do given their sources, then recommend the next action: no first-party data → gather evidence outside-in, then `synthesize`; rich connectors → gather evidence then `prioritize-backlog`; an existing roadmap → `pressure-test`.

## Output

A short, scannable summary in chat (sources found, confidence ceiling, top gap to close) plus the written `.product-eval/<scope>/sources.md`. Keep the chat summary free of internal file paths unless the user asks. End with `Next move:` and recommend the one action that moves the user toward delivery: upload/pull evidence, gather outside-in signal, rank opportunities, or pressure-test an existing plan.

## Notes

- CSV / file upload is the universal on-ramp: any source that can export becomes usable evidence even with zero connectors. Strength comes from the declared source type and content, not from how the data arrived.
- The web is always available as a corroboration layer for later steps, even when the user has no internal data.
