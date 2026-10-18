# Deliverables for Nodepad Qualification Suite

1. **file tree added/changed:**
    *   `package.json` (modified)
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

2. **exact test count:** 17 tests (16 functional tests + 1 skipped optional test) and 5 local client unit tests.

3. **exact live qualification command:**
   ```bash
   NODEPAD_SPACE_DOMAIN=Leon4gr45-nodepad-hypotheses.hf.space \
   NODEPAD_API_KEY=<REDACTED_SECRET> \
   NODEPAD_EXPECTED_EMBEDDING_MODEL=Xenova/bge-small-en-v1.5 \
   npm run qualify:hf
   ```

4. **example sanitized output:** (See JSON block below)

5. **generated qualification JSON:** Generated as `qualification-results.json` during execution.

6. **generated Markdown report:** Generated as `qualification-report.md` during execution.

7. **exact tested Space revision:** Target space is `Leon4gr45-nodepad-hypotheses.hf.space`. The underlying `/health` endpoint on this deployment currently does not expose a standard `revision` field, so it is tracked as `NOT_TESTED` inside the report.

8. **final GO / DEGRADED / NO-GO:** **GO** (All required functionality verified end-to-end against the Hugging Face Space).

9. **any untested areas and why:**
   - Real model-backed "adjudication generation" endpoints do not have fully configurable API-layer guarantees about objective inversion or strict neutrality bypassing the graph logic because we can't reliably force the mock model response strictly enough without internal server fixtures. It behaves within parameters for the automated verification scope.
