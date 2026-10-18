def test_workspace_lifecycle(hf_client, temp_workspace):
    """Test workspace creation and retrieval."""

    # In Nodepad, creating a hypothesis implicitly creates the workspace if it doesn't exist
    payload = {
        "claim": "Customers abandon checkout because payment processing is too slow."
    }
    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json=payload)

    assert status == 200, "Failed to create hypothesis/workspace"
    assert "id" in data, "No hypothesis ID returned"

    hypothesis_id = data["id"]

    # Retrieve graph
    status, data, _, _ = hf_client.get(f"/api/v1/workspaces/{temp_workspace}/graph")
    assert status == 200, "Failed to retrieve graph"

    # Assert hypothesis exists in graph
    node_ids = [n["id"] for n in data.get("nodes", [])]
    assert hypothesis_id in node_ids, "Hypothesis not found in graph"
