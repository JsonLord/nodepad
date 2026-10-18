# Evidence adjudication and synthesis reasoning

EmbeddingGemma finds potentially related material. LLMs interpret evidence and generate hypotheses. Deterministic code alone controls scoring, confidence, qualification and promotion.

## Research evidence pipeline

Research results are stored as evidence before interpretation. Every task hypothesis is processed independently in both the submission service and heartbeat:

1. Reuse a completed adjudication for unchanged evidence/hypothesis/configuration; retry failed interpretations in a later run.
2. Use the optional embedding prefilter. Below its relevance threshold, retain evidence with a `low_relevance` adjudication record and skip the LLM. Missing embeddings preserve the path to adjudication; they do not imply relevance/support.
3. Ask the fast model for strict structured JSON: relevance 0–100, relation (`supports`, `contradicts`, `neutral`, `uncertain`), directness, adjudication confidence 0–100, bounded rationale. Research objective and a provider's suggested relation are untrusted context, never ground truth. A disconfirmation search may yield supportive evidence.
4. Validate the response deterministically with a strict schema. Prose, malformed JSON, out-of-range values, unknown fields and attempts to set qualification/scores fail to `uncertain`. No score-bearing edge is created on failure.
5. Accept supported/contradictory links only above the relevance/confidence gates. Qualified neutral interpretations remove a prior link if one exists; uncertain/failed interpretations preserve prior accepted knowledge. New neutral/uncertain evidence has no score effect.
6. Rescore using the existing deterministic scoring function. Only the existing brain policy promotes/demotes knowledge.

Direct human/agent/system evidence API calls that explicitly declare a relation remain supported as **explicit assertion adjudications** with caller provenance. The request is an assertion, not an inference made by a research objective. Likewise, explicit evidence references on hypothesis creation are recorded as assertions. Merely passing a relation on a research result does not bypass the LLM. Existing pre-stage linkages are retained; there is no silent retroactive reinterpretation/migration.

`NODEPAD_ADJUDICATION_MIN_RELEVANCE=60` and `NODEPAD_ADJUDICATION_MIN_CONFIDENCE=65` gate linkage. A fast result below `max(MIN_CONFIDENCE, ESCALATE_BELOW)` is uncertain unless eligible for escalation. Defaults: `NODEPAD_ADJUDICATION_ESCALATE_BELOW=70`, `NODEPAD_ADJUDICATION_ESCALATE_MIN_IMPORTANCE=70`. Only low-confidence, sufficiently important cases use an explicitly configured escalation model; there is no mandatory expensive tier. A failed/low-confidence escalation stays uncertain. One run uses a shared model-failure circuit breaker so an unavailable/malformed model is not retried for every result; future runs can retry.

Interpretation confidence is separate from deterministic hypothesis confidence. Directness/rationale do not add score weights. No embedding or LLM assigns scores or promotion.

## Models and configuration

All calls use the existing server-side `completeChat()` OpenAI-compatible endpoint/credential (`OPENAI_URL`, `OPENAI_API`). Role aliases are opaque model IDs:

```sh
NODEPAD_LLM_ADJUDICATION_MODEL=
NODEPAD_LLM_SYNTHESIS_MODEL=
NODEPAD_LLM_ESCALATION_MODEL=
NODEPAD_SYNTHESIS_MODE=hybrid
NODEPAD_ADJUDICATION_MIN_RELEVANCE=60
NODEPAD_ADJUDICATION_MIN_CONFIDENCE=65
NODEPAD_ADJUDICATION_ESCALATE_BELOW=70
NODEPAD_ADJUDICATION_ESCALATE_MIN_IMPORTANCE=70
```

Unset adjudication/synthesis roles use `OPENAI_MODEL`. An unset escalation role disables escalation. Calls request JSON-schema structured output with low temperature. The gateway must support `response_format: json_schema`; unsupported schemas, authentication errors, missing models, rate limits, timeouts and bad JSON fail safely. There is no vendor fallback or client exposure of deployment credentials.

## Synthesis routing

Registry entries now declare `reasoningMode`. S012 and selected reasoning-heavy S121–S130 definitions are LLM-preferred; mechanical/validation families remain deterministic. No 130-agent/prompt architecture is introduced.

- `deterministic`: existing family engine only, without LLM configuration.
- `llm`: structured generation for LLM-preferred definitions, deterministic fallback.
- `hybrid` (default): deterministic scoped family context plus LLM reasoning/proposals for preferred definitions, deterministic fallback.

Both LLM modes use the same scoped, bounded context and safety checks. Evidence, themes, competing hypotheses, known support/contradiction IDs and unknowns are included. Evidence claims are bounded, with at most 40 detailed evidence inputs, 10 themes and 10 competing hypotheses. A shared heartbeat generator allows at most **two** LLM synthesis attempts per run. Each service-requested synthesis has its own small budget. No live external actions are generated or executed.

LLM output is validated strictly; unknown evidence citations invalidate it. New proposals have empty supporting/contradicting evidence and start unresolved through the matcher, even when deterministic fallback generated them. Derivation is not validation. A matching existing hypothesis retains its already-adjudicated relationships. Syntheses with no known support are `draft_ai`; they do not qualify hypotheses. Moderate lexical/semantic similarity creates no strategic edges. Alternatives, replacement and dependencies require explicit classifier/adjudicator intent through the existing matching interface.

Successful syntheses reuse the same input/routing hash. Changing actual evidence content or routing configuration rekeys the result. A recorded fallback synthesis is retained for that input until the input/configuration changes; there is no automatic paid regeneration loop.

## Audit and storage

`workspace.adjudications` contains first-class durable records; old workspaces without the optional field remain valid. Records include model/provider, prompt/schema version, run/time, source evidence and semantic context IDs, input hash, semantic relevance, interpretation, bounded rationale, attempts, fallback/escalation state. Server code owns record IDs/entity bindings. `GET /api/v1/workspaces/:id/adjudications` uses normal session/bearer authentication.

Score-bearing edges reference their adjudication in provenance. Qualification-transition events include the new evidence/adjudication IDs, relation change and before/after score, deterministic confidence and qualification. Synthesis and generated-hypothesis provenance retain the reasoning context. Workspace validation checks record references/ranges/provenance. GitHub serialization and staging restore preserve adjudications under `adjudications/records.ndjson`; no secrets/auth headers are added. Known deployment credential values are scrubbed after JSON parsing, including escaped strings.

## Limits

The system cannot guarantee an LLM's interpretation is true. Thresholds are policy gates, not calibrated probabilities. Explicit API assertions still trust an authorized caller. Strategic hypothesis relationships are not autonomously LLM-classified in this patch; only explicit classification creates them. Failed research adjudications retry on a subsequent heartbeat; there is no distributed adjudication queue or transactional concurrency layer beyond existing workspace leases. Raw prompts/responses are not persisted. No real Ollama or LLM is required in tests; production router/model compatibility must be checked separately.

## Validation for this stage

`npm ci` succeeded. `npm test` passed **102/102** tests, including **16** dedicated reasoning tests. `npm run test:registry` passed 2/2 (the full-depth suite also exercises all 130 definitions); `npm run validate:fixture` passed qualification/brain/backup round-trip checks. `npx tsc --noEmit` and `npm run build` passed. Lint had zero errors and four existing warnings. Production smoke passed authentication (17 assertions), route protection including adjudication records (90), model handling (11), deterministic core workflows (18), secret isolation (162), and restart/logout persistence (5).

Existing research-loop tests now inject an explicit mock adjudicator in place of obsolete task-objective inference; their scoring, promotion/demotion and replay assertions remain unchanged. Mocked tests cover actual embedding relevance through adjudication/rescore, contrary task objectives, malformed/timeout responses, escalation/no-escalation, unvalidated synthesis proposals, fallback/budgets, transition causality, model roles, multi-target submission/heartbeat reuse, escaped secret redaction, content hashing and corrupt snapshot rejection. No real LLM/Ollama endpoint or GitHub backup write was used. Docker validation and live gateway structured-output compatibility were not run for this stage.
