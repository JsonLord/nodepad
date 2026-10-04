# Build Brief, structures

Agent-facing specs. Plain markdown, hierarchical, literal. No narrative voice, it distracts code and design agents.

## `--code` structure

- **Goal** (1-2 sentences) + target user + top job-to-be-done.
- **Scope**: In / Out (non-goals explicit).
- **User flows**: numbered steps per flow.
- **Functional requirements**: table: `ID | Requirement | Priority (P0/P1) | Acceptance criteria (Given/When/Then) | Owner`.
- **Data model**: entities, key fields, relationships.
- **States & edge cases**: empty / loading / error / success; boundary conditions; failure handling.
- **Constraints & dependencies**: tech constraints, interfaces/contracts, third-party deps.
- **Success metrics + instrumentation**: what to measure and where.
- **MVP slice**: the narrowest shippable wedge to build first.

Acceptance criteria are the highest-leverage element for a code agent, every P0 must have testable Given/When/Then.

## `--design` structure

- **Goal + primary user + key flow** (1-2 sentences).
- **Screens**: one block per view: purpose, elements (header, inputs, primary CTA, …), and states (empty / loading / error / success).
- **Flows**: numbered step sequences across screens; the primary action per screen.
- **Copy**: key microcopy (CTAs, empty states, error messages).
- **Constraints**: brand, platform (web/mobile), responsive behavior, accessibility notes.

Screen + state enumeration is the highest-leverage element for a design agent. Prose is useless here.

## Both modes

Carry the success metrics from the decision so the build is measurable, and link back to the approved brief for context.
