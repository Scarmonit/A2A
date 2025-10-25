#!/usr/bin/env ts-node
/**
 * Live Demo: Warp + Ollama Enterprise A2A Integration
 *
 * This script demonstrates the new enterprise features:
 * 1. generateChatCompletion() - OpenAI-compatible API
 * 2. integrateWithA2A() - Multi-agent collaboration
 */

import { WarpOllamaManager, createWarpOllama } from './src/warp/ollama-manager.js';

// ANSI color codes for beautiful output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
};

function section(title: string) {
  console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}\n`);
}

function subsection(title: string) {
  console.log(`\n${colors.yellow}--- ${title} ---${colors.reset}\n`);
}

function success(msg: string) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function info(msg: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${msg}`);
}

function error(msg: string) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function code(msg: string) {
  console.log(`${colors.magenta}${msg}${colors.reset}`);
}

async function demo() {
  section('WARP + OLLAMA ENTERPRISE A2A INTEGRATION - LIVE DEMO');

  // Demo 1: Initialize the manager
  subsection('Demo 1: Initialize WarpOllamaManager');

  info('Creating WarpOllamaManager with enterprise configuration...');
  code(`
const manager = createWarpOllama({
  baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  behavior: 'coding',
  logger: (msg) => console.log(\`[Ollama] \${msg}\`),
});`);

  const manager = createWarpOllama({
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    behavior: 'coding',
    logger: (msg) => console.log(`[Ollama] ${msg}`),
  });

  success('Manager created successfully!');

  // Demo 2: GPU Detection
  subsection('Demo 2: GPU Detection');

  info('Detecting available GPU and VRAM...');
  code(`const gpu = await manager.detectGPU();`);

  try {
    const gpu = await manager.detectGPU();
    success(`GPU detected: ${gpu.vendor.toUpperCase()}`);
    info(`VRAM: ${gpu.vramMB} MB (${(gpu.vramMB / 1024).toFixed(2)} GB)`);
    if (gpu.name) {
      info(`GPU Name: ${gpu.name}`);
    }
  } catch (err) {
    error(`GPU detection failed: ${err instanceof Error ? err.message : err}`);
  }

  // Demo 3: Model Selection
  subsection('Demo 3: Automatic Model Selection');

  info('Selecting best model based on available VRAM...');
  code(`const model = await manager.selectModel();`);

  try {
    const model = await manager.selectModel();
    success(`Selected model: ${model.name}`);
    info(`Required VRAM: ${model.minVramMB} MB (${(model.minVramMB / 1024).toFixed(2)} GB)`);
    info(`Model family: ${model.family || 'unknown'}`);
    info(`Max context: ${model.maxContext || 'N/A'} tokens`);
  } catch (err) {
    error(`Model selection failed: ${err instanceof Error ? err.message : err}`);
  }

  // Demo 4: generateChatCompletion (OpenAI-compatible API)
  subsection('Demo 4: generateChatCompletion() - OpenAI Compatible API');

  info('Using the new generateChatCompletion() method...');
  code(`
const response = await manager.generateChatCompletion({
  model: 'qwen3-coder:480b-cloud',  // 480B coding model
  messages: [
    {
      role: 'user',
      content: 'Create a TypeScript microservice for user authentication with JWT'
    }
  ],
  temperature: 0.1,
  max_tokens: 2048,
});`);

  try {
    // For demo purposes, use a smaller model that might be available
    const response = await manager.generateChatCompletion({
      model: 'llama3.1:8b-instruct-q4_K_M',  // Use smaller model for demo
      messages: [
        {
          role: 'user',
          content: 'Create a TypeScript microservice for user authentication with JWT'
        }
      ],
      temperature: 0.1,
      max_tokens: 512,
    });

    success('Chat completion successful!');
    info(`Model: ${response.model}`);
    info(`Response ID: ${response.id}`);
    console.log(`\n${colors.bright}Response:${colors.reset}`);
    console.log(response.choices[0].message.content);

  } catch (err) {
    error(`Chat completion failed: ${err instanceof Error ? err.message : err}`);
    info('This is expected if Ollama is not running or model is not available');
    console.log(`\n${colors.bright}Expected Output Structure:${colors.reset}`);
    code(`{
  id: 'chatcmpl-abc123',
  object: 'chat.completion',
  created: 1234567890,
  model: 'qwen3-coder:480b-cloud',
  choices: [{
    message: {
      role: 'assistant',
      content: '// TypeScript microservice code here...'
    },
    finish_reason: 'stop',
    index: 0
  }]
}`);
  }

  // Demo 5: integrateWithA2A (Multi-agent collaboration)
  subsection('Demo 5: integrateWithA2A() - Multi-Agent Collaboration');

  info('Orchestrating multi-agent collaboration for distributed system design...');
  code(`
const result = await manager.integrateWithA2A(
  'enterprise-agent',      // Source: Requirements analyst
  'research-assistant',    // Target: Architect
  'Design a distributed AI system for 10M+ users',
  {
    reasoningModel: 'qwen3:671b-cloud',        // 671B for deep reasoning
    codingModel: 'qwen3-coder:480b-cloud',     // 480B for implementation
    temperature: 0.2,
    maxRounds: 3,
  }
);`);

  try {
    const result = await manager.integrateWithA2A(
      'enterprise-agent',
      'research-assistant',
      'Design a distributed AI system for 10M+ users with real-time inference',
      {
        reasoningModel: 'llama3.1:8b-instruct-q4_K_M',  // Use available model
        codingModel: 'llama3.1:8b-instruct-q4_K_M',
        temperature: 0.2,
        maxRounds: 3,
      }
    );

    if (result.success) {
      success('A2A Integration completed successfully!');
      console.log(`\n${colors.bright}Results:${colors.reset}`);
      info(`Task: ${result.task}`);
      info(`Source Agent: ${result.sourceAgent}`);
      info(`Target Agent: ${result.targetAgent}`);
      info(`Total Rounds: ${result.metadata.totalRounds}`);
      info(`Models Used: ${result.metadata.modelsUsed.join(', ')}`);
      info(`Execution Time: ${result.metadata.executionTimeMs}ms (${(result.metadata.executionTimeMs / 1000).toFixed(2)}s)`);

      console.log(`\n${colors.bright}Conversation Timeline:${colors.reset}`);
      result.conversation.forEach((turn, idx) => {
        console.log(`\n${colors.yellow}[Round ${idx + 1}] ${turn.agent} (${turn.model})${colors.reset}`);
        console.log(`Time: ${new Date(turn.timestamp).toISOString()}`);
        console.log(`Content length: ${turn.content.length} characters`);
        console.log(`Preview: ${turn.content.substring(0, 200)}...`);
      });

      console.log(`\n${colors.bright}Final Output Preview:${colors.reset}`);
      console.log(result.finalOutput.substring(0, 500) + '...\n');

      // Optionally save to file
      const fs = await import('fs/promises');
      const outputPath = './distributed-ai-design-demo.md';
      await fs.writeFile(outputPath, result.finalOutput);
      success(`Full output saved to: ${outputPath}`);

    } else {
      error('A2A Integration failed');
      console.log(result.finalOutput);
    }

  } catch (err) {
    error(`A2A integration failed: ${err instanceof Error ? err.message : err}`);
    info('This is expected if Ollama is not running or models are not available');

    console.log(`\n${colors.bright}Expected Output Structure:${colors.reset}`);
    code(`{
  success: true,
  task: 'Design a distributed AI system...',
  sourceAgent: 'enterprise-agent',
  targetAgent: 'research-assistant',
  conversation: [
    {
      agent: 'enterprise-agent',
      model: 'qwen3:671b-cloud',
      content: '# Requirements Analysis\\n\\n...',
      timestamp: 1234567890123
    },
    {
      agent: 'research-assistant',
      model: 'qwen3:671b-cloud',
      content: '# Architecture Design\\n\\n...',
      timestamp: 1234567891234
    },
    {
      agent: 'enterprise-agent+research-assistant',
      model: 'qwen3-coder:480b-cloud',
      content: '// Implementation code\\n\\n...',
      timestamp: 1234567892345
    }
  ],
  finalOutput: '# Full markdown document with all phases...',
  metadata: {
    totalRounds: 3,
    modelsUsed: ['qwen3:671b-cloud', 'qwen3-coder:480b-cloud'],
    executionTimeMs: 45000
  }
}`);
  }

  section('DEMO COMPLETE');

  console.log(`${colors.bright}Summary:${colors.reset}`);
  success('WarpOllamaManager with enterprise features demonstrated');
  success('generateChatCompletion() - OpenAI-compatible API ✓');
  success('integrateWithA2A() - Multi-agent collaboration ✓');

  console.log(`\n${colors.bright}Next Steps:${colors.reset}`);
  info('1. Install Ollama: curl -fsSL https://ollama.com/install.sh | sh');
  info('2. Pull models: ollama pull llama3.1:8b-instruct-q4_K_M');
  info('3. Run this demo: npx ts-node demo-warp-ollama-live.ts');
  info('4. See examples/warp-ollama-enterprise-integration.ts for more');
  info('5. Read docs/WARP_OLLAMA_ENTERPRISE.md for full documentation');

  console.log('');
}

// Run the demo
demo().catch((err) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, err);
  process.exit(1);
});
