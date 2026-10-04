# Signal Analysis Reference

How to separate signal from noise when gathering evidence, and what to extract.

## Signal hierarchy

### Tier 1, direct pain (highest reliability)
- **Migration stories** ("we switched from X to Y because..."), strongest; a costly action taken (revealed preference). Extract the trigger, not just the destination.
- **Workaround descriptions** ("I built a spreadsheet because the product can't..."), the workaround reveals the problem's shape. Extract what it does.
- **Detailed complaints with specifics** ("took 3 hours to configure permissions, still got it wrong"), specificity indicates real experience. Extract task, context, failure mode.

### Tier 2, indirect pain (moderate)
- **Feature requests**: extract the implied unmet need, not the requested feature.
- **Comparative dissatisfaction** ("competitor does this better"), extract the missing capability.
- **Support-seeking on things that should be obvious**: a discoverability problem.

### Tier 3, weak (corroboration only)
- **Vague complaints** ("this is frustrating"), only to increase count on an already-identified theme.
- **Competitor praise without product criticism**: context only.
- **Analyst/influencer opinions**: flag to investigate, never use as primary evidence.

### NOT signals (never use as evidence)
Competitor marketing (landing pages, announcements); paid/sponsored reviews; signals older than ~2 years in fast-moving categories; bot/spam content.

## Changelogs as a freshness layer (not pain evidence)

Competitor marketing is never a pain signal, but a competitor's (or your own) **changelog / release notes** is a factual record of what shipped, and it's the right tool for checking whether evidence is still current. Use it to **validate freshness**, not as evidence of pain: if a complaint that "Competitor X lacks Y" predates X shipping Y, retire that gap; and check your own changelog so you don't "discover" a problem you already fixed. A shipped feature isn't necessarily a good one, so a changelog hit downgrades a table-stakes gap rather than killing a quality-differentiation play.

## Source evaluation (quick guide)

- **Reddit**: weigh upvotes, comment count and quality; 100+ upvotes with substantive pain = strong; watch sample bias.
- **G2 / Capterra**: the "what do you dislike?" section is the best signal; 5+ reviews naming the same dislike = strong; watch incentivized reviews.
- **App stores**: 1-3 star reviews with specifics; skews to mobile UX and reliability.
- **Hacker News**: "Ask HN: alternatives to X" and Show HN feedback; developer-skewed.
- **GitHub issues**: detailed bug reports with repros and 👍 reactions; recurring/duplicated issues = strong; distinguish bugs from feature requests.
- **Community (Discord/Slack)**: recurring threads on the same issue; watch power-user bias.

## Claim extraction rules

State the pain, not the solution; quantify when possible (flag when missing); preserve the persona; don't editorialize; flag temporal relevance (6+ months old in a fast market tempers confidence).

## When signals are thin

If research yields fewer than ~5 qualifying problems:
1. Lower the threshold, include 1-2 strong tier-1 signals (migration story, detailed workaround), marked lower confidence.
2. Search adjacent areas, onboarding, integrations, pricing/packaging, performance, migration/switching.
3. Check competitor gaps, problems rivals solve well that this product doesn't (people may have already churned).
4. Explain what was searched and found, and suggest next steps.
5. Include sub-threshold signals as "emerging".
