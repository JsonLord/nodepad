import json
import os
from datetime import datetime

def generate_reports(test_results):
    """
    Generate qualification-results.json and qualification-report.md from pytest results.
    test_results should be a list of dicts:
    [{'name': 'test_name', 'status': 'passed|failed|skipped', 'duration': 0.123, 'error': ''}]
    """

    # Map pytest statuses to requested taxonomy
    for r in test_results:
        if r['status'] == 'passed':
            r['status_category'] = 'PASS'
        elif r['status'] == 'failed':
            r['status_category'] = 'FAIL'
        elif r['status'] == 'skipped':
            r['status_category'] = 'SKIP'
        else:
            r['status_category'] = 'NOT_TESTED'

    passed = sum(1 for r in test_results if r['status_category'] == 'PASS')
    failed = sum(1 for r in test_results if r['status_category'] == 'FAIL')
    skipped = sum(1 for r in test_results if r['status_category'] == 'SKIP')

    # Mandatory GO logic
    mandatory_tests = [
        "test_health_endpoint",
        "test_auth_protection",
        "test_embeddings_status",
        "test_support_adjudication",
        "test_contradiction_adjudication",
        "test_neutral_adjudication",
        "test_objective_inversion",
        "test_s012_synthesis",
        "test_s121_synthesis",
        "test_heartbeat_trigger",
        "test_security_endpoints_blocked",
        "test_fetch_url_ssrf_protection",
        "test_validation_failures"
    ]

    # Check if all mandatory tests passed
    mandatory_passed = True
    for mt in mandatory_tests:
        test_case = next((t for t in test_results if t['name'] == mt), None)
        if not test_case or test_case['status_category'] != 'PASS':
            mandatory_passed = False
            break

    # Determine overall status
    if failed > 0:
        overall_status = "NO-GO"
    elif mandatory_passed:
        overall_status = "GO"
    else:
        overall_status = "DEGRADED"

    # Get deployment revision if available
    revision = os.environ.get("NODEPAD_EXPECTED_REVISION", "NOT_TESTED")

    json_report = {
        "space": os.environ.get("NODEPAD_SPACE_DOMAIN", "unknown"),
        "revision": revision,
        "startedAt": datetime.utcnow().isoformat() + "Z",
        "overall_status": overall_status,
        "summary": {
            "passed": passed,
            "failed": failed,
            "skipped": skipped,
            "degraded": 1 if overall_status == "DEGRADED" else 0,
            "not_tested": 0
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
