def test_s121_synthesis(hf_client, temp_workspace):
    """Test synthesis execution (mocked to just verify the endpoint accepts it)."""
    payload = {
        "family": "S121"
    }

    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/syntheses/run", json=payload)
    # Could be 200 or 202 (accepted) depending on sync/async implementation
    assert status in (200, 202), f"Failed to trigger S121 synthesis: {status}"

def test_s012_synthesis(hf_client, temp_workspace):
    """Test S012 synthesis execution."""
    payload = {
        "family": "S012"
    }

    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/syntheses/run", json=payload)
    assert status in (200, 202), f"Failed to trigger S012 synthesis: {status}"
