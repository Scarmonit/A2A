#!/bin/bash

# A2A Custom Code RAG Indexing Script
# Automatically indexes the codebase into LanceDB

set -e

echo "🚀 A2A Custom Code RAG Indexer"
echo "================================"

# Check for VOYAGE_API_KEY
if [ -z "$VOYAGE_API_KEY" ]; then
    echo "❌ Error: VOYAGE_API_KEY environment variable not set"
    echo "Please set your Voyage AI API key:"
    echo "  export VOYAGE_API_KEY='your-api-key-here'"
    exit 1
fi

# Install dependencies
echo "📦 Installing Python dependencies..."
pip install -q lancedb pyarrow mcp voyageai sentence-transformers

# Create data directory
mkdir -p ./data/vector_db

# Run indexer
echo "🔍 Indexing A2A repository..."
python ./src/rag/indexing/code_indexer.py

echo "✅ Indexing complete!"
echo ""
echo "📊 Vector database created at: ./data/vector_db"
echo "🔧 MCP server ready at: ./src/rag/mcp/rag_server.py"
echo ""
echo "Next steps:"
echo "1. Configure Continue with: config/continue_rag.yaml or config/continue_rag.json"
echo "2. Run MCP server: python ./src/rag/mcp/rag_server.py"
echo "3. Start using semantic code search in Continue!"
