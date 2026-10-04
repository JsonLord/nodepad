# Adversarial Lenses & Termination Protocol

The multi-lens panel attacks a brief, a FAQ, or a high-stakes finding from independent angles, then terminates each point honestly. Used by `critique` mode 3.

## The lenses

Assign each lens to the answers/findings it owns; run only those relevant to the artifact.

- **Skeptical customer**: "Would I actually switch for this, or is my current workaround fine? Is this a painkiller or a vitamin?"
- **Competitor**: "We'd close this gap in a sprint." Cross-check the competitor's changelog/release notes; gaps that already closed get retired.
- **Economics / CFO**: "Do the unit economics survive the downside case? What's break-even? Which single assumption is doing all the work?"
- **Feasibility / engineer**: "The hard part is the part the brief waves past. What's the riskiest technical assumption, and what if it's wrong?"
- **Contrarian PM**: actively hunts disconfirming evidence, single-source grounding, vanity metrics, and problem-statement drift.
- **Security / legal**: privacy, compliance, and data handling (only where the artifact touches them).

## Independence (mandatory)

Each lens runs as a separate pass with its own context; prefer a different model. A panel of one model agreeing with itself is theater. The author's reasoning is input to attack, not a position to defend.

## Bounded rounds

Max 3 rounds. After each, the author revises or flags; stop early when a round raises no new substantive issue. Reserve the full panel for high-stakes findings, it's expensive.

## Termination, three states, never "consensus"

Agreement among agents is not truth, and more argument cannot resolve a real disagreement, only evidence can. Terminate every point into exactly one state:

1. **Resolved**: answered and backed by evidence that clears the gate.
2. **Open**: needs data the panel lacks → emit a specific gap question (with where to look), routed to `gather-evidence` or a research sprint. Do not talk it closed.
3. **Contested**: a genuine, unresolved disagreement → log it as a recorded risk in the decisions log, naming who would need to decide.

## Output

Each attacked point tagged resolved / open / contested. Lead with the count in each state, "12 resolved, 2 open, 1 contested" is an honest map of where the artifact stands. Open items carry their gap question; contested items carry the dissent.
