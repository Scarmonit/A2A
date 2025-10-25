# Voyage AI Integration Guide

This guide explains how to integrate Voyage AI with A2A, including setup, environment configuration, code examples, best practices, model selection, and troubleshooting.

## Prerequisites
- Python 3.9+
- pip or uv/poetry
- A Voyage AI API key
- Network access to api.voyageai.com

## Installation
```bash
pip install voyageai
# or
pip install "voyageai[all]"  # if you plan to use reranking and streaming utilities
```

## Configuration
Set your API key as an environment variable so A2A and your apps can access it.

macOS/Linux:
```bash
export VOYAGE_API_KEY="your_api_key_here"
```
Windows (PowerShell):
```powershell
setx VOYAGE_API_KEY "your_api_key_here"
$env:VOYAGE_API_KEY = "your_api_key_here"  # current session
```
.env file (recommended for local dev):
```
VOYAGE_API_KEY=your_api_key_here
```

In code, the SDK reads VOYAGE_API_KEY automatically; you can also pass it explicitly.

## Quick Start: Embeddings
```python
from voyageai import Voyage

vo = Voyage()
# Create embeddings for a list of texts
resp = vo.embeddings(model="voyage-3", input=[
    "A2A is an autonomous agent framework.",
    "Voyage provides state-of-the-art embeddings.",
])

vectors = resp.embeddings  # List[List[float]]
usage = resp.usage         # Token/compute usage
print(len(vectors), len(vectors[0]))
```

Batching for large corpora:
```python
texts = ["doc 1", "doc 2", ...]
for i in range(0, len(texts), 128):
    chunk = texts[i:i+128]
    vo.embeddings(model="voyage-3", input=chunk)
```

## Semantic Search with Cosine Similarity
```python
import numpy as np
from voyageai import Voyage

vo = Voyage()

docs = [
    "Install A2A with npm or yarn.",
    "Configure VOYAGE_API_KEY in your environment.",
    "Run the agent with parallel execution.",
]
emb = vo.embeddings(model="voyage-3", input=docs).embeddings

query = "How do I set the API key?"
qvec = vo.embeddings(model="voyage-3", input=[query]).embeddings[0]

# cosine similarity
E = np.array(emb)
q = np.array(qvec)
scores = E @ q / (np.linalg.norm(E, axis=1) * np.linalg.norm(q) + 1e-12)
ranked = sorted(zip(scores.tolist(), docs), reverse=True)
print(ranked[:3])
```

## Reranking
```python
from voyageai import Voyage

vo = Voyage()
query = "configure voyage api key"
candidates = [
    "Set OPENAI_API_KEY in your env.",
    "Set VOYAGE_API_KEY and export it.",
    "Update package.json scripts",
]
res = vo.rerank(model="rerank-2", query=query, documents=candidates, top_k=3)
for item in res.data:
    print(item.index, item.document, item.relevance_score)
```

## Text Generation / Chat
```python
from voyageai import Voyage

vo = Voyage()

messages = [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Explain A2A in one sentence."},
]
comp = vo.chat.completions.create(
    model="voyage-chat-2",
    messages=messages,
    temperature=0.7,
)
print(comp.choices[0].message["content"])
```

Streaming chat responses:
```python
for event in vo.chat.completions.create(
    model="voyage-chat-2",
    messages=[{"role": "user", "content": "Summarize A2A docs"}],
    stream=True,
):
    if event.type == "message.delta":
        print(event.delta, end="")
    elif event.type == "message.completed":
        print()  # newline at end
```

Function/tool calling (JSON schema):
```python
from voyageai import Voyage
vo = Voyage()

messages = [
    {"role": "user", "content": "What is the weather in Paris?"}
]
functions = [
    {
        "name": "get_weather",
        "description": "Get weather by city",
        "parameters": {
            "type": "object",
            "properties": {"city": {"type": "string"}},
            "required": ["city"],
        },
    }
]
resp = vo.chat.completions.create(
    model="voyage-chat-2",
    messages=messages,
    tools=[{"type": "function", "function": functions[0]}],
    tool_choice="auto",
)
print(resp.choices[0].message)
```

## HTTP API Examples (cURL)
Embeddings:
```bash
curl https://api.voyageai.com/v1/embeddings \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"voyage-3","input":["hello","world"]}'
```
Rerank:
```bash
curl https://api.voyageai.com/v1/rerank \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"rerank-2","query":"api key","documents":["a","b","c"],"top_k":3}'
```
Chat:
```bash
curl https://api.voyageai.com/v1/chat/completions \
  -H "Authorization: Bearer $VOYAGE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"voyage-chat-2","messages":[{"role":"user","content":"Hello"}]}'
```

## Integration with A2A
- Secrets: store VOYAGE_API_KEY in your secrets manager or .env; do not commit keys.
- Providers: create a Voyage provider module implementing A2A's embedding, rerank, and chat interfaces.
- Retrievers: use voyage-3 embeddings; normalize vectors; store in your vector DB (e.g., pgvector, Chroma, Pinecone).
- RAG: embed chunks with voyage-3, retrieve k=5-10, optionally rerank with rerank-2, and pass context to your LLM.

Example provider skeleton:
```python
# a2a/providers/voyage_provider.py
from typing import List, Dict, Any
from voyageai import Voyage

class VoyageProvider:
    def __init__(self, api_key: str | None = None):
        self.vo = Voyage(api_key=api_key) if api_key else Voyage()

    def embed(self, texts: List[str], model: str = "voyage-3") -> List[List[float]]:
        return self.vo.embeddings(model=model, input=texts).embeddings

    def rerank(self, query: str, docs: List[str], model: str = "rerank-2", top_k: int = 10):
        return self.vo.rerank(model=model, query=query, documents=docs, top_k=top_k).data

    def chat(self, messages: List[Dict[str, Any]], model: str = "voyage-chat-2", **kwargs):
        return self.vo.chat.completions.create(model=model, messages=messages, **kwargs)
```

## Model Selection Guide
- Embeddings: voyage-3 (general-purpose, high-quality) | voyage-2-lite (faster/cheaper, smaller dim)
- Rerank: rerank-2 (balanced quality/speed), rerank-2-lite (cost-optimized)
- Chat: voyage-chat-2 for general assistants; tune temperature/top_p for creativity vs determinism
- Choose based on: latency, context length, cost, and downstream metric (MRR@k, nDCG, answer accuracy)

## Best Practices
- Batch inputs (64-256) to maximize throughput; respect rate limits.
- Cache embeddings; only re-embed modified content.
- Normalize vectors; use cosine similarity for retrieval.
- Use reranking after vector search to improve precision@k.
- Monitor usage and errors; implement retries with exponential backoff.
- Stream chat for better UX on long generations.
- Truncate/summarize long inputs; stay within model limits.
- Securely handle API keys and PII; follow least-privilege.

Retry helper:
```python
import time
from voyageai import Voyage

vo = Voyage()

def with_retry(fn, max_retries=5, base=0.5):
    for i in range(max_retries):
        try:
            return fn()
        except Exception as e:
            if i == max_retries - 1:
                raise
            time.sleep(base * (2 ** i))

# usage
with_retry(lambda: vo.embeddings(model="voyage-3", input=["ping"]))
```

## Troubleshooting
- 401 Unauthorized: Ensure VOYAGE_API_KEY is set and not expired; check shell session.
- 429 Rate limit: Backoff and batch; ensure idempotency; consider lighter models.
- 400 Validation error: Verify model name and parameter types.
- Timeouts/5xx: Implement retries; shorten payloads; check status page.
- Vector DB mismatch: Ensure same embedding model used for both index and query.
- Unexpected chat output: Adjust system prompt, temperature, or max_tokens.

## References
- Voyage AI Docs: https://docs.voyageai.com/
- Python SDK: https://pypi.org/project/voyageai/
- API Reference: https://docs.voyageai.com/api-reference
- Changelog: https://docs.voyageai.com/changelog
