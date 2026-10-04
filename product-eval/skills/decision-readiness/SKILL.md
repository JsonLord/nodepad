---
name: decision-readiness
description: "Judge whether there is enough evidence to make a build decision on a specific problem or bet, and return one of three outcomes: Decide now, Run a research sprint, or Do not commit yet. Use when the user asks \"do we have enough data to decide?\", \"is this worth building?\", \"are we ready to commit to X?\", \"what's the evidence for this?\", or \"decision readiness\". This is the core gate, Confidence band drives the decision; signal strength is assessed per evidence item."
---

# Decision Readiness

Answer the question every other tool skips: *does the user have the right to make this call yet?* Assess the evidence behind a specific bet, run the sufficiency gate, compute Confidence, and return a clear outcome with the exact gaps to close. This is the main product moment, lead with the verdict, then show the evidence math below it.

## Workflow

### 1. Identify the bet and gather its evidence

Pin down the specific problem/bet being decided (lightly frame it first if it is vague). Collect its evidence from `.product-eval/<scope>/evidence/`, from connected sources, and from anything the user pastes or uploads (CSV, notes, transcripts). If sources are connected, pull relevant items; if not, accept what the user provides and note the limitation.

**Preflight (data contract).** Before trusting scoped files, run the conformance preflight in `DATA-CONTRACT.md` (Validation) on the `evidence/`, `themes.md`, and `scores.md` you read. A failed check (for example `scores.md` confidence not matching `themes.md`, or a band inconsistent with its number) stops the readiness call with the exact violation, so the gate never runs on inconsistent data.

### 2. Rate and weight each evidence item

Using `references/evidence-quality.md`, rate every item 1-5 and tag it (source type, persona, funnel stage, impact type, recency). Then **dedup by resolved identity** (one user appearing across channels is not several voices), and compute each item's **weight** (base-by-strength × recency). Merge exact duplicates; keep independent cross-source corroboration (it adds weight). Keep contradictory evidence and surface it; it is valuable for an honest call.

### 3. Triangulate (optional but valuable)

If the bet rests on internal evidence (e.g. a ticket cluster), search public sources to see whether the same pain appears externally. A match raises confidence and may indicate an industry-wide opportunity; no match suggests it is specific to this product/segment. Record the result as additional evidence and as added source diversity.

### 4. Run the sufficiency gate (binary)

Using `references/decision-gate.md`, compute the **total evidence weight** (strength-weighted and deduplicated, quality and independence, not raw count) and check the floors: weight below threshold; nothing rated strength 3+; single source type; or a vague problem statement. Report exactly which floor failed and the fix.

### 5. Compute Confidence and the verdict

**Source of truth:** if this item is already scored in `.product-eval/<scope>/scores.md`, use that Value and Confidence and skip recomputation (recompute only if absent, then write the result back). Otherwise compute Confidence per `references/decision-gate.md` (saturating base from evidence weight × diversity × contradiction penalty), apply any **bounded ±10 adjustment** for context the inputs miss (state the reason, log it), and report it as a **band**: Low / Moderate / High, not a bare point. Combine the band with the item's Value band and map to the matrix to produce the outcome:

- **Decide now** (passes gate, Confidence 70+), enough to commit.
- **Run a research sprint** (passes gate, Confidence 40-69), promising but get specific proof first.
- **Do not commit yet** (fails gate, or Confidence below 40), not enough to decide.

Confidence drives the verdict. Respect the confidence ceiling in `.product-eval/<scope>/sources.md`, if the connected sources cannot reach 70, say so explicitly.

### 6. Emit gaps with where to look

Whenever the verdict is not "Decide now", list specific gap questions, each naming **where to look** and **which source or connector would close it** (e.g. "Do product analytics confirm the drop-off at the permissions step? Connect Amplitude/Datadog" or "Have non-sales sources named this, or is it only sales-requested?"). Avoid generic "needs more research". On a **Run a research sprint** verdict, hand these gaps to `design-test` to turn them into the single cheapest experiment that would move Confidence past the gate.

### 7. Record

Append the verdict, Confidence with reasoning, evidence item IDs, and the gaps to `.product-eval/<scope>/decisions-log.md`. Offer the next step: close a gap, run a research sprint, or proceed to pressure-test / the output layer.

## Output

A direct outcome (Decide now / Run a research sprint / Do not commit yet), the Confidence band with concise reasoning, what the gate found, and a short list of gaps-with-where-to-look. Put exact math below the verdict or in the scope file. Do not soften "Do not commit yet" into a maybe. End with `Next move:`: Decide now → pressure-test if high-stakes, then write the memo/build brief; Run a research sprint → design the cheapest test; Do not commit yet → gather the missing source, reframe, or deprioritize.
