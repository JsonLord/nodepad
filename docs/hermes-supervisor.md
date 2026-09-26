# Hermes Supervisor (System-2 Supervisory Layer)

## Overview

Hermes operates as the System-2 supervisory layer above System-1 routing (Laya) and hard deterministic policy. Hermes is **not** an ordinary agent adapter in the execution dispatcher—it supervises, plans, decomposes tasks, manages contextual routing escalation, and performs typed graph/control-plane operations.

```text
                         USER
                           │
                        Hermes
                    System-2 supervisor
                           │
                ┌──────────┴──────────┐
                │                     │
           Work Graph            UI Control
                │
         Nodepad Control Plane
                │
     ┌──────────┴───────────┐
     │                      │
 hard deterministic      Laya
      policy            System-1
     │                      │
     └──────────┬───────────┘
                │
           Delegations
                │
            Dispatcher
     ┌──────────┼──────────────┐
     │          │              │
   AGTX       HTTP         Local CLI
```

---

## 1. Routing Escalation Pipeline

Routing decisions follow strict hierarchical filtering and escalation:

```text
Hard Policy Filter (Local/Privacy/Capabilities/Rules)
       │
       ▼
Deterministic Assignment or Single Candidate
       │ (if ambiguous)
       ▼
Laya System-1 Selection
       │ (if low confidence / low margin / Laya error)
       ▼
Hermes System-2 Escalation
```

### Hard Policy Invariant
Hermes receives **only** candidates that passed hard deterministic policy (`eligibleAgentIds`).
If Hermes returns or selects an ineligible agent, the supervisor service **rejects** the selection with a structured supervisor policy violation error and does not dispatch the candidate.

---

## 2. Server-Only Configuration

Configuration is managed strictly server-side:

```env
HERMES_ENABLED=true
HERMES_BASE_URL=https://hermes.example.com
HERMES_API_KEY=secret_key_here
HERMES_MODEL=hermes-3
HERMES_TIMEOUT_MS=10000
HERMES_AUTHORIZATION_MODE=confirm_each
```

Credentials and secret values are never exposed to browser-visible state or `AgentProfile` records.

---

## 3. Authorization Modes

Hermes operates under three authorization modes:

1. **`suggest_only`**: Hermes can analyze, propose, and plan, but **cannot** perform any mutations on work or control plane state.
2. **`confirm_each`** *(Default)*: Hermes prepares typed `SupervisorActionProposal`s, but user approval is required before mutation or dispatch.
3. **`authorized`**: Hermes may execute explicitly permitted typed operations autonomously.

**Safety Invariant**: No authorization mode permits raw shell access, raw SQL execution, policy bypass, or secret extraction.

---

## 4. Typed Supervisor Tools

Hermes interacts with the domain strictly through standard domain and service layer operations (no raw database mutation):

- **Search & Inspection**: `search_graph`, `get_entity`, `get_task`, `get_project`
- **Task & Project Management**: `create_task`, `update_task`, `create_subtask`, `set_task_status`, `set_task_priority`, `set_task_due_date`, `create_project`, `update_project`
- **Graph Topology**: `link_entities`, `unlink_entities`, `add_dependency`, `remove_dependency`
- **Routing & Delegation**: `preview_route`, `route_task`, `create_delegation`, `queue_delegation`, `authorize_delegation`, `cancel_delegation`

---

## 5. Health Monitoring & Endpoints

A safe, secret-free health endpoint is provided at:

```http
GET /api/control/hermes/health
```

Response format:

```json
{
  "enabled": true,
  "reachable": true,
  "state": "ready",
  "model": "hermes-3",
  "provider": "http_hermes"
}
```

---

## 6. Testing & Live Probe

Standard test suite runs against a deterministic fake provider:

```bash
npm test
```

Optional live probe to test an actual Hermes instance:

```bash
npm run test:hermes
```
