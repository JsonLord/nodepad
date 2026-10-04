# Problem Framing Reference

How to frame product problems at the right altitude: specific enough to investigate and build for, broad enough to justify investment.

## The altitude test

**Too broad (split/narrow):** "Our onboarding is bad" · "Users don't engage enough" · "We're losing to competitors" · "The product is slow." These are categories, not problems, split them by persona, journey step, severity, or frequency.

**Too narrow (lift):** "The tooltip on step 3 is confusing" · "The CSV button is in the wrong place" · "Users want dark mode." These are bugs, UX tweaks, or feature requests, lift them to the underlying user problem before scoring.

**Right altitude (accept):**
- "Teams with 5+ members cannot configure role-based permissions during onboarding without contacting support, leading to trial abandonment."
- "Managers cannot see cross-team project status without checking 3+ screens, so they build shadow tracking in spreadsheets."
- "Free-tier users who hit the usage limit have no visibility into what upgrading unlocks, so they churn instead of converting."

Specific enough to build for, broad enough to justify investment, tied to a business outcome.

## Problem-statement formula

**[Persona] cannot [job/task] [context/constraint] because [root cause], resulting in [business consequence].**

Every problem must contain:
1. WHO is affected (a specific persona, not "users")
2. WHAT they can't do or struggle with (the job/task)
3. WHEN/WHERE it happens (the triggering context)
4. WHY it happens (root cause if known; "unknown" is acceptable)
5. SO WHAT (the business impact: churn, lost revenue, support cost, competitive loss)

For exploration, unknown root cause or consequence can move forward as an explicit gap. For evaluation or validation, the statement should be concrete enough that a PM knows what evidence would prove or disprove it.

## Decomposing broad themes

- **By persona:** admin setup vs end-user first experience vs buyer evaluation are different problems.
- **By journey step:** where exactly in the flow does friction occur?
- **By severity:** blocker vs annoyance, focus on blockers first.
- **By frequency:** every user, or a segment? Which segment matters most?

Example, broad "onboarding is weak" decomposes into:
1. "Admins cannot complete SSO configuration without engineering help" (activation, admin, blocker, enterprise)
2. "New end-users don't discover core reporting in week one" (activation, end-user, missed value, all)
3. "Trial teams with 10+ invitees hit slow imports" (activation, admin, performance, growth)

## Quality checklist

- [ ] Persona specific (not "users" or "customers")
- [ ] Task concrete (not "have a better experience")
- [ ] Business consequence named, measured when evidence exists
- [ ] Addressable by a team in roughly 2-6 weeks
- [ ] Distinct from the other problems on the list
- [ ] A PM would immediately know what to investigate

Use the checklist as a progress tool. In exploration, return "best current framing + gaps"; in commit-stage decisions, tighten or rewrite before scoring readiness.

## Common mistakes

- **Disguised solutions:** "Need Slack integration" → "Users lose context on updates because notifications only exist in-product."
- **Symptom vs root cause:** "Too many support tickets" → "Users cannot resolve config errors because error messages don't explain what went wrong."
- **Bundled problems:** "Enterprise struggles" → split into specific pains per point.
- **No consequence:** "Settings page is cluttered" → "Admins take 4x longer to find notification preferences, causing misconfigured alerts."
