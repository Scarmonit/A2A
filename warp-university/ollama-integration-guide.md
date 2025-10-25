# Warp + Ollama + A2A Integration Guide

This guide walks you through integrating Warp terminal, Ollama local models, and the A2A repo to build and run AI workflows locally with OpenAI-compatible endpoints.

## 1) System Requirements and Checks

- OS: macOS 12+, Linux (glibc 2.31+), or Windows WSL2
- CPU: x86_64 or Apple Silicon (arm64)
- GPU (optional for speed): NVIDIA GPU with CUDA 12+ and VRAM >= 4 GB
- RAM: 8 GB minimum (16+ GB recommended)
- Disk: 10–20 GB free for models

Quick checks:
```bash
# CPU/arch
uname -a

# RAM
python - <<'PY'
import psutil, platform
print('RAM GB:', round(psutil.virtual_memory().total/1e9,2))
print('Arch:', platform.machine())
PY

# NVIDIA GPU + VRAM (Linux)
nvidia-smi || echo "No NVIDIA GPU detected"

# Apple Silicon GPU memory (rough estimate)
system_profiler SPDisplaysDataType | sed -n 's/^.*VRAM.*: //p'
```

If you lack a dedicated GPU or have <4 GB VRAM, prefer smaller models (see Model Selection).

## 2) Install Dependencies

- Warp: https://www.warp.dev/download
- Ollama: https://ollama.com/download
- Git + Python (if not already):
```bash
# macOS (Homebrew)
brew install git python

# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y git python3 python3-pip
```

## 3) Clone and Prepare A2A
```bash
git clone https://github.com/Scarmonit/A2A.git
cd A2A
# optional: create virtual environment
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt 2>/dev/null || true
```

## 4) Start Ollama and Pull a Model
Ensure the Ollama service is running:
```bash
# Start/ensure daemon
ollama --version
ollama serve  # in one terminal (or runs as a background service on macOS)
```
Pull a model aligned with your VRAM (see below) and test it:
```bash
# Example: small, fast
ollama pull llama3.2:3b
ollama run llama3.2:3b "Say hello from Ollama"
```

## 5) Model Selection Based on VRAM

- 0–4 GB VRAM or CPU-only: llama3.2:3b, qwen2.5:3b, phi4:latest
- 6–8 GB VRAM: llama3.1:8b, qwen2.5:7b, mistral:7b
- 12–16 GB VRAM: llama3.1:8b-instruct Q5_K_M, qwen2.5:14b (quantized)
- 20+ GB VRAM: llama3.1:8b/70b (quantized variants), deepseek-r1:8b

Tips:
- Prefer “instruct” variants for chat/completion tasks.
- Use quantized builds (e.g., Q4_K_M, Q5_K_M) to fit VRAM.
- If VRAM OOM occurs, try a smaller or more-quantized model.

## 6) Expose OpenAI-Compatible API via Ollama
Ollama offers an OpenAI-like API with a simple gateway. Two common paths:

A) Native Ollama API (chat/completions):
- Base URL: http://localhost:11434
- Chat endpoint: POST /api/chat

B) OpenAI-Compatible middleware (recommended for drop-in OpenAI client use):
- Use OpenAI-compatible router such as:
  - Open WebUI built-in proxy, or
  - llama.cpp server’s OpenAI mode, or
  - LiteLLM/Ollama Gateway

Simplest: enable OpenAI proxy with Ollama Gateway (LiteLLM):
```bash
pip install litellm
export OLLAMA_BASE_URL=http://localhost:11434
litellm --model ollama/llama3.2:3b --host 127.0.0.1 --port 8000 --drop_params True
# This exposes OpenAI-style endpoints at http://127.0.0.1:8000
```
Test with OpenAI Python client (pointed to local gateway):
```bash
pip install openai
python - <<'PY'
import os
from openai import OpenAI
os.environ['OPENAI_API_KEY'] = 'ollama'  # placeholder; not validated by gateway
client = OpenAI(base_url='http://127.0.0.1:8000/v1')
resp = client.chat.completions.create(
  model='ollama/llama3.2:3b',
  messages=[{'role':'user','content':'Respond with one line: Ready.'}],
)
print(resp.choices[0].message.content)
PY
```

## 7) Configure A2A to Use Local OpenAI-Compatible Endpoint

Option 1: Environment variables
```bash
# in the A2A repo root
cp .env.example .env 2>/dev/null || true
# Set env to point to local gateway
export OPENAI_API_KEY=ollama
export OPENAI_BASE_URL=http://127.0.0.1:8000/v1
# If app supports MODEL env
export OPENAI_MODEL=ollama/llama3.2:3b
```

Option 2: Code-level configuration (Python pseudocode)
```python
import os
from openai import OpenAI
client = OpenAI(
    base_url=os.getenv('OPENAI_BASE_URL', 'http://127.0.0.1:8000/v1'),
)
# API key can be any non-empty string for local gateways
```

## 8) Warp Terminal Integration

- Profiles/Workflows: Create Warp workflows to start services and run A2A tasks quickly.
- Create a workflow (Warp > Workflows > New) named "A2A Local LLM":
```yaml
title: A2A Local LLM
commands:
  - name: Start Ollama
    command: |
      pgrep -f "ollama serve" >/dev/null || ollama serve
  - name: Pull/Run Model (3B)
    command: |
      ollama pull llama3.2:3b && ollama run llama3.2:3b "Hello from Warp"
  - name: Start OpenAI Gateway
    command: |
      export OLLAMA_BASE_URL=http://localhost:11434
      litellm --model ollama/llama3.2:3b --host 127.0.0.1 --port 8000 --drop_params True
  - name: A2A Env Setup
    command: |
      cd ~/path/to/A2A
      export OPENAI_API_KEY=ollama
      export OPENAI_BASE_URL=http://127.0.0.1:8000/v1
      export OPENAI_MODEL=ollama/llama3.2:3b
```

## 9) Performance Optimization Tips

- Choose right quantization: Q4_K_M for minimal VRAM, Q5_K_M for better quality.
- Use smaller context window to reduce memory and latency (e.g., 2k–4k tokens).
- Batch prompts when possible; reuse a persistent chat session to leverage KV cache.
- On NVIDIA GPUs: use CUDA 12.4+ drivers, set CUDA_VISIBLE_DEVICES to pin GPUs.
- On Apple Silicon: close memory-heavy apps; prefer Metal-optimized builds (Ollama does this automatically).
- CPU-only: prefer 3B–7B models with quantization; enable num_threads=N env if exposed by runtime.
- Use streaming responses for better perceived latency.
- Pin temperature and top_p to stable values for reproducibility.

## 10) End-to-End Smoke Test

1) Start Ollama: `ollama serve`
2) Pull chosen model: `ollama pull llama3.2:3b`
3) Start gateway: `litellm --model ollama/llama3.2:3b --host 127.0.0.1 --port 8000`
4) In A2A, run a small script that hits OpenAI client with `OPENAI_BASE_URL` set.
5) Expect a short, coherent response.

## 11) Troubleshooting

- 404/connection refused: ensure gateway and Ollama are running and ports are correct.
- CUDA OOM: use a smaller/quantized model; lower context window.
- Slow replies: switch to 3B/7B models; enable streaming; reduce max_tokens.
- Tokenizer mismatch: stick to one model family per test.

---
Maintainers: update examples as A2A evolves. Contributions welcome.
