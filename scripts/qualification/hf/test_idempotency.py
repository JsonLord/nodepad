def test_idempotency_headers(hf_client, temp_workspace):
    """Test that idempotency keys prevent duplicate mutations."""
    payload = {
        "claim": "Test hypothesis for idempotency."
    }

    headers1 = {"Idempotency-Key": "test-key-123"}

    # First request
    status1, data1, _, _ = hf_client.post(
        f"/api/v1/workspaces/{temp_workspace}/hypotheses",
        json=payload,
        headers=headers1
    )

    assert status1 == 200

    # Second request with same key
    status2, data2, _, _ = hf_client.post(
        f"/api/v1/workspaces/{temp_workspace}/hypotheses",
        json=payload,
        headers=headers1
    )

    assert status2 == 200
    assert data1["id"] == data2["id"], "Idempotency key failed, created duplicate items"
