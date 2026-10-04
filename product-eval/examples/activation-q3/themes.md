# Problem-framed themes for activation-q3

- id: T1
  name: "New admins can't finish workspace setup without CS help"
  members: [E1, E2, E3, E4]
  personas: [admin, buyer]
  distinct_accounts: 9
  total_weight: 31
  source_types: [product_analytics, support_ticket, customer_interview, churn_survey]
  trend: up
  corroboration: cross-source
  contradictions: []
  confidence: 89          # base 89 (W=31) x 1.0 (4 source types) x 1.0 (no contradictions)
  confidence_band: high
  gaps: ["which connector is worst (Postgres vs Snowflake)?", "is the 38% inflated by trial spam?"]

- id: T2
  name: "Teams can't share saved views across the org"
  members: [E5, E6, E7]
  personas: [admin, end_user, buyer]
  distinct_accounts: 6
  total_weight: 14
  source_types: [feature_request, sales_call, app_review]
  trend: emerging
  corroboration: cross-source
  contradictions: []
  confidence: 63          # base 63 (W=14) x 1.0 (3 source types) x 1.0
  confidence_band: moderate
  gaps: ["how many seats would actually share?", "no first-party usage data on view re-creation"]

- id: T3
  name: "Alert noise pushes users to mute critical alerts"
  members: [E8, E9]
  personas: [end_user]
  distinct_accounts: 2
  total_weight: 5
  source_types: [internal_observation, community_post]
  trend: flat
  corroboration: single-source-ish
  contradictions: [E12]   # analytics show alert engagement flat -> 1 unresolved material contradiction
  confidence: 24          # base 30 (W=5) x 0.9 (2 source types) x 0.9 (1 contradiction)
  confidence_band: low
  gaps: ["no measured mute-rate", "E8 hypothesis directly contradicted by E12"]

- id: T4
  name: "Users want a dark-mode dashboard"
  members: [E10, E11]
  personas: [end_user]
  distinct_accounts: 4
  total_weight: 2
  source_types: [feature_request, app_review]
  trend: flat
  corroboration: weak
  contradictions: []
  confidence: 12          # base 13 (W=2) x 0.9 (2 source types) x 1.0
  confidence_band: low
  gaps: ["no business-impact signal", "aesthetic preference, low frequency"]
