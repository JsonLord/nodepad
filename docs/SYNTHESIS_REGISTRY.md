# Synthesis registry

The static registry contains S001–S130 as data, not agents. Each definition uses one input/output contract, prompt policy, priority and deterministic post-processor label. The runner sorts inputs, hashes decision-relevant content, returns an existing result for an identical hash, preserves contradictions, and attaches run provenance.

The specification's high-value definitions are marked specialized, with evidence-specific post-processors for S001/S004. All 130 are executable offline. A structured model generator can implement the same interface but never controls qualification.
