#!/usr/bin/env python3
"""
Voyage RAG Chatbot Example
- Ingest: load docs/ directory, split, embed with Voyage Embeddings
- Index: store vectors in local FAISS
- Retrieve: similarity search, then Voyage Reranker
- Generate: answer with Claude or OpenAI GPT via selected provider

Requirements:
  pip install voyageai faiss-cpu openai anthropic tiktoken pypdf python-dotenv
Env vars:
  VOYAGE_API_KEY=...
  ANTHROPIC_API_KEY=...   # if using Claude
  OPENAI_API_KEY=...      # if using GPT
Usage:
  python voyage_rag_chatbot.py --docs ./docs --provider claude --model claude-3-5-sonnet-latest
  python voyage_rag_chatbot.py --docs ./docs --provider openai --model gpt-4o-mini
"""

import os
import sys
import json
import time
import argparse
from dataclasses import dataclass
from typing import List, Tuple

# Optional but common utilities
try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

# Embeddings and rerank from Voyage AI
import voyageai as voi

# Vector store
try:
    import faiss  # type: ignore
except ImportError as e:
    print("Please install faiss-cpu: pip install faiss-cpu", file=sys.stderr)
    raise

# LLM providers
try:
    import anthropic
except Exception:
    anthropic = None

try:
    from openai import OpenAI as OpenAIClient
except Exception:
    OpenAIClient = None

# Simple loaders/splitters
from pathlib import Path

try:
    from pypdf import PdfReader
except Exception:
    PdfReader = None


@dataclass
class DocChunk:
    doc_id: str
    text: str
    metadata: dict


def load_text_file(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def load_pdf_file(path: Path) -> str:
    if PdfReader is None:
        raise RuntimeError("pypdf not installed. pip install pypdf")
    reader = PdfReader(str(path))
    texts = []
    for page in reader.pages:
        try:
            texts.append(page.extract_text() or "")
        except Exception:
            continue
    return "\n".join(texts)


def load_documents(docs_dir: str) -> List[Tuple[str, str]]:
    """Return list of (doc_id, text)."""
    p = Path(docs_dir)
    if not p.exists():
        raise FileNotFoundError(f"Docs directory not found: {docs_dir}")
    items: List[Tuple[str, str]] = []
    for path in p.rglob("*"):
        if not path.is_file():
            continue
        ext = path.suffix.lower()
        try:
            if ext in [".txt", ".md", ".csv", ".py", ".json", ".log"]:
                text = load_text_file(path)
            elif ext in [".pdf"]:
                text = load_pdf_file(path)
            else:
                continue
            if text.strip():
                items.append((str(path), text))
        except Exception as e:
            print(f"Skipping {path}: {e}")
    if not items:
        print("No supported documents found. Place files in the docs directory.")
    return items


def simple_split(text: str, chunk_size: int = 800, chunk_overlap: int = 150) -> List[str]:
    """Whitespace splitter that respects paragraph breaks."""
    if len(text) <= chunk_size:
        return [text]
    chunks = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunk = text[start:end]
        # try to cut on last paragraph or sentence boundary
        cut = max(chunk.rfind("\n\n"), chunk.rfind(". "))
        if cut > 0 and end != len(text):
            end = start + cut + 1
            chunk = text[start:end]
        chunks.append(chunk.strip())
        start = max(end - chunk_overlap, start + 1)
    return [c for c in chunks if c]


class VoyageRAG:
    def __init__(self, embedding_model: str = "voyage-2", rerank_model: str = "rerank-2"):
        api_key = os.getenv("VOYAGE_API_KEY")
        if not api_key:
            raise RuntimeError("VOYAGE_API_KEY not set")
        self.client = voi.Client(api_key=api_key)
        self.embedding_model = embedding_model
        self.rerank_model = rerank_model
        self.index = None  # FAISS index
        self.chunk_store: List[DocChunk] = []
        self.dim = None

    def build_index(self, docs: List[Tuple[str, str]], normalize: bool = True):
        corpus_chunks: List[DocChunk] = []
        for doc_id, text in docs:
            for i, chunk in enumerate(simple_split(text)):
                corpus_chunks.append(
                    DocChunk(doc_id=f"{doc_id}#chunk-{i}", text=chunk, metadata={"source": doc_id, "chunk": i})
                )
        texts = [c.text for c in corpus_chunks]
        # Embed with Voyage
        print(f"Embedding {len(texts)} chunks with {self.embedding_model}...")
        embeddings = self.client.embed(
            model=self.embedding_model,
            input=texts,
            input_type="document",
        ).embeddings
        import numpy as np
        vecs = np.array(embeddings, dtype="float32")
        if normalize:
            faiss.normalize_L2(vecs)
        self.dim = vecs.shape[1]
        self.index = faiss.IndexFlatIP(self.dim)
        self.index.add(vecs)
        self.chunk_store = corpus_chunks
        print(f"FAISS index built with {self.index.ntotal} vectors.")

    def retrieve(self, query: str, k: int = 12) -> List[Tuple[int, float]]:
        if self.index is None:
            raise RuntimeError("Index not built")
        # Query embedding
        qvec = self.client.embed(
            model=self.embedding_model,
            input=[query],
            input_type="query",
        ).embeddings[0]
        import numpy as np
        q = np.array([qvec], dtype="float32")
        faiss.normalize_L2(q)
        scores, idxs = self.index.search(q, k)
        return [(int(i), float(s)) for i, s in zip(idxs[0], scores[0]) if i != -1]

    def rerank(self, query: str, candidates: List[DocChunk], top_n: int = 5) -> List[DocChunk]:
        if not candidates:
            return []
        results = self.client.rerank(
            model=self.rerank_model,
            query=query,
            documents=[c.text for c in candidates],
            top_k=min(top_n, len(candidates)),
        )
        # Voyage returns sorted results w/ indices
        reranked = [candidates[r.index] for r in results.results]
        return reranked

    def search(self, query: str, k: int = 12, top_n: int = 5) -> List[DocChunk]:
        hits = self.retrieve(query, k=k)
        candidates = [self.chunk_store[i] for i, _ in hits]
        return self.rerank(query, candidates, top_n=top_n)


def build_prompt(query: str, contexts: List[DocChunk]) -> str:
    context_text = "\n\n---\n\n".join(
        [f"Source: {c.metadata.get('source')}\n{c.text}" for c in contexts]
    )
    return (
        "You are a helpful RAG assistant. Use only the provided context to answer.\n"
        "Cite sources by file name when relevant. If unsure, say you don't know.\n\n"
        f"Question: {query}\n\n"
        f"Context:\n{context_text}\n\n"
        "Answer:"
    )


def answer_with_claude(prompt: str, model: str) -> str:
    if anthropic is None:
        raise RuntimeError("anthropic package not installed")
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model=model,
        max_tokens=800,
        temperature=0.2,
        messages=[{"role": "user", "content": prompt}],
    )
    # Extract text
    parts = []
    for block in msg.content:
        if getattr(block, "type", None) == "text" or isinstance(block, dict) and block.get("type") == "text":
            parts.append(getattr(block, "text", None) or block.get("text", ""))
    return "".join(parts).strip() or str(msg)


def answer_with_openai(prompt: str, model: str) -> str:
    if OpenAIClient is None:
        raise RuntimeError("openai package not installed")
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")
    client = OpenAIClient(api_key=api_key)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
        max_tokens=800,
    )
    return resp.choices[0].message.content.strip()


def interactive_loop(rag: VoyageRAG, provider: str, model: str):
    print("RAG ready. Ask questions about your docs (Ctrl+C to exit).\n")
    while True:
        try:
            q = input("You: ").strip()
            if not q:
                continue
            contexts = rag.search(q, k=12, top_n=5)
            prompt = build_prompt(q, contexts)
            if provider == "claude":
                ans = answer_with_claude(prompt, model)
            else:
                ans = answer_with_openai(prompt, model)
            print("\nAssistant:\n" + ans + "\n")
            print("Sources:")
            for c in contexts:
                print(f" - {c.metadata.get('source')} (chunk {c.metadata.get('chunk')})")
            print()
        except KeyboardInterrupt:
            print("\nBye!")
            break
        except Exception as e:
            print(f"Error: {e}")


def persist_index(rag: VoyageRAG, path: str):
    if rag.index is None or rag.dim is None:
        raise RuntimeError("Index not built")
    import numpy as np
    faiss.write_index(rag.index, path)
    meta = {
        "dim": rag.dim,
        "chunks": [
            {"doc_id": c.doc_id, "text": c.text, "metadata": c.metadata}
            for c in rag.chunk_store
        ],
    }
    with open(path + ".meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f)


def load_index(path: str) -> Tuple[faiss.Index, List[DocChunk], int]:
    index = faiss.read_index(path)
    with open(path + ".meta.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
    chunks = [DocChunk(**c) for c in meta["chunks"]]
    dim = int(meta["dim"]) if "dim" in meta else None
    return index, chunks, dim


def main():
    parser = argparse.ArgumentParser(description="Voyage RAG Chatbot Example")
    parser.add_argument("--docs", default="./docs", help="Directory with documents")
    parser.add_argument("--embedding_model", default="voyage-2")
    parser.add_argument("--rerank_model", default="rerank-2")
    parser.add_argument("--provider", choices=["claude", "openai"], default="claude")
    parser.add_argument("--model", default="claude-3-5-sonnet-latest")
    parser.add_argument("--build", action="store_true", help="Rebuild the index from docs")
    parser.add_argument("--index_path", default="./voyage_faiss.index")
    args = parser.parse_args()

    rag = VoyageRAG(embedding_model=args.embedding_model, rerank_model=args.rerank_model)

    if args.build or not Path(args.index_path).exists():
        docs = load_documents(args.docs)
        if not docs:
            print("No documents to index. Exiting.")
            return
        rag.build_index(docs)
        persist_index(rag, args.index_path)
    else:
        index, chunks, dim = load_index(args.index_path)
        rag.index = index
        rag.chunk_store = chunks
        rag.dim = dim
        print(f"Loaded existing index with {len(chunks)} chunks.")

    interactive_loop(rag, args.provider, args.model)


if __name__ == "__main__":
    main()
