# Remote Laya System-1 routing

> Nodepad does not host Laya locally.

The authenticated `POST /api/control/route` endpoint first loads the control plane and applies deterministic assignment, rule, capability, locality, privacy, disabled-profile, and Hermes-supervisor policy. Deterministically resolved routes bypass Laya. Only multiple unresolved eligible candidates are sent by the Hub to a remote OpenAI-compatible endpoint. The browser never receives the Laya API key and no generic chat-completions proxy is exposed.

## Configuration

Set `LAYA_PROVIDER=remote_openai`, `LAYA_BASE_URL`, `LAYA_MODEL`, and optionally server-only `LAYA_API_KEY`. Operational defaults are: 10-second timeout, four concurrent requests, eight queued requests, 12 candidates, confidence 0.70, and margin 0.15. These are overridden with `LAYA_REQUEST_TIMEOUT_MS`, `LAYA_MAX_CONCURRENT_REQUESTS`, `LAYA_MAX_QUEUE_SIZE`, `LAYA_MAX_CANDIDATES`, `LAYA_MIN_CONFIDENCE`, and `LAYA_MIN_MARGIN`.

`LAYA_BASE_URL` is the OpenAI API root: Nodepad appends `chat/completions` and `models` without adding an extra `/v1`. For example, use `https://host.example/v1` when the serving layer exposes `/v1/chat/completions`.

## Request and response contract

Nodepad sends a JSON-mode chat completion containing only compact routing flags and eligible candidate names, locality, capabilities, privacy class, and description. It does not send a workspace, graph, note bodies, files, credentials, or API keys in the prompt. The response may be a provider-native `decision` object or JSON in `choices[0].message.content`, but it must semantically contain `selectedAgentId` and calibrated `probabilities` for every eligible candidate.

The provider rejects missing/unknown candidates, non-finite or out-of-range values, incomplete distributions, sums outside a 0.01 tolerance, and a selected ID that is not the highest-probability candidate. Missing probabilities are never inferred from prose or token log probabilities.

Confidence is exactly the selected candidate probability. Margin is the top probability minus the runner-up. Both thresholds are inclusive. Low confidence, low margin, unavailable/invalid providers, timeout, saturation, authentication, model, and rate-limit failures return an escalation result for future Hermes; Hermes is not called.

Every deterministic and remote result is stored in `routing_decisions`, separately from the work graph. Audits contain IDs, candidates, probabilities, policy rules, source, thresholds, model ID, latency, revision, and timestamps—not prompts, files, note bodies, or secrets.

## Operations

`GET /api/decision/laya/health` checks the configured model through the remote `/models` endpoint and exposes no endpoint or key. Health is independent from Hub health. Run `npm run laya:probe` or `npm run test:laya-remote` only in an environment configured with the real endpoint. The probe reports compatibility booleans without printing credentials or the private endpoint. Standard `npm test` uses fake providers and never contacts Laya.
