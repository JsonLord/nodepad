# Critic Checklist Reference

What to check when pressure-testing. Every flag must be actionable. Distinguish blocking issues from suggestions, and acknowledge strengths.

## Evidence → solution (is the problem ready to solution?)

**Blocking:** total evidence weight below threshold (strength-weighted and deduplicated, not a raw count); no evidence rated strength 3+; problem statement missing or vague; all evidence from a single source type.

**Suggestions:** no first-party data; no quantitative data; no counter-evidence considered; evidence older than 6 months without recent validation; Confidence below 40; persona gaps in evidence coverage; missing funnel context.

## Solution → ship (is the solution ready to build?)

**Blocking:** a Must-have requirement has no linked evidence; no acceptance criteria on Must-have requirements; no success metrics defined; the solution doesn't address the top evidence theme; goals are not measurable (no baseline or target).

**Suggestions:** requirements linked to only one evidence item (weak grounding); no non-goals defined (scope-creep risk); no risks identified; scope too big or too small for an MVP; metrics without an instrumentation plan; dependencies not identified; solution treats symptoms not root cause; decisions log shows requirements removed and re-added (indecision signal).

## Doc / pre-export (is the document sound?)

**Blocking:** the document omits the problem statement; the evidence summary doesn't match the actual top evidence; requirements in the doc don't match the agreed solution; required sections missing.

**Suggestions:** document too long (over-detailed) or too thin; no edge-cases section; tasks without acceptance criteria; rollout plan missing or generic; open-questions section suspiciously empty.

## Cross-stage consistency (always check, this is how drift shows up)

- Problem statement has not drifted from the evidence.
- Persona in the solution matches the persona in the evidence.
- Metrics relate to the actual problem (not vanity metrics).
- Scope is proportional to evidence strength and Value.
- Decisions log is consistent (no circular reversals).
- The narrative/framing has not quietly changed from a prior version without justification.

## Output shape

Return four things:

- **blocking_issues**: with specific fix instructions
- **suggestions**: with what to do
- **strengths**: what's working
- **overall_readiness**: ready / needs fixes / not ready

## Scope modes (recommend exactly one)

- **Expand**: the real opportunity is bigger than proposed; name the missing capability.
- **Hold**: scope is right; defend why.
- **Reduce**: scope is too big or unproven; identify the narrowest valuable wedge to ship and learn from first.
