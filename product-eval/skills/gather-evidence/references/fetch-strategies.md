# Fetching evidence from a source, adaptive ladder

Connectors vary across users, different MCP wrappers, configs, custom fields, permissions, and data volumes. Never assume a source's shape: **probe it, then climb a ladder of strategies, diagnosing each failure.** The goal, if a source *can* yield data, find the way; if it can't, say so precisely.

## 1. Probe first (one cheap call)
Before bulk-pulling, learn the source's actual shape: list the connector's available operations, pull one recent item, and inspect the returned fields. Build the real query around what you observe, MCP wrappers often rename parameters and reshape output relative to the underlying API.

## 2. The fetch ladder (try in order; stop when useful data returns)
1. **Targeted query**: the search/list operation with filters from your hypotheses (time window, status, tags, keywords).
2. **Relax the query**: if empty: widen the window, drop the narrowest filter, try synonyms or alternate field names.
3. **Alternate operation**: most tools expose several (e.g. Zendesk: search vs list-tickets vs views vs incremental export). Try another.
4. **Re-read the schema, re-parameterize**: inspect the tool's parameter schema; the wrapper may use different names (`q` vs `query`, `created_after` vs `start_time`). Retry with corrected params.
5. **Broad pull + local filter**: fetch a larger recent set and filter in memory when server-side filters misbehave.
6. **Hand back to the user**: CSV export / paste, reconnect, or grant scope (see the failure table).

## 3. Diagnose the failure (don't retry blindly)
| Symptom | Likely cause | Next move |
|---|---|---|
| Auth / credential error | not authenticated, token expired | prompt reconnect, retry once |
| Empty result | query too narrow, wrong field, or genuinely no data | relax (step 2) → alternate op (step 3) |
| Schema / validation error | wrapper renamed params | re-read schema, re-parameterize (step 4) |
| Permission / 403 | restricted scope | narrow scope; ask the user to grant access |
| Rate limit / timeout | too much at once | back off, paginate, sample |
| Operation not found | connector lacks that op | alternate op or CSV fallback |

## 4. Bounded loop
At most ~3 attempts per source per failure class. Stop when useful data returns, or when the blocker needs the user (auth / permission / missing data). Never loop indefinitely, report what you tried and what's needed (same discipline as `investigate`: no endless retrying).

## 5. Remember the working recipe
Once a source returns data, record the working access pattern (tool · operation · params) in `.product-eval/<scope>/sources.md`, so later pulls, and other skills, reuse it in one step instead of re-climbing the ladder. Treat it like a per-source note that fires next time you touch that source.

## Honest degradation
If the ladder is exhausted, mark the source **blocked/empty** in the source map (which lowers the confidence ceiling) and tell the user exactly what failed and the one action that would unblock it (reconnect, grant scope, or export a CSV). A source you can't read is a known gap, not a silent zero.
