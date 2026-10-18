# Optional semantic layer

EmbeddingGemma 2 via Ollama is optional. If disabled or unavailable, Nodepad falls back to its existing deterministic evidence identity, normalized-text hypothesis matching, lexical themes and research relevance behavior. Embeddings improve retrieval and matching; they never classify support/contradiction or control scores, confidence, qualification, or brain promotion/demotion.

Configure the server/worker environment (not browser settings):

```sh
NODEPAD_EMBEDDING_ENABLED=true
NODEPAD_EMBEDDING_PROVIDER=ollama
NODEPAD_EMBEDDING_URL=http://127.0.0.1:11434
NODEPAD_EMBEDDING_MODEL=embeddinggemma2
```

The example model identifier is fully configurable. Install/pull the exact embedding model tag supported by your Ollama installation; CI does not assume `embeddinggemma2` exists or download it. Run Ollama separately. Inside a container, loopback refers to that container: use a reachable Ollama service URL when running it elsewhere. This patch does not install Ollama, bundle model weights, or add an embedding secret.

The backend-neutral `EmbeddingProvider` exposes `embed(texts)` and `health()`. The Ollama adapter POSTs `/api/embed` with `{model,input:[...],truncate:false}`, in batches of up to 32, and expects one finite, nonzero, dimensionally consistent vector per input. It rejects malformed responses and normalizes errors without exposing URLs, credentials or raw bodies. Requests default to a 5000ms timeout (`NODEPAD_EMBEDDING_TIMEOUT_MS`, bounded to 100–30000ms). No browser calls Ollama. `/api/tags` checks connectivity and model installation; an available health status does not guarantee that every input can be embedded. Oversized inputs are not silently truncated: the affected batch falls back instead.

Durable vectors live in `NODEPAD_DATA_DIR/.embeddings`, outside workspace JSON and GitHub serialization, with private file permissions and atomic writes. Keys hash provider, model, endpoint and a SHA-256 content hash. Raw text is not stored in cache files. Unchanged content is reused across processes/heartbeats; changing model/endpoint naturally rekeys. Corrupt/missing entries are misses, storage failure is nonfatal, and mixed dimensions trigger fallback. If weights are replaced under the same tag with identical dimensions, clear `.embeddings` or change the configured tag. Cache eviction and cross-process request coalescing are not implemented.

Thresholds (cosine similarity; invalid settings revert to defaults):

| Variable suffix (`NODEPAD_EMBEDDING_…_THRESHOLD`) | Default | Purpose |
|---|---:|---|
| `EVIDENCE_DUP` | 0.92 | Conservative duplicate merging after exact identity |
| `HYPOTHESIS_DUP` | 0.90 | Same-type hypothesis duplicate matching |
| `THEME` | 0.80 | Nearest semantic theme assignment |
| `RELEVANCE` | 0.35 | Gate existing research-result relation handling |

Exact dedupe remains first and linear when embeddings are off. Semantic merges retain full `duplicateRecords`, provenance, source refs, corroboration and `aliases`; hypothesis/synthesis evidence references and graph endpoints are remapped. Negation/numeric-claim mismatches and already-adjudicated opposing evidence cannot be semantically merged. Similarity remains an imperfect duplicate detector: use conservative thresholds and inspect retained originals. Independent related claims below the threshold stay separate.

Hypothesis duplicates use exact normalized matching first and then a high-similarity, same-type match. Moderate semantic similarity does not generate epistemic edges. `supersedes` now requires explicit replacement classification; neither lexical similarity nor embeddings imply replacement intent. Existing lexical alternative detection remains unchanged and is not driven by embeddings.

Semantic theme clustering uses deterministic ID order and reuses prior theme identities as seeds. Themes retain member evidence IDs, centroid metadata, provenance, timestamps and current membership edges. No vector database is required. Missing vectors fall back to lexical clustering. Centroids/member IDs are safe operational metadata and can be serialized with themes; the vector cache and endpoint configuration are not serialized. Theme nodes from older clustering modes remain historical records.

For research results, low similarity retains the evidence but skips the existing relation handler. High similarity only allows that handler to run; it does not choose the relation. The structured [LLM adjudicator](REASONING.md) now interprets relevant research results; task objectives do not assign their relation. Missing vectors always allow the existing path. Per-hypothesis relevance is recorded in result metadata. Both the research submission service and heartbeat process every task hypothesis. Human/agent explicit evidence ingestion is not overridden by the semantic prefilter.

An unavailable provider is attempted once per semantic-layer instance/heartbeat, then the remainder of that run uses cached vectors/lexical fallback. A future run can retry. Semantic comparisons are in-process and quadratic in the worst case; this is intended for current workspace sizes, not vector-database scale.

`GET /api/v1/embeddings/status` is authenticated like other data APIs and returns only enabled/provider/model/status. Workspace context includes the same safe status. The brain bar displays `Embeddings: available · <model>` or `Embeddings: fallback mode`.

Run `npm test` for deterministic mocked-vector/provider coverage. No live Ollama is required in CI.

## Integration and validation

Added modules: `lib/embeddings/{provider,ollama,cache,similarity,index,dedupe,themes,relevance}.ts` and authenticated `app/api/v1/embeddings/status/route.ts`. Updated heartbeat, hypothesis matcher, research submission/context service, evidence alias/original-record types, brain status UI, environment examples/ignore rules, README/data-model/heartbeat documentation and production-smoke route coverage. Tests live in `tests/embeddings.test.ts`.

Validation on branch `main-9784285964960745014`: `npm ci` succeeded; `npm test` passed 86/86 tests (17 dedicated embedding tests); registry 2/2; deterministic fixture passed; `npx tsc --noEmit` passed; lint zero errors/four existing warnings; production build passed. The isolated production smoke suite passed authentication (17 assertions), route protection including embedding status (84), model selection (11), core workflows (18), secret isolation (156) and restart/logout persistence (5). No live Ollama or model weights were used. Docker image validation was not rerun for this change.
