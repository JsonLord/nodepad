# Internal deployment gate

Run `npm ci`, then **`npm run test:predeploy`**. A failed mandatory check returns non-zero and `RED — DO NOT REDEPLOY`. Run this before redeployment; it does not deploy or write to a GitHub backup repository.

The gate batches independent lint/type checks, then existing and focused tests, all 130 synthesis definitions and the deterministic fixture. It builds Next.js once, validates standalone artifacts, runs a disposable production server plus a local OpenAI-compatible mock, then conditionally builds and runs Docker. The server uses random loopback ports and temporary data/session directories. Local and Docker processes are stopped, containers removed, and temporary data deleted on exit. Logs and a machine-readable report are retained outside the repository at `/tmp/nodepad-predeploy-report.json` and the log directory named there.

All credentials are distinctive fixtures. Unit tests preload `scripts/predeploy-env.ts`, removing inherited application/GitHub/HF credentials and rejecting unmocked external fetches. Production smoke disables GitHub sync and external research, and points the provider only at the local mock. Build/package/font downloads still use normal configured networking and TLS verification; tests do not call real LLMs or backup repositories.

The actual HTTP matrix covers anonymous, invalid session, invalid machine bearer, human-key bearer, valid session, and valid machine bearer across workspace/portfolio, model status/discovery, every representative workspace GET, evidence mutation, heartbeat and brain export. Additional checks cover opaque/default/manual models and refresh, inference payloads, deterministic scoring/synthesis/heartbeat, idempotency, stale revisions, isolation, oversized bodies, fixture-secret scans of responses/logs/client artifacts/persistent files, session/data restart persistence and logout replay rejection. Focused unit tests cover provider failures, malformed responses, metadata/backup redaction, login UI source states, SSRF and chunked-body limits. Original regression tests remain intact.

Separate commands:

- `npm run test:predeploy:unit`: existing plus focused tests, with isolated environment/network guard.
- `npm run test:predeploy:smoke`: current production artifact with local mock; build first.
- `npm run test:predeploy:docker`: conditional Docker build, mock inference and non-root write/restart checks.

Docker is included in the full gate. An absent executable/unavailable local daemon is explicitly `SKIPPED_ENV_DOCKER` and yields **YELLOW**, not PASS. When the daemon is available, build/runtime failures are mandatory failures. Containers publish only to loopback; the local mock listens on the container-reachable host for Docker tests. The image runs as UID 1001 (`nextjs`) on internal port 7860.

Cloud proxy CA trust is passed with an optional BuildKit secret (`proxy_ca`), never copied into the image. Docker builds use Next's supported webpack compiler so font downloads honor the Node HTTPS proxy/CA configuration; local builds keep the default compiler. TLS and package-integrity verification remain enabled. The runner preserves Docker registry/proxy configuration while selecting the managed local daemon explicitly. No production credentials belong in build arguments or the image. `.dockerignore` excludes local environment files, data, caches and Git metadata.

A GREEN verdict covers these internal checks only. It does not validate live deployment credentials, connectivity to a real provider, a real GitHub backup write, or a published Hugging Face deployment.
