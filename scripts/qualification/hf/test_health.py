import os

def test_health_endpoint(hf_client):
    status, data, latency, error = hf_client.get("/health")
    assert status == 200, f"Expected 200, got {status} ({error})"
    assert isinstance(data, dict), "Expected JSON response"
    assert data.get("status") == "ok", "Expected status='ok'"
