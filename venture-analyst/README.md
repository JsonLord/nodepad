# venture-analyst

![npm](https://img.shields.io/npm/v/@veyralabs/venture-analyst) ![license](https://img.shields.io/badge/license-MIT-green)

Startup and SaaS idea validation skill for Claude Code. Research market evidence, map competitors, score viability, and generate concrete validation experiments - no API keys required.

Part of [venture-suite](https://github.com/veyralabsgroup/venture-suite) by [VeyraLabs](https://github.com/veyralabsgroup).

## Install

```bash
npx @veyralabs/skills install venture-analyst
```

Or via the main package:

```bash
npx @veyralabs/skills install venture-suite
```

## What it does

Four phases, each with structured output:

1. **Problem Discovery** - collects evidence the problem exists (HN, Reddit, GitHub issues, Google Trends)
2. **Competitor Intelligence** - maps the landscape, extracts pricing signals, finds gaps
3. **Validation Experiments** - generates 3 prioritized experiments (Mom Test, fake door, concierge MVP)
4. **Verdict** - Bull/Bear/Judge debate with a scored recommendation

## Usage

```
/venture-analyst [idea description]
```

Example:
```
/venture-analyst A tool that helps freelancers track billable hours without manual timers
```

## Zero friction

Works immediately after install. No API keys, no configuration, no paid accounts required.

Uses HN Algolia (no auth), Reddit .json endpoints, GitHub REST API (unauthenticated), ddgs for web search, and trendspyg for Google Trends. Auto-detects and uses available enhancements (SearXNG via Docker, optional env keys) without asking the user to configure anything.

## Includes

- `SKILL.md` - main orchestrator with 4-phase workflow
- `scripts/sources.py` - zero-key data collection
- `scripts/enhance_detect.py` - Level 2/3 auto-detection
- `scripts/scraper.py` - competitor page scraping with Cloudflare fallback
- `scripts/experiments.py` - validation experiment generator
- `references/` - Lean Startup, Customer Development, Mom Test, Blue Ocean, Traction
- `templates/` - experiment spec, verdict output

## License

MIT. Built by [VeyraLabs](https://veyralabs.com).
