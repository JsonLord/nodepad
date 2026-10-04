# Identity Resolution Reference

Recognize when records from different sources refer to the same person or account, so multi-touchpoint signals are visible and breadth counts are not inflated. `discover-sources` detects which join keys each source exposes; `gather-evidence` performs the stitching.

## Two grains

- **Person**: one individual across tools.
- **Account / org**: the company they belong to. In B2B this is often the more useful unit.

## Join keys, by reliability

- **Strong (deterministic):** shared `email`; shared `user_id` / `external_id` when the company uses a consistent ID across tools.
- **Account-level (deterministic):** `email domain` → company. Groups individuals into an account even when individuals can't be matched. Exclude consumer domains (gmail, outlook), never merge all gmail users into one "account".
- **Weak (probabilistic):** `name` + `company`, phone, social handle. Fuzzy, thresholded, flagged for review.

## Keys by source (typical)

| Source | Join key | Grain |
|---|---|---|
| Intercom, Zendesk, Help Scout | email, company | person + account |
| Salesforce, HubSpot | email, account (+ ARR, segment, renewal) | person + account |
| Amplitude, PostHog | user_id / external_id; email if identified | person (often pseudonymous) |
| Google Analytics (GA4) | client_id (pseudonymous) | rarely joinable to a person |
| GitHub | username (email often private) | best-effort person |
| CDP (Segment, RudderStack) | pre-resolved identity graph | person + account |

## Matching ladder (precision-first)

1. Exact `email` or shared `user_id` → merge (high confidence).
2. Else `email domain` → account-level group (medium-high; exclude consumer domains).
3. Else fuzzy `name + company` with a score → propose, do not auto-merge below threshold; surface for review.

Record method + confidence per merge. Keep merges reversible and inspectable. Never silently merge on weak keys, a false merge corrupts the evidence.

## Why it matters, two opposite uses (the key nuance)

- **Severity / journey (collapse to one entity):** the same user appearing in Intercom + Zendesk + a sales call escalated across channels, a severity signal, and the touchpoints reconstruct a journey (PostHog error → chat → ticket → call). Enrich from CRM (segment, ARR, renewal) to size impact: "this hits $X ARR, concentrated in mid-market."
- **Breadth / reach (dedup by entity):** to count how many *distinct* users or accounts have a problem, dedup by identity so one loud customer across three channels counts as one voice, not three. This corrects Confidence (independent diversity) and Value (frequency / reach).

Identity resolution therefore feeds both severity and accurate breadth, and prevents the classic trap of mistaking one vocal account for a widespread problem.

## CDP shortcut

If a CDP (Segment, RudderStack) or a reverse-ETL identity graph is connected, use its resolved identity instead of re-deriving, it already stitches IDs. Detect this in `discover-sources`.

## Data handling

Identity resolution works *because* it uses real identifiers: a shared email or email domain is what stitches the same person or account across Zendesk, the CRM, and analytics into one entity (and what lets you enrich that entity with CRM segment and ARR). So keep those identifiers readable in `identities.md` and in the evidence tags. Hashing or pseudonymizing them would break the cross-system match and the holistic picture it produces, which is the whole point of this step.

`.product-eval/` lives in the user's own repository, so retention, redaction, and what to commit versus `.gitignore` are the user's data-governance call, not something this plugin imposes. The one default worth keeping: do not send raw customer identifiers into the external web-triangulation step, since that would hand them to third-party search. Surface where identifiers are stored so the user can apply their own policy.

## Output

`.product-eval/<scope>/identities.md` mapping each resolved person/account to its source records with match method + confidence. Evidence items carry `person_id` and `account_id` so synthesis can collapse (for severity) or dedup (for breadth) correctly.
