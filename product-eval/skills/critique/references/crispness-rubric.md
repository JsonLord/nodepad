# Problem One-Liner Crispness Rubric

Score a problem statement on 8 dimensions, 0-10 each (max 80). Any dimension at **0 is blocking**: rewrite required. The pass threshold scales with stage (below). Always return the total, the lowest-scoring dimensions, and a one-line rewrite that lifts them.

## Dimensions

**1. Persona specificity**: a named, specific segment, not "users".
- 0: "users" / "customers" / unspecified · 5: a bare role ("admins") · 10: qualified segment ("admins on 5+ seat teams during trial").

**2. Task / job concreteness**: a specific job-to-be-done, not "a better experience".
- 0: "engage more", "have a better experience" · 5: vague action ("set things up") · 10: concrete task ("configure role-based permissions").

**3. Context / trigger**: when/where it happens.
- 0: none · 5: implied · 10: explicit trigger ("during onboarding, before the first invite").

**4. Root cause**: why it happens (or an honest "unknown").
- 0: a solution disguised as a cause ("because there's no wizard") · 5: a restated symptom · 10: a named mechanism ("permissions require manual API calls") or an explicit "root cause unknown, to investigate".

**5. Consequence (measurable)**: the business impact.
- 0: none · 5: qualitative ("frustration") · 10: measurable ("34% of trials abandon at this step").

**6. Altitude**: buildable in 2-6 weeks; not a category, not a ticket.
- 0: a category ("onboarding is bad") or a ticket ("move the button") · 5: slightly too broad/narrow · 10: a team could address it in 2-6 weeks.

**7. Distinctness**: one problem, not a bundle.
- 0: a bundle ("enterprise struggles") · 10: one clean problem, distinct from the others on the list.

**8. Evidence link**: grounded, not asserted.
- 0: asserted, no evidence · 5: one weak source · 10: linked to strength-3+ evidence from 2+ source types.

## Blocking & thresholds

- **Any dimension at 0 → blocked**, rewrite required.
- Pass threshold by stage:
  - **Explore (founder / new space):** ≥ 40/80, and no 0 on Persona, Task, or Altitude. Consequence, Root cause, and Evidence may be low, mark them as gaps to close, not blockers. You are still discovering.
  - **Evaluate / Validate (committing resources):** ≥ 60/80, no 0 anywhere, and Consequence + Evidence link ≥ 6. The bar is higher because you are about to spend.

## Worked examples

- *"Onboarding is bad."* → persona 0, task 0, context 0, root cause 0, consequence 0, altitude 0, distinct 5, evidence 0 → **5/80, blocked** (it's a category). Rewrite required.
- *"Teams with 5+ members can't configure role-based permissions during onboarding without contacting support, causing trial abandonment."* → persona 9, task 9, context 8, root cause 6, consequence 8, altitude 9, distinct 9, evidence 7 → **~65/80, passes** at the evaluate stage.

## Always return

The total, the two or three weakest dimensions, and the rewrite that would raise them. The grader proposes the sharper one-liner; it does not silently replace the author's.
