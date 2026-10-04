# Evidence Quality Reference

What constitutes high-quality evidence for a product problem, and how to rate it. Used when assessing and structuring evidence items.

## Evidence strength (1-5)

**Strength 5: direct, quantitative, first-party**
- Product analytics showing measurable drop-off, churn correlation, or failure rate
- A/B test results demonstrating impact
- Revenue or retention data tied to the issue
- Large-scale survey (n > 100) with clear signal
- e.g. "Funnel analytics show 34% drop-off at the permissions step, up from 22% last quarter."

**Strength 4: direct qualitative first-party, or strong third-party quantitative**
- Customer interview quotes describing the exact pain unprompted
- Support ticket clusters (10+ tickets on the same issue in a window)
- Sales calls where prospects cite this as a reason not to buy
- Churn-survey responses explicitly naming the issue
- Detailed, specific G2/Capterra complaints
- e.g. "In 3 separate interviews, admins called onboarding 'confusing' and needed support to finish setup."

**Strength 3: indirect first-party, or direct third-party qualitative**
- Feature requests that imply the problem
- Competitor-comparison reviews ("I switched to X because of Y")
- Community posts (Reddit, HN) with significant engagement
- Related (not exact) support tickets
- Internal observations from CS, Sales, Engineering
- e.g. "Reddit thread, 89 upvotes, asking if anyone else finds permissions impossible."

**Strength 2: indirect or anecdotal**
- Single complaint without corroboration
- Analyst reports on the category (not your product)
- Competitor feature releases implying demand
- Social mentions without engagement
- e.g. "One tweet wishing the product had better onboarding."

**Strength 1: speculative or very indirect**
- General industry trends that might apply
- Analogies from adjacent products
- Theoretical arguments without data
- Outdated evidence (> 12 months in fast-moving markets)

## Evidence weight (not just count)

A raw count is crude, three strength-5 first-party findings far outweigh fifty vague anecdotes. Convert strength into a weight so quality dominates, then sum over deduplicated items.

**Base weight by strength (non-linear so quality dominates; tunable):**

| Strength | Base weight |
|---|---|
| 5 | 12 |
| 4 | 7 |
| 3 | 4 |
| 2 | 2 |
| 1 | 1 |

**Modifiers (multiplicative on base):**

- **Recency:** ×1.0 if < 3 months, ×0.7 if 3-6, ×0.4 if 6-12, ×0.2 if older (fast-moving markets).
- **Independence / dedup:** collapse items that are the same user/account across channels (see `identity-resolution.md`) or exact duplicates, count the strongest once. Independent corroboration from a *different* source type adds a modest bonus (e.g. +25% of the corroborating item's weight), not a full second count.
- Do **not** add a separate first-party multiplier, first-party-ness is already baked into the strength rating.

**Total Evidence Weight** = sum of (base × recency) over deduplicated items + corroboration bonus.

These numbers are a starting heuristic, keep them explicit and tunable, and always show the math (e.g. "Weight 19: two strength-5 first-party (recent) + one strength-3, across 2 source types"). Treat weight as a transparent composite, not a precise truth.

## Source type taxonomy

**First-party:** product_analytics, support_ticket, sales_call, churn_survey, customer_interview, internal_data, internal_observation, feature_request

**Third-party:** app_review, community_post, social_media, competitor_analysis, market_research, blog_or_article

## Claim extraction rules

1. **State the pain, not the solution.** "We need Slack integration" → "Users lack visibility into events in their communication tools."
2. **Quantify when possible**, and flag when quantification is missing.
3. **Preserve the persona** (admin vs end-user vs buyer).
4. **Don't editorialize**: reflect what the evidence says.
5. **Flag temporal relevance**: evidence 6+ months old in a fast market tempers confidence.

## Tags

- **Persona:** admin, end_user, buyer, developer, manager (tag all that apply, primary first)
- **Funnel stage:** awareness, activation, engagement, retention, expansion, advocacy
- **Impact type:** conversion, activation, retention, expansion, cost, competitive

## Duplicate & corroboration handling

- Exact duplicate (same source, same claim): merge.
- Corroborating (different source, same claim): keep both, independent corroboration raises confidence.
- Related but distinct: keep both, suggest a shared theme.
- Contradictory: keep and flag, valuable for an honest assessment.

## Gap detection patterns

- No quantitative data → suggest analytics or a survey
- Single-source bias → suggest diversifying source types
- No first-party data → suggest tickets, calls, analytics
- Persona blind spot → suggest investigating other personas
- No recency → suggest checking whether the problem still exists
- No counter-evidence → suggest looking for reasons it might NOT be a problem
