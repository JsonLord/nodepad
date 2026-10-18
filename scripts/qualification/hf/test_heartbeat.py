def test_heartbeat_trigger(hf_client, temp_workspace):
    """Test manual heartbeat cycle trigger."""

    # Needs to be a POST based on Agent.md
    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/heartbeat")

    # 200 or 202 is acceptable
    assert status in (200, 202), f"Failed to trigger heartbeat: {status}"
