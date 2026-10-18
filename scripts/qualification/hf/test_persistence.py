import os
import pytest

def test_persistence_between_restarts(hf_client):
    """Test optional workspace persistence checking across restarts."""

    workspace_id = os.environ.get("NODEPAD_PERSISTENCE_WORKSPACE_ID")
    expected_revision = os.environ.get("NODEPAD_PERSISTENCE_EXPECTED_REVISION")

    if not workspace_id:
        pytest.skip("NODEPAD_PERSISTENCE_WORKSPACE_ID not set, skipping persistence test")

    status, data, _, _ = hf_client.get(f"/api/v1/workspaces/{workspace_id}/context")

    assert status == 200, f"Failed to retrieve persisted workspace {workspace_id}"

    if expected_revision:
        actual_rev = str(data.get("revision", ""))
        assert actual_rev == expected_revision, f"Revision mismatch: {actual_rev} != {expected_revision}"
