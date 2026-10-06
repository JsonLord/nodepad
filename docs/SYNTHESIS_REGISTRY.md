# Synthesis registry and context

S001–S130 remain configuration, not agents. Every definition maps by ID to one of thirteen offline-capable reasoning families: epistemics; customer/problem; JTBD/adoption; value/positioning; product/solution; pricing/economics; competition; distribution; trust/risk; experiments; narrative; strategy; and emergent graph reasoning.

Family engines produce materially different statements, rationales, unknowns, falsification research and typed `HypothesisProposal` objects. They preserve source IDs and contextual support/contradiction IDs but cannot set authoritative score, confidence or qualification.

`selectSynthesisContext` accepts hypothesis, explicit node IDs, changed-since time, graph distance and evidence budget. It traverses supports, contradicts, derived_from, depends_on, applies_to, alternative_to, tests, produced and implies. Direct graph distance, strength, freshness, behavioral/first-party signals and source diversity rank evidence. Input hashes include only selected decision-relevant evidence, so unrelated clusters do not invalidate a synthesis.
