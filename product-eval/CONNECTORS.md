# Connectors

This plugin is tool-agnostic in spirit: it works in terms of **evidence source categories**, and uses whatever you connect in each. Nothing is required, `discover-sources` detects what's available, CSV/upload is a universal fallback, and the plugin honestly caps decision confidence by the sources you actually have.

The full category → example-tool mapping lives in `skills/discover-sources/references/source-catalog.md`. Summary:

| Category | Example tools | Evidence role |
|---|---|---|
| Product / behavioral analytics | Amplitude, PostHog, Mixpanel, GA4 | first-party quantitative (strongest) |
| Reliability / logs / errors | Datadog, Sentry, New Relic | first-party quantitative |
| Support / tickets | Zendesk, Intercom, Freshdesk | ticket clusters |
| Voice of customer / calls | Fireflies, Gong, churn & NPS surveys | transcripts / surveys |
| CRM / sales | Salesforce, HubSpot | PFRs, lost-deal reasons |
| Feedback / idea mgmt | Productboard, Canny, Aha! | feature requests |
| Reviews / app stores | G2, Capterra, App/Play Store | third-party qualitative |
| Community | Reddit, Hacker News, Discord | third-party qualitative |
| Market / SEO / demand | Semrush, Ahrefs, SimilarWeb | market signal |
| Issue trackers / changelogs | GitHub, GitLab | bug/feature signal + freshness checks |
| Identity (CDP) | Segment, RudderStack | resolves the same user/account across the above |

Connect any subset. The more first-party quantitative sources you connect (analytics, logs) and the more source-type diversity you have, the higher the confidence ceiling the plugin can reach.
