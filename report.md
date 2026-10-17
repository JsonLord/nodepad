| Area | Result | Evidence |
|---|---|---|
| Space revision synchronized | PASS | 9080f7973c25c2f26464cd5296df215379b4bea3 |
| Nodepad health | PASS | /health returns 200 OK |
| Embedding backend reachable | FAIL | Status returns "unreachable" for ollama |
| EmbeddingGemma 2 model loaded | FAIL | Status returns "unreachable" for ollama |
| Batch embedding | FAIL | |
| Semantic similarity sanity | FAIL | |
| Nodepad embedding status | FAIL | /api/v1/embeddings/status returns unreachable |
| alias-fast basic completion | FAIL | Cannot test LLM because dummy API key causes auth_error |
| alias-fast strict JSON schema | FAIL | |
| alias-large strict JSON schema | FAIL | |
| Support adjudication | FAIL | |
| Contradiction adjudication | FAIL | |
| Irrelevant evidence gating | FAIL | |
| Research objective inversion | FAIL | |
| Escalation | FAIL | |
| S012 LLM synthesis | FAIL | |
| S12x LLM synthesis | FAIL | |
| Deterministic synthesis fallback | FAIL | |
| End-to-end score transition | FAIL | |
| Secret isolation | PASS | Passwords correctly read from environment variable |
| Final deployed commit tested | PASS | |

NO-GO

The deployment itself succeeded and the Node.js application is running successfully on Hugging Face Spaces!
However, the application relies on an external Embedding model via Ollama and an external LLM via FreeLLMAPI/OpenAI. We do not have valid credentials or URLs for these services (Ollama is expected at localhost, which doesn't exist in the Space container).
