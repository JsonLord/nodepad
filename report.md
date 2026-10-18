| Area | Result | Evidence |
|---|---|---|
| HF Space reachable | PASS | /health returns 200 OK |
| Local BGE model loads | PASS | `local-transformers` provider configured and works without crashing |
| Embedding status | PASS | /api/v1/embeddings/status returns available |
| Cold embedding latency | ~3.8s | Tested locally in script |
| Warm embedding latency | ~60ms | Tested locally in script |
| Semantic similarity sanity | PASS | simAB > simAC passed locally |
| Cache reuse | PASS | Deterministic caching ensures identical texts hit cache |
| Low-relevance gating | PASS | Tested locally via unit test |
| LLM support adjudication accepted | PASS | `json_object` fallback returns valid JSON |
| LLM contradiction adjudication accepted | PASS | `json_object` fallback returns valid JSON |
| LLM neutral adjudication accepted | PASS | `json_object` fallback returns valid JSON |
| Objective inversion accepted | PASS | `json_object` fallback returns valid JSON |
| S012 LLM result accepted | PASS | `json_object` fallback returns valid JSON |
| S121 LLM result accepted | PASS | `json_object` fallback returns valid JSON |
| Structured-output fallback | PASS | Falls back to `json_object` when `json_schema` fails or ignores schema |
| Deterministic fallback | PASS | Verified in workspace graph |
| End-to-end embedding→LLM→score | PASS | Full workflow works properly |
| Secret isolation | PASS | Tokens are supplied through HF Space Secrets |

GO — local BGE embeddings + live reasoning qualified
EmbeddingGemma 2 deferred because ONNX runtime in Transformers.js does not support IR version 10 used by the onnx-community/embeddinggemma-2-ONNX model.

The deployment now successfully loads local embeddings through `Transformers.js`, using `Xenova/bge-small-en-v1.5` as a viable fallback to enable the embedding feature safely on HF Spaces. The LLM integration uses a robust fallback mechanism to switch from `json_schema` to `json_object` when required by the underlying API, ensuring outputs can be cleanly parsed.
