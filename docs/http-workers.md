# HTTP execution workers

HTTP workers implement `POST /runs`, `GET /runs/{runId}`, optional `POST /runs/{runId}/cancel`, and `GET /health`. Nodepad sends the delegation ID in both the request body and `Idempotency-Key`; workers must retain the same durable run identity when that key is retried. Nodepad owns reconciliation and browsers never contact workers directly.

Profiles contain only server-side configuration: `baseUrl`, `credentialRef`, `submitPath`, `statusPath`, `cancelPath`, `healthPath`, `requestTimeoutMs`, and `pollIntervalMs`. Bearer credentials use an `env:VARIABLE_NAME` reference and the resolved value is never persisted or returned to the browser.

Outbound requests require an exact hostname in `HTTP_AGENT_ALLOWED_HOSTS`. HTTP(S) is mandatory, URL credentials and absolute configurable paths are rejected, and loopback/private/link-local targets are denied unless `HTTP_AGENT_ALLOW_PRIVATE_NETWORKS=true`. DNS results are checked before each operation. Enabling private networking is appropriate for an explicitly trusted local worker, not as a general default.

Responses are timeout- and size-bounded. Artifact metadata is retained as references only (at most 100 entries and 256 KB); Nodepad does not download artifact URLs. Temporary status failures are reconciled by the generic dispatcher as `waiting_for_agent`. Run configuration and durable worker identity permit restart recovery without resubmission.
