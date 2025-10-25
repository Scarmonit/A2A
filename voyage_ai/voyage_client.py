"""Voyage AI Client - Complete implementation for embeddings, reranking, and multimodal support."""

import os
import logging
from typing import List, Dict, Any, Optional, Union
import voyageai
from PIL import Image
import numpy as np
import io
import base64

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VoyageAIClient:
    """Complete Voyage AI client with embeddings, reranker, and multimodal capabilities."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Voyage AI client.
        
        Args:
            api_key: Voyage AI API key. If None, reads from VOYAGE_API_KEY env var.
        """
        self.api_key = api_key or os.getenv('VOYAGE_API_KEY')
        if not self.api_key:
            raise ValueError("Voyage AI API key must be provided or set in VOYAGE_API_KEY environment variable")
        
        self.client = voyageai.Client(api_key=self.api_key)
        logger.info("Voyage AI client initialized successfully")
    
    def get_embeddings(
        self,
        texts: Union[str, List[str]],
        model: str = "voyage-3",
        input_type: Optional[str] = None,
        truncation: bool = True
    ) -> Dict[str, Any]:
        """
        Generate embeddings for text inputs.
        
        Args:
            texts: Single text or list of texts to embed
            model: Model name (voyage-3, voyage-3-lite, voyage-code-3, voyage-finance-2, voyage-law-2, voyage-multilingual-2)
            input_type: Type of input ('query' or 'document'). Optimizes embedding for search use case.
            truncation: Whether to truncate inputs that exceed model's context length
        
        Returns:
            Dictionary containing embeddings and metadata
        """
        try:
            if isinstance(texts, str):
                texts = [texts]
            
            result = self.client.embed(
                texts=texts,
                model=model,
                input_type=input_type,
                truncation=truncation
            )
            
            logger.info(f"Generated embeddings for {len(texts)} texts using {model}")
            return {
                'embeddings': result.embeddings,
                'total_tokens': getattr(result, 'total_tokens', None),
                'model': model,
                'dimension': len(result.embeddings[0]) if result.embeddings else 0
            }
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            raise
    
    def get_query_embedding(
        self,
        query: str,
        model: str = "voyage-3"
    ) -> List[float]:
        """
        Generate embedding optimized for search queries.
        
        Args:
            query: Query text to embed
            model: Model name
        
        Returns:
            Query embedding vector
        """
        result = self.get_embeddings(query, model=model, input_type="query")
        return result['embeddings'][0]
    
    def get_document_embeddings(
        self,
        documents: List[str],
        model: str = "voyage-3"
    ) -> List[List[float]]:
        """
        Generate embeddings optimized for documents.
        
        Args:
            documents: List of documents to embed
            model: Model name
        
        Returns:
            List of document embedding vectors
        """
        result = self.get_embeddings(documents, model=model, input_type="document")
        return result['embeddings']
    
    def rerank(
        self,
        query: str,
        documents: List[str],
        model: str = "rerank-2",
        top_k: Optional[int] = None,
        return_documents: bool = True
    ) -> Dict[str, Any]:
        """
        Rerank documents based on relevance to query.
        
        Args:
            query: Search query
            documents: List of documents to rerank
            model: Reranking model (rerank-2, rerank-2-lite)
            top_k: Return only top k results. If None, returns all.
            return_documents: Whether to include document text in results
        
        Returns:
            Dictionary with reranked results and relevance scores
        """
        try:
            result = self.client.rerank(
                query=query,
                documents=documents,
                model=model,
                top_k=top_k
            )
            
            reranked_results = []
            for item in result.results:
                result_dict = {
                    'index': item.index,
                    'relevance_score': item.relevance_score
                }
                if return_documents:
                    result_dict['document'] = documents[item.index]
                reranked_results.append(result_dict)
            
            logger.info(f"Reranked {len(documents)} documents, returning top {len(reranked_results)}")
            return {
                'results': reranked_results,
                'model': model,
                'total_tokens': getattr(result, 'total_tokens', None)
            }
        except Exception as e:
            logger.error(f"Error during reranking: {str(e)}")
            raise
    
    def get_multimodal_embeddings(
        self,
        inputs: List[Dict[str, Any]],
        model: str = "voyage-multimodal-3",
        input_type: Optional[str] = None,
        truncation: bool = True
    ) -> Dict[str, Any]:
        """
        Generate embeddings for multimodal inputs (text and images).
        
        Args:
            inputs: List of input dictionaries. Each dict can contain:
                    - 'content': text string or list of content items
                    - For images: {'type': 'image_url', 'image_url': 'url_or_base64'}
                    - For text: {'type': 'text', 'text': 'content'}
            model: Multimodal model name (voyage-multimodal-3)
            input_type: Input type ('query' or 'document')
            truncation: Whether to truncate inputs
        
        Returns:
            Dictionary containing embeddings and metadata
        """
        try:
            result = self.client.multimodal_embed(
                inputs=inputs,
                model=model,
                input_type=input_type,
                truncation=truncation
            )
            
            logger.info(f"Generated multimodal embeddings for {len(inputs)} inputs")
            return {
                'embeddings': result.embeddings,
                'total_tokens': getattr(result, 'total_tokens', None),
                'model': model,
                'dimension': len(result.embeddings[0]) if result.embeddings else 0
            }
        except Exception as e:
            logger.error(f"Error generating multimodal embeddings: {str(e)}")
            raise
    
    def embed_image_from_path(
        self,
        image_path: str,
        model: str = "voyage-multimodal-3"
    ) -> List[float]:
        """
        Generate embedding for a single image from file path.
        
        Args:
            image_path: Path to image file
            model: Multimodal model name
        
        Returns:
            Image embedding vector
        """
        try:
            # Load and encode image
            with Image.open(image_path) as img:
                buffered = io.BytesIO()
                img.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue()).decode()
            
            inputs = [{
                'content': [{
                    'type': 'image_url',
                    'image_url': f'data:image/png;base64,{img_str}'
                }]
            }]
            
            result = self.get_multimodal_embeddings(inputs, model=model)
            return result['embeddings'][0]
        except Exception as e:
            logger.error(f"Error embedding image from path: {str(e)}")
            raise
    
    def embed_text_and_image(
        self,
        text: str,
        image_path: Optional[str] = None,
        image_url: Optional[str] = None,
        model: str = "voyage-multimodal-3"
    ) -> List[float]:
        """
        Generate embedding for combined text and image input.
        
        Args:
            text: Text content
            image_path: Path to local image file
            image_url: URL to image (use either image_path or image_url)
            model: Multimodal model name
        
        Returns:
            Combined embedding vector
        """
        content = [{'type': 'text', 'text': text}]
        
        if image_path:
            with Image.open(image_path) as img:
                buffered = io.BytesIO()
                img.save(buffered, format="PNG")
                img_str = base64.b64encode(buffered.getvalue()).decode()
                content.append({
                    'type': 'image_url',
                    'image_url': f'data:image/png;base64,{img_str}'
                })
        elif image_url:
            content.append({
                'type': 'image_url',
                'image_url': image_url
            })
        
        inputs = [{'content': content}]
        result = self.get_multimodal_embeddings(inputs, model=model)
        return result['embeddings'][0]
    
    def batch_embed(
        self,
        texts: List[str],
        batch_size: int = 128,
        model: str = "voyage-3",
        input_type: Optional[str] = None
    ) -> List[List[float]]:
        """
        Embed large number of texts in batches.
        
        Args:
            texts: List of texts to embed
            batch_size: Number of texts per batch
            model: Model name
            input_type: Input type
        
        Returns:
            List of all embeddings
        """
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            result = self.get_embeddings(
                batch,
                model=model,
                input_type=input_type
            )
            all_embeddings.extend(result['embeddings'])
            logger.info(f"Processed batch {i//batch_size + 1}/{(len(texts)-1)//batch_size + 1}")
        
        return all_embeddings
    
    def cosine_similarity(
        self,
        embedding1: List[float],
        embedding2: List[float]
    ) -> float:
        """
        Calculate cosine similarity between two embeddings.
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
        
        Returns:
            Cosine similarity score (0 to 1)
        """
        vec1 = np.array(embedding1)
        vec2 = np.array(embedding2)
        
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        return float(dot_product / (norm1 * norm2))
    
    def find_most_similar(
        self,
        query_embedding: List[float],
        document_embeddings: List[List[float]],
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Find most similar documents to query based on embeddings.
        
        Args:
            query_embedding: Query embedding vector
            document_embeddings: List of document embedding vectors
            top_k: Number of top results to return
        
        Returns:
            List of dictionaries with index and similarity score
        """
        similarities = []
        for idx, doc_emb in enumerate(document_embeddings):
            sim = self.cosine_similarity(query_embedding, doc_emb)
            similarities.append({'index': idx, 'similarity': sim})
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        
        return similarities[:top_k]


if __name__ == "__main__":
    # Example usage
    client = VoyageAIClient()
    
    # Test text embeddings
    texts = ["Hello, world!", "Voyage AI is powerful"]
    result = client.get_embeddings(texts)
    print(f"Generated {len(result['embeddings'])} embeddings with dimension {result['dimension']}")
    
    # Test reranking
    query = "What is machine learning?"
    documents = [
        "Machine learning is a subset of AI",
        "The weather is sunny today",
        "Deep learning uses neural networks"
    ]
    reranked = client.rerank(query, documents, top_k=2)
    print(f"Top reranked document: {reranked['results'][0]['document']}")
