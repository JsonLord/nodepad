# Synthesis registry

The static registry contains S001–S130 as data, not agents. Each definition uses one input/output contract, prompt policy, priority and deterministic post-processor label. The runner sorts inputs, hashes decision-relevant content, returns an existing result for an identical hash, preserves contradictions, and attaches run provenance.

The specification's high-value definitions are marked specialized, with evidence-specific post-processors for S001/S004. The generator contract returns zero or more `HypothesisProposal` objects. The matcher uses normalized statement/type identity, reuses exact hypotheses, and creates `alternative_to` or `supersedes` edges for related formulations. Result objects retain every created/matched hypothesis ID. All 130 are executable offline; generators never control evidence score, confidence, or qualification.
