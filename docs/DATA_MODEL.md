# Canonical evidence graph

`Workspace` owns one graph plus evidence, hypotheses, syntheses, research, events and brain state. `KnowledgeNode.kind` and `KnowledgeEdge.type` cover the specified semantic vocabulary. AI/agent/system writes require provenance; mutation APIs record actor context and accept `Idempotency-Key`.

Evidence and hypotheses are separate. Deterministic scoring combines weighted support/contradiction with strength, freshness, reliability, first-party and behavioral/measured multipliers. The signed result maps to ten bands while confidence measures volume/diversity. `contested`, `stale`, and `unresearched` are overlays.

The filesystem `NodepadStore` uses atomic JSON writes and exclusive expiring leases. Legacy `.nodepad` browser behavior remains unchanged and a migration adapter maps old blocks and relationships into this graph.
