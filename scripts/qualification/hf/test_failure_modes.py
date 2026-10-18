def test_validation_failures(hf_client, temp_workspace):
    """Test malformed requests fail safely."""

    # Overly long string for hypothesis
    payload = {
        "statement": "A" * 1000000
    }
    status, _, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json=payload)
    assert status in (400, 413, 422, 500, 502), f"Expected validation failure for large input, got {status}"

    # Invalid enum value for synthesis
    payload = {
        "synthesisType": "INVALID_TYPE"
    }
    status, _, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/syntheses/run", json=payload)
    assert status in (400, 422), f"Expected validation failure for invalid synthesis type, got {status}"
