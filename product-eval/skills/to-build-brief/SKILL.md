---
name: to-build-brief
description: Transform an approved decision into an agent-ready build spec, --code for Claude Code/Codex, --design for Figma/wireframe/Gemini. Use when the user says "turn this into a spec", "make it buildable", "build brief", "hand this to Claude Code / Figma", or after a brief is approved. Strips narrative voice; outputs structured, testable markdown.
---

# To Build Brief

Turn the approved Opportunity Brief / decision into a structured spec an implementation or design agent can execute. This artifact is for builders: literal requirements, screens, states, data, acceptance criteria, and metrics. Reads `.product-eval/<scope>/`; writes to `.product-eval/<scope>/build/`. Two modes; strip persuasion and prose, builders want literal, testable detail (see `references/build-brief.md`).

## Preconditions

Only run on an approved decision. **Verify a passing decision-readiness verdict exists for this item in `.product-eval/<scope>/decisions-log.md`**; if it has not passed, refuse, do not generate a build spec for an unvalidated bet (say what is missing and point to `decision-readiness` / `design-test`). Run the conformance preflight in `DATA-CONTRACT.md` (Validation) on the scope files first, so a build spec is never generated from a malformed `decisions-log.md` or `scores.md`.

## `--code` (Claude Code / Codex)

Emit: scope in/out (explicit non-goals); primary user flows; P0/P1 functional requirements each with **Given/When/Then acceptance criteria**; data model / key entities; states and edge/error cases; constraints, dependencies, interfaces; success metrics + instrumentation; and a "build this MVP slice first" callout. Markdown, hierarchical, no narrative voice.

## `--design` (Figma / wireframe / Gemini)

Emit: a screen-by-screen breakdown, each view, its elements, and its states (empty / loading / error / success); flows as numbered steps; the primary action/CTA per screen; key copy; brand/platform/responsive constraints. Optionally push to Figma via its MCP path.

## Workflow

1. Load the approved brief, decision, and scores from the scope.
2. Render the requested mode from `references/build-brief.md`.
3. Carry the success metrics over, so the builder produces something measurable.
4. Write to `.product-eval/<scope>/build/` and note it's ready to hand to the target tool.

## Output

The build brief in the requested mode, in plain markdown so Claude Code, Codex, Gemini, and Figma's tooling all parse it. Lead with the scope and the MVP slice. End with `Next move:` and name the handoff target: Codex/Claude Code for implementation, or the design tool/agent for wireframes and interaction work.
