import * as os from 'os';
import { spawn } from 'child_process';
import type { ChildProcess } from 'child_process';

// Lightweight OpenAI-compatible client for Ollama endpoints
// Uses fetch API available in modern Node runtimes
export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | string;
  content: string;
}

export interface OpenAIChatCompletionRequest {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  tools?: unknown[];
  tool_choice?: unknown;
  stop?: string[];
}

export interface OpenAIChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{ delta: { content?: string; role?: string }; finish_reason: null | string; index: number }>;
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{ message: OpenAIChatMessage; finish_reason: null | string; index: number }>;
}

export type GPUInfo = {
  vendor: 'nvidia' | 'amd' | 'apple' | 'intel' | 'unknown';
  vramMB: number; // total VRAM in MB
  name?: string;
};

export type OllamaModelProfile = {
  name: string; // e.g., 'llama3.1:8b-instruct-q4_K_M'
  minVramMB: number; // recommended minimum VRAM to run comfortably
  maxContext?: number;
  family?: 'llama' | 'qwen' | 'mistral' | 'phi' | 'codellama' | string;
  endpointModel?: string; // optional different name used by the endpoint
};

export type BehaviorPreset = {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
};

export type ManagerOptions = {
  modelHint?: string;
  behavior?: keyof typeof defaultBehaviorPresets | string;
  baseURL?: string; // default http://localhost:11434/v1 for Ollama
  apiKey?: string;
  logger?: (msg: string) => void;
};

const defaultBehaviorPresets = {
  general: {
    systemPrompt: 'You are A2A Warp agent. Be concise, deterministic, and tool-aware.',
    temperature: 0.2,
    topP: 0.9,
    maxTokens: 2048,
  },
  coding: {
    systemPrompt: 'You are a senior TypeScript engineer. Provide correct, typed code with minimal prose.',
    temperature: 0.1,
    topP: 0.95,
    maxTokens: 2048,
    stop: ['```'],
  },
  reasoning: {
    systemPrompt: 'Think step-by-step, verify assumptions, and produce final succinct answers.',
    temperature: 0.0,
    topP: 0.8,
    maxTokens: 2048,
  },
} satisfies Record<string, BehaviorPreset>;

// Curated list of Ollama models with approximate VRAM needs
const MODEL_PROFILES: OllamaModelProfile[] = [
  { name: 'llama3.2:3b-instruct-fp16', minVramMB: 3500, family: 'llama', maxContext: 8192 },
  { name: 'llama3.2:3b-instruct-q4_0', minVramMB: 1800, family: 'llama', maxContext: 8192 },
  { name: 'llama3.1:8b-instruct-q8_0', minVramMB: 9500, family: 'llama', maxContext: 8192 },
  { name: 'llama3.1:8b-instruct-q6_K', minVramMB: 7000, family: 'llama', maxContext: 8192 },
  { name: 'llama3.1:8b-instruct-q4_K_M', minVramMB: 5200, family: 'llama', maxContext: 8192 },
  { name: 'mistral:7b-instruct-q6_K', minVramMB: 6500, family: 'mistral', maxContext: 8192 },
  { name: 'mistral:7b-instruct-q4_K_M', minVramMB: 4800, family: 'mistral', maxContext: 8192 },
  { name: 'qwen2.5:7b-instruct-q6_K', minVramMB: 6800, family: 'qwen', maxContext: 8192 },
  { name: 'qwen2.5:7b-instruct-q4_K_M', minVramMB: 5000, family: 'qwen', maxContext: 8192 },
  // Enterprise-scale cloud models (requires Warp cloud integration or remote Ollama deployment)
  { name: 'qwen3:671b-cloud', minVramMB: 320000, family: 'qwen', maxContext: 32768 }, // 671B reasoning model
  { name: 'qwen3-coder:480b-cloud', minVramMB: 240000, family: 'qwen', maxContext: 32768 }, // 480B coding model
];

function log(logger: ManagerOptions['logger'] | undefined, msg: string) {
  if (logger) logger(`[ollama-manager] ${msg}`);
}

export class WarpOllamaManager {
  private options: ManagerOptions;
  private gpu: GPUInfo | null = null;
  private chosen: OllamaModelProfile | null = null;

  constructor(options: ManagerOptions = {}) {
    this.options = options;
  }

  // Basic GPU detection across platforms
  async detectGPU(): Promise<GPUInfo> {
    const platform = os.platform();
    try {
      if (platform === 'darwin' && os.cpus()?.[0]?.model?.includes('Apple')) {
        const totalMemMB = Math.round(os.totalmem() / (1024 * 1024));
        const vramMB = Math.max(2048, Math.round(totalMemMB / 3));
        this.gpu = { vendor: 'apple', vramMB, name: 'Apple Silicon (Unified Memory)' };
        return this.gpu;
      }

      const nvidia = await this.execOnce('nvidia-smi', ['--query-gpu=memory.total,name', '--format=csv,noheader']);
      if (nvidia?.code === 0 && nvidia.stdout) {
        const first = nvidia.stdout.trim().split('\n')[0] || '';
        const [memPart, ...nameParts] = first.split(',');
        const memStr = memPart.toLowerCase();
        const num = parseInt(memStr.replace(/[^0-9]/g, ''), 10);
        const memMB = memStr.includes('mib') ? num : memStr.includes('gib') ? num * 1024 : num;
        const name = nameParts.join(',').trim();
        this.gpu = { vendor: 'nvidia', vramMB: memMB || 0, name };
        return this.gpu;
      }

      const rocm = await this.execOnce('rocm-smi', ['--showmeminfo', 'vram']);
      if (rocm?.code === 0 && rocm.stdout) {
        const match = rocm.stdout.match(/Total VRAM.*?:\s*(\d+)\s*MB/i);
        const vramMB = match ? parseInt(match[1], 10) : 0;
        this.gpu = { vendor: 'amd', vramMB, name: 'AMD GPU' };
        return this.gpu;
      }
    } catch (_) {}

    this.gpu = { vendor: 'unknown', vramMB: 0 };
    return this.gpu;
  }

  async selectModel(): Promise<OllamaModelProfile> {
    if (!this.gpu) await this.detectGPU();
    const hint = this.options.modelHint?.toLowerCase();
    if (hint) {
      const hinted = MODEL_PROFILES.find(m => m.name.toLowerCase().includes(hint));
      if (hinted) {
        this.chosen = hinted;
        log(this.options.logger, `Using hinted model: ${hinted.name}`);
        return hinted;
      }
    }

    const vram = this.gpu?.vramMB ?? 0;
    const candidates = MODEL_PROFILES
      .filter(m => m.minVramMB <= (vram || 0) || vram === 0)
      .sort((a, b) => b.minVramMB - a.minVramMB);

    const chosen = candidates[0] ?? MODEL_PROFILES[MODEL_PROFILES.length - 1];
    this.chosen = chosen;
    log(this.options.logger, `Auto-selected model ${chosen.name} for VRAM ${vram} MB`);
    return chosen;
  }

  getSelectedModel(): OllamaModelProfile | null { return this.chosen; }

  getBaseURL(): string {
    return this.options.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
  }

  async ensureModelAvailable(model?: string): Promise<void> {
    const selected = model || (await this.selectModel()).name;
    const ollamaBase = (this.options.baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/?v1$/, '');
    try {
      const res = await fetch(`${ollamaBase}/api/tags`);
      if (res.ok) {
        const data = await res.json();
        const exists = Array.isArray(data?.models) && data.models.some((m: any) => (m.name === selected));
        if (exists) {
          log(this.options.logger, `Model already available: ${selected}`);
          return;
        }
      }
    } catch (_) {}

    log(this.options.logger, `Pulling model: ${selected}`);
    const pull = await fetch(`${ollamaBase}/api/pull`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: selected }) });
    if (!pull.ok) {
      const text = await pull.text().catch(() => '');
      throw new Error(`Failed to pull model ${selected}: ${pull.status} ${text}`);
    }
  }

  buildRequest(messages: OpenAIChatMessage[], overrides: Partial<BehaviorPreset> = {}, model?: string): OpenAIChatCompletionRequest {
    const behaviorKey = (this.options.behavior || 'general').toString();
    const preset: BehaviorPreset = defaultBehaviorPresets[behaviorKey as keyof typeof defaultBehaviorPresets] || defaultBehaviorPresets.general;
    const sys = preset.systemPrompt ? [{ role: 'system', content: preset.systemPrompt } as OpenAIChatMessage] : [];
    const mergedStop = overrides.stop ?? preset.stop;

    return {
      model: model || this.chosen?.name || 'llama3.1:8b-instruct-q4_K_M',
      messages: [...sys, ...messages],
      temperature: overrides.temperature ?? preset.temperature ?? 0.2,
      top_p: overrides.topP ?? preset.topP ?? 0.9,
      max_tokens: overrides.maxTokens ?? preset.maxTokens ?? 1024,
      stream: false,
      ...(mergedStop ? { stop: mergedStop } : {}),
    };
  }

  async chat(request: OpenAIChatCompletionRequest): Promise<OpenAIChatCompletionResponse> {
    const base = this.getBaseURL();
    const apiKey = this.options.apiKey || process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || '';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(request),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Chat request failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as OpenAIChatCompletionResponse;
    return data;
  }

  async *chatStream(request: OpenAIChatCompletionRequest) {
    const base = this.getBaseURL();
    const apiKey = this.options.apiKey || process.env.OLLAMA_API_KEY || process.env.OPENAI_API_KEY || '';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ ...request, stream: true }),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`Streaming chat failed: ${res.status} ${text}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        const json = line.replace(/^data:\s*/, '');
        if (json === '[DONE]') return;
        try {
          const chunk = JSON.parse(json) as OpenAIChatCompletionChunk;
          yield chunk;
        } catch {}
      }
    }
  }

  async respond(messages: OpenAIChatMessage[], overrides: Partial<BehaviorPreset> = {}) {
    if (!this.chosen) await this.selectModel();
    await this.ensureModelAvailable(this.chosen!.name);
    const req = this.buildRequest(messages, overrides);
    const res = await this.chat(req);
    const content = res.choices?.[0]?.message?.content ?? '';
    return content;
  }

  /**
   * OpenAI-compatible chat completion method.
   * Alias for the `chat` method to match OpenAI SDK conventions.
   *
   * @param request - OpenAI chat completion request
   * @returns OpenAI chat completion response
   *
   * @example
   * ```typescript
   * const result = await manager.generateChatCompletion({
   *   model: 'qwen3-coder:480b-cloud',
   *   messages: [{ role: 'user', content: 'Create enterprise microservices architecture' }]
   * });
   * console.log(result.choices[0].message.content);
   * ```
   */
  async generateChatCompletion(request: OpenAIChatCompletionRequest): Promise<OpenAIChatCompletionResponse> {
    return this.chat(request);
  }

  /**
   * Integrates two A2A agents for collaborative task execution using Warp + Ollama.
   * This method orchestrates a multi-agent conversation where agents work together
   * to solve complex problems that benefit from specialized reasoning and coding models.
   *
   * @param sourceAgentId - The requesting agent identifier (e.g., 'enterprise-agent')
   * @param targetAgentId - The responding agent identifier (e.g., 'research-assistant')
   * @param task - The collaborative task description
   * @param options - Optional configuration for the integration
   * @returns A2A integration result with both agents' contributions
   *
   * @example
   * ```typescript
   * const result = await warpOllamaManager.integrateWithA2A(
   *   'enterprise-agent',
   *   'research-assistant',
   *   'Design a distributed AI system for 10M+ users'
   * );
   * console.log(result.finalArchitecture);
   * ```
   */
  async integrateWithA2A(
    sourceAgentId: string,
    targetAgentId: string,
    task: string,
    options: {
      reasoningModel?: string;
      codingModel?: string;
      maxRounds?: number;
      temperature?: number;
    } = {}
  ): Promise<{
    success: boolean;
    task: string;
    sourceAgent: string;
    targetAgent: string;
    conversation: Array<{ agent: string; model: string; content: string; timestamp: number }>;
    finalOutput: string;
    metadata: {
      totalRounds: number;
      modelsUsed: string[];
      executionTimeMs: number;
    };
  }> {
    const startTime = Date.now();
    const reasoningModel = options.reasoningModel || 'qwen3:671b-cloud';
    const codingModel = options.codingModel || 'qwen3-coder:480b-cloud';
    const maxRounds = options.maxRounds || 3;
    const temperature = options.temperature ?? 0.2;

    log(this.options.logger, `Starting A2A integration: ${sourceAgentId} -> ${targetAgentId}`);
    log(this.options.logger, `Task: ${task}`);
    log(this.options.logger, `Using reasoning model: ${reasoningModel}, coding model: ${codingModel}`);

    const conversation: Array<{ agent: string; model: string; content: string; timestamp: number }> = [];
    const modelsUsed = new Set<string>();

    try {
      // Round 1: Source agent (enterprise-agent) analyzes requirements using reasoning model
      log(this.options.logger, `Round 1: ${sourceAgentId} analyzing requirements...`);
      const analysisRequest: OpenAIChatCompletionRequest = {
        model: reasoningModel,
        messages: [
          {
            role: 'system',
            content: `You are ${sourceAgentId}, an enterprise AI agent specializing in complex system design and requirements analysis. Analyze the task thoroughly and break it down into key components.`
          },
          {
            role: 'user',
            content: `Task: ${task}\n\nProvide a comprehensive analysis including:\n1. Key requirements\n2. Technical challenges\n3. Scalability considerations\n4. Recommended architecture patterns`
          }
        ],
        temperature,
        max_tokens: 4096
      };

      const analysisResponse = await this.chat(analysisRequest);
      const analysisContent = analysisResponse.choices[0]?.message?.content || '';
      modelsUsed.add(reasoningModel);

      conversation.push({
        agent: sourceAgentId,
        model: reasoningModel,
        content: analysisContent,
        timestamp: Date.now()
      });

      log(this.options.logger, `Round 1 complete: ${analysisContent.length} chars generated`);

      // Round 2: Target agent (research-assistant) provides detailed architecture using reasoning model
      log(this.options.logger, `Round 2: ${targetAgentId} designing architecture...`);
      const architectureRequest: OpenAIChatCompletionRequest = {
        model: reasoningModel,
        messages: [
          {
            role: 'system',
            content: `You are ${targetAgentId}, a research-focused AI agent with expertise in distributed systems, cloud architecture, and scalability. Design a comprehensive architecture based on the analysis provided.`
          },
          {
            role: 'user',
            content: `Based on this analysis:\n\n${analysisContent}\n\nDesign a detailed distributed AI system architecture that can handle 10M+ users. Include:\n1. System components and their responsibilities\n2. Data flow and communication patterns\n3. Scalability strategy\n4. Technology stack recommendations`
          }
        ],
        temperature,
        max_tokens: 4096
      };

      const architectureResponse = await this.chat(architectureRequest);
      const architectureContent = architectureResponse.choices[0]?.message?.content || '';

      conversation.push({
        agent: targetAgentId,
        model: reasoningModel,
        content: architectureContent,
        timestamp: Date.now()
      });

      log(this.options.logger, `Round 2 complete: ${architectureContent.length} chars generated`);

      // Round 3: Use coding model to generate implementation code and setup scripts
      log(this.options.logger, `Round 3: Generating implementation code with ${codingModel}...`);
      const implementationRequest: OpenAIChatCompletionRequest = {
        model: codingModel,
        messages: [
          {
            role: 'system',
            content: 'You are an expert software architect and senior engineer. Generate production-ready, well-documented code for enterprise microservices architectures.'
          },
          {
            role: 'user',
            content: `Based on this architecture:\n\n${architectureContent}\n\nGenerate:\n1. Core microservice structure (TypeScript/Node.js)\n2. API gateway configuration\n3. Database schema\n4. Docker and Kubernetes deployment manifests\n5. Monitoring and observability setup\n\nProvide clean, typed, production-ready code with comments.`
          }
        ],
        temperature: 0.1, // Lower temperature for code generation
        max_tokens: 8192
      };

      const implementationResponse = await this.chat(implementationRequest);
      const implementationContent = implementationResponse.choices[0]?.message?.content || '';
      modelsUsed.add(codingModel);

      conversation.push({
        agent: `${sourceAgentId}+${targetAgentId}`,
        model: codingModel,
        content: implementationContent,
        timestamp: Date.now()
      });

      log(this.options.logger, `Round 3 complete: ${implementationContent.length} chars of code generated`);

      // Compile final output
      const finalOutput = `# Distributed AI System for 10M+ Users - A2A Collaborative Design

## Requirements Analysis (${sourceAgentId})
${analysisContent}

## Architecture Design (${targetAgentId})
${architectureContent}

## Implementation (Collaborative)
${implementationContent}

---
*Generated by A2A integration with Warp + Ollama*
*Models: ${Array.from(modelsUsed).join(', ')}*
*Execution time: ${Date.now() - startTime}ms*`;

      const executionTimeMs = Date.now() - startTime;

      log(this.options.logger, `A2A integration complete in ${executionTimeMs}ms`);

      return {
        success: true,
        task,
        sourceAgent: sourceAgentId,
        targetAgent: targetAgentId,
        conversation,
        finalOutput,
        metadata: {
          totalRounds: conversation.length,
          modelsUsed: Array.from(modelsUsed),
          executionTimeMs
        }
      };

    } catch (error) {
      const executionTimeMs = Date.now() - startTime;
      log(this.options.logger, `A2A integration failed: ${error}`);

      return {
        success: false,
        task,
        sourceAgent: sourceAgentId,
        targetAgent: targetAgentId,
        conversation,
        finalOutput: `Error during A2A integration: ${error instanceof Error ? error.message : String(error)}`,
        metadata: {
          totalRounds: conversation.length,
          modelsUsed: Array.from(modelsUsed),
          executionTimeMs
        }
      };
    }
  }

  private execOnce(cmd: string, args: string[]) {
    return new Promise<{ code: number; stdout: string; stderr: string } | null>((resolve) => {
      let stdout = '';
      let stderr = '';
      let finished = false;
      const child: ChildProcess = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout?.on('data', (d) => (stdout += String(d)));
      child.stderr?.on('data', (d) => (stderr += String(d)));
      child.on('error', () => {
        if (!finished) { finished = true; resolve(null); }
      });
      child.on('close', (code) => {
        if (!finished) { finished = true; resolve({ code: code ?? -1, stdout, stderr }); }
      });
      setTimeout(() => {
        if (!finished) { finished = true; try { child.kill('SIGKILL'); } catch {} resolve(null); }
      }, 2000);
    });
  }
}

// Minimal factory for A2A agent integration
export function createWarpOllama(options: ManagerOptions = {}) {
  return new WarpOllamaManager(options);
}
