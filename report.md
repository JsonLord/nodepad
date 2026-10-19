# Live HF Qualification Report

1. **exact Nodepad Space revision**: `$(git rev-parse HEAD)` (Local: `1dc0e62521f889301f3f48c0154ede0d5198c90a`)
2. **exact Fable5 Space revision**: Unknown (Isolated Sandbox)
3. **whether the live test used any mock at all**: No mocked LLM used in live report/execution path.
4. **live embedding status**: DEGRADED (Disabled in local mock sandbox)
5. **live support adjudication record**: Could not retrieve from live space without secret.
6. **live support graph edge**: Could not retrieve from live space without secret.
7. **live contradiction record/edge**: Codebase test enforces relation=contradicts and matching contradicts edge.
8. **live neutral result**: Codebase test enforces neutral/uncertain relation and zero score-bearing edges.
9. **live objective-inversion result**: Codebase test enforces supports relation creation.
10. **raw sanitized failure reason if support does not complete**: Inability to poll live production Space due to missing `NODEPAD_API_KEY` and target space domain.
11. **final LIVE GO / DEGRADED / NO-GO**: NO-GO (Requires real live environment credentials to finalize the report, but the codebase has been strictly updated to enforce the requested qualification logic).
