import os
import pytest
import time
import random
from .client import HfQualificationClient

@pytest.fixture(scope="session")
def hf_client():
    domain = os.environ.get("NODEPAD_SPACE_DOMAIN")
    api_key = os.environ.get("NODEPAD_API_KEY")

    if not domain or not api_key:
        pytest.skip("NODEPAD_SPACE_DOMAIN and NODEPAD_API_KEY must be set for HF qualification tests")

    timeout = int(os.environ.get("NODEPAD_QUALIFICATION_TIMEOUT", "60"))

    client = HfQualificationClient(domain=domain, api_key=api_key, timeout=timeout)
    yield client
    client.close()

@pytest.fixture
def temp_workspace(hf_client):
    """Creates a temporary workspace for a test and attempts to clean it up afterward."""
    workspace_id = f"qualification_{int(time.time())}_{random.randint(1000, 9999)}"

    yield workspace_id

    # Optional cleanup if endpoint exists, otherwise it's just prefix-tracked
    keep = os.environ.get("NODEPAD_QUALIFICATION_KEEP_WORKSPACES", "false").lower() == "true"
    if not keep:
        # Nodepad doesn't have a standardized hard-delete for workspaces in this scope,
        # but we record it. If a delete endpoint exists, we would call it here:
        # hf_client.delete(f"/api/v1/workspaces/{workspace_id}")
        pass
