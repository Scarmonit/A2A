# Warp + Ollama Integration Guide

This guide walks you through installing and verifying Ollama, running your first model, understanding model terms, integrating Ollama into apps and terminals, and customizing behavior. It also includes A2A MCP server integration and Warp terminal workflows.

## 1) Install and verify Ollama
- macOS: `brew install ollama` (or download from https://ollama.com)
- Linux: `curl -fsSL https://ollama.com/install.sh | sh`
- Windows: Download installer from https://ollama.com/download

Start service:
- macOS/Linux: `ollama serve` (often started automatically by `ollama run`)
- Windows: Service starts with app; or run in PowerShell `ollama serve`

Verify version and API health:
- `ollama --version`
- `curl http://localhost:11434/api/tags` (should return JSON)

Check system specs for model readiness:
- CPU/GPU: `ollama info`
- macOS Metal: `system_profiler SPDisplaysDataType | grep Metal`
- NVIDIA: `nvidia-smi` (Linux/Windows)
- RAM/VRAM guidance: small LLMs (3–8B) fit on most machines; larger require more VRAM. If VRAM is low, models will use CPU and system RAM, but will be slower.

## 2) Run your first model
Pull and run a popular small model:
- `ollama run llama3.1:8b`
- Or: `ollama run mistral`

Example interactive session:
```
$ ollama run llama3.1:8b
>>> You are a helpful assistant. Summarize: Warp is a modern terminal.
...
```
Exit with Ctrl+D or `/.exit`.

Run with a one-off prompt:
- `ollama run llama3.1:8b "Write a haiku about Warp terminal"`

List, pull, remove models:
- `ollama list`
- `ollama pull qwen2:7b`
- `ollama rm qwen2:7b`

## 3) Understand model terms
- Parameter size (e.g., 7B, 8B, 13B): larger can be more capable but require more memory.
- Quantization (e.g., Q4_0, Q5_K_M): trades memory for speed/accuracy; lower numbers use less VRAM but may reduce quality.
- Context length: max tokens model can consider; affects memory usage.
- Family/architecture: llama, mistral, qwen, phi, etc.—choose based on licensing and strengths.
- Variants: Some tags include instruct/chat tuning (e.g., `-instruct`) better for conversational use.

## 4) Use the HTTP API (integrating into apps)
Ollama exposes a local REST API on port 11434.

Simple chat completion (streaming disabled for brevity):
```
POST http://localhost:11434/api/chat
Content-Type: application/json
{
  "model": "llama3.1:8b",
  "messages": [
    {"role": "system", "content": "You are a concise assistant."},
    {"role": "user", "content": "Explain Warp terminal in one sentence."}
  ],
  "stream": false
}
```

Generate endpoint (single prompt):
```
POST http://localhost:11434/api/generate
{
  "model": "mistral",
  "prompt": "List three benefits of Warp",
  "stream": true
}
```

Embeddings:
```
POST http://localhost:11434/api/embeddings
{
  "model": "nomic-embed-text",
  "prompt": "Warp makes the terminal collaborative."
}
```

Curl example:
```
curl -s http://localhost:11434/api/chat -H 'Content-Type: application/json' -d '{
  "model": "llama3.1:8b",
  "messages": [
    {"role": "system", "content": "You are terse."},
    {"role": "user", "content": "What is A2A MCP?"}
  ],
  "stream": false
}' | jq .message.content
```

## 5) Customize model behavior
- System prompt: Set consistent instructions via the `system` message.
- Temperature: `0.0–1.0` (higher = more creative). Example: `{"temperature": 0.2}`.
- Top-k / top-p: sampling controls for diversity.
- Stop sequences: ensure responses end at delimiters.
- Keep-alive: keep models loaded for faster subsequent calls.
- Modelfile: create custom variants.

Example Modelfile:
```
FROM llama3.1:8b
SYSTEM "You are A2A's coding assistant. Prefer concise, correct answers with code blocks."
PARAMETER temperature 0.2
PARAMETER stop "</end>"
```
Build and run:
```
ollama create a2a-coder -f Modelfile
ollama run a2a-coder
```

## 6) Warp terminal workflows
Warp (https://www.warp.dev) is a modern terminal with AI commands and shared workflows.

Recommended setup:
- Install Warp and sign in.
- Create a Warp Workflow for common Ollama tasks:
  - Pull model: `ollama pull {{model_tag}}`
  - Chat once: `ollama run {{model_tag}} "{{prompt}}"`
  - Serve API: `ollama serve`
  - Health check: `curl -s http://localhost:11434/api/tags | jq`.
- Use Warp Blocks to keep prompts and outputs grouped.
- Share workflows with your team via Warp Cloud.

Warp AI integration tips:
- Point Warp AI to local Ollama via HTTP if supported, else use `curl` snippets.
- Save reusable prompts and Modelfiles in a repo folder (`docs/ollama/`).

## 7) A2A MCP server integration
A2A includes an MCP (Model Context Protocol) server that can use local models via Ollama.

Steps:
1) Ensure Ollama is running: `ollama serve` and that `curl :11434/api/tags` works.
2) Configure A2A MCP to point to `http://localhost:11434`.
   - Example config (JSON or YAML, adjust to your project conventions):
```
# .a2a/mcp/ollama.json
{
  "provider": "ollama",
  "endpoint": "http://localhost:11434",
  "default_model": "llama3.1:8b",
  "completion": {
    "temperature": 0.2,
    "top_p": 0.9,
    "max_tokens": 1024,
    "stop": ["</end>"]
  },
  "embeddings": {
    "model": "nomic-embed-text"
  }
}
```
3) Expose MCP tools that wrap Ollama API calls (chat, generate, embeddings). Ensure streaming handling where supported.
4) Add health and model-list tools that map to `/api/tags` and `/api/ps`.
5) Provide fallback to remote providers if local Ollama unavailable.

Node.js sample using MCP client to call Ollama:
```
import fetch from 'node-fetch';

export async function chat(messages) {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama3.1:8b', messages, stream: false })
  });
  const data = await res.json();
  return data.message?.content ?? '';
}
```

MCP tool definition sketch:
```
{
  "name": "ollama_chat",
  "description": "Chat with local Ollama model",
  "input_schema": {
    "type": "object",
    "properties": {
      "messages": {"type": "array"}
    },
    "required": ["messages"]
  }
}
```

## 8) Testing and troubleshooting
- If requests hang: confirm `ollama serve` is active and port 11434 free.
- Slow responses: try a smaller or more quantized model (e.g., `q4_K_M`).
- GPU not used: verify drivers/Metal and `ollama info` shows GPU.
- Context overflow: shorten prompts or increase context model tag if available.
- Permission/firewall: allow local connections to 11434.

## 9) Putting it together: sample workflows
- Quick sanity check:
```
ollama pull llama3.1:8b
ollama run llama3.1:8b "Say hello from A2A."
```
- App integration smoke test:
```
curl -s localhost:11434/api/chat -H 'Content-Type: application/json' -d '{
  "model":"llama3.1:8b",
  "messages":[{"role":"user","content":"Briefly describe the A2A project."}],
  "stream":false
}' | jq
```
- MCP route test inside A2A dev script:
```
node -e "import('./scripts/ollama_chat_test.mjs').then(m=>m.default())"
```

## 10) Maintenance
- Update models periodically: `ollama pull llama3.1:8b`
- Prune unused models: `ollama rm <tag>`
- Pin versions/tags in config for reproducibility.
- Check release notes at https://ollama.com/library and GPU driver updates.

---
For questions or improvements, open an issue or PR in A2A.
