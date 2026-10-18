import pytest
import sys
import os
import httpx
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from hf.client import HfQualificationClient

def test_client_sanitizes_errors():
    client = HfQualificationClient("example.com", "secret-token")
    err_str = client._sanitize_error(Exception("Connection failed to secret-token provider"))
    assert "secret-token" not in err_str
    assert "***REDACTED***" in err_str

def test_client_retry_behavior(monkeypatch):
    class MockResponse:
        def __init__(self, status_code, text='{"status": "error"}'):
            self.status_code = status_code
            self.text = text
        def json(self):
            import json
            return json.loads(self.text)

    call_count = 0
    def mock_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return MockResponse(429)
        return MockResponse(200, '{"ok": true}')

    client = HfQualificationClient("example.com", "token")
    monkeypatch.setattr(client.client, "request", mock_request)
    monkeypatch.setattr("time.sleep", lambda x: None)

    status, data, _, _ = client.get("/test")
    assert status == 200
    assert call_count == 3
    assert data["ok"] is True

def test_client_no_retry_400(monkeypatch):
    class MockResponse:
        def __init__(self, status_code):
            self.status_code = status_code
            self.text = '{"error": "bad request"}'
        def json(self):
            import json
            return json.loads(self.text)

    call_count = 0
    def mock_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        return MockResponse(400)

    client = HfQualificationClient("example.com", "token")
    monkeypatch.setattr(client.client, "request", mock_request)
    monkeypatch.setattr("time.sleep", lambda x: None)

    status, _, _, _ = client.get("/test")
    assert status == 400
    assert call_count == 1  # Should not retry

def test_client_timeout(monkeypatch):
    call_count = 0
    def mock_request(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise httpx.TimeoutException("Timeout")

    client = HfQualificationClient("example.com", "token")
    monkeypatch.setattr(client.client, "request", mock_request)
    monkeypatch.setattr("time.sleep", lambda x: None)

    status, _, _, error = client.get("/test")
    assert status == 0
    assert call_count == 4 # Initial + 3 retries
    assert "Timeout" in error

def test_client_non_json_handling(monkeypatch):
    class MockResponse:
        def __init__(self):
            self.status_code = 200
            self.text = "Just some text"
        def json(self):
            import json
            return json.loads(self.text)

    def mock_request(*args, **kwargs):
        return MockResponse()

    client = HfQualificationClient("example.com", "token")
    monkeypatch.setattr(client.client, "request", mock_request)

    status, data, _, _ = client.get("/test")
    assert status == 200
    assert data == "Just some text"
