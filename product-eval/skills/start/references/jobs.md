# Outcome Modes

Entry is by desired outcome, not persona or internal skill. Two axes configure a session: the **outcome** (sets breadth + output) and **data availability** (sets direction + confidence ceiling). "Founder" and "PM" are common contexts, not entry points.

## The outcomes

| Outcome | Trigger phrases | Breadth | Internal flow | First output |
|---|---|---|---|---|
| Rank opportunities | "what should we build next", "prioritize this backlog", "rank these opportunities" | broad or specific | gather evidence as needed, synthesize into problem-framed themes, score Value/Confidence, render ranking | ranked problem shortlist |
| Decide on one bet | "is this worth building", "do we have enough data for X", "can we commit" | single | frame the bet, gather targeted evidence if needed, run readiness, design the cheapest test if proof is missing | Decide now / Run a research sprint / Do not commit yet |
| Pressure-test a plan | "poke holes in this", "stress-test our roadmap", "red-team this plan" | existing artifact | pressure-test the artifact against evidence and assumptions | blocking issues + verdict |
| Write the output | "write the brief", "write the decision memo", "turn this into a spec", "make a scorecard" | decided or scored artifact | produce the requested decision artifact from the scope | brief, memo, build brief, or scorecard |

Keep these labels user-facing. The internal flow can use specific skills, but the chat should normally say "ranking", "decision", "research sprint", "pressure-test", or "brief/spec" rather than naming every step.

## Setup before outcomes

On a new scope or a vague first prompt, setup comes before analysis. Ask for the product, target users, decision goal, scope/time horizon, available evidence sources, and the metric or business constraint that should shape Value. Do not rank "onboarding" or judge "SSO" until the product context and evidence plan are clear, unless the user explicitly asks for an outside-in first pass and accepts a lower confidence ceiling.

If the user wants a report or brief, treat that as a Write outcome but still ask for audience, source material, and the decision the report should support when those are missing.

## Investigation scopes

- State lives at `.product-eval/<scope>/`, one scope per distinct investigation.
- A broad-space exploration and a specific-product evaluation are **different scopes**; do not share evidence between them unless the user explicitly links them.
- Resuming: if a scope already exists, load its `context.md`, `sources.md`, and prior `decisions-log.md` rather than starting over.
- The same user can keep several scopes alive in parallel; `drift-check` tracks each independently over time.

## Direction & ceiling (the data axis)

- No first-party data → outside-in; confidence ceiling **Moderate**; lean on the evidence-generation loop (prescribe the cheapest test).
- First-party connectors present → inside-out; ceiling up to **Decide now**; lean on connector aggregation.
- Mixed is common (e.g., own analytics + competitor web signal). The ceiling follows the data, independent of the job.

## Delivery nudges

Every user-facing result should end with `Next move:` and one recommended action. Prefer delivery language over skill names:

| Current result | Best next move |
|---|---|
| Setup is incomplete | Ask for the missing product context, evidence source, or report audience. |
| Source map exists | Pull or upload the evidence that can answer the decision. |
| Evidence is gathered | Turn it into problem-framed candidates for ranking or one-bet readiness. |
| Problem candidates are framed | Rank them, or run a readiness call on the leading bet. |
| Ranking is done | Decide on the top item, pressure-test the shortlist, or render a scorecard/report. |
| Decide now | Pressure-test the plan if commitment is high-stakes, then write the memo or build brief. |
| Run a research sprint | Design the cheapest test that would close the proof gap. |
| Do not commit yet | Reframe, gather a missing source, or deprioritize the bet. |
| Pressure-test is done | Fix blocking issues, then write the decision memo or build brief. |
| Critique is done | Revise the artifact, or pressure-test it if it is a plan/roadmap/PRD. |
| Brief/memo is done | Run an adversarial FAQ pass if needed, then create the build brief. |
| Build brief is done | Hand it to the implementation or design agent. |
