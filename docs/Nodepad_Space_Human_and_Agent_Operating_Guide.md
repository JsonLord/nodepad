# Nodepad Hugging Face Space — Human & Agent Operating Guide

**Space:** `Leon4gr45/nodepad-hypotheses`  
**Human UI:** `https://leon4gr45-nodepad-hypotheses.hf.space/`  
**API docs:** `https://leon4gr45-nodepad-hypotheses.hf.space/api-docs`  
**Health:** `https://leon4gr45-nodepad-hypotheses.hf.space/health`  
**Current source basis:** `JsonLord/nodepad` PR #17, head `de9ca615944d459fa022bf3810397c94de858206`  
**Qualified reasoning backend:** Fable5/Gemma through an OpenAI-compatible server route; current deployment work has used `gemma-3-4b-it-qat-q4_0` with BGE-style local embeddings.

---

## 1. What Nodepad is

Nodepad has two complementary layers:

1. **Human spatial canvas** — a browser-first thinking environment with tiling, kanban, and graph views. Projects and notes in this classic UI are stored in the browser's `localStorage` and can be imported/exported as `.nodepad` or Markdown.
2. **Canonical evidence brain** — a server-side workspace graph under `/api/v1/workspaces/{id}`. It stores evidence, hypotheses, adjudications, research tasks/results, syntheses, events, heartbeat state, and promoted brain knowledge.

These layers intentionally coexist. The browser canvas is fast and personal; the evidence brain is auditable, durable server state designed for humans, agents, and automated research loops.

### Authority model

Nodepad deliberately separates **interpretation** from **authority**:

- Embeddings find potentially related material; they do not assign support, condiction, confidence, qualification, or promotion.
- The LLM interprets evidence and can generate hypothesis proposals.
- Deterministic Nodepad code controls scores, confidence, qualification bands, and brain promotion.
- Direct API evidence with an explicit `relation` is treated as an authorized caller assertion, not as an LLM inference.
- Research results are routed through adjudication; the research task's objective never determines the evidence relation.

For structured LLM output, Nodepad now treats the authoritative boundary as:

`provider response -> exact JSON.parse -> strict Zod validation -> capability cache -> domain logic`

The automatic transport compatibility order is:

`json_schema -> json_object -> prompt_json`

A successful fallback mode is cached only after strict parsing and Zod validation succeed.

---

## 2. Credentials and access

Nodepad deliberately separates human and machine credentials.

| Purpose | Secret | How it is used |
|---|---|---|
| Human/browser login | `NODEPAD_LOGIN_KEY` | Entered on `/login`; creates an HttpOnly server session cookie |
| Agent/machine API | `NODEPAD_API_KEY` | `Authorization: Bearer <key>` on protected API calls |
| Upstream LLM | `OPENAI_API` | Server-side only; never give this to humans or agents using Nodepad |

### Public routes

These do **not** require Nodepad auth:

- `/login`
- `/api/auth/status`
- `/api/auth/login`
- `/api/auth/logout`
- `/health`
- `/api-docs`
- required static assets

Everything under the application data API is protected.

### Important security rules

- Never use `NODEPAD_LOGIN_KEY` as a bearer token.
- Never put credentials in query parameters, workspace data, prompts, notes, or Git history.
- Agents use only `NODEPAD_API_KEY`.
- Browser mutations use same-origin protection; bearer-authenticated machine calls are exempt.
- Five failed human login attempts per minute trigger rate limiting.
- Browser sessions are HttpOnly and have a 30-day maximum age.

---

# PART I — HUMAN USE

## 3. Human quick start

### Step 1 — Open the Space

Open:

`https://leon4gr45-nodepad-hypotheses.hf.space/`

If not authenticated, Nodepad sends you to the login view.

### Step 2 — Log in

Enter the **human access key** configured as `NODEPAD_LOGIN_KEY`.

A successful login creates a server-side session and sets an HttpOnly cookie. The key itself is not stored in browser local storage.

If login fails:

- `401` — wrong key
- `429` — too many attempts; wait for the retry window
- `503` — the deployment owner has not configured `NODEPAD_LOGIN_KEY` or the session store cannot create the session

### Step 3 — Choose or create a project

Use the left project sidebar to:

- select a project,
- create a new project,
- rename a project,
- delete a project,
- import a `.nodepad` project.

The active project ID is also used as the server evidence-brain workspace ID when the Brain panel is opened.

### Step 4 — Add notes

Use the central input bar and press **Enter** to add a note.

The classic canvas can classify/enrich notes and infer connections. Useful keyboard actions include:

- `Enter` — add a note
- `Cmd/Ctrl + K` — command palette
- `Cmd/Ctrl + Z` — undo
- `Escape` — deselect / close panels
- double-click a note — edit it

### Step 5 — Change views

Nodepad provides three main views:

- **Tiling** — spatial BSP layout for associative thinking
- **Kanban** — notes grouped by category/type
- **Graph** — graph view of relationships and centrality

Use the status bar / command palette to switch views.

### Step 6 — Open the Evidence Brain

In the status bar, click **brain**.

The Evidence Brain is server-backed and shows the canonical evidence/hypothesis state for the active project/workspace ID.

It exposes, per hypothesis:

- qualification band,
- evidence score,
- confidence,
- strategic importance,
- uncertainty,
- promoted/not promoted state,
- supporting evidence,
- contradicting evidence,
- research gaps,
- active research tasks,
- dependencies and event history.

Useful filters include:

- all,
- qualified,
- potential,
- contested,
- disqualified,
- stale,
- unresearched,
- promoted,
- high priority.

### Step 7 — Check embeddings / heartbeat / backup

The status bar also shows:

- **Embeddings** — whether the semantic layer is available or operating in fallback mode
- **Heartbeat** — current/recent heartbeat status
- **Backup** — configured/disabled/last backup state

Buttons beside those states let a human trigger:

- `POST /api/v1/workspaces/{id}/heartbeat`
- `POST /api/v1/workspaces/{id}/github/backup`

Backup only works when the deployment owner has configured the backup/GitHub settings.

### Step 8 — Log out

Use the sidebar logout control. Logout revokes the server session and expires the cookie.

---

## 4. Human data model: local canvas vs server brain

This distinction is essential.

### Browser-local canvas

The classic UI stores projects under browser local storage keys including:

- `nodepad-projects`
- `nodepad-active-project`
- `nodepad-backup`

That means changing browser/device/profile can change what you see on the visual canvas unless you export/import your project.

### Server-side evidence brain

The canonical server workspace persists as a JSON workspace in `NODEPAD_DATA_DIR` and contains:

- nodes and edges,
- evidence,
- hypotheses,
- adjudications,
- syntheses,
- research tasks,
- research results,
- events,
- brain promotion state,
- heartbeat / backup state.

The current UI's Evidence Brain **reads** that server workspace and exposes heartbeat/backup controls. The main canvas itself does not automatically POST each browser note into `/api/v1/workspaces/{id}/evidence`.

For a human who wants authoritative evidence-brain data, use either:

1. an agent connected to the API, or
2. direct API calls / tooling against the protected `/api/v1` endpoints.

---

## 5. A good human workflow

A practical pattern is:

1. **Think spatially** in the canvas — collect notes, questions, claims, observations, ideas.
2. **Decide what is evidence-worthy** — source-backed observations, measurements, interviews, experiments, external findings.
3. **Send authoritative material into the evidence brain** through an agent/API integration.
4. **Inspect the brain** — check what supports/contradicts each hypothesis and where uncertainty remains.
5. **Trigger research** — let agents create/claim research tasks and submit results.
6. **Run heartbeat** — refresh deterministic scoring, qualification, synthesis, and operational state.
7. **Review promotion** — treat promoted brain knowledge as a higher bar than generated hypotheses.

---

# PART II — AGENT / MACHINE USE

## 6. Agent connection contract

### Base URL

```text
https://leon4gr45-nodepad-hypotheses.hf.space
```

### Required auth header

```http
Authorization: Bearer ${NODEPAD_API_KEY}
```

### Recommended identity headers

```http
X-Nodepad-Actor-Type: agent
X-Nodepad-Actor-Id: my-agent-name
X-Nodepad-Actor-Role: researcher
X-Nodepad-Session-Id: session-123
X-Agency-Task-Id: task-456
X-Correlation-Id: run-2026-10-20-001
```

Only `X-Nodepad-Actor-Type` and `X-Nodepad-Actor-Id` are normally essential for good provenance; the rest are optional but strongly recommended for multi-agent workflows.

### Mutation safety headers

Use a stable `Idempotency-Key` for operations that must not duplicate on retry:

```http
Idempotency-Key: research-result:source-123:hypothesis-456
```

For revision-sensitive operations, first read the workspace revision and then send:

```http
If-Match: 17
```

A stale revision returns `409` instead of overwriting newer state.

### Workspace ID rule

Workspace IDs may contain only letters, numbers, `_`, and `-`.

Good:

```text
aux-validation
customer-research-2026
workspace_01
```

Bad:

```text
customer/research
my workspace
```

A workspace is effectively created on first persisted mutation. Reading an unknown workspace can return an empty in-memory workspace, but it will not appear in the persistent workspace list until saved by a mutation.

---

## 7. Agent bootstrap sequence

Before doing work, an agent should run this sequence.

### 7.1 Health

```bash
curl -sS \
  https://leon4gr45-nodepad-hypotheses.hf.space/health
```

Expected: HTTP 200.

### 7.2 API documentation

```bash
curl -sS \
  https://leon4gr45-nodepad-hypotheses.hf.space/api-docs
```

### 7.3 Authentication check / list workspaces

```bash
curl -sS \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces
```

### 7.4 Read workspace context

```bash
curl -sS \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/context
```

Use the returned `revision` for optimistic concurrency when needed.

---

## 8. Recommended agent research loop

The preferred agent path for new external findings is **research task -> result -> adjudication**, not direct assertion.

### 8.1 Create a hypothesis

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Nodepad-Actor-Type: agent" \
  -H "X-Nodepad-Actor-Id: research-agent" \
  -H "X-Correlation-Id: run-001" \
  -H "Idempotency-Key: hyp:checkout-latency" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/hypotheses \
  -d '{
    "title": "Checkout latency drives abandonment",
    "statement": "Customers abandon checkout because payment processing is too slow.",
    "hypothesisType": "proposition",
    "strategicImportance": 80
  }'
```

New hypotheses begin unresolved. Generated/created hypotheses do not become qualified merely because an LLM proposed them.

### 8.2 Create a research task

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Nodepad-Actor-Type: agent" \
  -H "X-Nodepad-Actor-Id: research-agent" \
  -H "Idempotency-Key: task:checkout-latency:discriminate" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/research/tasks \
  -d '{
    "question": "Does payment latency causally contribute to checkout abandonment?",
    "objective": "discriminate",
    "hypothesisIds": ["hyp_..."],
    "preferredSources": ["web", "github"],
    "priority": 80,
    "requiredSourceDiversity": 2,
    "maxCostClass": "free"
  }'
```

Valid objectives are:

- `support`
- `disconfirm`
- `discriminate`
- `refresh`
- `discover`

The objective is a research intention only. It does **not** determine whether resulting evidence supports or contradicts the hypothesis.

### 8.3 Claim the task

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Nodepad-Actor-Type: agent" \
  -H "X-Nodepad-Actor-Id: research-agent" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/research/tasks/TASK_ID/claim \
  -d '{ "ttlMs": 300000 }'
```

Claims are exclusive and expire. The maximum TTL is one hour.

### 8.4 Perform research using the agent's own tools

The research agent can use web search, connected apps, code, local files, or other tools. Nodepad does not require the agent to perform research inside Nodepad itself.

The agent should preserve provenance such as source URL, source/provider name, publication date, and a concise evidence excerpt.

### 8.5 Submit the result

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Nodepad-Actor-Type: agent" \
  -H "X-Nodepad-Actor-Id: research-agent" \
  -H "X-Correlation-Id: run-001" \
  -H "Idempotency-Key: result:checkout-study:2026-10-20" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/research/tasks/TASK_ID/results \
  -d '{
    "providerId": "web-research",
    "title": "Checkout latency study",
    "excerpt": "Session recordings show 41% of users leaving checkout while waiting through a 12-second payment-processing delay.",
    "url": "https://example.org/study",
    "publishedAt": "2026-10-19T12:00:00Z"
  }'
```

Submission automatically:

1. stores the research result,
2. creates a durable evidence record,
3. runs semantic relevance filtering when available,
4. adjudicates the evidence against each task hypothesis,
5. creates score-bearing support/contradiction edges only when thresholds are met,
6. marks the research task complete.

### 8.6 Read adjudications

```bash
curl -sS \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  https://leon4gr45-nodepad-hypotheses.hf.spaace/api/v1/workspaces/aux-validation/adjudications
```
A durable adjudication records items such as:

- evidence ID,
- hypothesis ID,
- relation: `supports`, `contradicts`, `neutral`, or `uncertain`,
- relevance,
- directness,
- interpretation confidence,
- model/provider,
- prompt/schema version,
- transport provenance (`requestedMode`, `effectiveMode`, `compatibilityRetryUsed` when applicable),
- run/input provenance.

### 8.7 Query the graph

```bash
curl -sS \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  "https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/graph?nodeId=hyp_...&depth=2"
```

Graph filters:

- `nodeId`
- `kind`
- `depth` (0-3)
- `qualification`
- `important=true`
- `stale=true`
- `contested=true`

### 8.8 Run heartbeat

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/heartbeat \
  -d '{ "runId": "heartbeat-run-001" }'
```

Heartbeat is the operational consolidation pass for queued work, scoring, synthesis, qualification changes, and optional backup.

### 8.9 Re-read the brain

```bash
curl -sS \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/brain
```

The agent should treat the persisted brain/graph/adjudications as the source of truth, not its own previous natural-language summary.

---

## 9. When to use direct evidence assertions

An agent can add evidence directly:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Nodepad-Actor-Type: agent" \
  -H "X-Nodepad-Actor-Id: measurement-agent" \
  -H "Idempotency-Key: ev:first-party-latency-001" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/evidence \
  -d '{
    "claim": "Production telemetry shows median payment confirmation latency increased from 2.1s to 11.8s during the conversion drop.",
    "hypothesisId": "hyp_...",
    "relation": "supports",
    "sourceType": "production_telemetry",
    "sourceRef": "metrics:checkout-latency-2026-10-20",
    "evidenceType": "measured",
    "firstParty": true,
    "strength": 5,
    "weight": 1
  }'
```

Use explicit `relation` only when the caller is intentionally making an authoritative assertion. This path can immediately affect deterministic hypothesis scoring.

If the relationship needs interpretation, omit the direct relation and prefer the research-task/result pipeline.

Nodepad rejects attempts to inject authoritative fields such as:

- `qualification`
- `confidence`
- `evidenceScore`

---

## 10. Synthesis

Run a registered synthesis by ID:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Nodepad-Actor-Type: agent" \
  -H "X-Nodepad-Actor-Id: synthesis-agent" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/syntheses/run \
  -d '{ "synthesisType": "S012", "runId": "synthesis-001" }'
```

Reasoning-heavy definitions can use LLM-assisted structured generation; mechanical/validation families remain deterministic.

Important:

- synthesis creates **proposals**, not qualified truth,
- new generated hypotheses start unresolved,
- generated hypotheses do not receive fabricated support edges,
- derivation is not validation,
- unknown evidence citations invalidate LLM output.

---

## 11. Recording agent activity

Agents can append auditable workflow events.

Allowed event types:

- `agent.task_started`
- `agent.evidence_submitted`
- `agent.artifact_created`
- `agent.handoff`
- `agent.task_completed`

Example:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $NODEPAD_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Nodepad-Actor-Type: agent" \
  -H "X-Nodepad-Actor-Id: research-agent" \
  -H "Idempotency-Key: event:run-001:completed" \
  https://leon4gr45-nodepad-hypotheses.hf.space/api/v1/workspaces/aux-validation/events/agent \
  -d '{
    "type": "agent.task_completed",
    "entityId": "TASK_ID",
    "after": {
      "summary": "Submitted one measured result and one contradictory result."
    }
  }'
```

---

## 12. Endpoint reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Public readiness check |
| GET | `/api-docs` | Public endpoint documentation |
| GET | `/api/v1/llm/status` | Configured LLM provider status |
| GET | `/api/v1/llm/models` | Discover sanitized model IDs |
| POST | `/api/v1/llm/test` | Test the configured LLM provider |
| GET | `/api/v1/portfolio` | Summary across persisted workspaces |
| GET | `/api/v1/workspaces` | List persisted workspaces |
| GET | `/api/v1/workspaces/{id}/context` | Revision, embeddings, heartbeat, backup status |
| GET | `/api/v1/workspaces/{id}/graph` | Filtered graph/subgraph query |
| GET/POST | `/api/v1/workspaceso{id}/evidence` | Read/add evidence |
| GET/POST | `/api/v1/workspaces/{id}/hypotheses` | Read/create hypotheses |
| GET | `/api/v1/workspaces/{id}/hypotheses/{hypothesisId}` | Read one hypothesis |
| GET | `/api/v1/workspaces/{id}/adjudications` | Read durable evidence adjudications |
| GET/POST | `/api/v1/workspaces/{id}/research/tasks` | Filter/create research tasks |
| POST | `/api/v1/workspaceso{id}/research/tasks/{taskId}/claim` | Exclusively claim a task |
| POST | `/api/v1/workspaces/{id}/research/tasks/{taskId}/results` | Submit result; triggers evidence/adjudication |
| POST | `/api/v1/workspaces/{id}/syntheses/run` | Run synthesis registry definition |
| GET | `/api/v1/workspaceso{id}/brain` | Export current qualified brain state |
| POST | `/api/v1/workspaces/{id}/brain/export` | Brain export alias |
| GET | `/api/v1/workspaces/{id}/events` | Audit event stream |
| POST | `/api/v1/workspaces/{id}/events/agent` | Record correlated agent event |
| POST | `/api/v1/workspaces/{id}/heartbeat` | Run heartbeat |
| POST | `/api/v1/workspaces/{id}/github/backup` | Trigger configured backup |
| POST | `/api/v1/workspaces/{id}/github/restore` | Stage restore from a snapshot ref |

---

## 13. Python agent client example

```python
import os
import time
import httpx

BASE = "https://leon4gr45-nodepad-hypotheses.hf.space"
API_KEY = os.environ["NODEPAD_API_KEY"]

client = httpx.Client(
    base_url=BASE,
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
        "X-Nodepad-Actor-Type": "agent",
        "X-Nodepad-Actor-Id": "my-research-agent",
        "X-Nodepad-Actor-Role": "researcher",
    },
    timeout=60,
)

def request(method, path, **kwargs):
    for attempt in range(4):
        r = client.request(method, path, **kwargs)
        if r.status_code not in {429, 502, 503, 504}:
            r.raise_for_status()
            return r.json() if r.content else None
        if attempt == 3:
            r.raise_for_status()
        time.sleep(2 ** attempt)

workspace = "aux-validation"
context = request("GET", f"/api/v1/workspaces/{workspace}/context")
print("revision", context["revision"])

hypothesis = request(
    "POST",
    f"/api/v1/workspaces/{workspace}/hypotheses",
    headers={"Idempotency-Key": "hyp:checkout-latency"},
    json={
        "statement": "Customers abandon checkout because payment processing is too slow.",
        "strategicImportance": 80,
    },
)

print(hypothesis["id"])
```

### Retry policy

Safe operational default:

- retry: `429`, `502`, `503`, `504`
- do not blindly retry: `400`, `401`, `403`, `409`
- use stable idempotency keys before retrying mutations
- on `409`, re-read context/revision and reconcile

---

## 14. Agent system prompt / operating policy

Use this as a base instruction for an autonomous Nodepad-connected agent:

```text
You are connected to Nodepad, an evidence-to-hypothesis operating system.

NODEPAD BASE URL:
https://leon4gr45-nodepad-hypotheses.hf.space

AUTH:
Read NODEPAD_API_KEY from the environment and send it only as:
Authorization: Bearer <NODEPAD_API_KEY>
Never expose, log, summarize, store, or place the key in workspace content.

IDENTITY:
Send X-Nodepad-Actor-Type: agent and a stable X-Nodepad-Actor-Id.
Use X-Correlation-Id for each research run and Idempotency-Key for every retryable mutation.

SOURCE OF TRUTH:
Treat persisted Nodepad workspace state, adjudications, graph edges, hypothesis qualification, and brain export as authoritative state.
Do not treat your own prior summary, an LLM generation, or a synthesis proposal as validated evidence.

RESEARCH:
Prefer the research-task pipeline for evidence whose relation must be interpreted:
create task -> claim task -> research externally -> submit result -> read adjudication -> read graph/brain.
Research objective is not evidence relation.

DIRECT ASSERTIONS:
Only send an explicit evidence relation when you intentionally make an authoritative caller assertion supported by reliable provenance.
Never attempt to set evidenceScore, confidence, qualification, or promotion directly.

AUTHORITY BOUNDARY:
Embeddings retrieve; LLMs interpret and propose; deterministic Nodepad code scores, qualifies, and promotes.
Generated hypotheses begin unresolved. Derivation is not validation.

CONCURRENCY:
Read workspace context/revision before revision-sensitive mutations. On 409, refresh state and reconcile instead of overwriting.
Use task claim endpoints for exclusive work.

FAILURE HANDLING:
Retry 429/502/503/504 with bounded exponential backoff and the same idempotency key.
Do not retry 400/401/403/409 without diagnosing the cause.

AUDIT:
Record significant lifecycle events using /events/agent.
After meaningful evidence changes, re-read adjudications and the brain before deciding what to do next.
```

---

## 15. Machine-readable connection profile

```yaml
nodepad:
  base_url: https://leon4gr45-nodepad-hypotheses.hf.space
  public:
    health: /health
    api_docs: /api-docs
  auth:
    type: bearer
    env: NODEPAD_API_KEY
  actor_headers:
    X-Nodepad-Actor-Type: agent
    X-Nodepad-Actor-Id: <stable-agent-id>
    X-Nodepad-Actor-Role: <optional-role>
    X-Nodepad-Session-Id: <optional-session-id>
    X-Agency-Task-Id: <optional-agency-task-id>
    X-Correlation-Id: <run-id>
  mutation_headers:
    Idempotency-Key: <stable-operation-key>
    If-Match: <workspace-revision-when-required>
  preferred_loop:
    - GET /api/v1/workspaces/{workspace}/context
    - POST /api/v1/workspaces/{workspace}/research/tasks
    - POST /api/v1/workspaces/{workspace}/research/tasks/{taskId}/claim
    - external_research
    - POST /api/v1/workspaces/{workspace}/research/tasks/{taskId}/results
    - GET /api/v1/workspaces/{workspace}/adjudications
    - GET /api/v1/workspaces/{workspace}/graph
    - POST /api/v1/workspaces/{workspace}/heartbeat
    - GET /api/v1/workspaces/{workspace}/brain
  retry_statuses: [429, 502, 503, 504]
  no_blind_retry_statuses: [400, 401, 403, 409]
```

---

## 16. Troubleshooting

### `401 Unauthorized`

For agents, check that you are using `NODEPAD_API_KEY`, not the human login key. For humans, re-login with the browser access key.

### `403 Forbidden`

Usually a same-origin protection issue for a cookie-authenticated mutation. Machine clients should use bearer auth.

### `409 revision_conflict`

Another writer changed the workspace. Re-read `/context`, inspect current state, then retry with the new revision only after reconciliation.

### `429`

Back off and retry. Human login uses an explicit five-attempts-per-minute limiter.

### `500` from LLM test / reasoning

Check the upstream provider configuration and `/api/v1/llm/status`. Agents normally should not connect directly to Fable5; use Nodepad's reasoning path so structured-output fallback and validation remain centralized.

### Embeddings show `fallback mode`

The system remains usable. Embeddings are an optional semantic layer and do not control deterministic qualification.

### Brain is empty while canvas has many notes

This is expected when only the browser-local canvas has been populated. Send evidence/hypotheses into the server workspace through an agent/API integration.

### Backup says not configured

The deployment owner must configure GitHub/local backup variables and enable `NODEPAD_GITHUB_SYNC` when desired.

---

## 17. Deployment-owner checklist

In Hugging Face Space **Settings -> Variables and secrets**:

### Secrets

```text
NODEPAD_LOGIN_KEY=<strong human key>
NODEPAD_API_KEY=<different strong machine key>
OPENAI_API=<server-side upstream model credential>
```

### Core variables

```text
OPENAI_URL=<OpenAI-compatible endpoint>/v1
OPENAI_MODEL=<default model id>
NODEPAD_SYNTHESIS_MODE=hybrid
NODEPAD_ADJUDICATION_MIN_RELEVANCE=60
NODEPAD_ADJUDICATION_MIN_CONFIDENCE=65
```

### Current semantic deployment pattern

The project has been tested with a local-transformers BGE model for semantic similarity. The exact production embedding variables should match the deployed configuration; embeddings remain optional and fail safely to deterministic fallback behavior.

### Validation after deployment

At minimum verify:

1. `/health` -> 200
2. human login / logout
3. invalid browser session -> 401 on protected API
4. bearer API key -> protected API works
5. `/api/v1/llm/status`
6. embeddings status in `/context`
7. create hypothesis -> create task -> submit result -> persisted adjudication/edge
8. heartbeat
9. restart/session persistence behavior appropriate to the Space storage model
10. no secrets in logs or workspace serialization

---

## 18. Mental model to remember

**Human canvas:** think, arrange, explore.  
**Agent API:** research, persist, coordinate, audit.  
**Embeddings:** retrieve likely relevance.  
**LLM:** interpret and propose.  
**Deterministic core** score, qualify, promote.  
**Brain:** persisted, auditable source of truth.

That separation is the central operating principle of the Nodepad Space.
