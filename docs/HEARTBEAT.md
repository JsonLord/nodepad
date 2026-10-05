# Durable heartbeat

Run once with `npm run heartbeat -- default --once`, or continuously with `npm run heartbeat -- default`. Configure `NODEPAD_HEARTBEAT_INTERVAL_SECONDS`.

The worker takes an expiring lease and executes the full phase sequence. Dedupe merges evidence by source/reference/content identity and research results by task/provider/URL. Theme refresh creates stable canonical theme nodes and evidence links. Synthesis proposals are deterministically matched or created before scoring. Gap planning favors falsification; due queued tasks execute through eligible free-first providers, and result ingestion creates task → result → evidence → hypothesis edges before a second score pass. Replaying a completed run ID cannot duplicate state.

Research adapters declare cost, rate and health policies. Provider failures degrade independently, task attempts remain retryable, and `NODEPAD_MAX_RESEARCH_TASKS_PER_HEARTBEAT` caps work. Tests use mocked providers and make no network calls. Evidence older than `NODEPAD_EVIDENCE_STALE_DAYS` is retained but marked stale; important hypotheses with mostly stale support get a stable refresh task and can be demoted from brain knowledge.
