---
name: start
description: "Use as the front door when the user is getting oriented rather than requesting a finished deliverable. Trigger on bare openers ('start', 'where do I begin', 'help me get going', 'just installed this'), questions about what this plugin or tool does, requests to survey or kick off an investigation into a space or area, or any broad product goal stated without a single concrete action ('find our next bet', 'what should we work on'). The intent is 'point me in the right direction', not 'do this specific task'. Route them toward one of four outcomes: rank opportunities, decide on one bet, pressure-test a plan, or write an output. Do NOT use when the user names a concrete deliverable and the inputs for it: synthesize provided evidence, rank a given list, judge one named bet, pressure-test a pasted plan, or draft a specific brief, memo, or spec. When in doubt, if there is a clear single action to perform, stay out."
---

# Start

Route the user into the right workflow by the **outcome** they want, set up an investigation scope, and keep internal skill choreography out of the chat unless the user asks. Never ask "are you a founder or a PM"; ask what product decision they are trying to make, what product/context it applies to, and what evidence they want decisions to rely on.

## First-run setup gate

Do **not** run straight into analysis on a first contact or a vague prompt. If there is no usable `.product-eval/<scope>/context.md` and `.product-eval/<scope>/sources.md`, or the user has not supplied enough context, pause and ask a compact setup question before ranking or deciding.

Minimum context to proceed:

- Product and target users/personas.
- Decision goal: rank opportunities, decide one bet, pressure-test a plan, or write a report/brief/spec/scorecard.
- Scope and time horizon, including what the named product area means.
- Available evidence/data sources: files, CSVs, transcripts, tickets, analytics, CRM, reviews, connectors, or "outside-in only".
- Success metric or business constraint that should shape Value.

Ask for these in one short message, not a long form. If the user explicitly says "use outside-in evidence only" or "make a low-confidence first pass", proceed but state the confidence ceiling. If the user asks for a report, first ask who the audience is and what source material or scope it should draw from unless that is already clear.

## Run to the outcome after setup

When the setup context is available and the user states an outcome, "what should we build and write the brief", "is X worth it", "give me the scorecard", don't make them invoke each step. Run the chain in one pass as needed: source setup → evidence gathering → problem-framed synthesis → ranking/readiness → the requested output. Pause only for (a) the **decision-readiness gate** (the genuine Decide-now / Run-a-research-sprint / Do-not-commit-yet fork), (b) real **taste calls** the user must own, and (c) **blockers** (a source won't connect, evidence too thin → a research sprint design). Narrate briefly; surface decisions, not mechanics. The point is the user reaches the document, not that they orchestrate the skills.

## Workflow

### 1. Identify the outcome

Infer from what the user said, or ask once (one question, not a form). The outcomes (see `references/jobs.md`):

- **Rank opportunities**: turn an area, backlog, or evidence pile into a ranked problem shortlist.
- **Decide on one bet**: judge whether one idea is ready to commit, needs a research sprint, or should not proceed yet.
- **Pressure-test a plan**: find the weak spots in an existing roadmap, PRD, strategy, or bet.
- **Write the output**: produce a brief, decision memo, build brief, or scorecard.

### 2. Select or create the investigation scope

Each investigation gets its own namespace, `.product-eval/<scope>/`, so a broad-space scan and a specific-product analysis don't bleed into each other. Ask for a short scope name only if it cannot be inferred, and create or reuse the directory. List existing scopes if the user might be resuming one.

### 3. Run setup

Set up the evidence context for this scope and capture missing business context before proceeding. State plainly what the tool can and cannot decide given the available data, including the honest confidence ceiling.

### 4. Run the outcome flow

Run the internal steps for the selected outcome (see `references/jobs.md`) and present the output in outcome language. End each step with `Next move:` and propose the single best action toward delivery, not a menu of skill names.

## Output

A one-line confirmation of the outcome and scope, a concise data/ceiling summary, and the first useful result or setup question. Always end with `Next move:`. Keep skill names out of the user-facing text unless asked; describe the action in user terms such as "upload the support CSV", "rank these opportunities", "run the readiness call", "pressure-test the plan", or "write the decision memo".
