"""RAG implementation using Voyage AI embeddings and reranker."""

from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from dataclasses import dataclass
from .voyage_client import VoyageAIClient
from .voyage_config import get_config, VoyageConfig


@dataclass
class RetrievedChunk:
    index: int
    text: str
    score: float


class VoyageRAG:
    """Retrieval-Augmented Generation utilities powered by Voyage AI."""

    def __init__(self, config: Optional[VoyageConfig] = None, client: Optional[VoyageAIClient] = None):
        self.config = config or get_config()
        self.client = client or VoyageAIClient(api_key=self.config.api_key)
        self.embedding_model = self.config.default_embedding_model
        self.rerank_model = self.config.default_rerank_model

    def build_corpus_index(self, documents: List[str], input_type: str = "document") -> Dict[str, Any]:
        """Create an index of embeddings for a list of documents."""
        embeddings = self.client.get_embeddings(documents, model=self.embedding_model, input_type=input_type)[
            'embeddings'
        ]
        index = {
            'embeddings': embeddings,
            'documents': documents,
            'model': self.embedding_model,
            'dimension': len(embeddings[0]) if embeddings else 0,
        }
        return index

    def retrieve(self, query: str, index: Dict[str, Any], top_k: int = 5, use_reranker: bool = True) -> List[RetrievedChunk]:
        """Retrieve top-k relevant chunks using vector similarity and optional reranking."""
        # Vector search via cosine similarity
        query_emb = self.client.get_query_embedding(query, model=index.get('model', self.embedding_model))
        doc_embs = index['embeddings']

        sims = self._cosine_similarities(query_emb, doc_embs)
        top_indices = np.argsort(-sims)[: top_k * 5 if use_reranker else top_k]
        prelim = [RetrievedChunk(int(i), index['documents'][int(i)], float(sims[int(i)])) for i in top_indices]

        if not use_reranker:
            return sorted(prelim, key=lambda x: x.score, reverse=True)[:top_k]

        # Rerank candidates with Voyage reranker
        candidates = [c.text for c in prelim]
        reranked = self.client.rerank(query, candidates, model=self.rerank_model, top_k=top_k, return_documents=True)
        results = []
        for r in reranked['results']:
            results.append(
                RetrievedChunk(index=prelim[r['index']].index, text=r.get('document', candidates[r['index']]), score=r['relevance_score'])
            )
        return results

    def _cosine_similarities(self, query_embedding: List[float], document_embeddings: List[List[float]]) -> np.ndarray:
        q = np.array(query_embedding)
        D = np.array(document_embeddings)
        q_norm = np.linalg.norm(q) + 1e-10
        D_norm = np.linalg.norm(D, axis=1) + 1e-10
        sims = (D @ q) / (D_norm * q_norm)
        return sims

    def answer(self, query: str, index: Dict[str, Any], generator, top_k: int = 5, system_prompt: Optional[str] = None) -> Tuple[str, List[RetrievedChunk]]:
        """
        Retrieve context and use the provided generator to produce an answer.
        'generator' is a callable: (prompt: str) -> str
        """
        retrieved = self.retrieve(query, index, top_k=top_k, use_reranker=True)
        context = "\n\n".join([f"[{i+1}] {rc.text}" for i, rc in enumerate(retrieved)])
        prompt = self._build_prompt(query, context, system_prompt)
        answer = generator(prompt)
        return answer, retrieved

    def _build_prompt(self, query: str, context: str, system_prompt: Optional[str]) -> str:
        sys = system_prompt or (
            "You are a helpful assistant. Answer the user's question using ONLY the provided context."
            " Cite sources by bracket number when relevant. If the answer is not contained, say you don't know."
        )
        return f"{sys}\n\nContext:\n{context}\n\nQuestion: {query}\nAnswer:"


# Example generator for testing purposes
if __name__ == "__main__":
    def echo_generator(p: str) -> str:
        return p[:500] + " ..."

    docs = [
        "Voyage AI provides high-quality text embeddings suitable for semantic search and clustering.",
        "Reranking models improve search relevance by reordering candidates based on a cross-encoder.",
        "Multimodal models support images and text for richer retrieval and understanding.",
        "Batching requests helps scale embedding computation efficiently.",
        "Configuration management centralizes API keys and model defaults.",
    ]

    rag = VoyageRAG()
    index = rag.build_corpus_index(docs)
    answer, retrieved = rag.answer("How to improve search relevance?", index, generator=echo_generator)
    print(answer)
    for r in retrieved:
        print(r)
