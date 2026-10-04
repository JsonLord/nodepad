# Scores for activation-q3 (exact 0-100 stored for audit; chat leads with bands)

- problem: T1
  value: 72
  value_inputs: {persona: 20, funnel: 22, frequency: 20, competitive: 10}
  value_band: high
  confidence: 89
  confidence_band: high
  recommendation: "Decide now"
  rationale: "High-value activation cliff, corroborated across 4 first-party source types; the math supports committing."
  override: null

- problem: T2
  value: 70
  value_inputs: {persona: 20, funnel: 15, frequency: 15, competitive: 20}
  value_band: high
  confidence: 63
  confidence_band: moderate
  recommendation: "Run a research sprint"
  rationale: "High value and competitors solved it, but no first-party usage data; firm up proof before committing."
  override: null

- problem: T3
  value: 60
  value_inputs: {persona: 15, funnel: 25, frequency: 10, competitive: 10}
  value_band: moderate
  confidence: 24
  confidence_band: low
  recommendation: "Do not commit yet"
  rationale: "Retention-relevant if true, but the core hypothesis is directly contradicted by first-party analytics (E12)."
  override: null

- problem: T4
  value: 35
  value_inputs: {persona: 10, funnel: 10, frequency: 10, competitive: 5}
  value_band: low
  confidence: 12
  confidence_band: low
  recommendation: "Deprioritize"
  rationale: "Prize too small: secondary persona, engagement-only, no competitive pressure."
  override: null
