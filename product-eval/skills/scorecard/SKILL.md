---
name: scorecard
description: "Render the results of a product-eval investigation as a self-contained interactive HTML page: ranked opportunities with their Value, Confidence, verdict, evidence weight, customer quotes, and open gaps, laid out as KPI cards, a Value by Confidence quadrant, and per-opportunity cards. Use when the user wants to visualize, render, share, or make a dashboard or scorecard from an existing product-eval scope, that is, the output of prioritize-backlog or decision-readiness, or a scope's scores.md, themes.md, and decisions-log.md. Triggers include 'decision dashboard', 'product dashboard', 'scorecard from the ranked opportunities', 'turn the prioritization into something visual to share'. Do NOT use for general metrics or KPI dashboards, north-star or quarterly metric trends, grading raw signal strength, checking connected data sources, or drafting briefs; this only renders an already-scored opportunity ranking, it does not gather data or compute scores."
---

# Scorecard

Turn an investigation's scores and verdicts into a single self-contained, interactive HTML page a PM can open, sort, share, and act on. This is the **rich output**: it makes `prioritize-backlog` and `decision-readiness` results tangible instead of a wall of text.

## When to run

After `prioritize-backlog` (ideally with `decision-readiness` run on the top items). Reads `.product-eval/<scope>/scores.md`, `.product-eval/<scope>/themes.md`, and `.product-eval/<scope>/decisions-log.md`.

**Preflight (data contract).** Before rendering, run the conformance preflight in `DATA-CONTRACT.md` (Validation) on `scores.md`, `themes.md`, and `decisions-log.md`. If a check fails (a verdict outside the four-verdict vocabulary, a band that disagrees with its number, a `problem` with no matching theme), stop and report it rather than drawing a misleading dashboard. `examples/activation-q3/` is a conformant fixture and `examples/activation-q3/scorecard.html` is its rendered output.

## What it produces

One standalone `.product-eval/<scope>/scorecard.html` (no server; only optional Chart.js from a CDN), containing:

- **KPI cards**: total opportunities, counts by recommendation (Decide now / Run a research sprint / Do not commit yet / Deprioritize), and the confidence ceiling.
- **Value × Confidence quadrant**: each opportunity plotted; a vertical line at the Confidence gate (70) and a horizontal at Value 70, so the eye lands on the top-right "Decide now" quadrant.
- **Opportunity cards**: one per opportunity, with clearly-labeled bands (Value, Confidence), optional 0-100 audit bars, evidence weight, accounts affected, the recommendation, **verbatim customer quotes** (the qualitative voice), the **top complaint** and the **explicit ask**, and a **"why it ranks here"** line tying the score back to that customer pain, plus the open gaps. The quotes and the complaint/ask are what make the prioritization legible; lead with them, not the number.
- **A "how to read" glossary**: plain-language definitions of Value, Confidence, evidence weight, and accounts, and the recommendation tiers.
- **Honest footer**: the confidence ceiling and the single cheapest move to raise the top item (e.g. "add one independent source type").

## How to build

Generate one HTML file with inline CSS + JS. Read the data from the scope files (or accept inline data when rendering an example). For each opportunity, pull 1-2 **verbatim** customer quotes plus its top complaint and explicit ask from the evidence, these carry the qualitative voice and make the ranking legible. Show clearly-labeled Value and Confidence bands first, with exact 0-100 bars only as audit detail, and include the glossary. Color-code recommendations consistently: Decide now = green, Run a research sprint = amber, Do not commit yet = grey, Deprioritize = red. If a bounded ±10 adjustment was applied, note it. Keep it faithful to the formula, never invent a number the evidence doesn't support. Write to `.product-eval/<scope>/scorecard.html` and offer to open it.

## Output

The path to the HTML scorecard plus a one-line summary (e.g. "5 opportunities, 1 Decide now, 2 Run a research sprint, 1 Do not commit yet, 1 Deprioritize; ceiling: Decide-now reachable"). End with `Next move:` and recommend deciding on the top item, designing the research sprint for under-evidenced items, or writing the stakeholder report.
