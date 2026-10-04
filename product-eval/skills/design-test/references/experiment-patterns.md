# Experiment patterns, cheapest test by assumption type

Pick the lightest method that could *disconfirm* the riskiest assumption. Bias to cheap and fast.

| You need to learn | Cheapest test | Signal | Rough effort |
|---|---|---|---|
| Will anyone want it? (demand) | Fake-door / smoke test; landing page + small ad spend | click / sign-up rate vs threshold | hours-days |
| Will they pay or switch? | Pre-order, paid pilot, "fake" pricing page | conversions / letters of intent | days |
| Do they have the pain we assume? | 5-10 problem interviews (no pitching) | unprompted mentions, workarounds | days |
| Which framing lands? | A/B test or two landing variants | conversion delta | days |
| Is the workflow usable? | Concierge / Wizard-of-Oz (do it manually) | completion, time, drop-off | days-1 wk |
| Is the quantitative claim real? | Instrument the funnel / event; pull after a week | the actual rate | 1 wk |
| Would they recommend it? | Survey + NPS to a real segment (n > 30) | top-box %, themes | days |

## Rules
- **Test to disconfirm, not confirm.** Design the result that would kill the bet, then see if reality refuses to produce it.
- **One assumption per test**: the riskiest one. Don't bundle.
- **Threshold before data**: a number + window, written before running. No moving goalposts.
- **Cheapest that could change the decision**: if the result wouldn't change what you do, don't run it.
- Results are first-party evidence → feed back via `gather-evidence`, then re-run `decision-readiness`.
