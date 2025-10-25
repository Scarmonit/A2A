"""
Voyage AI multimodal (image+text) embedding client for A2A integrations.

Supports generating embeddings from text, images, or combined inputs.
"""
from __future__ import annotations

import base64
import os
import time
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

import requests

VOYAGE_API_KEY_ENV = "VOYAGE_API_KEY"
VOYAGE_API_BASE = os.getenv("VOYAGE_API_BASE", "https://api.voyageai.com/v1")
DEFAULT_MM_MODEL = os.getenv("VOYAGE_MM_MODEL", "voyage-multimodal-2")

ImageInput = Union[str, bytes]  # URL or raw bytes


class VoyageMultimodalError(Exception):
    pass


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode("utf-8")


class VoyageMultimodalClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MM_MODEL,
        base_url: str = VOYAGE_API_BASE,
        timeout: float = 60.0,
        max_retries: int = 5,
        retry_backoff: float = 1.5,
        batch_size: int = 16,
    ) -> None:
        self.api_key = api_key or os.getenv(VOYAGE_API_KEY_ENV)
        if not self.api_key:
            raise VoyageMultimodalError(
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

    def _post(self, path: str, json: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries):
            try:
                resp = self.session.post(url, json=json, headers=self.headers, timeout=self.timeout)
                if resp.status_code == 429 or 500 <= resp.status_code < 600:
                    raise VoyageMultimodalError(f"HTTP {resp.status_code}: {resp.text[:200]}")
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                last_err = e
                time.sleep(min(30, self.retry_backoff ** attempt))
        raise VoyageMultimodalError(f"Request failed after retries: {last_err}")

    @staticmethod
    def _image_part(image: ImageInput) -> Dict[str, Any]:
        if isinstance(image, bytes):
            return {"type": "image", "image": {"base64": _b64(image)}}
        if isinstance(image, str) and image.startswith("http"):
            return {"type": "image", "image": {"url": image}}
        raise VoyageMultimodalError("Image must be URL str or raw bytes")

    def embed(
        self,
        texts: Optional[Sequence[str]] = None,
        images: Optional[Sequence[ImageInput]] = None,
        *,
        model: Optional[str] = None,
        normalize: bool = True,
        batch_size: Optional[int] = None,
    ) -> List[List[float]]:
        if not texts and not images:
            return []
        model = model or self.model
        bsz = batch_size or self.batch_size
        # Build combined inputs: each item can have text and/or image parts
        items: List[List[Dict[str, Any]]]= []
        n = 0
        if texts:
            n = max(n, len(texts))
        if images:
            n = max(n, len(images))
        for i in range(n):
            parts: List[Dict[str, Any]] = []
            if texts and i < len(texts):
                parts.append({"type": "text", "text": texts[i]})
            if images and i < len(images):
                parts.append(self._image_part(images[i]))
            items.append(parts)

        embeddings: List[List[float]] = []
        for i in range(0, len(items), bsz):
            chunk = items[i : i + bsz]
            payload: Dict[str, Any] = {
                "model": model,
                "input": chunk,
                "normalize": normalize,
            }
            data = self._post("/multimodal/embeddings", json=payload)
            if "data" not in data:
                raise VoyageMultimodalError(f"Unexpected response: {data}")
            for entry in data["data"]:
                emb = entry.get("embedding")
                if not isinstance(emb, list):
                    raise VoyageMultimodalError("Missing embedding in response item")
                embeddings.append(emb)
        return embeddings


if __name__ == "__main__":
    key = os.getenv(VOYAGE_API_KEY_ENV)
    if not key:
        print(f"Set {VOYAGE_API_KEY_ENV} to run demo.")
    else:
        cli = VoyageMultimodalClient(api_key=key)
        embs = cli.embed(
            texts=["cat sitting on a sofa"],
            images=["https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg"],
        )
        print(f"Multimodal embeddings: {len(embs)} items, dim={len(embs[0]) if embs else 0}")
