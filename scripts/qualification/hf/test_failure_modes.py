def test_validation_failures(hf_client, temp_workspace):
    """Test malformed requests fail safely."""

    # Missing required field 'claim'
    payload = {
        "text": "This is missing the claim field"
    }
    status, _, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json=payload)
    assert status in (400, 422), f"Expected validation failure, got {status}"

    # Overly long string
    payload = {
        "claim": "A" * 100000
    }
    status, _, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json=payload)
    assert status in (400, 413, 422), f"Expected validation failure for large input, got {status}"
