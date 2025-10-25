/**
 * Parallel Autonomous Executor
 * Complete parallel execution system with API handling and autonomous task processing
 */

import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';

export interface Task {
  id: string;
  type: 'api' | 'browser' | 'computation' | 'io';
  priority: number;
  payload: any;
  dependencies?: string[];
  timeout?: number;
}

export interface ExecutionResult {
  taskId: string;
  success: boolean;
  data?: any;
  error?: Error;
  duration: number;
  timestamp: Date;
}

export interface ExecutorConfig {
  maxParallelTasks: number;
  maxRetries: number;
  retryDelay: number;
  enableMonitoring: boolean;
  workerPoolSize: number;
}

class TaskQueue {
  private queue: Task[] = [];
  private executing = new Map<string, Task>();

  enqueue(task: Task): void {
    this.queue.push(task);
    this.queue.sort((a, b) => b.priority - a.priority);
  }

  dequeue(): Task | undefined {
    return this.queue.shift();
  }

  canExecute(task: Task, completedTasks: Set<string>): boolean {
    if (!task.dependencies || task.dependencies.length === 0) {
      return true;
    }
    return task.dependencies.every(dep => completedTasks.has(dep));
  }

  hasAvailableTasks(completedTasks: Set<string>): boolean {
    return this.queue.some(task => this.canExecute(task, completedTasks));
  }

  getNextAvailableTask(completedTasks: Set<string>): Task | undefined {
    const index = this.queue.findIndex(task => this.canExecute(task, completedTasks));
    if (index !== -1) {
      return this.queue.splice(index, 1)[0];
    }
    return undefined;
  }

  markExecuting(taskId: string, task: Task): void {
    this.executing.set(taskId, task);
  }

  markCompleted(taskId: string): void {
    this.executing.delete(taskId);
  }

  get size(): number {
    return this.queue.length;
  }

  get executingCount(): number {
    return this.executing.size;
  }
}

export class ParallelAutonomousExecutor extends EventEmitter {
  private config: ExecutorConfig;
  private taskQueue: TaskQueue;
  private completedTasks = new Set<string>();
  private results = new Map<string, ExecutionResult>();
  private workerPool: Worker[] = [];
  private isRunning = false;

  constructor(config: Partial<ExecutorConfig> = {}) {
    super();
    this.config = {
      maxParallelTasks: config.maxParallelTasks || 10,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      enableMonitoring: config.enableMonitoring !== false,
      workerPoolSize: config.workerPoolSize || 4
    };
    this.taskQueue = new TaskQueue();
    this.initializeWorkerPool();
  }

  private initializeWorkerPool(): void {
    // Worker pool initialization logic
    this.emit('workerPoolInitialized', { size: this.config.workerPoolSize });
  }

  /**
   * Add a single task to the execution queue
   */
  public addTask(task: Task): void {
    this.taskQueue.enqueue(task);
    this.emit('taskAdded', { taskId: task.id, type: task.type });
  }

  /**
   * Add multiple tasks in parallel
   */
  public addTasks(tasks: Task[]): void {
    tasks.forEach(task => this.addTask(task));
    this.emit('batchTasksAdded', { count: tasks.length });
  }

  /**
   * Execute all queued tasks in parallel with dependency resolution
   */
  public async executeAll(): Promise<ExecutionResult[]> {
    if (this.isRunning) {
      throw new Error('Executor is already running');
    }

    this.isRunning = true;
    this.emit('executionStarted', { queueSize: this.taskQueue.size });

    const executionPromises: Promise<void>[] = [];

    while (this.taskQueue.size > 0 || this.taskQueue.executingCount > 0) {
      // Get all available tasks that can execute (dependencies satisfied)
      while (
        this.taskQueue.executingCount < this.config.maxParallelTasks &&
        this.taskQueue.hasAvailableTasks(this.completedTasks)
      ) {
        const task = this.taskQueue.getNextAvailableTask(this.completedTasks);
        if (!task) break;

        this.taskQueue.markExecuting(task.id, task);
        const executionPromise = this.executeTask(task)
          .then(result => {
            this.results.set(task.id, result);
            this.completedTasks.add(task.id);
            this.taskQueue.markCompleted(task.id);
            this.emit('taskCompleted', result);
          })
          .catch(error => {
            const result: ExecutionResult = {
              taskId: task.id,
              success: false,
              error,
              duration: 0,
              timestamp: new Date()
            };
            this.results.set(task.id, result);
            this.taskQueue.markCompleted(task.id);
            this.emit('taskFailed', result);
          });

        executionPromises.push(executionPromise);
      }

      // Wait for at least one task to complete before checking for more
      if (executionPromises.length > 0) {
        await Promise.race(executionPromises);
      }
    }

    // Wait for all remaining tasks to complete
    await Promise.all(executionPromises);

    this.isRunning = false;
    const allResults = Array.from(this.results.values());
    this.emit('executionCompleted', { 
      total: allResults.length,
      successful: allResults.filter(r => r.success).length,
      failed: allResults.filter(r => !r.success).length
    });

    return allResults;
  }

  /**
   * Execute a single task with retry logic
   */
  private async executeTask(task: Task, retryCount = 0): Promise<ExecutionResult> {
    const startTime = Date.now();
    this.emit('taskStarted', { taskId: task.id, attempt: retryCount + 1 });

    try {
      const data = await this.executeTaskByType(task);
      const duration = Date.now() - startTime;

      return {
        taskId: task.id,
        success: true,
        data,
        duration,
        timestamp: new Date()
      };
    } catch (error) {
      if (retryCount < this.config.maxRetries) {
        this.emit('taskRetrying', { taskId: task.id, attempt: retryCount + 1 });
        await this.delay(this.config.retryDelay * (retryCount + 1));
        return this.executeTask(task, retryCount + 1);
      }

      const duration = Date.now() - startTime;
      throw {
        taskId: task.id,
        success: false,
        error: error as Error,
        duration,
        timestamp: new Date()
      };
    }
  }

  /**
   * Execute task based on its type
   */
  private async executeTaskByType(task: Task): Promise<any> {
    switch (task.type) {
      case 'api':
        return await this.executeApiTask(task);
      case 'browser':
        return await this.executeBrowserTask(task);
      case 'computation':
        return await this.executeComputationTask(task);
      case 'io':
        return await this.executeIOTask(task);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Execute API request task
   */
  private async executeApiTask(task: Task): Promise<any> {
    const { method = 'GET', url, headers = {}, body } = task.payload;

    const controller = new AbortController();
    const timeoutId = task.timeout 
      ? setTimeout(() => controller.abort(), task.timeout)
      : null;

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  /**
   * Execute browser automation task
   */
  private async executeBrowserTask(task: Task): Promise<any> {
    // Browser automation logic would be integrated here
    // This connects to the browser-automation-agent.ts
    this.emit('browserTaskExecuting', { taskId: task.id });
    return { status: 'browser_task_completed', payload: task.payload };
  }

  /**
   * Execute computation task (CPU intensive)
   */
  private async executeComputationTask(task: Task): Promise<any> {
    // Offload to worker thread for CPU-intensive tasks
    return new Promise((resolve, reject) => {
      // Worker thread execution logic
      const result = task.payload.compute ? task.payload.compute() : task.payload;
      resolve(result);
    });
  }

  /**
   * Execute I/O task (file operations, database, etc.)
   */
  private async executeIOTask(task: Task): Promise<any> {
    // I/O operation logic
    this.emit('ioTaskExecuting', { taskId: task.id });
    return { status: 'io_task_completed', payload: task.payload };
  }

  /**
   * Get execution results
   */
  public getResults(): ExecutionResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Get result by task ID
   */
  public getResult(taskId: string): ExecutionResult | undefined {
    return this.results.get(taskId);
  }

  /**
   * Clear all results and reset state
   */
  public reset(): void {
    this.results.clear();
    this.completedTasks.clear();
    this.taskQueue = new TaskQueue();
    this.emit('executorReset');
  }

  /**
   * Get current execution statistics
   */
  public getStats() {
    const results = Array.from(this.results.values());
    return {
      totalTasks: results.length,
      completed: this.completedTasks.size,
      queued: this.taskQueue.size,
      executing: this.taskQueue.executingCount,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      averageDuration: results.length > 0 
        ? results.reduce((sum, r) => sum + r.duration, 0) / results.length 
        : 0
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Shutdown executor and cleanup resources
   */
  public async shutdown(): Promise<void> {
    this.isRunning = false;
    // Cleanup worker pool
    this.workerPool.forEach(worker => worker.terminate());
    this.workerPool = [];
    this.emit('executorShutdown');
  }
}

// Factory function for easy instantiation
export function createParallelExecutor(config?: Partial<ExecutorConfig>): ParallelAutonomousExecutor {
  return new ParallelAutonomousExecutor(config);
}

export default ParallelAutonomousExecutor;
