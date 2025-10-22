/**
 * Greenlet Process Pool
 * 
 * Manages a pool of Python greenlet worker processes with:
 * - Min/max worker configuration
 * - Health checks and auto-restart
 * - Round-robin worker allocation
 * - Resource cleanup
 */

import { GreenletBridgeAdapter } from './greenlet-bridge-adapter.js';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { component: 'greenlet-pool' } });

export interface GreenletProcessPoolConfig {
  minWorkers?: number;
  maxWorkers?: number;
  pythonPath?: string;
  scriptPath?: string;
  healthCheckInterval?: number;
  restartOnFailure?: boolean;
  workerRecycleInterval?: number;
  maxMessagesPerWorker?: number;
  loadBalancingStrategy?: 'round-robin' | 'least-busy' | 'random';
}

interface WorkerInfo {
  adapter: GreenletBridgeAdapter;
  healthy: boolean;
  lastHealthCheck: number;
  messagesProcessed: number;
  createdAt: number;
}

export interface PoolStats {
  total: number;
  available: number;
  busy: number;
  healthy: number;
  totalMessagesProcessed: number;
  averageWorkerAge: number;
  oldestWorker: number;
}

export interface DetailedPoolStats extends PoolStats {
  workers: Array<{
    id: string;
    healthy: boolean;
    messagesProcessed: number;
    age: number;
  }>;
}

export class GreenletProcessPool extends EventEmitter {
  private config: Required<GreenletProcessPoolConfig>;
  private workers: Map<string, WorkerInfo> = new Map();
  private availableWorkers: string[] = [];
  private nextWorkerId: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private recycleTimer: NodeJS.Timeout | null = null;
  private shuttingDown: boolean = false;
  private totalMessagesProcessed: number = 0;

  constructor(config: GreenletProcessPoolConfig = {}) {
    super();
    
    this.config = {
      minWorkers: config.minWorkers ?? 2,
      maxWorkers: config.maxWorkers ?? 10,
      pythonPath: config.pythonPath || 'python3',
      scriptPath: config.scriptPath || 'src/agents/python/greenlet_a2a_agent.py',
      healthCheckInterval: config.healthCheckInterval ?? 30000, // 30s
      restartOnFailure: config.restartOnFailure ?? true,
      workerRecycleInterval: config.workerRecycleInterval ?? 3600000, // 1 hour
      maxMessagesPerWorker: config.maxMessagesPerWorker ?? 10000,
      loadBalancingStrategy: config.loadBalancingStrategy ?? 'least-busy',
    };
  }
  
  /**
   * Start the process pool
   */
  async start(): Promise<void> {
    logger.info({
      minWorkers: this.config.minWorkers,
      maxWorkers: this.config.maxWorkers
    }, 'Starting greenlet process pool');
    
    // Start minimum number of workers
    const startPromises: Promise<string>[] = [];
    for (let i = 0; i < this.config.minWorkers; i++) {
      startPromises.push(this.addWorker());
    }
    
    await Promise.all(startPromises);
    
    // Start health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
    
    // Start worker recycle timer
    this.recycleTimer = setInterval(() => {
      this.recycleOldWorkers();
    }, this.config.workerRecycleInterval);
    
    logger.info({ workers: this.workers.size }, 'Greenlet process pool started');
  }
  
  /**
   * Add a new worker to the pool
   */
  async addWorker(): Promise<string> {
    if (this.workers.size >= this.config.maxWorkers) {
      throw new Error(`Maximum workers (${this.config.maxWorkers}) reached`);
    }
    
    const workerId = `worker-${this.nextWorkerId++}`;
    
    const adapter = new GreenletBridgeAdapter({
      pythonPath: this.config.pythonPath,
      scriptPath: this.config.scriptPath,
      agentId: workerId
    });
    
    try {
      await adapter.connect();
      
      this.workers.set(workerId, {
        adapter,
        healthy: true,
        lastHealthCheck: Date.now(),
        messagesProcessed: 0,
        createdAt: Date.now()
      });
      
      this.availableWorkers.push(workerId);
      
      // Handle worker exit
      adapter.on('exit', (code: number | null, signal: string | null) => {
        this.handleWorkerExit(workerId, code, signal);
      });
      
      logger.info({ workerId }, 'Worker added to pool');
      return workerId;
      
    } catch (error) {
      logger.error({ workerId, error: error instanceof Error ? error.message : String(error) }, 'Failed to add worker');
      throw error;
    }
  }
  
  /**
   * Get an available worker from the pool with load balancing
   */
  async getWorker(): Promise<GreenletBridgeAdapter> {
    if (this.availableWorkers.length === 0) {
      // Try to add a new worker if under max
      if (this.workers.size < this.config.maxWorkers) {
        const workerId = await this.addWorker();
        const worker = this.workers.get(workerId)!;
        worker.messagesProcessed++;
        this.totalMessagesProcessed++;
        return worker.adapter;
      }
      
      throw new Error('No available workers and max workers reached');
    }
    
    // Apply load balancing strategy
    let workerId: string;
    
    switch (this.config.loadBalancingStrategy) {
      case 'least-busy':
        workerId = this.getLeastBusyWorker();
        break;
      case 'random':
        const randomIndex = Math.floor(Math.random() * this.availableWorkers.length);
        workerId = this.availableWorkers.splice(randomIndex, 1)[0];
        break;
      case 'round-robin':
      default:
        workerId = this.availableWorkers.shift()!;
        break;
    }
    
    const worker = this.workers.get(workerId)!;
    worker.messagesProcessed++;
    this.totalMessagesProcessed++;
    
    // Check if worker needs recycling
    if (worker.messagesProcessed >= this.config.maxMessagesPerWorker) {
      logger.info({ workerId, messagesProcessed: worker.messagesProcessed }, 'Worker reached message limit, scheduling recycle');
      setImmediate(() => this.recycleWorker(workerId));
    }
    
    return worker.adapter;
  }

  /**
   * Get least busy worker
   */
  private getLeastBusyWorker(): string {
    let leastBusyId = this.availableWorkers[0];
    let leastMessages = this.workers.get(leastBusyId)?.messagesProcessed ?? Infinity;
    
    for (const workerId of this.availableWorkers) {
      const worker = this.workers.get(workerId);
      if (worker && worker.messagesProcessed < leastMessages) {
        leastMessages = worker.messagesProcessed;
        leastBusyId = workerId;
      }
    }
    
    const index = this.availableWorkers.indexOf(leastBusyId);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }
    
    return leastBusyId;
  }
  
  /**
   * Release worker back to available pool
   */
  releaseWorker(adapter: GreenletBridgeAdapter): void {
    for (const [workerId, worker] of this.workers.entries()) {
      if (worker.adapter === adapter) {
        if (!this.availableWorkers.includes(workerId)) {
          this.availableWorkers.push(workerId);
        }
        return;
      }
    }
  }
  
  /**
   * Remove worker from pool
   */
  async removeWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;
    
    try {
      await worker.adapter.disconnect();
    } catch (error) {
      logger.error({ workerId, error: error instanceof Error ? error.message : String(error) }, 'Error disconnecting worker');
    }
    
    this.workers.delete(workerId);
    const index = this.availableWorkers.indexOf(workerId);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }
    
    logger.info({ workerId }, 'Worker removed from pool');
  }
  
  /**
   * Shutdown the entire pool
   */
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.recycleTimer) {
      clearInterval(this.recycleTimer);
      this.recycleTimer = null;
    }
    
    logger.info('Shutting down greenlet process pool');
    
    const shutdownPromises: Promise<void>[] = [];
    for (const workerId of this.workers.keys()) {
      shutdownPromises.push(this.removeWorker(workerId));
    }
    
    await Promise.all(shutdownPromises);
    logger.info('Greenlet process pool shutdown complete');
  }
  
  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    const workers = Array.from(this.workers.values());
    const now = Date.now();
    const totalAge = workers.reduce((sum, w) => sum + (now - w.createdAt), 0);
    const oldestWorkerAge = workers.length > 0 ? Math.max(...workers.map(w => now - w.createdAt)) : 0;
    
    return {
      total: this.workers.size,
      available: this.availableWorkers.length,
      busy: this.workers.size - this.availableWorkers.length,
      healthy: workers.filter(w => w.healthy).length,
      totalMessagesProcessed: this.totalMessagesProcessed,
      averageWorkerAge: workers.length > 0 ? totalAge / workers.length : 0,
      oldestWorker: oldestWorkerAge
    };
  }

  /**
   * Get detailed pool statistics
   */
  getDetailedStats(): DetailedPoolStats {
    const basicStats = this.getStats();
    const now = Date.now();
    
    const workers = Array.from(this.workers.entries()).map(([id, info]) => ({
      id,
      healthy: info.healthy,
      messagesProcessed: info.messagesProcessed,
      age: now - info.createdAt
    }));
    
    return {
      ...basicStats,
      workers
    };
  }

  /**
   * Recycle old workers to prevent memory leaks
   */
  private async recycleOldWorkers(): Promise<void> {
    if (this.shuttingDown) return;
    
    const now = Date.now();
    const workersToRecycle: string[] = [];
    
    for (const [workerId, worker] of this.workers.entries()) {
      const age = now - worker.createdAt;
      
      // Recycle workers older than recycle interval
      if (age > this.config.workerRecycleInterval) {
        workersToRecycle.push(workerId);
      }
    }
    
    for (const workerId of workersToRecycle) {
      // Only recycle if we're above minimum workers
      if (this.workers.size > this.config.minWorkers) {
        logger.info({ workerId }, 'Recycling old worker');
        await this.recycleWorker(workerId);
      }
    }
  }

  /**
   * Recycle a specific worker
   */
  private async recycleWorker(workerId: string): Promise<void> {
    try {
      await this.removeWorker(workerId);
      
      // Add a new worker if we're below minimum
      if (this.workers.size < this.config.minWorkers && !this.shuttingDown) {
        await this.addWorker();
      }
    } catch (error) {
      logger.error({ workerId, error: error instanceof Error ? error.message : String(error) }, 'Failed to recycle worker');
    }
  }
  
  /**
   * Perform health checks on all workers
   */
  private async performHealthChecks(): Promise<void> {
    for (const [workerId, worker] of this.workers.entries()) {
      try {
        // Send ping
        worker.adapter.sendMessage({ type: 'agent.ping' });
        
        // Wait for pong (with timeout)
        const pongReceived = await new Promise<boolean>((resolve) => {
          const timeout = setTimeout(() => resolve(false), 5000);
          
          worker.adapter.once('agent.pong', () => {
            clearTimeout(timeout);
            resolve(true);
          });
        });
        
        if (pongReceived) {
          worker.healthy = true;
          worker.lastHealthCheck = Date.now();
        } else {
          worker.healthy = false;
          logger.warn({ workerId }, 'Worker health check failed');
          
          if (this.config.restartOnFailure) {
            await this.removeWorker(workerId);
            await this.addWorker();
          }
        }
      } catch (error) {
        logger.error({ workerId, error: error instanceof Error ? error.message : String(error) }, 'Health check error');
      }
    }
  }
  
  /**
   * Handle worker exit
   */
  private async handleWorkerExit(workerId: string, code: number | null, signal: string | null): Promise<void> {
    logger.info({ workerId, code, signal }, 'Worker exited');
    
    this.workers.delete(workerId);
    const index = this.availableWorkers.indexOf(workerId);
    if (index > -1) {
      this.availableWorkers.splice(index, 1);
    }
    
    // Restart if needed and not shutting down
    if (this.config.restartOnFailure && !this.shuttingDown) {
      if (this.workers.size < this.config.minWorkers) {
        try {
          await this.addWorker();
        } catch (error) {
          logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to restart worker');
        }
      }
    }
  }
}
