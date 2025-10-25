# RAG (Retrieval-Augmented Generation) Module

## Directory Structure

```
src/rag/
├── indexing/
│   └── code_indexer.py      # Vector database indexing
├── mcp/
│   └── rag_server.py        # MCP server for Continue
└── README.md                 # This file
```

## Quick Reference

### Index Codebase
```bash
python src/rag/indexing/code_indexer.py
```

### Start MCP Server
```bash
python src/rag/mcp/rag_server.py
```

### Test Search
```python
import lancedb

db = lancedb.connect("./data/vector_db")
table = db.open_table("code_chunks_a2a")
results = table.search("authentication").limit(5).to_list()

for r in results:
    print(f"File: {r['filename']}")
    print(f"Text: {r['text'][:100]}...\n")
```

## MCP Tools Available

1. **search_codebase(query, limit, repository)**
   - Semantic code search
   - Returns: List of relevant code chunks

2. **get_file_context(filename, repository)**
   - Get complete file contents
   - Returns: All chunks from specified file

3. **search_by_language(query, language, limit, repository)**
   - Language-filtered search
   - Supported: typescript, javascript, python, yaml, json, markdown

## Environment Variables

- `VOYAGE_API_KEY`: Voyage AI API key (required)
- `RAG_DB_PATH`: Vector database path (default: ./data/vector_db)
- `RAG_MAX_CHUNK_TOKENS`: Max tokens per chunk (default: 15000)

## See Also

- Full documentation: `docs/CUSTOM_CODE_RAG_GUIDE.md`
- Configuration examples: `config/continue_rag.{yaml,json}`
- Indexing script: `scripts/index_codebase.sh`
