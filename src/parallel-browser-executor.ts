import { BrowserAutomationEngine, BrowserTask, ExecutionResult } from './browser-automation-engine.js';
import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { WebSocketServer, WebSocket } from 'ws';

export interface ParallelExecutionConfig {
  maxConcurrency: number;
  timeout?: number;
  retries?: number;
  browsers?: ('chromium' | 'firefox' | 'webkit')[];
}

export interface TaskQueue {
  pending: BrowserTask[];
  running: Map<string, Promise<ExecutionResult>>;
  completed: ExecutionResult[];
  failed: ExecutionResult[];
}

export class ParallelBrowserExecutor extends EventEmitter {
  private engines: Map<string, BrowserAutomationEngine> = new Map();
  private taskQueue: TaskQueue = {
    pending: [],
    running: new Map(),
    completed: [],
    failed: []
  };
  private config: ParallelExecutionConfig;
  private wsServer?: WebSocketServer;
  private activeConnections: Set<WebSocket> = new Set();

  constructor(config: ParallelExecutionConfig) {
    super();
    this.config = {
      maxConcurrency: config.maxConcurrency || 10,
      timeout: config.timeout || 60000,
      retries: config.retries || 3,
      browsers: config.browsers || ['chromium']
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize engines for each browser type
      for (const browserType of this.config.browsers!) {
        const engine = new BrowserAutomationEngine(this.config.maxConcurrency);
        await engine.initialize(browserType);
        this.engines.set(browserType, engine);
        
        // Forward engine events
        engine.on('task:navigated', (data) => this.emit('task:navigated', data));
        engine.on('task:action', (data) => this.emit('task:action', data));
        engine.on('browser:error', (data) => this.emit('browser:error', data));
      }

      this.emit('executor:initialized', { 
        browsers: this.config.browsers,
        maxConcurrency: this.config.maxConcurrency 
      });
    } catch (error) {
      this.emit('executor:error', { error });
      throw error;
    }
  }

  async addTask(task: BrowserTask): Promise<void> {
    this.taskQueue.pending.push(task);
    this.emit('task:queued', { taskId: task.id, queueSize: this.taskQueue.pending.length });
    await this.processQueue();
  }

  async addBatch(tasks: BrowserTask[]): Promise<void> {
    this.taskQueue.pending.push(...tasks);
    this.emit('batch:queued', { count: tasks.length, queueSize: this.taskQueue.pending.length });
    await this.processQueue();
  }

  private async processQueue(): Promise<void> {
    while (this.taskQueue.pending.length > 0 && 
           this.taskQueue.running.size < this.config.maxConcurrency) {
      const task = this.taskQueue.pending.shift();
      if (!task) break;

      const execution = this.executeTaskWithRetry(task);
      this.taskQueue.running.set(task.id, execution);
      
      execution.then((result) => {
        this.taskQueue.running.delete(task.id);
        
        if (result.success) {
          this.taskQueue.completed.push(result);
          this.emit('task:completed', result);
        } else {
          this.taskQueue.failed.push(result);
          this.emit('task:failed', result);
        }
        
        // Process next task
        this.processQueue();
      }).catch((error) => {
        this.taskQueue.running.delete(task.id);
        this.emit('task:error', { taskId: task.id, error });
        this.processQueue();
      });
    }
  }

  private async executeTaskWithRetry(task: BrowserTask, attempt: number = 1): Promise<ExecutionResult> {
    const browserType = this.selectBrowser();
    const engine = this.engines.get(browserType);
    
    if (!engine) {
      throw new Error(`No engine available for browser type: ${browserType}`);
    }

    try {
      const timeoutPromise = new Promise<ExecutionResult>((_, reject) => {
        setTimeout(() => reject(new Error('Task timeout')), this.config.timeout);
      });

      const executionPromise = engine.executeTask(task);
      const result = await Promise.race([executionPromise, timeoutPromise]);

      if (!result.success && attempt < this.config.retries!) {
        this.emit('task:retry', { taskId: task.id, attempt: attempt + 1 });
        return await this.executeTaskWithRetry(task, attempt + 1);
      }

      return result;
    } catch (error: any) {
      if (attempt < this.config.retries!) {
        this.emit('task:retry', { taskId: task.id, attempt: attempt + 1 });
        return await this.executeTaskWithRetry(task, attempt + 1);
      }

      return {
        taskId: task.id,
        success: false,
        error: error.message,
        duration: 0
      };
    }
  }

  private selectBrowser(): string {
    // Round-robin browser selection for load balancing
    const browsers = Array.from(this.engines.keys());
    const index = this.taskQueue.completed.length % browsers.length;
    return browsers[index];
  }

  async executeAllParallel(tasks: BrowserTask[]): Promise<ExecutionResult[]> {
    this.emit('parallel:started', { count: tasks.length });
    
    const startTime = Date.now();
    await this.addBatch(tasks);

    // Wait for all tasks to complete
    while (this.taskQueue.pending.length > 0 || this.taskQueue.running.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const duration = Date.now() - startTime;
    const results = [...this.taskQueue.completed, ...this.taskQueue.failed];
    
    this.emit('parallel:completed', {
      total: tasks.length,
      completed: this.taskQueue.completed.length,
      failed: this.taskQueue.failed.length,
      duration
    });

    return results;
  }

  startWebSocketServer(port: number = 8080): void {
    this.wsServer = new WebSocketServer({ port });

    this.wsServer.on('connection', (ws: WebSocket) => {
      this.activeConnections.add(ws);
      this.emit('ws:connected', { connectionCount: this.activeConnections.size });

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          
          if (data.type === 'task') {
            const task: BrowserTask = data.task;
            await this.addTask(task);
          } else if (data.type === 'batch') {
            const tasks: BrowserTask[] = data.tasks;
            await this.addBatch(tasks);
          }
        } catch (error: any) {
          ws.send(JSON.stringify({ error: error.message }));
        }
      });

      ws.on('close', () => {
        this.activeConnections.delete(ws);
        this.emit('ws:disconnected', { connectionCount: this.activeConnections.size });
      });

      // Stream events to client
      this.on('task:completed', (result) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'task:completed', data: result }));
        }
      });

      this.on('task:failed', (result) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event: 'task:failed', data: result }));
        }
      });
    });

    this.emit('ws:server:started', { port });
  }

  stopWebSocketServer(): void {
    if (this.wsServer) {
      this.activeConnections.forEach(ws => ws.close());
      this.wsServer.close();
      this.emit('ws:server:stopped');
    }
  }

  getStatus(): {
    pending: number;
    running: number;
    completed: number;
    failed: number;
    engines: number;
  } {
    return {
      pending: this.taskQueue.pending.length,
      running: this.taskQueue.running.size,
      completed: this.taskQueue.completed.length,
      failed: this.taskQueue.failed.length,
      engines: this.engines.size
    };
  }

  async waitForCompletion(): Promise<void> {
    while (this.taskQueue.pending.length > 0 || this.taskQueue.running.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async cleanup(): Promise<void> {
    // Stop WebSocket server
    this.stopWebSocketServer();

    // Wait for running tasks to complete
    const runningTasks = Array.from(this.taskQueue.running.values());
    await Promise.allSettled(runningTasks);

    // Cleanup all engines
    await Promise.all(
      Array.from(this.engines.values()).map(engine => engine.cleanup())
    );
    
    this.engines.clear();
    this.taskQueue.pending = [];
    this.taskQueue.running.clear();
    
    this.emit('executor:cleanup:completed');
  }
}

// Example usage
if (require.main === module) {
  const executor = new ParallelBrowserExecutor({
    maxConcurrency: 5,
    timeout: 30000,
    retries: 2,
    browsers: ['chromium', 'firefox']
  });

  executor.on('executor:initialized', (data) => console.log('Executor initialized:', data));
  executor.on('task:completed', (result) => console.log('Task completed:', result.taskId));
  executor.on('task:failed', (result) => console.log('Task failed:', result.taskId, result.error));
  executor.on('parallel:completed', (data) => console.log('All tasks completed:', data));

  (async () => {
    try {
      await executor.initialize();

      // Example parallel execution
      const tasks: BrowserTask[] = [
        {
          id: 'task-1',
          url: 'https://github.com',
          actions: [{ type: 'screenshot', value: 'screenshots/github.png' }]
        },
        {
          id: 'task-2',
          url: 'https://example.com',
          actions: [{ type: 'screenshot', value: 'screenshots/example.png' }]
        }
      ];

      const results = await executor.executeAllParallel(tasks);
      console.log(`Executed ${results.length} tasks in parallel`);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    } finally {
      await executor.cleanup();
    }
  })();
}
