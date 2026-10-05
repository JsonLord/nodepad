# Agency Agents integration boundary

Agency Agents remains separate. Use `/api/v1` with `X-Nodepad-Actor-Type: agent`, `X-Nodepad-Actor-Id`, and `Idempotency-Key`. Shared services—not handlers—own business logic, ready for a later MCP transport.

Routes include workspace graph/context; evidence and hypotheses; synthesis execution; heartbeat; research tasks/results; brain export/events; and Git backup/restore. Set `NODEPAD_API_KEY` to require Bearer authentication for mutations. Specialist task claiming and MCP exposure are intentionally deferred.
