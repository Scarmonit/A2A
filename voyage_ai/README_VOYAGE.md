# Voyage AI Integration for A2A

This directory provides a complete integration of Voyage AI for embeddings, reranking, and multimodal support, plus a simple Retrieval-Augmented Generation (RAG) pipeline.

Contents:
- voyage_client.py: High-level client wrapping Voyage AI SDK (embeddings, reranker, multimodal)
- voyage_config.py: Configuration management with env/file support
- voyage_rag.py: Minimal RAG utilities using Voyage embeddings + reranker
- requirements_voyage.txt: Dependencies for this integration

Prerequisites
- Python 3.9+
- Set environment variable VOYAGE_API_KEY

Installation
1) pip install -r voyage_ai/requirements_voyage.txt
2) Optionally create a .env with VOYAGE_API_KEY=... and load via python-dotenv

Quick Start: Text Embeddings
```python
from voyage_ai.voyage_client import VoyageAIClient

client = VoyageAIClient()  # reads VOYAGE_API_KEY from env
res = client.get_embeddings(["hello world", "voyage ai"], model="voyage-3", input_type="document")
print(len(res["embeddings"]), len(res["embeddings"][0]))
```

Quick Start: Reranker
```python
from voyage_ai.voyage_client import VoyageAIClient

client = VoyageAIClient()
query = "what is machine learning?"
docs = [
  "Machine learning is a subset of AI",
  "The weather is sunny today",
  "Deep learning uses neural networks",
]
reranked = client.rerank(query, docs, model="rerank-2", top_k=2)
for r in reranked["results"]:
    print(r["relevance_score"], r.get("document"))
```

Quick Start: Multimodal Embeddings (text+image)
```python
from voyage_ai.voyage_client import VoyageAIClient

client = VoyageAIClient()
emb = client.embed_text_and_image(
    text="A cat sitting on a chair",
    image_path="example.png",
    model="voyage-multimodal-3",
)
print(len(emb))
```

RAG Example
```python
from voyage_ai.voyage_rag import VoyageRAG

rag = VoyageRAG()
docs = [
  "Voyage AI provides high-quality text embeddings suitable for semantic search and clustering.",
  "Reranking models improve search relevance by reordering candidates based on a cross-encoder.",
]
index = rag.build_corpus_index(docs)

def simple_generator(prompt: str) -> str:
    # replace with your LLM call
    return "Echo:\n" + prompt[:400]

answer, retrieved = rag.answer("How to improve search relevance?", index, generator=simple_generator)
print(answer)
print(retrieved)
```

Configuration
- VOYAGE_API_KEY: API key (required)
- Optional environment variables:
  - VOYAGE_EMBEDDING_MODEL (default: voyage-3)
  - VOYAGE_RERANK_MODEL (default: rerank-2)
  - VOYAGE_BATCH_SIZE, VOYAGE_TIMEOUT, VOYAGE_MAX_RETRIES, VOYAGE_ENABLE_CACHE, VOYAGE_CACHE_DIR

Notes
- See https://docs.voyageai.com for latest models, parameters, and usage.
- This integration avoids storing keys in code; use env or a JSON config via VoyageConfig.
