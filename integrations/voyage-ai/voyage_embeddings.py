"""
Voyage AI text embedding service for A2A integrations.

Provides a simple client wrapper around VoyageAI's embedding API with batching,
retry logic, and model/version configurability.
"""
from __future__ import annotations

import os
import time
from typing import Iterable, List, Optional, Sequence, Dict, Any

import requests

DEFAULT_EMBED_MODEL = os.getenv("VOYAGE_EMBED_MODEL", "voyage-2")
VOYAGE_API_KEY_ENV = "VOYAGE_API_KEY"
VOYAGE_API_BASE = os.getenv("VOYAGE_API_BASE", "https://api.voyageai.com/v1")


class VoyageEmbeddingError(Exception):
    pass


class VoyageEmbeddingClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_EMBED_MODEL,
        base_url: str = VOYAGE_API_BASE,
        timeout: float = 60.0,
        max_retries: int = 5,
        retry_backoff: float = 1.5,
        batch_size: int = 128,
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self.api_key = api_key or os.getenv(VOYAGE_API_KEY_ENV)
        if not self.api_key:
            raise VoyageEmbeddingError(
                f"Missing API key. Set {VOYAGE_API_KEY_ENV} env var or pass api_key."
            )
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        self.batch_size = batch_size
        self.session = requests.Session()
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if extra_headers:
            self.headers.update(extra_headers)

    def _post(self, path: str, json: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries):
            try:
                resp = self.session.post(url, json=json, headers=self.headers, timeout=self.timeout)
                if resp.status_code == 429 or 500 <= resp.status_code < 600:
                    # rate limit or server error
                    raise VoyageEmbeddingError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                last_err = e
                sleep_s = min(30, (self.retry_backoff ** attempt))
                time.sleep(sleep_s)
        raise VoyageEmbeddingError(f"Request failed after retries: {last_err}")

    def embed_texts(
        self,
        texts: Sequence[str],
        *,
        model: Optional[str] = None,
        input_type: Optional[str] = None,
        normalize: bool = True,
        batch_size: Optional[int] = None,
    ) -> List[List[float]]:
        if not texts:
            return []
        model = model or self.model
        bsz = batch_size or self.batch_size
        embeddings: List[List[float]] = []
        for i in range(0, len(texts), bsz):
            chunk = texts[i : i + bsz]
            payload: Dict[str, Any] = {
                "model": model,
                "input": chunk,
            }
            if input_type:
                payload["input_type"] = input_type
            # Voyage supports normalize=true for unit-length vectors
            payload["normalize"] = normalize
            data = self._post("/embeddings", json=payload)
            # Expecting data: { "data": [ {"embedding": [...]} , ... ] }
            if "data" not in data:
                raise VoyageEmbeddingError(f"Unexpected response: {data}")
            for item in data["data"]:
                emb = item.get("embedding")
                if not isinstance(emb, list):
                    raise VoyageEmbeddingError("Missing embedding field in response item")
                embeddings.append(emb)
        return embeddings

    def embed(self, text: str, **kwargs: Any) -> List[float]:
        res = self.embed_texts([text], **kwargs)
        return res[0] if res else []


def embed_documents(
    documents: Iterable[str],
    *,
    api_key: Optional[str] = None,
    model: str = DEFAULT_EMBED_MODEL,
    input_type: Optional[str] = None,
    normalize: bool = True,
    batch_size: int = 128,
) -> List[List[float]]:
    client = VoyageEmbeddingClient(
        api_key=api_key,
        model=model,
        batch_size=batch_size,
    )
    return client.embed_texts(list(documents), input_type=input_type, normalize=normalize)


if __name__ == "__main__":
    # Simple smoke test
    key = os.getenv(VOYAGE_API_KEY_ENV)
    if not key:
        print(f"Set {VOYAGE_API_KEY_ENV} to run demo.")
    else:
        cli = VoyageEmbeddingClient(api_key=key)
        out = cli.embed_texts([
            "Voyage AI provides high-quality embeddings.",
            "We use these vectors for semantic search.",
        ])
        print(f"Generated {len(out)} embeddings, dim={len(out[0]) if out else 0}")
