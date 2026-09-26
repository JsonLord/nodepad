# Orchestrator Console

## Overview

The **Orchestrator** is the top-level visual control surface operating over System-2 supervision (Hermes), System-1 routing (Laya), hard deterministic routing policy, generic execution dispatching, worker agent fleets (AGTX, HTTP, Local CLI), and human approval gates.

```text
                         USER
                           │
                    ORCHESTRATOR UI
                           │
                        Hermes
                    System-2 supervisor
                           │
                Nodepad Control Plane
                    /             \
               Routing         Delegations
              /      \              │
       hard rules   Laya        Dispatcher
                    │          /     │      \
                 Hermes      AGTX   HTTP   Local CLI
```

---

## 1. Role Separation

- **Orchestrator**: Unified UI operational cockpit and control plane surface.
- **Hermes**: System-2 supervisory layer responsible for contextual reasoning, planning, task decomposition, and action proposals.
- **Laya**: System-1 probabilistic agent selector.
- **Dispatcher**: Execution gateway managing worker agent delegations.
- **Adapters**: Execution providers (`agtx`, `http`, `local_cli`).

---

## 2. Main Panels

1. **Ask Hermes / Delegate Work**: Prompts Hermes with natural language requests. Hermes responds with structured plans, proposals, and routing explanations.
2. **Needs Your Input**: Prioritized human input queue aggregating pending Hermes action proposals, delegations waiting for human authorization, and execution reviews.
3. **Active Work**: Real-time list of active worker agent runs across AGTX, HTTP workers, and Local CLI processes with provider-native phase details.
4. **Routing Explanation**: Step-by-step trace showing explicit assignments, hard deterministic policy filters, Laya probabilities, and Hermes escalation choices.
5. **Agent Fleet**: Live status of all configured `AgentProfile`s, active run concurrency, capabilities, and health metrics.

---

## 3. Authorization Modes

Hermes operates under three authorization modes in the Orchestrator:

1. **`suggest_only`**: Analysis and proposals only; no state mutation.
2. **`confirm_each`** *(Default)*: Action proposals require explicit human approval before execution.
3. **`authorized`**: Permitted typed action proposals execute autonomously.

---

## 4. Security Invariants

- **Session Authentication**: All Orchestrator and Hermes control endpoints require valid Hub session authentication.
- **Proposal Revalidation**: At approval time, every action proposal is revalidated against current domain entities, agent profiles, and hard policy filters before executing.
- **Idempotency**: Proposal approvals are locked to prevent duplicate execution upon double-click or network retry.
- **No Secret Leakage**: Credentials, API tokens, and secret provider configs are strictly excluded from API responses, UI states, and proposal records.
- **Browser Protection**: In browser-only/offline mode, Orchestrator mutations are disabled.
