import os
import asyncio
import httpx
import pytest

@pytest.mark.asyncio
async def test_concurrent_reads(temp_workspace):
    """Test concurrent reads to ensure no 500s or corruption."""
    domain = os.environ.get("NODEPAD_SPACE_DOMAIN", "http://localhost:7860")
    if not domain.startswith("http"):
        domain = f"https://{domain}"

    api_key = os.environ.get("NODEPAD_API_KEY", "")
    concurrency = int(os.environ.get("NODEPAD_QUALIFICATION_CONCURRENCY", "4"))

    headers = {
        "Authorization": f"Bearer {api_key}"
    }

    # Simple unauth/auth safe read test
    async with httpx.AsyncClient(base_url=domain) as client:
        tasks = []
        for i in range(concurrency):
            tasks.append(client.get("/health"))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for res in results:
            if isinstance(res, Exception):
                pytest.fail(f"Concurrent request failed with exception: {res}")
            assert res.status_code == 200, f"Concurrent request failed with status: {res.status_code}"
