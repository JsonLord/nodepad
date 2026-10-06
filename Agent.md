# Agent Deployment & Operational Guide

This codebase is configured for deployment on Hugging Face Spaces using the Docker SDK.

## 1. Deployment Configuration

### Target Space
- **Profile:** `Leon4gr45`
- **Space:** `nodepad-hypotheses`
- **Full Identifier:** `Leon4gr45/nodepad-hypotheses`
- **Frontend Port:** `7860` (mandatory for Hugging Face Spaces)

### Container & Build Setup
- **SDK:** `docker`
- **Dockerfile:** Multi-stage Docker build utilizing Next.js standalone output mode (`output: "standalone"` in `next.config.mjs`).
- **Port Mapping:** Exposes port `7860` and sets `PORT=7860` and `HOSTNAME="0.0.0.0"`.

### Environment Variables
All configuration variables are read dynamically from `process.env`. Key variables include:
- `NODEPAD_DATA_DIR`: Root directory for file-backed storage (default `./data`).
- `NODEPAD_STORE`: Store strategy (`file`).
- `NODEPAD_HEARTBEAT_ENABLED`: Enables automated heartbeat worker (`true`/`false`).
- `NODEPAD_HEARTBEAT_INTERVAL_SECONDS`: Heartbeat cycle interval.
- `NODEPAD_RESEARCH_ENABLED`: Enables automated background research synthesis.
- `NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT`: Maximum tasks queued per heartbeat cycle.
- `NODEPAD_GITHUB_SYNC`, `NODEPAD_GITHUB_REPOSITORY`, `NODEPAD_GITHUB_TOKEN`, `NODEPAD_GITHUB_BRANCH`: Remote GitHub backup configuration.
- `NODEPAD_API_KEY`: Optional Bearer token for API authorization.

Note: Hugging Face API tokens are passed via runtime environment or headers and never hardcoded.

---

## 2. Mandatory & Functional API Endpoints

### Mandatory Endpoints
- **`/health`**
  - Method: `GET`
  - Purpose: Returns HTTP 200 when container is ready (`{ "status": "ok" }`). Required for HF Space state transition (*starting* -> *running*).
- **`/api-docs`**
  - Method: `GET`
  - Purpose: Documents all functional API endpoints exposed by the server. Accessible at `https://Leon4gr45-nodepad-hypotheses.hf.space/api-docs`.

### Functional Endpoints
- **`/api/v1/portfolio`** (GET): Aggregate portfolio metrics across workspaces.
- **`/api/v1/workspaces`** (GET): List active workspaces.
- **`/api/v1/workspaces/:id/graph`** (GET): Query workspace spatial/knowledge graph with filters.
- **`/api/v1/workspaces/:id/context`** (GET): Context, revision, and backup state.
- **`/api/v1/workspaces/:id/evidence`** (GET, POST): Retrieve or insert evidence claims.
- **`/api/v1/workspaces/:id/hypotheses`** (GET, POST): Retrieve or construct hypothesis nodes.
- **`/api/v1/workspaces/:id/research/tasks`** (GET, POST): Query or queue research tasks.
- **`/api/v1/workspaces/:id/research/tasks/:taskId/claim`** (POST): Claim task execution lease.
- **`/api/v1/workspaces/:id/research/tasks/:taskId/results`** (POST): Submit research task results.
- **`/api/v1/workspaces/:id/brain`** (GET): Inspection state, qualification badges, and audit trail.
- **`/api/v1/workspaces/:id/events`** (GET): Domain event stream.
- **`/api/v1/workspaces/:id/events/agent`** (POST): Append agent event.
- **`/api/v1/workspaces/:id/syntheses/run`** (POST): Execute synthesis family algorithms.
- **`/api/v1/workspaces/:id/heartbeat`** (POST): Trigger manual heartbeat cycle.
- **`/api/v1/workspaces/:id/github/backup`** (POST): Trigger workspace state snapshot sync.
- **`/api/v1/workspaces/:id/github/restore`** (POST): Stage workspace restore from git ref.
- **`/api/fetch-url`** (POST): Server-side URL fetching for research and web grounding.

---

## 3. Iterative Deployment & Monitoring Workflow

### Uploading Files
To deploy updates to the target space:
```bash
python3 -c "
from huggingface_hub import HfApi
api = HfApi(token='<HF_TOKEN>')
api.upload_folder(
    folder_path='.',
    repo_id='Leon4gr45/nodepad-hypotheses',
    repo_type='space',
    ignore_patterns=['node_modules/**', '.next/**', '.git/**']
)
"
```

### Log Monitoring
Stream build logs:
```bash
curl -N -H "Authorization: Bearer <HF_TOKEN>" "https://huggingface.co/api/spaces/Leon4gr45/nodepad-hypotheses/logs/build"
```

Stream runtime logs:
```bash
curl -N -H "Authorization: Bearer <HF_TOKEN>" "https://huggingface.co/api/spaces/Leon4gr45/nodepad-hypotheses/logs/run"
```

### Best Practices & Deployment Tricks
1. **Next.js Standalone Mode:** Always ensure `output: "standalone"` is set in `next.config.mjs` when building inside Docker to minimize image layer size.
2. **Port Binding:** Hugging Face Spaces require binding to `0.0.0.0:7860`.
3. **Storage Persistence:** Next.js standalone runner defaults to local memory/filesystem storage (`NODEPAD_DATA_DIR`). For persistent cross-restart state, configure GitHub backup environment variables (`NODEPAD_GITHUB_SYNC=true`, `NODEPAD_GITHUB_TOKEN`, etc.).
