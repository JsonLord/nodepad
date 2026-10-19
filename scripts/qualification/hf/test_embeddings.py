import os

def test_embeddings_status(hf_client):
    status, data, latency, error = hf_client.get("/api/v1/embeddings/status")

    assert status == 200, f"Expected 200, got {status} ({error})"
    assert isinstance(data, dict), "Expected JSON response"

    assert data.get("enabled") is True
    assert data.get("provider") == "local-transformers"

    expected_model = os.environ.get("NODEPAD_EXPECTED_EMBEDDING_MODEL", "Xenova/bge-small-en-v1.5")
    assert data.get("model") == expected_model
    assert data.get("status") == "available"

    # Reject these exact statuses explicitly per spec
    assert data.get("provider") != "ollama"
    assert data.get("status") not in ("disabled", "model_error", "unreachable")
