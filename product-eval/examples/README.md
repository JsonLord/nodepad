# Examples

## `activation-q3/`: a complete sample investigation

A synthetic, self-contained investigation scope for the fictional product "Pulse" (a B2B product-analytics workspace). It mirrors exactly what the plugin writes to `.product-eval/<scope>/` in a real project, and it serves two purposes:

1. **A `scorecard` reference output.** `activation-q3/scorecard.html` is the rendered decision scorecard for this scope: open it in a browser to see the KPI cards, the Value by Confidence quadrant, the four color-coded verdict cards (with verbatim quotes, top complaint, the ask, and "why it ranks here"), the glossary, and the honest footer.
2. **A conformance fixture.** Every file conforms to `DATA-CONTRACT.md`, and every number was computed from the shipped scoring defaults, so it is the fixture the validation preflight (and `scripts/validate_scope.py`) is tested against.

### What's inside

| File | Role |
|---|---|
| `context.md` | scope front-matter (product, north star, personas) |
| `evidence/E1.md` ... `E12.md` | 12 normalized, weighted evidence items (E12 is a flagged contradiction) |
| `identities.md` | resolved cross-system identities (same account across Zendesk + CRM + analytics; same email across Zendesk + CRM) |
| `themes.md` | 4 problem-framed themes with computed confidence |
| `scores.md` | Value/Confidence and a recommendation per theme |
| `decisions-log.md` | readiness verdicts (append-only) |
| `scorecard.html` | the rendered scorecard |

### The four opportunities (one of each verdict)

| Theme | Value | Confidence | Verdict |
|---|---|---|---|
| T1 New admins can't finish setup without CS help | 72 (High) | 89 (High) | **Decide now** |
| T2 Teams can't share saved views across the org | 70 (High) | 63 (Moderate) | **Run a research sprint** |
| T3 Alert noise pushes users to mute critical alerts | 60 (Moderate) | 24 (Low) | **Do not commit yet** |
| T4 Users want a dark-mode dashboard | 35 (Low) | 12 (Low) | **Deprioritize** |

T3 shows how a directly contradicting first-party signal (E12) drives confidence below the gate even when value is real.

### Verify it

```
python ../scripts/validate_scope.py activation-q3/      # -> OK (needs PyYAML)
```

All numbers are illustrative. No real customer data.
