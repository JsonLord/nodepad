# Source Catalog, the universe of product-data sources

The catalog of where product-relevant evidence can come from. `discover-sources` walks this list to ask about, detect, and map a user's sources. Each row maps a category to how it is ingested, the evidence role it plays, the maximum evidence strength it can reach (per the evidence-quality rubric, 1-5), and the metric-tree branch it illuminates.

| Category | Example sources | Ingest via | Evidence role | Max strength | Lights up |
|---|---|---|---|---|---|
| Product / behavioral analytics | Amplitude, Pendo, Mixpanel, PostHog, GA4; raw in Snowflake/BigQuery/Databricks | MCP / CSV | first-party quantitative | 5 | activation, engagement, retention |
| Reliability / logs / errors | Datadog, Sentry, New Relic, Grafana, CloudWatch | MCP / CSV | first-party quantitative | 5 | failure modes, performance |
| Support / tickets | Zendesk, Intercom, Freshdesk, Help Scout | MCP / CSV | support-ticket cluster | 4 | activation & retention friction |
| Voice of customer / calls | Fireflies, Gong, Chorus; churn & NPS surveys | MCP / CSV | transcript / survey | 4-5 | unprompted pain, churn reasons |
| CRM / sales | Salesforce (PFRs, lost-deal reasons), HubSpot, Pipedrive | MCP / CSV | sales_call / feature_request | 3-4 | conversion, expansion |
| Feedback / idea management | Productboard, Canny, Aha!, UserVoice | MCP / CSV | feature_request | 3 | demand intent |
| Reviews / app stores | G2, Capterra, TrustRadius, App Store, Play Store | Web / CSV | third-party qualitative | 2-4 | comparative gaps |
| Community | Reddit, Hacker News, Discord, Slack communities | Web | third-party qualitative | 2-4 | emerging pain, workarounds |
| Issue trackers / dev signal | GitHub issues, GitLab issues, public roadmaps | MCP / Web | bug report / feature_request | 3-4 | bugs, integration & developer friction |
| Changelogs / release notes | competitor + own /changelog, /releases, GitHub releases, RSS | Web / MCP | freshness validation (not pain evidence) |, | retire stale gap evidence |
| Market / SEO / demand | Semrush, Ahrefs, SimilarWeb, Google Trends | MCP / Web | market_research | 2-3 | category demand, competitor gaps |
| Backlog / delivery | Linear, Jira, Asana, ClickUp, Monday, GitHub PRs | MCP | context (not evidence) |, | what is already planned |
| Knowledge / docs | Notion, Confluence, Guru, Google Drive, Box | MCP / CSV | prior art / decisions | varies | past research, decisions |
| Manual | CSV / XLSX exports, pasted notes, interview transcripts | Upload | depends on content | by content | universal fallback |

## Two cross-cutting on-ramps

- **CSV / file upload is universal.** Any source that can export becomes gradable evidence even with zero connectors, a Zendesk export, a Salesforce report, survey results, a spreadsheet of feature requests. Assign strength from the declared source type and content, not the delivery method.
- **The web is the always-available corroboration layer.** Even a fully instrumented PM gains from triangulation: take an internal cluster (e.g. a recurring ticket theme) and check whether the same pain appears externally (G2 dislikes, Reddit, competitor reviews). A match raises confidence and may signal an industry-wide opportunity; no match suggests the issue is specific to this product or segment. Either way it adds source diversity, which the sufficiency gate rewards.

## How sources set the confidence ceiling

- Only third-party / indirect sources present → confidence ceiling is **Moderate**. Decisions will tend to land at *Run a research sprint* or *Do not commit yet*.
- At least one strong first-party quantitative source (analytics or logs) **plus** corroboration from a second source type → ceiling can reach **Decide now**.
- Single-source coverage, however strong, cannot pass the sufficiency gate (which requires more than one source type). Treat single-source as a gap to close.

## Linking the same user across sources (identity resolution)

Many sources can be joined on a shared key so the same person or account is recognized across tools, e.g. someone who opened an Intercom chat, filed a Zendesk ticket, and exists in the CRM. `discover-sources` records the **join keys** each source exposes; `gather-evidence` uses them to stitch identities. Full method in `identity-resolution.md`. Keys by source:

| Source | Typical join key | Grain |
|---|---|---|
| Intercom, Zendesk, Help Scout | email, company | person + account |
| Salesforce, HubSpot | email, account (+ ARR, segment, renewal) | person + account |
| Amplitude, PostHog | user_id / external_id (email if identified) | person (often pseudonymous) |
| Google Analytics (GA4) | client_id (pseudonymous) | rarely joinable to a person |
| GitHub | username (email often private) | best-effort person |
| CDP (Segment, RudderStack) | pre-resolved identity graph | person + account |

Email is the strongest cross-tool key; email domain enables account-level grouping (exclude consumer domains). GA4 and pseudonymous analytics usually cannot be tied to a named person unless a `user_id` is set, treat them as account or aggregate signal.

## Mapping notes

- Tag each source with the persona(s) it speaks for and the funnel stage(s) it covers, so gaps (a missing persona, an uncovered stage) are visible.
- A backlog tool (Linear, Jira) is *context*, not evidence, it tells you what is planned, not whether it is worth doing.
- Prefer recent sources; in fast-moving categories, evidence older than ~6-12 months should temper confidence.
