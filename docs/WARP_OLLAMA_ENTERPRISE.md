# Warp + Ollama Enterprise Integration for A2A

## Overview

This guide covers the enterprise-scale integration of Warp terminal with Ollama AI models in the A2A (Agent-to-Agent) system. The integration supports massive models up to 671B parameters for complex reasoning tasks and 480B parameters for advanced code generation.

## Key Features

### 1. Enterprise-Scale Model Support

The `WarpOllamaManager` now supports cloud-scale models designed for production enterprise workloads:

| Model | Parameters | VRAM Required | Primary Use Case |
|-------|-----------|---------------|------------------|
| `qwen3:671b-cloud` | 671 billion | ~320GB | Complex reasoning, system design, strategic planning |
| `qwen3-coder:480b-cloud` | 480 billion | ~240GB | Advanced code generation, architecture implementation |
| `llama3.1:8b-instruct-q4_K_M` | 8 billion | ~5.2GB | General-purpose tasks, local development |
| `mistral:7b-instruct-q4_K_M` | 7 billion | ~4.8GB | Fast inference, lightweight reasoning |

### 2. A2A Agent Integration (`integrateWithA2A`)

Orchestrates multi-agent collaboration where specialized agents work together on complex tasks:

```typescript
const result = await warpOllamaManager.integrateWithA2A(
  'enterprise-agent',        // Source agent for requirements analysis
  'research-assistant',      // Target agent for architecture design
  'Design a distributed AI system for 10M+ users',
  {
    reasoningModel: 'qwen3:671b-cloud',         // 671B for deep analysis
    codingModel: 'qwen3-coder:480b-cloud',      // 480B for implementation
    temperature: 0.2,
    maxRounds: 3,
  }
);
```

**Workflow:**
1. **Round 1**: Source agent analyzes requirements using 671B reasoning model
2. **Round 2**: Target agent designs architecture using 671B reasoning model
3. **Round 3**: Collaborative code generation using 480B coding model

**Returns:**
```typescript
{
  success: boolean;
  task: string;
  sourceAgent: string;
  targetAgent: string;
  conversation: Array<{
    agent: string;
    model: string;
    content: string;
    timestamp: number;
  }>;
  finalOutput: string;  // Markdown document with all phases
  metadata: {
    totalRounds: number;
    modelsUsed: string[];
    executionTimeMs: number;
  };
}
```

### 3. OpenAI-Compatible Chat Completion (`generateChatCompletion`)

Direct OpenAI API compatibility for seamless integration with existing tools:

```typescript
const codeResult = await warpOllamaManager.generateChatCompletion({
  model: 'qwen3-coder:480b-cloud',
  messages: [
    {
      role: 'user',
      content: 'Create enterprise microservices architecture with TypeScript'
    }
  ],
  temperature: 0.1,
  max_tokens: 4096,
});

console.log(codeResult.choices[0].message.content);
```

## Installation & Setup

### Prerequisites

1. **Ollama Installation**
   ```bash
   # macOS/Linux
   curl -fsSL https://ollama.com/install.sh | sh

   # Windows (PowerShell)
   Invoke-WebRequest -Uri https://ollama.com/install.ps1 -OutFile install.ps1; .\install.ps1
   ```

2. **Warp Terminal** (Optional, for rich UX)
   - Download from [https://www.warp.dev/](https://www.warp.dev/)
   - Install and configure according to Warp documentation

3. **A2A Workspace**
   ```bash
   git clone https://github.com/Scarmonit/A2A.git
   cd A2A
   npm install
   npm run build
   ```

### Model Installation

#### For Local Development (8B models)

```bash
# General-purpose model
ollama pull llama3.1:8b-instruct-q4_K_M

# Coding model
ollama pull qwen2.5:7b-instruct-q4_K_M

# Verify installation
ollama list
```

#### For Enterprise/Cloud Deployment (671B, 480B models)

These models require distributed GPU clusters or cloud infrastructure. Options:

1. **Warp Cloud Integration** (Recommended)
   - Sign up for Warp cloud service
   - Configure cloud endpoint in environment:
     ```bash
     export OLLAMA_BASE_URL=https://your-warp-cloud.example.com/v1
     export OLLAMA_API_KEY=your-api-key
     ```

2. **Self-Hosted Cluster**
   - Deploy Ollama on Kubernetes with multi-GPU support
   - See `/home/user/A2A/k8s/warp-ollama-deployment.yaml` for reference
   - Requires: 8x A100 80GB GPUs (minimum) for 671B model

3. **Remote Ollama Server**
   ```bash
   # On remote GPU server
   OLLAMA_HOST=0.0.0.0:11434 ollama serve

   # On client
   export OLLAMA_BASE_URL=http://gpu-server:11434/v1
   ```

## Usage Examples

### Example 1: Basic Chat Completion

```typescript
import { createWarpOllama } from './src/warp/ollama-manager';

const manager = createWarpOllama({
  modelHint: '480b',  // Will select qwen3-coder:480b-cloud
  behavior: 'coding',
  logger: console.log,
});

const response = await manager.generateChatCompletion({
  model: 'qwen3-coder:480b-cloud',
  messages: [
    {
      role: 'user',
      content: 'Create a high-performance API gateway in TypeScript'
    }
  ],
  temperature: 0.1,
  max_tokens: 4096,
});

console.log(response.choices[0].message.content);
```

### Example 2: A2A Collaborative Design

```typescript
import { WarpOllamaManager } from './src/warp/ollama-manager';

const manager = new WarpOllamaManager({
  baseURL: process.env.OLLAMA_BASE_URL,
  logger: (msg) => console.log(`[WarpOllama] ${msg}`),
});

// Detect GPU capabilities
const gpu = await manager.detectGPU();
console.log(`GPU: ${gpu.vendor}, VRAM: ${gpu.vramMB}MB`);

// Multi-agent collaboration
const result = await manager.integrateWithA2A(
  'enterprise-agent',
  'research-assistant',
  'Design a distributed AI system for 10M+ users',
  {
    reasoningModel: 'qwen3:671b-cloud',
    codingModel: 'qwen3-coder:480b-cloud',
    temperature: 0.2,
  }
);

if (result.success) {
  console.log('\n=== Requirements Analysis ===');
  console.log(result.conversation[0].content);

  console.log('\n=== Architecture Design ===');
  console.log(result.conversation[1].content);

  console.log('\n=== Implementation ===');
  console.log(result.conversation[2].content);

  // Save final output
  await fs.promises.writeFile(
    './distributed-ai-design.md',
    result.finalOutput
  );
}
```

### Example 3: Streaming Responses

```typescript
const manager = createWarpOllama({
  behavior: 'reasoning',
});

const request = {
  model: 'qwen3:671b-cloud',
  messages: [
    {
      role: 'user',
      content: 'How would you design a globally distributed caching layer?'
    }
  ],
  temperature: 0.0,  // Deterministic
  stream: true,
};

process.stdout.write('Response: ');

for await (const chunk of manager.chatStream(request)) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) {
    process.stdout.write(content);
  }
}

console.log('\n');
```

### Example 4: Multi-Phase Project with Context

```typescript
// Phase 1: Requirements (671B reasoning)
const phase1 = await manager.generateChatCompletion({
  model: 'qwen3:671b-cloud',
  messages: [
    {
      role: 'system',
      content: 'You are a senior product architect.',
    },
    {
      role: 'user',
      content: 'Extract requirements for a real-time bidding platform handling 1M req/s',
    },
  ],
});

const requirements = phase1.choices[0].message.content;

// Phase 2: Architecture (671B reasoning)
const phase2 = await manager.generateChatCompletion({
  model: 'qwen3:671b-cloud',
  messages: [
    {
      role: 'user',
      content: `Design architecture for:\n${requirements}`,
    },
  ],
});

const architecture = phase2.choices[0].message.content;

// Phase 3: Implementation (480B coding)
const phase3 = await manager.generateChatCompletion({
  model: 'qwen3-coder:480b-cloud',
  messages: [
    {
      role: 'user',
      content: `Implement this architecture:\n${architecture}`,
    },
  ],
  temperature: 0.1,  // Lower temp for code
  max_tokens: 8192,
});

const code = phase3.choices[0].message.content;
```

## Running the Examples

```bash
# Run all examples
npx ts-node examples/warp-ollama-enterprise-integration.ts

# Run specific example
EXAMPLE_FILTER="a2a" npx ts-node examples/warp-ollama-enterprise-integration.ts

# With custom Ollama endpoint
OLLAMA_BASE_URL=http://gpu-cluster:11434/v1 \
  npx ts-node examples/warp-ollama-enterprise-integration.ts
```

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────┐
│                   A2A Application                       │
├─────────────────────────────────────────────────────────┤
│                 WarpOllamaManager                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │ • GPU Detection (NVIDIA/AMD/Apple/Intel)          │  │
│  │ • Model Selection (VRAM-aware)                    │  │
│  │ • Chat Completion (OpenAI-compatible)             │  │
│  │ • Streaming Support (SSE)                         │  │
│  │ • A2A Integration (Multi-agent orchestration)     │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                               │
├─────────────────────────────────────────────────────────┤
│              Ollama HTTP API (Port 11434)              │
│              OpenAI-compatible endpoints:               │
│              • POST /v1/chat/completions                │
│              • POST /api/generate                       │
│              • GET  /api/tags                           │
├─────────────────────────────────────────────────────────┤
│                   Ollama Runtime                        │
│  ┌───────────────┬───────────────┬──────────────────┐   │
│  │   Model       │  Parameters   │  VRAM (GB)       │   │
│  ├───────────────┼───────────────┼──────────────────┤   │
│  │ qwen3:671b    │ 671 billion   │ ~320 GB          │   │
│  │ qwen3c:480b   │ 480 billion   │ ~240 GB          │   │
│  │ llama3.1:8b   │ 8 billion     │ ~5.2 GB          │   │
│  └───────────────┴───────────────┴──────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### A2A Integration Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Round 1    │────>│   Round 2    │────>│   Round 3    │
│              │     │              │     │              │
│ Source Agent │     │ Target Agent │     │ Joint Code   │
│ (671B model) │     │ (671B model) │     │ (480B model) │
│              │     │              │     │              │
│ Requirements │     │ Architecture │     │ Implementa-  │
│ Analysis     │     │ Design       │     │ tion         │
└──────────────┘     └──────────────┘     └──────────────┘
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                             │
                      ┌──────▼───────┐
                      │ Final Output │
                      │  (Markdown)  │
                      └──────────────┘
```

## Performance Considerations

### Model Selection Guidelines

| Use Case | Recommended Model | VRAM | Latency | Best For |
|----------|------------------|------|---------|----------|
| Complex reasoning | `qwen3:671b-cloud` | 320GB | High | Strategic planning, deep analysis |
| Code generation | `qwen3-coder:480b-cloud` | 240GB | High | Enterprise architecture, complex implementations |
| Fast prototyping | `llama3.1:8b-instruct-q4_K_M` | 5.2GB | Low | Local development, quick iterations |
| General tasks | `mistral:7b-instruct-q4_K_M` | 4.8GB | Low | Chat, simple code, documentation |

### Optimization Tips

1. **Use smaller models for development**
   ```typescript
   const devManager = createWarpOllama({
     modelHint: '8b',  // Use local 8B model during dev
   });
   ```

2. **Cache frequently used models**
   ```bash
   # Pre-pull models to avoid latency
   ollama pull llama3.1:8b-instruct-q4_K_M
   ollama pull qwen2.5:7b-instruct-q4_K_M
   ```

3. **Configure connection pooling**
   ```typescript
   const manager = new WarpOllamaManager({
     baseURL: process.env.OLLAMA_BASE_URL,
     // Connection reuse handled by fetch API
   });
   ```

4. **Monitor GPU usage**
   ```bash
   # NVIDIA
   watch -n 1 nvidia-smi

   # AMD
   watch -n 1 rocm-smi

   # Apple Silicon
   sudo powermetrics --samplers gpu_power
   ```

## Deployment

### Kubernetes Deployment (Enterprise Models)

See `/home/user/A2A/k8s/warp-ollama-deployment.yaml` for complete manifest.

**Key requirements:**
- Multi-GPU node pool (8x A100 80GB minimum)
- Persistent volume for model storage (>1TB)
- Network policy for secure access
- Resource limits and quotas

```bash
# Deploy to Kubernetes
kubectl apply -f k8s/warp-ollama-deployment.yaml

# Check status
kubectl get pods -n ai-agents

# View logs
kubectl logs -n ai-agents deployment/warp-ollama -f
```

### Docker Compose (Local Development)

```yaml
version: '3.8'
services:
  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama-models:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    environment:
      - OLLAMA_HOST=0.0.0.0:11434

volumes:
  ollama-models:
```

```bash
docker-compose up -d
docker-compose exec ollama ollama pull llama3.1:8b-instruct-q4_K_M
```

## Troubleshooting

### Common Issues

#### 1. Model Not Found

```
Error: Chat request failed: 404 model 'qwen3:671b-cloud' not found
```

**Solution:**
```bash
# List available models
ollama list

# Pull the missing model
ollama pull qwen3:671b-cloud

# Or use a local model alternative
const manager = createWarpOllama({
  modelHint: '8b',  // Uses local llama3.1:8b
});
```

#### 2. Out of Memory

```
Error: CUDA out of memory
```

**Solution:**
```bash
# Check available VRAM
nvidia-smi

# Use quantized model (lower VRAM)
ollama pull llama3.1:8b-instruct-q4_K_M  # 5.2GB instead of 9.5GB

# Or configure model offloading
export OLLAMA_NUM_GPU=0  # CPU-only mode
```

#### 3. Connection Refused

```
Error: fetch failed (ECONNREFUSED)
```

**Solution:**
```bash
# Start Ollama service
ollama serve

# Or check if running
ps aux | grep ollama

# Verify endpoint
curl http://localhost:11434/api/tags
```

#### 4. Slow Inference

**Solutions:**
- Use quantized models (q4_K_M instead of fp16)
- Enable GPU acceleration
- Increase `num_gpu` in Modelfile
- Use local deployment instead of remote
- Cache models in memory (`keep_alive` parameter)

## API Reference

### `WarpOllamaManager`

#### Constructor

```typescript
new WarpOllamaManager(options?: ManagerOptions)
```

**Options:**
- `modelHint?: string` - Model family hint (e.g., '671b', '480b', '8b')
- `behavior?: 'general' | 'coding' | 'reasoning'` - Behavior preset
- `baseURL?: string` - Ollama API endpoint (default: `http://localhost:11434/v1`)
- `apiKey?: string` - API key for authenticated endpoints
- `logger?: (msg: string) => void` - Logging callback

#### Methods

##### `detectGPU(): Promise<GPUInfo>`
Detects available GPU and VRAM across platforms (NVIDIA, AMD, Apple, Intel).

##### `selectModel(): Promise<OllamaModelProfile>`
Automatically selects best model based on available VRAM.

##### `generateChatCompletion(request): Promise<OpenAIChatCompletionResponse>`
OpenAI-compatible chat completion (alias for `chat` method).

##### `integrateWithA2A(sourceAgentId, targetAgentId, task, options?): Promise<A2AResult>`
Multi-agent collaboration orchestration.

**Parameters:**
- `sourceAgentId: string` - Source agent identifier
- `targetAgentId: string` - Target agent identifier
- `task: string` - Collaborative task description
- `options.reasoningModel?: string` - Model for reasoning (default: 'qwen3:671b-cloud')
- `options.codingModel?: string` - Model for code generation (default: 'qwen3-coder:480b-cloud')
- `options.temperature?: number` - Sampling temperature (default: 0.2)
- `options.maxRounds?: number` - Max conversation rounds (default: 3)

##### `chatStream(request): AsyncGenerator<OpenAIChatCompletionChunk>`
Streaming chat completion with Server-Sent Events.

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../LICENSE)

## Support

- GitHub Issues: [https://github.com/Scarmonit/A2A/issues](https://github.com/Scarmonit/A2A/issues)
- Documentation: [/home/user/A2A/docs/](../docs/)
- Warp Terminal: [https://docs.warp.dev/](https://docs.warp.dev/)
- Ollama Docs: [https://ollama.com/docs](https://ollama.com/docs)
