# A2A Awesome Integration

... (existing content above)

## 🚀 Voyage AI Integration
Bring state-of-the-art embeddings, reranking, and multimodal understanding to A2A using Voyage AI.

### Installation
- Python client: `pip install voyageai`
- Node.js client: `npm install @voyageai/sdk`

### API Key Setup
Create an API key at https://dash.voyageai.com and set it in your environment.
- macOS/Linux:
  - Bash: `export VOYAGE_API_KEY=your_key`
  - Fish: `set -x VOYAGE_API_KEY your_key`
- Windows (PowerShell): `setx VOYAGE_API_KEY your_key`

Or place in a .env file (development only):
VOYAGE_API_KEY=your_key

### Python Usage Examples

- Embeddings (text/code)
```python
import voyageai as voi
vo = voi.Client()
texts = [
  "How do I configure the A2A MCP server?",
  "Vector search with LanceDB",
]
emb = vo.embeddings(input=texts, model="voyage-3", input_type="text")
print(len(emb.data), len(emb.data[0].embedding))
```
- Code Embeddings
```python
code_snippets = ["def add(a,b):\n    return a+b", "function add(a,b){return a+b}"]
emb = vo.embeddings(input=code_snippets, model="voyage-code-3", input_type="code")
```
- Reranker
```python
query = "authentication middleware"
docs = ["Add oauth2 to FastAPI", "Express auth middleware", "Logging setup"]
ranked = vo.rerank(model="rerank-2", query=query, documents=docs)
for item in ranked.data:
    print(item.index, item.relevance_score)
```
- Multimodal (image + text)
```python
with open("diagram.png", "rb") as f:
    img_bytes = f.read()
res = vo.multimodal_embeddings(
    input=[{"type": "text", "text": "A2A architecture diagram"}, {"type": "image", "image": img_bytes}],
    model="voyage-multimodal-3"
)
```

### TypeScript/Node Usage Examples
```ts
import Voyage from "@voyageai/sdk";
const client = new Voyage({ apiKey: process.env.VOYAGE_API_KEY! });
// Embeddings
const emb = await client.embeddings.create({
  model: "voyage-3",
  input: ["Search across A2A", "MCP tools"],
  input_type: "text",
});
// Rerank
const rr = await client.rerank.create({
  model: "rerank-2",
  query: "LanceDB integration",
  documents: ["LanceDB quickstart", "SQLite how-to"],
});
```

### Integrating with A2A RAG
- Default embedding model: `voyage-code-3` (code) or `voyage-3` (text)
- Configure via env:
  - `VOYAGE_API_KEY`
  - `A2A_RAG_EMBED_MODEL=voyage-code-3`
- Example indexing script snippet:
```python
from src.rag.embed import embedder
E = embedder(model="voyage-code-3")
E.index_repo("./", include=[".py", ".ts", ".md"]) 
```

### Models Cheatsheet
- Text: voyage-3, voyage-2
- Code: voyage-code-3
- Rerank: rerank-2
- Multimodal: voyage-multimodal-3

### Documentation
- Voyage AI docs: https://docs.voyageai.com
- Python SDK: https://pypi.org/project/voyageai/
- JS SDK: https://www.npmjs.com/package/@voyageai/sdk
- API reference: https://api.voyageai.com
