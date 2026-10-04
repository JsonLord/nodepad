# Synthesis Reference

How to turn evidence items into problem-framed themes, trends, confidence, and gaps.

## Theme identification

A theme is a recurring pattern across 2+ evidence items. Themes must already be usable as problem candidates:
- Named as **problems**, not solutions ("auth breaks during setup", not "need an OAuth wizard").
- Specific enough to act on.
- Distinct from each other (merge heavy overlap).

Report per theme: problem-framed name (5-10 words), optional one-line problem statement, member evidence IDs, affected personas, distinct accounts, average strength, total weight, impact type, confidence band, and exact confidence for audit. Typical: 2-5 themes. More than 7 = too fine. Only 1 = evidence too narrow.

## Clustering method

- **Modest corpora (hundreds of items):** LLM map-reduce, extract a normalized claim + tags per item, cluster the claims into themes, label each as a problem. No infrastructure; explainable.
- **Large corpora (thousands+):** pre-aggregate (counts, tag/keyword rollups, time buckets) and/or embed-and-cluster (e.g. HDBSCAN, which isolates outliers as noise), then label and frame clusters with the model. This is where a vector store earns its place.
- Evidence arrives already identity-deduped from `gather-evidence`, so one user across channels does not inflate a cluster.

## Trend and pattern detection

- Volume over time per theme; WoW/MoM deltas.
- Signal-count bands: 3-5 emerging (worth flagging), 6-12 established (likely real), 13+ well-known, 50+ fundamental issue or recent regression.
- A sudden spike in a theme = likely recent regression, flag it.
- Cross-source corroboration (2+ source types) and internal↔external triangulation raise confidence and may flag an industry-wide opportunity.
- Surface contradictions; do not smooth them.

## Merge rules

MERGE into a theme when 3+ independent signals describe the same core pain, same persona, same context, from 2+ source types. DO NOT merge when pains are similar but distinct (setup vs ongoing use), personas differ, or different root causes share a surface symptom.

## Summary rules (3-5 sentences)

Lead with the strongest problem candidate; state the number and diversity of sources; note contradictions or surprises; do NOT make build recommendations (that is the scoring step's job).

## Confidence reasoning

Compute Confidence with the formula in `../../prioritize-backlog/references/scoring-framework.md` and report it as a **band** (Low / Moderate / High), not a bare point, then explain it: "Confidence Moderate (~70): 12 items across 3 source types (strong diversity), recent, but no first-party quantitative data (gap); consistent on the pain, varying on severity."

## Gap questions

Specific, with where to look: "Do product analytics confirm the drop-off at the permissions step?" / "Is this enterprise or only SMB?" / "Still true since the Q2 UI change?" Avoid generic "needs more research".
