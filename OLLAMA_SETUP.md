# 🦙 Ollama Setup Guide for A2A MCP Server

This guide helps you set up your A2A MCP server with free local AI models via Ollama.

## 📋 Prerequisites

1. **Ollama installed** on your system
2. **8GB+ RAM** recommended (16GB+ for larger models)
3. **GPU optional** but improves performance

## 🚀 Quick Setup

### 1. Install Ollama (if not already installed)

**Windows:**
```powershell
# Download from https://ollama.ai/download
# Or use winget
winget install Ollama.Ollama
```

**Verify installation:**
```bash
ollama --version
```

### 2. Pull Recommended Models

```bash
# Code generation (best for programming tasks)
ollama pull codellama:7b-code     # 3.8GB - Fast
ollama pull codellama:13b-code    # 7.4GB - Better quality

# General chat and analysis
ollama pull llama2:7b-chat        # 3.8GB - Fast general tasks  
ollama pull llama2:13b-chat       # 7.4GB - Better reasoning

# Alternative: More efficient models
ollama pull mistral:7b-instruct   # 4.1GB - Good balance
ollama pull phi3:mini             # 2.3GB - Very fast, decent quality
```

### 3. Configure A2A MCP Environment

Add to your `.env` file (create if doesn't exist):

```bash
# Ollama Configuration
LOCAL_LLM_URL=http://localhost:11434
NODE_ENV=development

# Optional: Customize default models
DEFAULT_CODE_MODEL=codellama:7b-code
DEFAULT_CHAT_MODEL=llama2:7b-chat
DEFAULT_CREATIVE_MODEL=llama2:13b-chat

# Memory and performance
MAX_CONCURRENCY=5
LOG_LEVEL=info
```

### 4. Update package.json Dependencies

```powershell
# No external API dependencies needed!
npm install uuid pino ws zod
```

### 5. Integration Code

Add to your `src/index.ts`:

```typescript
import { aiIntegration, AI_CAPABILITIES } from './ai-integration.js';
import { workflowOrchestrator } from './workflow-orchestrator.js';
import { analyticsEngine } from './analytics-engine.js';
import { agentMemorySystem } from './agent-memory.js';

// Test AI integration on startup
async function testLocalAI() {
  try {
    const result = await aiIntegration.generateResponse(
      AI_CAPABILITIES['general-assistant'],
      { input: 'Hello, test the AI integration' }
    );
    console.log('✅ Local AI integration working:', result.response);
  } catch (error) {
    console.log('❌ AI integration test failed:', error.message);
  }
}

// Call during server initialization
testLocalAI();
```

## 🎯 Model Recommendations by Use Case

### **🏃‍♀️ Fast & Lightweight (4GB RAM)**
```bash
ollama pull phi3:mini              # 2.3GB - General tasks
ollama pull codellama:7b-code      # 3.8GB - Code generation
```

### **⚖️ Balanced Performance (8GB RAM)**
```bash
ollama pull llama2:7b-chat         # 3.8GB - General chat
ollama pull mistral:7b-instruct    # 4.1GB - Good reasoning
ollama pull codellama:7b-code      # 3.8GB - Code generation
```

### **🚀 High Quality (16GB+ RAM)**
```bash
ollama pull llama2:13b-chat        # 7.4GB - Best reasoning
ollama pull codellama:13b-code     # 7.4GB - Best code quality
ollama pull mistral:7b-instruct    # 4.1GB - Efficient helper
```

## 🔧 Custom Model Configuration

Create `ollama-models.json`:

```json
{
  "models": {
    "fast": {
      "code": "codellama:7b-code",
      "chat": "phi3:mini",
      "creative": "llama2:7b-chat"
    },
    "quality": {
      "code": "codellama:13b-code", 
      "chat": "llama2:13b-chat",
      "creative": "llama2:13b-chat"
    },
    "experimental": {
      "code": "deepseek-coder:6.7b",
      "chat": "neural-chat:7b",
      "creative": "storyteller:7b"
    }
  },
  "active_profile": "fast"
}
```

## 🏥 Health Check & Testing

Test your setup:

```powershell
# 1. Check Ollama is running
curl http://localhost:11434/api/version

# 2. Test model availability  
ollama list

# 3. Test basic generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama2:7b-chat",
  "prompt": "Hello, how are you?",
  "stream": false
}'

# 4. Test your A2A MCP server
npm run build
npm run start
```

## ⚡ Performance Optimization

### **Windows Optimization:**
```powershell
# Set environment variables for better performance
$env:OLLAMA_NUM_PARALLEL = "4"
$env:OLLAMA_MAX_LOADED_MODELS = "2"
$env:OLLAMA_FLASH_ATTENTION = "1"
```

### **Memory Management:**
- **7B models**: 4-6GB RAM each
- **13B models**: 8-10GB RAM each  
- **Concurrent models**: Add RAM requirements
- **GPU acceleration**: Reduces RAM usage

### **Model Switching:**
```typescript
// Dynamic model selection based on task complexity
const selectModel = (task: string, complexity: 'low' | 'medium' | 'high') => {
  const models = {
    low: 'phi3:mini',
    medium: 'llama2:7b-chat', 
    high: 'llama2:13b-chat'
  };
  return models[complexity];
};
```

## 🛠️ Troubleshooting

### **Ollama not starting:**
```powershell
# Check if service is running
Get-Process ollama

# Start manually
ollama serve

# Check logs
ollama logs
```

### **Out of memory:**
```bash
# Use smaller models
ollama pull phi3:mini
ollama pull codellama:7b-code

# Or increase virtual memory
```

### **Slow responses:**
```bash
# Try GPU acceleration (if available)
ollama pull llama2:7b-chat --gpu

# Or use smaller context windows
# Set maxTokens: 500 instead of 2000
```

## 🎉 Ready to Go!

Your A2A MCP server now has:
- ✅ **5 AI-powered agent types** (code, data, research, general, creative)
- ✅ **100% local and free** AI capabilities
- ✅ **No API costs** or external dependencies
- ✅ **Privacy-first** - all data stays local
- ✅ **Customizable models** for different use cases

Start your server and enjoy AI-powered agents without any cloud costs! 🚀