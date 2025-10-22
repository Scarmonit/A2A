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
}

interface WorkerInfo {
  adapter: GreenletBridgeAdapter;
  healthy: boolean;
  lastHealthCheck: number;
}

export interface PoolStats {
  total: number;
  available: number;
  busy: number;
  healthy: number;
}

export class GreenletProcessPool extends EventEmitter {
  private config: Required<GreenletProcessPoolConfig>;
  private workers: Map<string, WorkerInfo> = new Map();
  private availableWorkers: string[] = [];
  private nextWorkerId: number = 0;
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private shuttingDown: boolean = false;

  constructor(config: GreenletProcessPoolConfig = {}) {
    super();
    
    this.config = {
      minWorkers: config.minWorkers ?? 2,
      maxWorkers: config.maxWorkers ?? 10,
      pythonPath: config.pythonPath || 'python3',
      scriptPath: config.scriptPath || 'src/agents/python/greenlet-a2a-agent.py',
      healthCheckInterval: config.healthCheckInterval ?? 30000, // 30s
      restartOnFailure: config.restartOnFailure ?? true,
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
        lastHealthCheck: Date.now()
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
   * Get an available worker from the pool
   */
  async getWorker(): Promise<GreenletBridgeAdapter> {
    if (this.availableWorkers.length === 0) {
      // Try to add a new worker if under max
      if (this.workers.size < this.config.maxWorkers) {
        const workerId = await this.addWorker();
        return this.workers.get(workerId)!.adapter;
      }
      
      throw new Error('No available workers and max workers reached');
    }
    
    // Round-robin allocation
    const workerId = this.availableWorkers.shift()!;
    return this.workers.get(workerId)!.adapter;
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
    return {
      total: this.workers.size,
      available: this.availableWorkers.length,
      busy: this.workers.size - this.availableWorkers.length,
      healthy: Array.from(this.workers.values()).filter(w => w.healthy).length
    };
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
