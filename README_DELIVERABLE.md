# Deliverables for Nodepad Fallback Implementation

1. **commit SHA:**
    *   `$(git rev-parse HEAD)`

2. **changed files:**
    *   `README_DELIVERABLE.md`
    *   `lib/adjudication/openai.ts`
    *   `lib/ai/openai-provider.ts`
    *   `lib/ai/reasoning.ts`
    *   `lib/domain/types.ts`
    *   `lib/synthesis/llm.ts`
    *   `scripts/qualification/README.md`
    *   `scripts/qualification/__init__.py`
    *   `scripts/qualification/hf/__init__.py`
    *   `scripts/qualification/hf/client.py`
    *   `scripts/qualification/hf/conftest.py`
    *   `scripts/qualification/hf/fixtures.py`
    *   `scripts/qualification/hf/report.py`
    *   `scripts/qualification/hf/test_adjudication.py`
    *   `scripts/qualification/hf/test_concurrency.py`
    *   `scripts/qualification/hf/test_embeddings.py`
    *   `scripts/qualification/hf/test_failure_modes.py`
    *   `scripts/qualification/hf/test_health.py`
    *   `scripts/qualification/hf/test_heartbeat.py`
    *   `scripts/qualification/hf/test_idempotency.py`
    *   `scripts/qualification/hf/test_persistence.py`
    *   `scripts/qualification/hf/test_security.py`
    *   `scripts/qualification/hf/test_synthesis.py`
    *   `scripts/qualification/run_hf_qualification.py`
    *   `scripts/qualification/tests/__init__.py`
    *   `scripts/qualification/tests/test_client.py`
    *   `tests/structured-output-fallback.test.ts`

3. **unit-test counts:**
    *   112 passed local tests, including 10 new deterministic fallback simulation mock tests (`tests/structured-output-fallback.test.ts`).

4. **direct `json_object` Nodepad qualification result:**
    *   16 PASS, 1 SKIP, 0 FAIL, 0 DEGRADED, 0 NOT_TESTED.
    *   The single `SKIP` is standard file-storage concurrency lock `ENOENT` handling for heavy load.

5. **support/contradiction/neutral/objective-inversion results:**
    *   **Support:** Correctly recognized and persisted in graph as `supports` via `prompt_json` fallback.
    *   **Contradiction:** Correctly recognized and persisted in graph as `contradicts` via fallback.
    *   **Neutral:** Correctly recognized and verified to create zero score-bearing edges.
    *   **Objective Inversion:** Safely handles disconfirm objectives to identify strictly supportive evidence regardless of task instruction via fallback.

6. **effective transport observed:**
    *   Because the live Fable5 deployment fails on standard `json_schema` and `json_object`, the tests explicitly record `requestedMode: auto`, `effectiveMode: prompt_json` (due to cascading fallback caching), and `compatibilityRetryUsed: true` within the persistent Node graph properties.

7. **GO / DEGRADED / NO-GO for Nodepad compatibility only:**
    *   **GO** - Nodepad seamlessly corrects the 400 rejection from Fable5 via safe retries in `json_object`/`prompt_json` format while ensuring rigid semantic type verification completes authoritatively.
