# AGTX coding execution backend

## Compatibility gate

Phase B execution-provider work is intentionally gated on a successful run against the target Debian AGTX installation:

```bash
AGTX_BINARY=/path/to/agtx AGTX_TEST_REPO=/path/to/safe/repository npm run test:agtx
```

The probe fails when either required variable is absent; a skipped probe is not compatibility evidence. It records `agtx --version`, performs the MCP handshake, verifies the complete required-tool set, creates and reads one harmless Backlog task, verifies its correlation marker and uniqueness, and reports safe response shapes and tool input schemas. It does not start a coding agent. The `move_task` and `wait_for_board_change` contracts are inspected from discovered MCP schemas without causing a phase transition or a blocking watcher during the harmless probe.

As of this repository revision, the target Debian binary and test repository were not available in the coding environment. Therefore the generic HTTP execution phase has **not** begun. This preserves the required ordering: actual AGTX compatibility must be established before extracting a provider-neutral lifecycle from it.

AGTX is Nodepad's first and only executable adapter. Nodepad launches the operator-configured binary as `agtx mcp-serve` with an argument array and `shell:false`, then communicates exclusively through MCP JSON-RPC over stdio. stderr is diagnostic-only. Nodepad does not read AGTX files, control tmux, create worktrees, configure plugins, or launch coding agents itself.

## Configuration and security

Set `AGTX_BINARY` on the server, `AGTX_MCP_MODE=global`, `AGTX_REQUEST_TIMEOUT_MS`, and comma-separated `AGTX_PROJECT_ROOTS`. `AGTX_EXECUTION_ENABLED` defaults to false: project/task boards remain readable while dispatch and transitions are blocked. Repository mappings are separate control-plane records. Paths must exist, resolve through `realpath`, and remain inside an allowed root, preventing traversal and symlink escapes. Browser requests cannot choose a binary, command, arguments, MCP tool, or shell input.

The MCP client performs `initialize`, sends `notifications/initialized`, discovers tools, and requires `list_projects`, `list_tasks`, `create_task`, `get_task`, `move_task`, and `wait_for_board_change`. A single global process is reused. Process failure enters bounded restart backoff. Nodepad never invokes AGTX update or its experimental orchestrator.

## Dispatch and lifecycle

Routing remains separate. A routing decision can create a delegation draft; the user queues it and must then explicitly choose **Start in AGTX**. Dispatch verifies the queued delegation, authorization, selected routing decision, enabled AGTX profile, canonical task, allowed repository mapping, healthy compatible MCP runtime, and execution flag.

`agtx_dispatch_attempts` durably records authorization and creation. The delegation ID is embedded as a correlation marker. On an uncertain retry, Nodepad searches AGTX tasks for that marker before calling `create_task`, preventing normal response-loss retries from duplicating work. The returned AGTX task ID becomes `Delegation.externalRunId`; the canonical task is never duplicated or automatically completed.

AGTX phase mapping is centralized: Backlog → starting, Planning/Running → running, Review → review, Done → succeeded; blocked or input-required snapshots → waiting_for_human; explicit AGTX failure → failed. Allowed actions are re-read from `get_task` before `move_task`. Cancellation is not implemented because no supported cancellation tool was confirmed; Nodepad never kills tmux sessions, worktrees, or processes to fake cancellation.

## Monitoring, recovery, and UI

The persistent Debian Hub reuses one MCP process. A bounded monitor first reconciles active external delegations after startup and then waits through `wait_for_board_change`, avoiding browser-to-AGTX polling. If AGTX is unavailable, active work becomes `waiting_for_agent` with a diagnostic rather than failed. Deduplicated `delegation_events` record authorization, task creation, phase changes, review, completion, failure, and recovery.

The top-level **AGTX** tab shows AGTX-native Backlog, Planning, Running, Review, and Done columns; linked and unlinked tasks; mappings; workflow/agent fields; needs-input and review states; safe artifact references, diff summaries, and bounded read-only output tails when MCP provides them. It exposes only currently returned `allowed_actions`. Human Nodepad task status remains independent.

AGTX requires a long-lived Debian Nodepad Hub process and is unavailable in browser/offline mode. `npm run test:agtx` is an explicit live protocol probe requiring `AGTX_BINARY` and a disposable `AGTX_TEST_REPO`; it creates and reads back one harmless Backlog task but never starts execution; standard tests use fakes and never start AGTX or a coding agent.
