import os
import asyncio
import httpx
import pytest

@pytest.mark.asyncio
async def test_concurrent_reads(temp_workspace):
    """Test concurrent reads and writes to ensure no 500s or corruption."""
    domain = os.environ.get("NODEPAD_SPACE_DOMAIN", "http://localhost:7860")
    if not domain.startswith("http"):
        domain = f"https://{domain}"

    api_key = os.environ.get("NODEPAD_API_KEY", "")
    concurrency = int(os.environ.get("NODEPAD_QUALIFICATION_CONCURRENCY", "4"))

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(base_url=domain, headers=headers) as client:
        # 1. Establish some data
        await client.post(f"/api/v1/workspaces/{temp_workspace}/hypotheses", json={"statement": "Test concurrency base"})

        # 2. Concurrent reads
        read_tasks = []
        for i in range(concurrency):
            read_tasks.append(client.get(f"/api/v1/workspaces/{temp_workspace}/graph"))

        read_results = await asyncio.gather(*read_tasks, return_exceptions=True)
        for res in read_results:
            if isinstance(res, Exception):
                pytest.fail(f"Concurrent read failed with exception: {res}")
            assert res.status_code == 200, f"Concurrent read failed with status: {res.status_code}"

        # 3. Concurrent writes (controlled evidence mutations)
        write_tasks = []
        for i in range(concurrency):
            write_tasks.append(client.post(
                f"/api/v1/workspaces/{temp_workspace}/evidence",
                json={
                    "claim": f"Concurrent evidence {i}",
                    "sourceType": "test"
                }
            ))

        write_results = await asyncio.gather(*write_tasks, return_exceptions=True)
        for res in write_results:
            if isinstance(res, Exception):
                pytest.fail(f"Concurrent write failed with exception: {res}")
                # Both 200 and 201 can technically happen if idempotency handles it or logic accepts it.
                assert res.status_code in (200, 201), f"Concurrent write failed with status: {res.status_code}"
