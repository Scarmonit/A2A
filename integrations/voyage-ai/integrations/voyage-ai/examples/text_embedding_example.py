#!/usr/bin/env python3
"""
Example: Text embeddings with VoyageEmbeddingClient

Usage:
  export VOYAGE_API_KEY=...  # required
  python examples/text_embedding_example.py
"""
import os
from integrations.voyage-ai.voyage_embeddings import VoyageEmbeddingClient, VOYAGE_API_KEY_ENV


def main():
    key = os.getenv(VOYAGE_API_KEY_ENV)
    if not key:
        raise SystemExit(f"Please set {VOYAGE_API_KEY_ENV}")
    client = VoyageEmbeddingClient(api_key=key)
    texts = [
        "The quick brown fox jumps over the lazy dog.",
        "Embeddings map text to vectors for semantic search.",
    ]
    embs = client.embed_texts(texts)
    print(f"Got {len(embs)} vectors; dim={len(embs[0]) if embs else 0}")


if __name__ == "__main__":
    main()
