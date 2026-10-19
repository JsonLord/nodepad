def test_s121_synthesis(hf_client, temp_workspace):
    """Test S121 synthesis execution."""

    # Establish prerequisites
    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json={"statement": "Base hypothesis for synthesis."})
    assert status == 201

    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/evidence", json={"claim": "Some evidence.", "sourceType": "test"})
    assert status == 201

    payload = {
        "synthesisType": "S121"
    }

    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/syntheses/run", json=payload)
    # Synchronous success returns 200
    assert status == 200, f"Failed to trigger S121 synthesis: {status}, error: {data}"

    # Verify synthesis response
    assert data.get("synthesisType") == "S121"
    assert "generatedHypotheses" in data

    status, graph, _, _ = hf_client.get(f"/api/v1/workspaces/{temp_workspace}/graph")
    assert status == 200

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    status, hypotheses, _, _ = hf_client.get(f"/api/v1/workspaces/{temp_workspace}/hypotheses")
    assert status == 200

    if nodes:
        generated_hypotheses = [n for n in nodes if n.get("kind") == "hypothesis" and n.get("provenance", {}).get("reasoning", {}).get("synthesisType") == "S121"]
        for hyp in generated_hypotheses:
            support_edges = [e for e in edges if e.get("type") == "supports" and e.get("targetId") == hyp["id"]]
            assert len(support_edges) == 0, "Synthesis hallucinated/fabricated an authoritative support edge"

            full_hyp = next((h for h in hypotheses if h["id"] == hyp["id"]), None)
            if full_hyp:
                assert full_hyp.get("qualification") in ("unresolved", "draft", "proposed"), "Synthesis generated an automatically qualified hypothesis"

def test_s012_synthesis(hf_client, temp_workspace):
    """Test S012 synthesis execution."""

    # Establish prerequisites
    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json={"statement": "Base hypothesis for S012."})
    assert status == 201

    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/evidence", json={"claim": "Some evidence.", "sourceType": "test"})
    assert status == 201

    payload = {
        "synthesisType": "S012"
    }

    status, data, _, _ = hf_client.post(f"/api/v1/workspaces/{temp_workspace}/syntheses/run", json=payload)
    assert status == 200, f"Failed to trigger S012 synthesis: {status}, error: {data}"

    # Verify synthesis response
    assert data.get("synthesisType") == "S012"
    assert "generatedHypotheses" in data

    status, graph, _, _ = hf_client.get(f"/api/v1/workspaces/{temp_workspace}/graph")
    assert status == 200

    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])

    status, hypotheses, _, _ = hf_client.get(f"/api/v1/workspaces/{temp_workspace}/hypotheses")
    assert status == 200

    if nodes:
        generated_hypotheses = [n for n in nodes if n.get("kind") == "hypothesis" and n.get("provenance", {}).get("reasoning", {}).get("synthesisType") == "S012"]
        for hyp in generated_hypotheses:
            support_edges = [e for e in edges if e.get("type") == "supports" and e.get("targetId") == hyp["id"]]
            assert len(support_edges) == 0, "Synthesis hallucinated/fabricated an authoritative support edge"

            full_hyp = next((h for h in hypotheses if h["id"] == hyp["id"]), None)
            if full_hyp:
                assert full_hyp.get("qualification") in ("unresolved", "draft", "proposed"), "Synthesis generated an automatically qualified hypothesis"
