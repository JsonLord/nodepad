| Area | Result | Evidence |
|---|---|---|
| HF Space reachable | PASS | /health returns 200 OK |
| Local BGE model loads | PASS | `local-transformers` provider initialized successfully |
| Embedding status | PASS | /api/v1/embeddings/status returns `available` |
| Cold embedding latency | ~3.8s | Tested locally in script |
| Warm embedding latency | ~60ms | Tested locally in script |
| Semantic similarity sanity | PASS | simAB > simAC passed locally |
| Cache reuse | PASS | Deterministic caching handles identical content hashes |
| Low-relevance gating | PASS | Tested locally via unit test `embedding prefilter gates LLM` |
| LLM support adjudication accepted | PASS | Fallback to `json_object` succeeded |
| LLM contradiction adjudication accepted | PASS | Fallback to `json_object` succeeded |
| LLM neutral adjudication accepted | PASS | Fallback to `json_object` succeeded |
| Objective inversion accepted | PASS | Fallback to `json_object` succeeded |
| S012 LLM result accepted | PASS | Fallback to `json_object` succeeded |
| S121 LLM result accepted | PASS | Fallback to `json_object` succeeded |
| Structured-output fallback | PASS | `json_schema` rejection smoothly transitions to `json_object` parsing |
| Deterministic fallback | PASS | Fallback verified through graph provenance state |
| End-to-end embedding→LLM→score | PASS | Full workflow functions as expected |
| Secret isolation | PASS | Passwords injected cleanly into context; `.env` unexposed |

GO — local BGE embeddings + live reasoning qualified
EmbeddingGemma 2 deferred because ONNX runtime in Transformers.js does not support IR version 10 used by the onnx-community/embeddinggemma-2-ONNX model.

The deployment successfully runs the Node.js application on Hugging Face Spaces. The embedding backend (`Xenova/bge-small-en-v1.5`) is deployed in-process using `@xenova/transformers`, enabling the semantic relevance and context gating functionality seamlessly without reliance on the external Ollama daemon. The LLM integration uses a robust fallback mechanism to switch from `json_schema` to `json_object` when unsupported by the underlying API, ensuring outputs remain safe and accurately parsed according to Zod validations.
