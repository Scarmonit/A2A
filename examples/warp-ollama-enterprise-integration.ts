// examples/warp-ollama-enterprise-integration.ts
// Demonstrates enterprise-scale A2A integration with Warp + Ollama
// Showcases 671B reasoning model and 480B coding model for complex distributed systems

/*
Prerequisites:
- Ollama installed with cloud-scale models configured (or remote Ollama deployment)
- Models available:
    - qwen3:671b-cloud (671B parameter reasoning model)
    - qwen3-coder:480b-cloud (480B parameter coding model)
- Warp terminal for rich UX (optional): https://www.warp.dev/
- A2A workspace set up according to the repository README

Note: These enterprise-scale models require significant GPU resources.
For local testing, you can substitute with smaller models like:
- llama3.1:8b-instruct-q4_K_M (instead of 671B)
- qwen2.5:7b-instruct-q4_K_M (instead of 480B)

Configuration:
Set OLLAMA_BASE_URL if using a remote Ollama deployment:
export OLLAMA_BASE_URL=http://your-ollama-server:11434/v1
*/

import { WarpOllamaManager, createWarpOllama } from '../src/warp/ollama-manager';

// Example 1: Basic usage with generateChatCompletion
async function basicChatCompletionExample() {
  console.log('\n=== Example 1: Basic Chat Completion ===\n');

  const warpOllamaManager = createWarpOllama({
    modelHint: '480b', // Will use qwen3-coder:480b-cloud
    behavior: 'coding',
    logger: (msg) => console.log(msg),
  });

  // Use the enterprise coding model for advanced development
  const codeResult = await warpOllamaManager.generateChatCompletion({
    model: 'qwen3-coder:480b-cloud',
    messages: [
      {
        role: 'user',
        content: 'Create enterprise microservices architecture with TypeScript, featuring API gateway, service mesh, and event-driven communication'
      }
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  console.log('\n--- Generated Architecture Code ---');
  console.log(codeResult.choices[0].message.content);
  console.log('\n--- Metadata ---');
  console.log(`Model: ${codeResult.model}`);
  console.log(`ID: ${codeResult.id}`);
}

// Example 2: A2A Integration for Distributed System Design
async function a2aIntegrationExample() {
  console.log('\n=== Example 2: A2A Integration for Enterprise System Design ===\n');

  const warpOllamaManager = createWarpOllama({
    baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    logger: (msg) => console.log(`[WarpOllama] ${msg}`),
  });

  // Detect GPU capabilities
  const gpu = await warpOllamaManager.detectGPU();
  console.log(`\nDetected GPU: ${gpu.vendor} - ${gpu.name || 'Unknown'}`);
  console.log(`Available VRAM: ${gpu.vramMB} MB\n`);

  // Use massive 671B reasoning model for complex system design
  const result = await warpOllamaManager.integrateWithA2A(
    'enterprise-agent',
    'research-assistant',
    'Design a distributed AI system for 10M+ users with real-time inference, model serving, and auto-scaling',
    {
      reasoningModel: 'qwen3:671b-cloud', // 671B for deep reasoning
      codingModel: 'qwen3-coder:480b-cloud', // 480B for implementation
      temperature: 0.2,
      maxRounds: 3,
    }
  );

  if (result.success) {
    console.log('\n✅ A2A Integration Successful!\n');
    console.log('--- Conversation Timeline ---');
    result.conversation.forEach((turn, idx) => {
      console.log(`\n[Round ${idx + 1}] ${turn.agent} (${turn.model})`);
      console.log(`Timestamp: ${new Date(turn.timestamp).toISOString()}`);
      console.log(`Content length: ${turn.content.length} chars`);
      console.log(`Preview: ${turn.content.substring(0, 200)}...\n`);
    });

    console.log('\n--- Final Output ---');
    console.log(result.finalOutput);

    console.log('\n--- Metadata ---');
    console.log(`Total rounds: ${result.metadata.totalRounds}`);
    console.log(`Models used: ${result.metadata.modelsUsed.join(', ')}`);
    console.log(`Execution time: ${result.metadata.executionTimeMs}ms (${(result.metadata.executionTimeMs / 1000).toFixed(2)}s)`);
  } else {
    console.error('\n❌ A2A Integration Failed');
    console.error(result.finalOutput);
  }
}

// Example 3: Streaming chat with enterprise models
async function streamingChatExample() {
  console.log('\n=== Example 3: Streaming Chat Completion ===\n');

  const manager = new WarpOllamaManager({
    behavior: 'reasoning',
    logger: (msg) => console.log(msg),
  });

  console.log('Streaming response from 671B reasoning model...\n');

  const request = {
    model: 'qwen3:671b-cloud',
    messages: [
      {
        role: 'system',
        content: 'You are an expert in distributed systems and cloud architecture. Provide detailed, step-by-step reasoning.',
      },
      {
        role: 'user',
        content: 'How would you design a globally distributed caching layer that maintains consistency across regions while minimizing latency?',
      },
    ],
    temperature: 0.0, // Deterministic reasoning
    max_tokens: 2048,
    stream: true,
  };

  process.stdout.write('Response: ');

  for await (const chunk of manager.chatStream(request)) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      process.stdout.write(content);
    }
  }

  console.log('\n\n✅ Streaming complete\n');
}

// Example 4: Multi-model comparison
async function multiModelComparison() {
  console.log('\n=== Example 4: Multi-Model Comparison ===\n');

  const manager = createWarpOllama({
    logger: (msg) => console.log(msg),
  });

  const prompt = 'Design a fault-tolerant message queue system for 100K msgs/sec throughput';

  const models = [
    { name: 'qwen3:671b-cloud', description: '671B Reasoning Model' },
    { name: 'qwen3-coder:480b-cloud', description: '480B Coding Model' },
    { name: 'llama3.1:8b-instruct-q4_K_M', description: '8B General Model (baseline)' },
  ];

  console.log(`\nPrompt: "${prompt}"\n`);

  for (const model of models) {
    console.log(`\n--- Testing ${model.description} ---`);

    const startTime = Date.now();

    try {
      const response = await manager.generateChatCompletion({
        model: model.name,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 1024,
      });

      const elapsedMs = Date.now() - startTime;
      const content = response.choices[0].message.content;

      console.log(`\nModel: ${model.name}`);
      console.log(`Latency: ${elapsedMs}ms`);
      console.log(`Response length: ${content.length} chars`);
      console.log(`\nPreview:\n${content.substring(0, 300)}...\n`);
    } catch (error) {
      console.error(`Failed to query ${model.name}:`, error instanceof Error ? error.message : error);
    }
  }
}

// Example 5: Agent collaboration with context accumulation
async function contextAwareCollaboration() {
  console.log('\n=== Example 5: Context-Aware Agent Collaboration ===\n');

  const manager = createWarpOllama({
    logger: (msg) => console.log(msg),
  });

  // Phase 1: Requirements gathering with reasoning model
  console.log('\n[Phase 1] Requirements Analysis...');
  const phase1Response = await manager.generateChatCompletion({
    model: 'qwen3:671b-cloud',
    messages: [
      {
        role: 'system',
        content: 'You are a senior product architect. Extract and prioritize requirements from complex scenarios.',
      },
      {
        role: 'user',
        content: 'We need a real-time bidding platform for ad exchanges that can handle 1M bid requests per second with <50ms latency. What are the key technical requirements?',
      },
    ],
    temperature: 0.1,
  });

  const requirements = phase1Response.choices[0].message.content;
  console.log('\nRequirements extracted:');
  console.log(requirements.substring(0, 400) + '...\n');

  // Phase 2: Architecture design with reasoning model
  console.log('\n[Phase 2] Architecture Design...');
  const phase2Response = await manager.generateChatCompletion({
    model: 'qwen3:671b-cloud',
    messages: [
      {
        role: 'system',
        content: 'You are a cloud architect specializing in high-throughput, low-latency systems.',
      },
      {
        role: 'user',
        content: `Given these requirements:\n\n${requirements}\n\nDesign a scalable architecture with specific technology choices.`,
      },
    ],
    temperature: 0.2,
  });

  const architecture = phase2Response.choices[0].message.content;
  console.log('\nArchitecture designed:');
  console.log(architecture.substring(0, 400) + '...\n');

  // Phase 3: Implementation with coding model
  console.log('\n[Phase 3] Code Generation...');
  const phase3Response = await manager.generateChatCompletion({
    model: 'qwen3-coder:480b-cloud',
    messages: [
      {
        role: 'system',
        content: 'You are an expert backend engineer. Generate production-ready, well-tested code.',
      },
      {
        role: 'user',
        content: `Implement the core bid processor based on this architecture:\n\n${architecture}\n\nGenerate TypeScript code with proper typing and error handling.`,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  const implementation = phase3Response.choices[0].message.content;
  console.log('\nImplementation generated:');
  console.log(implementation.substring(0, 500) + '...\n');

  console.log('✅ Three-phase collaboration complete!\n');
}

// Main runner
async function main() {
  const examples = [
    { name: 'Basic Chat Completion', fn: basicChatCompletionExample },
    { name: 'A2A Integration', fn: a2aIntegrationExample },
    { name: 'Streaming Chat', fn: streamingChatExample },
    { name: 'Multi-Model Comparison', fn: multiModelComparison },
    { name: 'Context-Aware Collaboration', fn: contextAwareCollaboration },
  ];

  console.log('='.repeat(80));
  console.log('Warp + Ollama Enterprise Integration Examples');
  console.log('Enterprise-scale AI models: 671B reasoning + 480B coding');
  console.log('='.repeat(80));

  // Run all examples or specific ones based on environment variable
  const exampleFilter = process.env.EXAMPLE_FILTER;

  for (const example of examples) {
    if (exampleFilter && !example.name.toLowerCase().includes(exampleFilter.toLowerCase())) {
      console.log(`\nSkipping: ${example.name}`);
      continue;
    }

    try {
      await example.fn();
    } catch (error) {
      console.error(`\n❌ Error in ${example.name}:`, error);
      if (error instanceof Error) {
        console.error(error.stack);
      }
    }

    // Add delay between examples to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(80));
  console.log('All examples completed!');
  console.log('='.repeat(80) + '\n');
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exitCode = 1;
  });
}

// Export for use in other modules
export {
  basicChatCompletionExample,
  a2aIntegrationExample,
  streamingChatExample,
  multiModelComparison,
  contextAwareCollaboration,
};
