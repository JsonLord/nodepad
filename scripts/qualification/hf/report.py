import json
import os
from datetime import datetime

def generate_reports(test_results):
    """
    Generate qualification-results.json and qualification-report.md from pytest results.
    test_results should be a list of dicts:
    [{'name': 'test_name', 'status': 'passed|failed|skipped', 'duration': 0.123, 'error': ''}]
    """

    passed = sum(1 for r in test_results if r['status'] == 'passed')
    failed = sum(1 for r in test_results if r['status'] == 'failed')
    skipped = sum(1 for r in test_results if r['status'] == 'skipped')

    # Determine overall status
    if failed > 0:
        overall_status = "NO-GO"
    elif passed > 0:
        overall_status = "GO"
    else:
        overall_status = "DEGRADED"

    json_report = {
        "space": os.environ.get("NODEPAD_SPACE_DOMAIN", "unknown"),
        "startedAt": datetime.utcnow().isoformat() + "Z",
        "overall_status": overall_status,
        "summary": {
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "degraded": 0
        },
        "tests": test_results
    }

    with open("qualification-results.json", "w") as f:
        json.dump(json_report, f, indent=2)

    md_content = f"""# Nodepad Qualification Report

**Space:** `{json_report['space']}`
**Date:** `{json_report['startedAt']}`
**Final Decision:** **{overall_status}**

## Summary
- Passed: {passed}
- Failed: {failed}
- Skipped: {skipped}

## Detailed Results
| Test | Status | Duration (s) | Error |
|---|---|---|---|
"""
    for r in test_results:
        err_msg = str(r.get('error', '')).replace('\n', ' ')
        md_content += f"| `{r['name']}` | {r['status'].upper()} | {r['duration']:.3f} | {err_msg} |\n"

    with open("qualification-report.md", "w") as f:
        f.write(md_content)
