import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { agentRegistry } from './agents.js';
import pino from 'pino';

const logger = pino({ name: 'enhanced-mcp-manager' });

export interface MCPServerConfig {
  id: string;
  type: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  healthCheck?: () => Promise<boolean>;
  autoRestart?: boolean;
  maxRestarts?: number;
}

export interface ServerState {
  id: string;
  config: MCPServerConfig;
  process?: ChildProcess;
  status: 'stopped' | 'starting' | 'running' | 'failed';
  restarts: number;
  lastRestart?: number;
  lastHealthCheck?: {
    timestamp: number;
    healthy: boolean;
  };
}

/**
 * EnhancedMCPManager - Production-ready MCP server management
 * 
 * Features:
 * - Auto-recovery with exponential backoff
 * - Health monitoring with configurable intervals
 * - Event-driven architecture
 * - Integration with AgentRegistry
 * - Metrics collection
 */
export class EnhancedMCPManager extends EventEmitter {
  private servers = new Map<string, ServerState>();
  private healthMonitorInterval?: NodeJS.Timeout;
  private readonly MAX_RESTARTS = 3;
  private readonly RESTART_DELAYS = [1000, 2000, 4000]; // Exponential backoff
  private readonly MAX_RESTART_WINDOW = 30000; // 30 seconds

  constructor() {
    super();
    logger.info('EnhancedMCPManager initialized');
  }

  /**
   * Register a new MCP server
   */
  registerServer(config: MCPServerConfig): void {
    if (this.servers.has(config.id)) {
      logger.warn({ serverId: config.id }, 'Server already registered, updating config');
    }

    const state: ServerState = {
      id: config.id,
      config: {
        ...config,
        autoRestart: config.autoRestart ?? true,
        maxRestarts: config.maxRestarts ?? this.MAX_RESTARTS,
      },
      status: 'stopped',
      restarts: 0,
    };

    this.servers.set(config.id, state);
    this.emit('server:registered', { id: config.id });
    logger.info({ serverId: config.id, type: config.type }, 'Server registered');
  }

  /**
   * Start an MCP server
   */
  async startServer(id: string): Promise<void> {
    const state = this.servers.get(id);
    if (!state) {
      throw new Error(`Server ${id} not registered`);
    }

    if (state.status === 'running') {
      logger.warn({ serverId: id }, 'Server already running');
      return;
    }

    state.status = 'starting';
    this.emit('server:starting', { id });

    try {
      const proc = spawn(state.config.command, state.config.args, {
        env: { ...process.env, ...state.config.env },
        stdio: 'pipe',
      });

      state.process = proc;
      state.status = 'running';
      state.lastRestart = Date.now();

      this.emit('server:started', { id });
      logger.info({ serverId: id, pid: proc.pid }, 'Server started');

      // Handle process events
      proc.on('exit', (code, signal) => this.handleProcessExit(id, code, signal));
      proc.on('error', (error) => this.handleProcessError(id, error));

      // Register with AgentRegistry if applicable
      this.registerWithAgentRegistry(id, state.config);

    } catch (error) {
      state.status = 'failed';
      this.emit('server:failed', { id, error });
      logger.error({ serverId: id, error }, 'Failed to start server');
      throw error;
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(id: string): Promise<void> {
    const state = this.servers.get(id);
    if (!state) {
      throw new Error(`Server ${id} not registered`);
    }

    if (state.status === 'stopped') {
      logger.warn({ serverId: id }, 'Server already stopped');
      return;
    }

    if (state.process) {
      state.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if not stopped
      setTimeout(() => {
        if (state.process && !state.process.killed) {
          state.process.kill('SIGKILL');
        }
      }, 5000);
    }

    state.status = 'stopped';
    this.emit('server:stopped', { id });
    logger.info({ serverId: id }, 'Server stopped');
  }

  /**
   * Handle process exit with auto-recovery
   */
  private async handleProcessExit(id: string, code: number | null, signal: string | null): Promise<void> {
    const state = this.servers.get(id);
    if (!state) return;

    logger.info({ serverId: id, code, signal }, 'Process exited');
    this.emit('server:stopped', { id, code, signal });

    // Check if we should attempt restart
    if (!state.config.autoRestart || code === 0) {
      state.status = 'stopped';
      return;
    }

    // Check restart window
    const now = Date.now();
    const timeSinceLastRestart = now - (state.lastRestart || 0);
    
    if (timeSinceLastRestart > this.MAX_RESTART_WINDOW) {
      // Reset restart counter if outside window
      state.restarts = 0;
    }

    // Check max restarts
    if (state.restarts >= (state.config.maxRestarts || this.MAX_RESTARTS)) {
      state.status = 'failed';
      this.emit('server:failed', { id, restarts: state.restarts });
      logger.error({ serverId: id, restarts: state.restarts }, 'Max restarts exceeded');
      return;
    }

    // Calculate delay with exponential backoff
    const delay = this.RESTART_DELAYS[Math.min(state.restarts, this.RESTART_DELAYS.length - 1)];
    state.restarts++;

    logger.info(
      { serverId: id, attempt: state.restarts, delayMs: delay },
      'Attempting auto-restart'
    );
    this.emit('server:restarting', { id, attempt: state.restarts, delay });

    // Wait and restart
    await new Promise((resolve) => setTimeout(resolve, delay));
    
    try {
      await this.startServer(id);
      this.emit('server:recovered', { id, attempts: state.restarts });
      logger.info({ serverId: id, attempts: state.restarts }, 'Server recovered');
    } catch (error) {
      logger.error({ serverId: id, error }, 'Failed to restart server');
    }
  }

  /**
   * Handle process errors
   */
  private handleProcessError(id: string, error: Error): void {
    const state = this.servers.get(id);
    if (!state) return;

    logger.error({ serverId: id, error }, 'Process error');
    this.emit('server:error', { id, error });
  }

  /**
   * Start health monitoring for all servers
   */
  startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.healthMonitorInterval) {
      logger.warn('Health monitoring already running');
      return;
    }

    logger.info({ intervalMs }, 'Starting health monitoring');

    this.healthMonitorInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, intervalMs);

    // Perform initial check immediately
    this.performHealthChecks();
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = undefined;
      logger.info('Health monitoring stopped');
    }
  }

  /**
   * Perform health checks on all running servers
   */
  private async performHealthChecks(): Promise<void> {
    const results = new Map<string, { healthy: boolean; error?: string }>();

    for (const [id, state] of this.servers) {
      if (state.status !== 'running' || !state.config.healthCheck) {
        continue;
      }

      try {
        const healthy = await state.config.healthCheck();
        
        state.lastHealthCheck = {
          timestamp: Date.now(),
          healthy,
        };

        results.set(id, { healthy });

        if (!healthy) {
          logger.warn({ serverId: id }, 'Health check failed');
          this.emit('server:unhealthy', { id });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        state.lastHealthCheck = {
          timestamp: Date.now(),
          healthy: false,
        };

        results.set(id, { healthy: false, error: errorMessage });
        logger.error({ serverId: id, error: errorMessage }, 'Health check error');
        this.emit('server:unhealthy', { id, error: errorMessage });
      }
    }

    this.emit('health:checked', results);
  }

  /**
   * Get server state
   */
  getServerState(id: string): ServerState | undefined {
    return this.servers.get(id);
  }

  /**
   * Get all server states
   */
  getAllServerStates(): Map<string, ServerState> {
    return new Map(this.servers);
  }

  /**
   * Get health status for all servers
   */
  getHealthStatus(): {
    total: number;
    running: number;
    healthy: number;
    unhealthy: number;
    failed: number;
  } {
    const states = Array.from(this.servers.values());
    
    return {
      total: states.length,
      running: states.filter((s) => s.status === 'running').length,
      healthy: states.filter(
        (s) => s.status === 'running' && s.lastHealthCheck?.healthy === true
      ).length,
      unhealthy: states.filter(
        (s) => s.status === 'running' && s.lastHealthCheck?.healthy === false
      ).length,
      failed: states.filter((s) => s.status === 'failed').length,
    };
  }

  /**
   * Register server with AgentRegistry (if applicable)
   */
  private registerWithAgentRegistry(id: string, config: MCPServerConfig): void {
    // Integration point with existing AgentRegistry
    // This allows MCP servers to be discoverable as agents
    try {
      const existingAgent = agentRegistry.get(id);
      if (!existingAgent) {
        agentRegistry.deploy({
          id,
          name: `${config.type} MCP Server`,
          version: '1.0.0',
          category: config.type,
          tags: ['mcp', 'auto-managed', config.type],
          capabilities: [
            {
              name: 'mcp_server',
              description: 'MCP Server capability',
              inputSchema: { type: 'object', properties: {} },
              outputSchema: { type: 'object', properties: {} },
            },
          ],
          enabled: true,
        });
        logger.info({ serverId: id }, 'Registered with AgentRegistry');
      }
    } catch (error) {
      logger.error({ serverId: id, error }, 'Failed to register with AgentRegistry');
    }
  }

  /**
   * Shutdown all servers gracefully
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down EnhancedMCPManager');
    
    this.stopHealthMonitoring();

    const stopPromises = Array.from(this.servers.keys()).map((id) =>
      this.stopServer(id).catch((error) => {
        logger.error({ serverId: id, error }, 'Error stopping server during shutdown');
      })
    );

    await Promise.all(stopPromises);
    
    this.servers.clear();
    this.emit('manager:shutdown');
    logger.info('EnhancedMCPManager shutdown complete');
  }
}
