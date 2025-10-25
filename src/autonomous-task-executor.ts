// Autonomous Task Executor with MCP integration
// SPDX-License-Identifier: MIT

/*
High-level capabilities:
1) Analyze context from browser tabs, selected text, or API inputs
2) Plan execution strategy automatically
3) Execute multiple tasks in parallel without user intervention
4) Handle API requests with rate limiting and retries
5) Update configurations across multiple services simultaneously
6) Submit and confirm deliverables automatically
7) Implement self-healing on failures
8) Provide real-time progress updates via WebSocket
Includes MCP tool integration for agent coordination.
*/

import WebSocket, { WebSocketServer } from 'ws';
import { setTimeout as delay } from 'timers/promises';

// Minimal MCP client types (Model Context Protocol)
export interface MCPTool {
  name: string;
  description?: string;
  // JSON-serializable schema for input/output (simplified)
  inputSchema?: unknown;
  call(input: any): Promise<any>;
}

export interface MCPRegistry {
  register(tool: MCPTool): void;
  get(name: string): MCPTool | undefined;
  list(): MCPTool[];
}

export class InMemoryMCPRegistry implements MCPRegistry {
  private tools = new Map<string, MCPTool>();
  register(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }
  get(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }
  list(): MCPTool[] {
    return [...this.tools.values()];
  }
}

// Progress events broadcasted via WebSocket
type ProgressEvent = {
  type:
    | 'context_analyzed'
    | 'plan_created'
    | 'task_started'
    | 'task_progress'
    | 'task_succeeded'
    | 'task_failed'
    | 'deliverables_submitted'
    | 'config_updated'
    | 'healed'
    | 'rate_limited_retry';
  payload: any;
  timestamp: string;
};

export class ProgressBus {
  private wss?: WebSocketServer;
  private sockets = new Set<WebSocket>();

  constructor(private port = 0) {}

  async start(): Promise<number> {
    this.wss = new WebSocketServer({ port: this.port });
    this.wss.on('connection', (ws) => {
      this.sockets.add(ws);
      ws.on('close', () => this.sockets.delete(ws));
    });
    const address = this.wss.address();
    if (typeof address === 'object' && address) {
      return address.port;
    }
    // If port 0, wait a tick to ensure bound
    await delay(10);
    const addr2 = this.wss.address();
    if (typeof addr2 === 'object' && addr2) return addr2.port;
    throw new Error('WebSocket server failed to start');
  }

  broadcast(event: ProgressEvent) {
    const msg = JSON.stringify(event);
    for (const ws of this.sockets) {
      if (ws.readyState === WebSocket.OPEN) ws.send(msg);
    }
  }

  emit(type: ProgressEvent['type'], payload: any) {
    this.broadcast({ type, payload, timestamp: new Date().toISOString() });
  }
}

// Rate limiter with retries and exponential backoff + jitter
export interface RateLimitOptions {
  maxRequestsPerInterval: number;
  intervalMs: number;
  maxRetries: number;
  baseDelayMs: number;
}

export class RateLimiter {
  private queue: (() => Promise<void>)[] = [];
  private timestamps: number[] = [];
  private running = false;

  constructor(private options: RateLimitOptions, private onProgress?: (e: ProgressEvent) => void) {}

  private schedule() {
    if (this.running) return;
    this.running = true;
    const loop = async () => {
      while (this.queue.length) {
        const now = Date.now();
        // purge timestamps outside the interval
        this.timestamps = this.timestamps.filter((t) => now - t < this.options.intervalMs);
        if (this.timestamps.length >= this.options.maxRequestsPerInterval) {
          const waitFor = this.options.intervalMs - (now - this.timestamps[0]);
          await delay(waitFor);
          continue;
        }
        const job = this.queue.shift()!;
        this.timestamps.push(Date.now());
        await job();
      }
      this.running = false;
    };
    void loop();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
          try {
            const res = await fn();
            resolve(res);
            return;
          } catch (err) {
            if (attempt >= this.options.maxRetries) {
              reject(err);
              return;
            }
            const backoff = this.options.baseDelayMs * Math.pow(2, attempt);
            const jitter = Math.random() * this.options.baseDelayMs;
            const waitMs = backoff + jitter;
            this.onProgress?.({ type: 'rate_limited_retry', payload: { attempt, waitMs }, timestamp: new Date().toISOString() });
            await delay(waitMs);
          }
        }
      });
      this.schedule();
    });
  }
}

// Context analyzer aggregates from tabs, selection, and API inputs
export interface ContextSource {
  id: string;
  read(): Promise<string | Record<string, any> | null>;
}

export class CompositeContextAnalyzer {
  constructor(private sources: ContextSource[], private progress: ProgressBus) {}
  async analyze(): Promise<Record<string, any>> {
    const parts = await Promise.all(this.sources.map((s) => s.read().catch(() => null)));
    const context: Record<string, any> = {};
    for (let i = 0; i < parts.length; i++) {
      context[this.sources[i].id] = parts[i];
    }
    this.progress.emit('context_analyzed', { keys: Object.keys(context) });
    return context;
  }
}

// Planning
export interface PlanStep {
  id: string;
  description: string;
  tool?: string; // optional MCP tool name
  input?: any;
  parallelGroup?: string; // steps with same group execute in parallel
  onFailure?: 'retry' | 'skip' | 'abort';
}

export interface ExecutionPlan {
  steps: PlanStep[];
}

export class AutoPlanner {
  constructor(private mcp: MCPRegistry, private progress: ProgressBus) {}

  createPlan(context: Record<string, any>): ExecutionPlan {
    // Heuristic: derive plan from provided tasks list or infer defaults
    const tasks: any[] = context['apiInputs']?.tasks || context['selectedTextTasks'] || [];
    const steps: PlanStep[] = [];

    if (tasks.length === 0) {
      // default multi-step demonstration leveraging MCP tools
      for (const tool of this.mcp.list()) {
        steps.push({
          id: `use-${tool.name}`,
          description: `Execute tool ${tool.name} with default input`,
          tool: tool.name,
          input: {},
          parallelGroup: 'defaults',
          onFailure: 'retry',
        });
      }
    } else {
      for (const t of tasks) {
        steps.push({
          id: t.id || `task-${Math.random().toString(36).slice(2)}`,
          description: t.description || 'Run task',
          tool: t.tool,
          input: t.input,
          parallelGroup: t.parallel ? 'user-parallel' : undefined,
          onFailure: t.onFailure || 'retry',
        });
      }
    }

    this.progress.emit('plan_created', { stepCount: steps.length });
    return { steps };
  }
}

// Self-healing strategy
function defaultHeal(error: any) {
  if (typeof error === 'object' && error && 'response' in error) {
    return 'retry';
  }
  if ((error?.message || '').includes('timeout')) return 'retry';
  return 'skip';
}

export interface ExecutorOptions {
  rateLimit?: Partial<RateLimitOptions>;
}

export class ParallelExecutor {
  private limiter: RateLimiter;
  constructor(private mcp: MCPRegistry, private progress: ProgressBus, opts?: ExecutorOptions) {
    this.limiter = new RateLimiter(
      {
        maxRequestsPerInterval: opts?.rateLimit?.maxRequestsPerInterval ?? 5,
        intervalMs: opts?.rateLimit?.intervalMs ?? 1000,
        maxRetries: opts?.rateLimit?.maxRetries ?? 3,
        baseDelayMs: opts?.rateLimit?.baseDelayMs ?? 250,
      },
      (e) => this.progress.broadcast(e as ProgressEvent),
    );
  }

  async run(plan: ExecutionPlan): Promise<{ results: Record<string, any>; failures: Record<string, any> }> {
    const byGroup = new Map<string | undefined, PlanStep[]>();
    for (const step of plan.steps) {
      const key = step.parallelGroup;
      byGroup.set(key, [...(byGroup.get(key) || []), step]);
    }

    const results: Record<string, any> = {};
    const failures: Record<string, any> = {};

    const execStep = async (step: PlanStep) => {
      this.progress.emit('task_started', { id: step.id, description: step.description });
      const runOnce = async () => {
        if (!step.tool) return { ok: true, data: null };
        const tool = this.mcp.get(step.tool);
        if (!tool) throw new Error(`Tool not found: ${step.tool}`);
        const data = await this.limiter.execute(() => tool.call(step.input));
        this.progress.emit('task_progress', { id: step.id, status: 'executed' });
        return { ok: true, data };
      };

      try {
        const res = await runOnce();
        results[step.id] = res.data;
        this.progress.emit('task_succeeded', { id: step.id });
      } catch (err) {
        const strategy = step.onFailure || defaultHeal(err);
        if (strategy === 'retry') {
          try {
            const res2 = await runOnce();
            results[step.id] = res2.data;
            this.progress.emit('healed', { id: step.id, strategy });
          } catch (err2) {
            failures[step.id] = String(err2);
            this.progress.emit('task_failed', { id: step.id, error: String(err2) });
          }
        } else if (strategy === 'skip') {
          failures[step.id] = String(err);
          this.progress.emit('task_failed', { id: step.id, error: String(err), skipped: true });
        } else {
          failures[step.id] = String(err);
          this.progress.emit('task_failed', { id: step.id, error: String(err), aborted: true });
        }
      }
    };

    // Execute groups: undefined group sequentially, named groups in parallel batches
    const groups = [...byGroup.entries()];
    for (const [group, steps] of groups) {
      if (group) {
        await Promise.all(steps.map(execStep));
      } else {
        for (const s of steps) await execStep(s);
      }
    }

    return { results, failures };
  }
}

// Configuration updater across services (mocked atomic fan-out)
export interface ConfigUpdate {
  service: string;
  key: string;
  value: any;
}

export class MultiServiceConfigurator {
  constructor(private mcp: MCPRegistry, private progress: ProgressBus) {}
  async updateAll(updates: ConfigUpdate[]): Promise<void> {
    await Promise.all(
      updates.map(async (u) => {
        const tool = this.mcp.get(`config:${u.service}`);
        if (!tool) return;
        await tool.call({ key: u.key, value: u.value });
        this.progress.emit('config_updated', { service: u.service, key: u.key });
      }),
    );
  }
}

// Deliverable submission tool
export interface Deliverable {
  id: string;
  content: string | Buffer | Record<string, any>;
  destination: string; // e.g., URL or repo path
}

export class DeliverableManager {
  constructor(private mcp: MCPRegistry, private progress: ProgressBus) {}
  async submitAll(items: Deliverable[]): Promise<void> {
    await Promise.all(
      items.map(async (d) => {
        const tool = this.mcp.get('submit:deliverable');
        if (!tool) return;
        await tool.call(d);
      }),
    );
    this.progress.emit('deliverables_submitted', { count: items.length });
  }
}

// Orchestrator entrypoint
export interface AutonomousOptions {
  wsPort?: number; // 0 for random
  rateLimit?: Partial<RateLimitOptions>;
}

export class AutonomousTaskExecutor {
  public readonly progress: ProgressBus;
  public readonly mcp: MCPRegistry;
  public readonly planner: AutoPlanner;
  public readonly executor: ParallelExecutor;
  public readonly configurator: MultiServiceConfigurator;
  public readonly deliverables: DeliverableManager;

  private wsPort?: number;

  constructor(opts?: AutonomousOptions, registry?: MCPRegistry) {
    this.progress = new ProgressBus(opts?.wsPort ?? 0);
    this.mcp = registry ?? new InMemoryMCPRegistry();
    this.planner = new AutoPlanner(this.mcp, this.progress);
    this.executor = new ParallelExecutor(this.mcp, this.progress, { rateLimit: opts?.rateLimit });
    this.configurator = new MultiServiceConfigurator(this.mcp, this.progress);
    this.deliverables = new DeliverableManager(this.mcp, this.progress);
  }

  async start(): Promise<number> {
    this.wsPort = await this.progress.start();
    return this.wsPort;
  }

  async run(contextSources: ContextSource[]): Promise<{ results: Record<string, any>; failures: Record<string, any> }> {
    const context = await new CompositeContextAnalyzer(contextSources, this.progress).analyze();
    const plan = this.planner.createPlan(context);
    return this.executor.run(plan);
  }
}

// Example built-in MCP tools for demonstration
export const EchoTool: MCPTool = {
  name: 'echo',
  description: 'Echoes input back',
  async call(input: any) {
    return { echoed: input };
  },
};

export const HttpFetchTool = (fetchImpl: (url: string, init?: any) => Promise<Response>): MCPTool => ({
  name: 'http:fetch',
  description: 'Fetch HTTP resource with GET',
  async call(input: { url: string }) {
    const res = await fetchImpl(input.url);
    const text = await res.text();
    return { status: res.status, text };
  },
});

export const SubmitDeliverableTool: MCPTool = {
  name: 'submit:deliverable',
  description: 'Submit a deliverable to a destination (mock)',
  async call(input: Deliverable) {
    // Placeholder implementation — integrate with repo/PR or ticketing API
    return { submitted: true, id: input.id, destination: input.destination };
  },
};

// Helper to wire a ready-to-run executor instance
export async function createDefaultExecutor(opts?: AutonomousOptions) {
  const exec = new AutonomousTaskExecutor(opts);
  exec.mcp.register(EchoTool);
  exec.mcp.register(SubmitDeliverableTool);
  // Register a basic config tool for two services as examples
  exec.mcp.register({
    name: 'config:serviceA',
    async call(input: { key: string; value: any }) {
      return { ok: true, service: 'A', ...input };
    },
  });
  exec.mcp.register({
    name: 'config:serviceB',
    async call(input: { key: string; value: any }) {
      return { ok: true, service: 'B', ...input };
    },
  });
  return exec;
}
