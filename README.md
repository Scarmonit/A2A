# A2A Awesome Integration
[![CI Status](https://github.com/Scarmonit/A2A/actions/workflows/ci.yml/badge.svg)](https://github.com/Scarmonit/A2A/actions/workflows/ci.yml)
[![Security Scan](https://github.com/Scarmonit/A2A/actions/workflows/security.yml/badge.svg)](https://github.com/Scarmonit/A2A/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
A curated, awesome-style index for the A2A MCP Server that organizes tools, platforms, and frameworks used to build, deploy, and orchestrate agent-to-agent systems. Structured like Awesome Lists with emoji indicators and clear categories aligned to the A2A repository.
- Contribution guide: see Contributing section
- Legend: ✅ stable • 🧪 experimental • 🧰 tooling • 📦 package • 📚 docs • 🔌 integration • 🧩 plugin • ☁️ cloud • 🐳 container • ⚙️ automation • 🤖 AI/agents • 🔐 security • 📈 monitoring • 🚀 CI/CD
## INTEGRATIONS
### Terminal & Development Environment 🔌
#### Warp + Ollama Integration ⚡🤖
[![Warp Terminal](https://img.shields.io/badge/Warp-Terminal-FF6B35?style=for-the-badge&logo=warp&logoColor=white)](https://warp.dev)
[![Ollama](https://img.shields.io/badge/Ollama-AI-00ADD8?style=for-the-badge&logo=ollama&logoColor=white)](https://ollama.ai)
[![Performance](https://img.shields.io/badge/Performance-Optimized-4CAF50?style=for-the-badge)]()
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-9C27B0?style=for-the-badge)]()
> **Revolutionary terminal-AI integration bringing LLM capabilities directly into your development workflow with blazing-fast local inference and seamless A2A MCP connectivity.**
##### 🚀 Quick Start
```bash
# Install Warp Terminal
curl -fsSL https://raw.githubusercontent.com/warpdotdev/warp/main/install.sh | sh
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh
# Pull recommended models
ollama pull llama2:13b-chat
ollama pull codellama:34b-instruct
ollama pull mistral:7b-instruct
# Configure A2A MCP Bridge
git clone https://github.com/Scarmonit/A2A.git
cd A2A/integrations/warp-ollama
npm install
npm run setup-bridge
```
##### 📋 Features
- **🔄 Real-time MCP Protocol Integration** — Seamless bidirectional communication with A2A servers
- **⚡ Local LLM Processing** — Zero-latency inference with Ollama's optimized engine
- **🎯 Context-Aware Assistance** — Terminal-native code completion and debugging
- **🔧 Multi-Model Support** — Switch between specialized models for different tasks
- **📊 Performance Monitoring** — Real-time metrics and model performance analytics
- **🔐 Privacy-First** — All processing happens locally, no data leaves your machine
##### 📖 Documentation
- **[Setup Guide](./docs/integrations/warp-ollama-setup.md)** — Complete installation and configuration
- **[MCP Protocol Reference](./docs/integrations/warp-ollama-mcp.md)** — A2A MCP bridge implementation details
- **[Model Configuration](./docs/integrations/warp-ollama-models.md)** — Optimize models for different workflows
- **[Troubleshooting](./docs/integrations/warp-ollama-troubleshooting.md)** — Common issues and solutions
- **[API Reference](./docs/integrations/warp-ollama-api.md)** — Programmatic integration guide
##### 🎯 Use Cases
- **Code Review & Refactoring** — AI-powered code analysis and suggestions
- **Documentation Generation** — Automatic README, docstring, and comment generation
- **Debugging Assistant** — Intelligent error analysis and resolution suggestions
- **Command Explanation** — Natural language explanations of complex shell commands

## 📚 Custom Code RAG (Retrieval-Augmented Generation)

**State-of-the-art semantic code search powered by Voyage AI and LanceDB**

A2A includes a production-ready custom RAG system that enables:

- ✅ **Semantic code search** across your entire codebase
- ✅ **Natural language queries** ("Find authentication middleware")
- ✅ **Language-filtered search** (Python-only, TypeScript-only, etc.)
- ✅ **Continue IDE integration** via Model Context Protocol (MCP)
- ✅ **voyage-code-3 embeddings** (best-in-class for code)
- ✅ **LanceDB vector database** (fast, embedded, production-ready)

### Quick Start

```bash
# 1. Get Voyage AI API key from https://dash.voyageai.com/
export VOYAGE_API_KEY='your-api-key'

# 2. Install dependencies
pip install -r requirements-rag.txt

# 3. Index your codebase
./scripts/index_codebase.sh

# 4. Start MCP server
python src/rag/mcp/rag_server.py

# 5. Configure Continue IDE
cp config/continue_rag.yaml ~/.continue/config.yaml
```

### Features

**MCP Tools:**
- `search_codebase(query)` - Semantic code search
- `get_file_context(filename)` - Retrieve complete file
- `search_by_language(query, language)` - Filtered search

**Smart Indexing:**
- Automatic language detection (TS, JS, Python, YAML, JSON, MD)
- Intelligent chunking (15K tokens, preserves context)
- Incremental updates (reindex only changed files)
- Multi-repository support

### Documentation

- 📝 [Complete RAG Guide](docs/CUSTOM_CODE_RAG_GUIDE.md)
- 🛠️ [RAG Module README](src/rag/README.md)
- ⚙️ [Continue Config Examples](config/)

### Performance

- **Indexing**: 2-5 minutes for full A2A codebase
- **Search**: <100ms latency
- **Cost**: ~$0.05 per full index, ~$0.20/month with weekly reindexing
- **Vector DB Size**: 50-100MB
