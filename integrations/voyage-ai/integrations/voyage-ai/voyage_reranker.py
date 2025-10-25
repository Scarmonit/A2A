"""
Voyage AI document reranking client for A2A integrations.

Given a query and a list of documents, returns documents with scores in
descending order of relevance using Voyage reranker models.
"""
from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import requests

VOYAGE_API_KEY_ENV = "VOYAGE_API_KEY"
VOYAGE_API_BASE = os.getenv("VOYAGE_API_BASE", "https://api.voyageai.com/v1")
DEFAULT_RERANK_MODEL = os.getenv("VOYAGE_RERANK_MODEL", "rerank-2")


class VoyageRerankError(Exception):
    pass


@dataclass
class RerankResult:
    index: int
    document: str
    score: float


class VoyageRerankerClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_RERANK_MODEL,
        base_url: str = VOYAGE_API_BASE,
        timeout: float = 60.0,
        max_retries: int = 5,
        retry_backoff: float = 1.5,
        return_documents: bool = True,
    ) -> None:
        self.api_key = api_key or os.getenv(VOYAGE_API_KEY_ENV)
        if not self.api_key:
            raise VoyageRerankError(
                f"Missing API key. Set {VOYAGE_API_KEY_ENV} env var or pass api_key."
            )
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_backoff = retry_backoff
        self.return_documents = return_documents
        self.session = requests.Session()
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _post(self, path: str, json: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries):
            try:
                resp = self.session.post(url, json=json, headers=self.headers, timeout=self.timeout)
                if resp.status_code == 429 or 500 <= resp.status_code < 600:
                    raise VoyageRerankError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                last_err = e
                time.sleep(min(30, self.retry_backoff ** attempt))
        raise VoyageRerankError(f"Request failed after retries: {last_err}")

    def rerank(
        self,
        query: str,
        documents: Sequence[str],
        *,
        top_k: Optional[int] = None,
        model: Optional[str] = None,
    ) -> List[RerankResult]:
        if not documents:
            return []
        model = model or self.model
        payload: Dict[str, Any] = {
            "model": model,
            "query": query,
            "documents": list(documents),
        }
        if top_k is not None:
            payload["top_k"] = int(top_k)
        payload["return_documents"] = self.return_documents
        data = self._post("/rerank", json=payload)
        # Expected format: { data: [ { index, score, document? } ] }
        if "data" not in data:
            raise VoyageRerankError(f"Unexpected response: {data}")
        results: List[RerankResult] = []
        for item in data["data"]:
            idx = int(item.get("index", -1))
            score = float(item.get("score", 0.0))
            doc = item.get("document") if self.return_documents else documents[idx]
            results.append(RerankResult(index=idx, document=doc, score=score))
        # Ensure sorted descending by score (API should already do this)
        results.sort(key=lambda r: r.score, reverse=True)
        # Optionally truncate
        if top_k is not None:
            results = results[: top_k]
        return results


if __name__ == "__main__":
    key = os.getenv(VOYAGE_API_KEY_ENV)
    if not key:
        print(f"Set {VOYAGE_API_KEY_ENV} to run demo.")
    else:
        docs = [
            "Apple releases new iPhone with better camera",
            "Bananas are a great source of potassium",
            "Latest iOS update improves battery life",
            "How to bake an apple pie",
        ]
        client = VoyageRerankerClient(api_key=key)
        results = client.rerank("apple phone battery", docs, top_k=3)
        for r in results:
            print(f"{r.score:.4f}\t{r.index}\t{r.document}")
