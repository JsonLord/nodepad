import pytest
import os
import sys
from hf.report import generate_reports

class QualificationPlugin:
    def __init__(self):
        self.results = []

    def pytest_runtest_logreport(self, report):
        if report.when == "call":
            # For skipped tests, 'call' phase doesn't exist if skipped in setup,
            # but pytest deals with this differently. Let's capture 'call' for pass/fail.
            self.results.append({
                "name": report.nodeid.split("::")[-1],
                "status": report.outcome,
                "duration": report.duration,
                "error": str(report.longrepr) if report.longrepr else ""
            })
        elif report.when == "setup" and report.outcome == "skipped":
            self.results.append({
                "name": report.nodeid.split("::")[-1],
                "status": "skipped",
                "duration": report.duration,
                "error": str(report.longrepr) if report.longrepr else ""
            })

def main():
    print("Starting Nodepad HF Space Qualification Suite...")

    if not os.environ.get("NODEPAD_SPACE_DOMAIN") or not os.environ.get("NODEPAD_API_KEY"):
        print("ERROR: NODEPAD_SPACE_DOMAIN and NODEPAD_API_KEY must be set.", file=sys.stderr)
        sys.exit(1)

    plugin = QualificationPlugin()

    # Attempt to fetch revision if available
    import requests
    domain = os.environ.get("NODEPAD_SPACE_DOMAIN").rstrip('/')
    if not domain.startswith('http'):
        domain = f"https://{domain}"

    try:
        r = requests.get(f"{domain}/health", timeout=5)
        if r.status_code == 200:
            data = r.json()
            if "revision" in data:
                os.environ["NODEPAD_EXPECTED_REVISION"] = data["revision"]
            elif "version" in data:
                os.environ["NODEPAD_EXPECTED_REVISION"] = data["version"]
    except Exception:
        pass

    # Run pytest programmatically on the hf/ directory
    test_dir = os.path.join(os.path.dirname(__file__), "hf")

    args = [
        test_dir,
        "-v",
        "--disable-warnings"
    ]

    pytest_exit_code = pytest.main(args, plugins=[plugin])

    # Generate reports
    generate_reports(plugin.results)

    print(f"\nQualification suite finished with exit code {pytest_exit_code}")
    print("Reports generated: qualification-results.json, qualification-report.md")

    sys.exit(pytest_exit_code)

if __name__ == "__main__":
    main()
