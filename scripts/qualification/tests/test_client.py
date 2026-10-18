import os
import json
import httpx
import pytest

# Mock definitions for testing the client itself
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from hf.client import HfQualificationClient

def test_client_sanitizes_errors():
    client = HfQualificationClient("example.com", "secret-token")
    err_str = client._sanitize_error(Exception("Connection failed to secret-token provider"))
    assert "secret-token" not in err_str
    assert "***REDACTED***" in err_str

def test_client_retry_behavior(monkeypatch):
    class MockResponse:
        def __init__(self, status_code):
            self.status_code = status_code
            self.text = '{"status": "error"}'
        def json(self):
            return {"status": "error"}

    call_count = 0
    def mock_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return MockResponse(429)
        return MockResponse(200)

    client = HfQualificationClient("example.com", "token")
    monkeypatch.setattr(client.client, "request", mock_request)

    # We don't want to actually sleep in unit tests
    monkeypatch.setattr("time.sleep", lambda x: None)

    status, _, _, _ = client.get("/test")
    assert status == 200
    assert call_count == 3
