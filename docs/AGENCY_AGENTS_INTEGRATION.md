# Agency Agents integration

Agency remains separate and uses `/api/v1`. Send actor type/ID plus optional role, session, Agency task and correlation headers. Mutation idempotency uses `Idempotency-Key`; revision-sensitive operations use `If-Match` and return conflict instead of overwriting newer state.

Operations include targeted graph/subgraph queries; hypothesis filters; filtered research-task queries; task creation; exclusive claim with expiry; research result submission; agent event recording (`task_started`, `evidence_submitted`, `artifact_created`, `handoff`, `task_completed`); heartbeat; brain; events; backup/restore; and `/api/v1/portfolio` summaries across isolated workspaces.

Graph queries accept node, depth, kind, qualification, important, stale and contested filters. Research queries accept status, hypothesis, objective and minimum priority. Shared services contain business rules so a later MCP transport can reuse them.
