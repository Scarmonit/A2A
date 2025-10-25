"""Custom RAG MCP server for code retrieval"""
import asyncio
import os
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import lancedb
from typing import List

# Initialize database connection
DB_PATH = os.environ.get("RAG_DB_PATH", "./data/vector_db")
db = lancedb.connect(DB_PATH)

app = Server("a2a-custom-rag-server")

@app.tool()
async def search_codebase(query: str, limit: int = 10, repository: str = "A2A") -> list[TextContent]:
    """
    Search the codebase using vector similarity.
    
    Args:
        query: The search query (natural language or code snippet)
        limit: Maximum number of results to return
        repository: Repository name to search (default: A2A)
    """
    try:
        table = db.open_table(f"code_chunks_{repository.lower()}")
        
        # Query vector database
        results = table.search(query) \
            .metric("cosine") \
            .limit(limit) \
            .to_list()
        
        # Format results for Continue
        formatted_results = []
        for result in results:
            formatted_results.append(TextContent(
                type="text",
                text=f"File: {result['filename']}\nLanguage: {result['language']}\nChunk: {result['chunk_index']}\n\n{result['text']}"
            ))
        
        return formatted_results
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"Error searching codebase: {str(e)}"
        )]

@app.tool()
async def get_file_context(filename: str, repository: str = "A2A") -> list[TextContent]:
    """
    Get all chunks from a specific file.
    
    Args:
        filename: The name of the file to retrieve
        repository: Repository name (default: A2A)
    """
    try:
        table = db.open_table(f"code_chunks_{repository.lower()}")
        results = table.where(f"filename = '{filename}'").to_list()
        
        if not results:
            return [TextContent(
                type="text",
                text=f"No results found for file: {filename}"
            )]
        
        # Sort by chunk index
        results.sort(key=lambda x: x['chunk_index'])
        
        # Combine chunks
        full_content = "\n".join([r['text'] for r in results])
        
        return [TextContent(
            type="text",
            text=f"File: {filename}\n\n{full_content}"
        )]
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"Error retrieving file: {str(e)}"
        )]

@app.tool()
async def search_by_language(query: str, language: str, limit: int = 10, repository: str = "A2A") -> list[TextContent]:
    """
    Search codebase filtered by programming language.
    
    Args:
        query: The search query
        language: Programming language filter (typescript, python, javascript, etc.)
        limit: Maximum number of results
        repository: Repository name (default: A2A)
    """
    try:
        table = db.open_table(f"code_chunks_{repository.lower()}")
        
        results = table.search(query) \
            .where(f"language = '{language.lower()}'") \
            .metric("cosine") \
            .limit(limit) \
            .to_list()
        
        formatted_results = []
        for result in results:
            formatted_results.append(TextContent(
                type="text",
                text=f"File: {result['filename']}\nChunk: {result['chunk_index']}\n\n{result['text']}"
            ))
        
        return formatted_results
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"Error searching by language: {str(e)}"
        )]

if __name__ == "__main__":
    stdio_server(app).run()
