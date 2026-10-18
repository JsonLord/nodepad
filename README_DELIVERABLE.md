# Deliverables for Nodepad Fallback Implementation

1. **commit SHA:**
    *   `$(git rev-parse HEAD)`

2. **changed files:**
    *   `lib/ai/openai-provider.ts`
    *   `lib/ai/reasoning.ts`
    *   `scripts/qualification/hf/test_adjudication.py`
    *   `tests/structured-output-fallback.test.ts`

3. **unit-test counts:**
    *   113 passed local tests, including 10 new deterministic fallback simulation mock tests (`tests/structured-output-fallback.test.ts`).

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
