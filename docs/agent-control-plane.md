# Agent control-plane foundation

The control plane is deliberately separate from the Personal Work Graph. `Workspace`, `Entity`, and `Edge` remain human work/knowledge records. Profiles, rules, assignments, and delegations live in dedicated SQLite tables and are exposed only through authenticated `/api/control/*` routes. Browser-only mode does not persist privileged configuration.

## Models and lifecycle

- An `AgentProfile` describes a disabled or configuration-only HTTP, OpenAI-compatible, local CLI, AGTX, or Hermes adapter. Configuration accepts credential *references*, never credential values. Local CLI profiles accept only a server-defined `commandProfileId`; arbitrary commands are rejected.
- `AgentAssignment` links a canonical project or task ID to a profile without changing the entity. Multiple project roles are supported; task assignment precedes project assignment.
- `RoutingRule` contains structured conditions and a priority. Ties are deterministic by rule ID. No executable expressions or natural-language parsing are accepted.
- `Delegation` references the canonical task/project and is limited to `draft`, `queued`, and `cancelled`. Queued means awaiting a future dispatcher; it does not mean a process is running.
- The control plane uses one global optimistic revision. A stale whole-state update returns `REVISION_CONFLICT` and is never merged or blindly retried.

Cross-domain task/project references are validated transactionally by the repository because canonical entity IDs use a workspace-composite primary key. Agent references use SQLite foreign keys with restrictive deletion. Profiles therefore use enable/disable rather than hard deletion, preserving delegation history.

## Deterministic routing

Routing applies task assignment, then project assignment, but an assignment must still pass hard checks. Hard checks exclude disabled agents, Hermes supervisors, missing capabilities, incompatible locality, and privacy mismatch. Matching enabled rules are ordered by descending priority and then ID. A rule-fixed eligible target or explicit eligible assignment can be selected deterministically. One remaining candidate can also be selected; multiple candidates remain unresolved for future Laya.

The Laya boundary is `AgentSelectionRequest { routingContext, eligibleAgentIds }` and the future result is `AgentSelectionResult`. This release creates no probabilities and makes no model call. Hermes profiles are marked supervisors and excluded from ordinary worker eligibility. AGTX, HTTP, and CLI definitions contain configuration/contracts only—there is no `fetch`, process spawn, shell, AGTX, or Hermes execution path.

## UI and security

The **Agents** top-level view provides Profiles, Rules, Assignments, Delegations, and a route preview. It is available only while authenticated server mode is online; browser mode and unavailable Hub states show an unavailable/read-only message. All mutations reuse the Hub session, same-origin checks, body limits, validation, and structured error envelope. The UI never stores a credential value and performs no execution or health probe.
