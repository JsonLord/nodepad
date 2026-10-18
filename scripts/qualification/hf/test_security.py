def test_security_endpoints_blocked(hf_client):
    """Test common accidental paths are inaccessible."""
    paths_to_check = [
        "/.env",
        "/.env.local",
        "/.git/config",
        "/package-lock.json"
    ]

    for path in paths_to_check:
        status, data, _, _ = hf_client.get(path)
        # Should be 404 or 403, definitely not 200
        assert status in (404, 403, 401), f"Path {path} exposed! Status: {status}"

def test_fetch_url_ssrf_protection(hf_client):
    """Test SSRF protection for /api/fetch-url"""
    ssrf_targets = [
        "http://127.0.0.1:7860/health",
        "http://localhost:7860/health",
        "http://0.0.0.0:7860/health",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.0.0.1/"
    ]

    for target in ssrf_targets:
        status, data, _, _ = hf_client.post("/api/fetch-url", json={"url": target})
        # Should be blocked
        assert status in (400, 403), f"SSRF target {target} not blocked! Status: {status}"

    # Also test an unauthorized call without the token
    no_auth_client = __import__('httpx').Client(base_url=hf_client.domain)
    res = no_auth_client.post("/api/fetch-url", json={"url": "https://example.com"})
    assert res.status_code in (401, 403), "Protected route accessed without authorization"
