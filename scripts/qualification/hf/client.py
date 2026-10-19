import os
import time
import httpx
from typing import Dict, Any, Optional

class HfQualificationClient:
    def __init__(self, domain: str, api_key: str, timeout: int = 60):
        self.domain = domain.rstrip('/')
        if not self.domain.startswith('http'):
            self.domain = f'https://{self.domain}'
        self.api_key = api_key

        self.client = httpx.Client(
            base_url=self.domain,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            },
            timeout=timeout
        )

    def _sanitize_error(self, e: Exception) -> str:
        error_str = str(e)
        if self.api_key:
            error_str = error_str.replace(self.api_key, '***REDACTED***')
        return error_str

    def request(self, method: str, path: str, **kwargs) -> tuple[int, Any, float, str]:
        """
        Returns (status_code, parsed_json, latency_ms, error_category)
        Handles safe retries for 429, 502, 503, 504.
        """
        max_retries = 3
        retry_delay = 1

        path = path if path.startswith('/') else f'/{path}'

        for attempt in range(max_retries + 1):
            start_time = time.perf_counter()
            try:
                response = self.client.request(method, path, **kwargs)
                latency_ms = (time.perf_counter() - start_time) * 1000

                # Check for retryable status codes
                if response.status_code in (429, 502, 503, 504) and attempt < max_retries:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue

                # Try to parse JSON, default to text or None if empty
                if response.text:
                    try:
                        data = response.json()
                    except ValueError:
                        data = response.text
                else:
                    data = None

                return response.status_code, data, latency_ms, ""

            except httpx.TimeoutException as e:
                latency_ms = (time.perf_counter() - start_time) * 1000
                if attempt < max_retries:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue
                return 0, None, latency_ms, f"Timeout: {self._sanitize_error(e)}"
            except Exception as e:
                latency_ms = (time.perf_counter() - start_time) * 1000
                return 0, None, latency_ms, f"Error: {self._sanitize_error(e)}"

    def get(self, path: str, **kwargs):
        return self.request("GET", path, **kwargs)

    def post(self, path: str, **kwargs):
        return self.request("POST", path, **kwargs)

    def delete(self, path: str, **kwargs):
        return self.request("DELETE", path, **kwargs)

    def close(self):
        self.client.close()
