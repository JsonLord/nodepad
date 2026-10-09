# Pre-redeployment validation results

Validated the working tree based on commit `48d069227a0c7d9974f6f796cb4babffe287a5c8`, on branch `fix-missing-api-key-warning-3568997348856372609`. The tree was clean before validation; all subsequent tracked changes are the predeploy suite and narrow hardening fixes committed with this report.

## Final gate

`npm run test:predeploy` returned exit code **0** and **GREEN — READY TO REDEPLOY**. The final gate ran 2026-10-10 at 00:01 Europe/Berlin. No tests were disabled or weakened. Original tests passed unchanged before additions: 54/54. Final unit/regression suite: 68/68, with zero failures/skips. Separate registry: 2/2; existing full-depth tests exercise all 130 definitions. Deterministic fixture, lint, independent TypeScript check, production build and standalone artifacts passed. Lint retains seven existing warnings, zero errors.

The commands executed were `npm ci`, `npm test`, `npm run test:registry`, `npm run validate:fixture`, `npm run lint`, `npm run build` (through the gate), `npm run test:predeploy`, and `npm run test:predeploy:docker`. The final complete gate reran the entire test suite and production build after the fixes.

| Group | Passed | Failed | Skipped | Result |
|---|---:|---:|---:|---|
| Original tests before additions | 54 | 0 | 0 | PASS |
| Complete unit/regression suite | 68 | 0 | 0 | PASS |
| Authentication runtime assertions | 17 | 0 | 0 | PASS |
| Route/API matrix assertions | 78 | 0 | 0 | PASS |
| Custom model runtime assertions | 11 | 0 | 0 | PASS |
| Secret-isolation runtime assertions | 150 | 0 | 0 | PASS |
| Nodepad core runtime assertions | 18 | 0 | 0 | PASS |
| Persistence/logout runtime assertions | 5 | 0 | 0 | PASS |
| Registry tests | 2 | 0 | 0 | PASS |
| Deterministic fixture | 1 | 0 | 0 | PASS |
| Production build | 1 | 0 | 0 | PASS |
| Standalone artifacts | 3 | 0 | 0 | PASS |
| Docker build/runtime/non-root assertions | 12 | 0 | 0 | PASS |

Rows mix test cases and assertions; overlapping coverage is not additive. The six local smoke sections total 279 assertions. The Docker checks validate an actual image, UID 1001, port 7860, local mock discovery/inference, non-root session/data writes, restart persistence and secret-free logs. Disposable containers and processes were stopped and temporary storage removed.

## Failures found and fixed

| ID | Exact failure/root cause | Affected file(s) | Severity | Fix / retest |
|---|---|---|---|---|
| MODEL-12 / SEC-03 | HTTP 500 repeated the provider fixture credential; `String.replace` removed only the first occurrence. Empty/missing completion choices were also treated as a valid empty result. | `lib/ai/openai-provider.ts` | Critical credential exposure; malformed-response correctness | Redact every credential occurrence, redact thrown request errors, reject malformed completion objects. Focused and entire gates PASS. |
| SEC-01 / SEC-03 | Provider status exception containing the credential appeared in the returned warning. | `lib/ai/openai-provider.ts` | Critical credential exposure | Redact all credential occurrences in status warnings. Focused and entire gates PASS. |
| SEC-01 / CORE-10 | Serialization retained `OPENAI_API` metadata because the sensitive-key expression only recognized API-key names. Direct brain graph exports also returned unredacted metadata. | `lib/github-sync/serialization.ts`, `lib/brain/export.ts`, `lib/security/metadata.ts` | Critical credential exposure | Shared nonmutating metadata redaction includes provider/human/machine credential keys and applies to brain exports. Backup/brain/restore and entire gates PASS. |
| SEC-05 | Oversized chunked mutation without Content-Length returned 201 rather than rejection. The API checked only the declared header size. | `app/api/v1/[...path]/route.ts`, `lib/server/request-body.ts` | High body-limit bypass | Bound actual streamed byte count as well as declared size. Retest returns 400 `request_body_too_large`; entire gate PASS. |
| DOCKER-01 | Alpine package download failed TLS trust; after adding CA trust, Turbopack font downloads failed behind the cloud proxy. | `Dockerfile` | Environment integration blocker while Docker is available | Optional ephemeral CA secret mounts; Docker uses supported webpack compilation to honor Node proxy/trust. TLS verification retained. Actual Docker build/runtime and entire gate PASS. |
| SMOKE-03 | Harness threw `Invalid URL` on a relative Location header. | `scripts/predeploy-smoke.ts` | Test harness defect | Resolve redirect against the local server origin. Entire gate PASS. |

`.dockerignore` additionally prevents local environment files, data and dependency/build caches from entering the Docker build context. No production credential values were used or printed.

## Critical assertions

- Anonymous users cannot read Nodepad data: **YES**.
- Human login works: **YES**.
- Logout works, including replay rejection: **YES**.
- Machine bearer auth works without browser login: **YES**.
- Human and machine keys are separate: **YES**.
- Provider credential stays server-side: **YES**.
- Arbitrary/manual model IDs work: **YES**.
- Deployment default is respected: **YES**.
- No hidden commercial-model fallback is used by model resolution: **YES**.
- Deterministic heartbeat works without an LLM: **YES**.
- GitHub serialization and brain exports exclude credential metadata: **YES**.
- Next production build succeeds: **YES**.
- Docker image builds and runs: **YES**.

All model/backend calls used mocks; backup checks used local serialization/mock remotes. No live LLM, GitHub backup write, HF token or deployment credential was required. These results do not assert that production credentials, remote service access or an actual published deployment work.

The full run's machine-readable report is `/tmp/nodepad-predeploy-report.json`; individual logs are linked there. See `PREDEPLOY.md` for reusable gate instructions.
