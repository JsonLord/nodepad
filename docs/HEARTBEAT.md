# Durable heartbeat

Run once with `npm run heartbeat -- default --once`, or continuously with `npm run heartbeat -- default`. Configure `NODEPAD_HEARTBEAT_INTERVAL_SECONDS`.

The worker takes an expiring lease and executes the full phase sequence: ingest, dedupe, evidence quality, themes, synthesis, hypothesis generation/matching, rescore, gap planning, targeted research, result ingestion, second rescore, graph maintenance, brain promotion/demotion, staleness, backup and event summary. Replaying a completed run ID cannot duplicate state.

Research adapters declare cost, rate and health policies. Provider failures degrade independently, and tests make no network calls.
