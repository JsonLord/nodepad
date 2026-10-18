import time

def test_heartbeat_trigger(hf_client, temp_workspace):
    """Test manual heartbeat cycle trigger."""

    # Create some state first
    payload = {
        "statement": "State for heartbeat."
    }
    status, _, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json=payload)
    assert status == 201

    # Needs to be a POST based on Agent.md with valid JSON
    hb_payload = {
        "runId": f"qualification-hb-{int(time.time())}"
    }

    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/heartbeat", json=hb_payload)

    # 200 is acceptable
    assert status == 200, f"Failed to trigger heartbeat: {status}"

    # Ensure it returns phases
    assert isinstance(data, dict), "Expected JSON dict"
    assert "phases" in data, "Expected 'phases' in heartbeat response"
    assert "status" in data
