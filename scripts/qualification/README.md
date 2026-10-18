# Nodepad HF Space Qualification Suite

This is an automated qualification suite designed to be run against a freshly deployed Hugging Face Space for Nodepad.

It verifies:
- Core mandatory endpoints (`/health`)
- Embedding functionality and local-transformer enablement
- Security protections and secret isolation (e.g. no .env exposure)
- Adjudication and synthesis behavior via HTTP requests
- Concurrency and failure mode handling

## Running

```bash
NODEPAD_SPACE_DOMAIN=example.hf.space \
NODEPAD_API_KEY=... \
npm run qualify:hf
```

Or directly:
```bash
python3 scripts/qualification/run_hf_qualification.py
```

## Outputs

The suite automatically generates a JSON result and a Markdown report:
- `qualification-results.json`
- `qualification-report.md`
