# Resolved identities for activation-q3
# Shows the cross-system mapping: the same account/person stitched across
# Zendesk + CRM + analytics so multi-touchpoint signal collapses to one entity.

- entity: acct_acme
  grain: account
  matched_records: [zendesk:org_1183, hubspot:acct_55, amplitude:grp_acme]
  method: email_domain        # acme.io
  match_confidence: high
  # Appears in E1 (analytics), E2 (ticket), E3 (interview), E8 (observation):
  # one account, four touchpoints, escalating -> a severity signal, not four voices.

- entity: person_jordan
  grain: person
  matched_records: [zendesk:user_991, hubspot:contact_77]
  method: email               # jordan@acme.io present verbatim in both systems
  match_confidence: high
  # The canonical case: same email in a Zendesk ticket AND the CRM -> one person,
  # enriched with CRM context (admin at Acme, mid-market, renewal in 90 days).

- entity: acct_northwind
  grain: account
  matched_records: [gong:acct_nw, hubspot:acct_204]
  method: email_domain        # northwind.com
  match_confidence: high
