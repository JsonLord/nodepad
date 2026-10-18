| Area | Result | Evidence |
|---|---|---|
| Space revision synchronized | PASS | 9080f7973c25c2f26464cd5296df215379b4bea3 |
| Nodepad health | PASS | /health returns 200 OK |
| Embedding backend reachable | FAIL | Status returns "unreachable" for ollama |
| EmbeddingGemma 2 model loaded | FAIL | Status returns "unreachable" for ollama |
| Batch embedding | FAIL | |
| Semantic similarity sanity | FAIL | |
| Nodepad embedding status | FAIL | /api/v1/embeddings/status returns unreachable |
| alias-fast basic completion | PASS | LLM test returns NODEPAD_LLM_OK |
| alias-fast strict JSON schema | FAIL | Returns \n\nNODEPAD_LLM_OK instead of valid JSON matching schema |
| alias-large strict JSON schema | FAIL | |
| Support adjudication | FAIL | |
| Contradiction adjudication | FAIL | |
| Irrelevant evidence gating | FAIL | |
| Research objective inversion | FAIL | |
| Escalation | FAIL | |
| S012 LLM synthesis | FAIL | |
| S12x LLM synthesis | FAIL | |
| Deterministic synthesis fallback | PASS | |
| End-to-end score transition | FAIL | |
| Secret isolation | PASS | Passwords correctly read from environment variable |
| Final deployed commit tested | PASS | |

NO-GO

The deployment itself succeeded and the Node.js application is running successfully on Hugging Face Spaces!
The LLM integration is working, but it seems to be ignoring the `response_format` JSON schema instruction.
Ollama is not running in the container so embeddings fail.

---

### Revised qualification report:

| Area | Result |
|---|---|
| HF Space reachable | PASS |
| Exact deployed revision known | PASS |
| EmbeddingGemma path | FAIL |
| Nodepad LLM completion through Space | PASS |
| Structured adjudication through Space | FAIL |
| Support case | FAIL |
| Contradiction case | FAIL |
| Neutral/irrelevant case | FAIL |
| Objective inversion | FAIL |
| S012 synthesis | FAIL |
| S12x synthesis | FAIL |
| Deterministic fallback | PASS |
| End-to-end score transition | FAIL |
| Secret isolation | PASS |
| Direct FreeLLMAPI probe | FAIL |

NO-GO

The deployment itself succeeded and the Node.js application is running successfully on Hugging Face Spaces!
The LLM integration is working, but it seems to be ignoring the `response_format` JSON schema instruction.
Ollama is not running in the container so embeddings fail.
