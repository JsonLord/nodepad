# Nodepad web authentication

The login view is ported from [Automaker](https://github.com/JsonLord/automaker/blob/d37ced1c6ee44f721fc80930dfb5baefd7871dde/apps/ui/src/components/views/login-view.tsx), using its centered key panel, spacing, connection retries, invalid-key and loading states. Next.js replaces Automaker's TanStack routing/Zustand state; no credential is stored in browser storage. The MIT notice is in `AUTOMAKER_LICENSE.txt`.

In Hugging Face Space **Settings → Variables and secrets**, add separate **Secrets**:

- `NODEPAD_LOGIN_KEY`: strong random human/browser access key.
- `NODEPAD_API_KEY`: separate strong random machine/agent key.
- `OPENAI_API`: existing model-provider credential, unchanged.

Keep `OPENAI_URL` and `OPENAI_MODEL` as deployment variables. Never use `NEXT_PUBLIC_` for secrets, put keys in the Dockerfile, or include credentials in workspaces. Port 7860 and `/health` are unchanged. Missing auth keys do not enable anonymous access: browser login returns 503 until its secret is configured; a configured machine key can still be used independently.

Browser flow: `/login` checks `/api/auth/status`; `POST /api/auth/login` with JSON `{ "accessKey": "..." }` validates **only** the human key. The response contains success only and sets an HttpOnly, SameSite=Lax, Path=/ cookie with a 30-day expiry; Secure is enabled in production. Logout revokes the session on the server and expires the cookie. Keys/tokens are never returned in JSON or logged. Human keys are compared using fixed-size SHA-256 digests and timing-safe comparison.

Sessions use Automaker-style random server tokens, persisted as keyed-hash filenames with expiry metadata in `NODEPAD_DATA_DIR/.auth` (override with `NODEPAD_AUTH_DIR`). Files have mode 0600; directory mode 0700. Raw session tokens and login keys are not persisted. A human-key rotation invalidates all old sessions. Sessions survive server restarts when this private directory is retained; if storage is ephemeral, users log in again after replacement. This single-instance session store and in-memory login limiter are intended for the current single-container HF deployment, not multiple replicas. Keep the auth directory outside any custom whole-directory backup; built-in Nodepad workspace/brain serialization never includes it.

Failed login attempts are limited to five per minute. Next.js does not expose a reliable socket IP in route handlers, so untrusted deployments use a shared `unknown` bucket. Set `NODEPAD_TRUST_PROXY=true` **only** when the ingress proxy appends/overwrites `X-Forwarded-For` and the app cannot be reached around it. The rightmost valid IP is used; client-supplied prefixes are ignored. Verify the HF ingress contract before enabling this option. Limiting is never disabled for tests.

All app pages and `/api/*` data routes require a valid browser cookie **or** `Authorization: Bearer <NODEPAD_API_KEY>`, including GET workspace/brain, portfolio, config, LLM status/models/test and inference routes. Cookie-authenticated mutations reject cross-origin requests; machine bearer clients are exempt. Public routes: `/login`, `/api/auth/status`, `/api/auth/login`, `/api/auth/logout`, `/health`, `/api-docs`, and required Next.js/static icons. API docs contain no credentials. No cookie or credential query-parameter bypass is supported.

Machines continue using bearer auth directly; they never need a browser session. Model discovery returns sanitized opaque IDs plus the configured default, retaining `OPENAI_MODEL` on discovery failure. The existing custom URL/key controls and manual-model selection are unchanged, and deployed model calls keep `OPENAI_API` server-side.

Local development requires setting the two auth keys in an ignored `.env.local`. Do not commit that file. Run `npm test`, `npm run lint`, `npm run build`. Production cookies require HTTPS; local HTTP smoke tests may send the cookie explicitly, while `npm run dev` uses non-Secure cookies.
