import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { agentRegistry } from './agents.js';
import { EnhancedMCPManager } from './enhanced-mcp-manager.js';
import { aggregationCache } from './aggregation-cache.js';
import pino from 'pino';
import * as os from 'os';

const logger = pino({ name: 'realtime-dashboard' });

export interface DashboardMetrics {
  timestamp: number;
  agents: {
    total: number;
    enabled: number;
    disabled: number;
    categories: number;
    tags: number;
    byCategory: Record<string, number>;
    byTag: Record<string, number>;
  };
  mcpServers?: {
    total: number;
    running: number;
    healthy: number;
    unhealthy: number;
    failed: number;
  };
  performance: {
    memoryUsageMB: number;
    memoryPercentage: number;
    cpuLoadAverage: number[];
    uptime: number;
  };
  connections: {
    websocketClients: number;
    activeStreams: number;
  };
  cache?: {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    avgComputeTime: number;
  };
  websocket?: {
    connectedClients: number;
    queuedMessages: number;
    broadcastPending: boolean;
  };
}

export interface DashboardEvent {
  type: 'agent:deployed' | 'agent:removed' | 'agent:updated' | 'server:status' | 'metrics:update';
  timestamp: number;
  data: any;
}

/**
 * RealtimeDashboardHandler - Live metrics broadcasting for monitoring dashboards
 * 
 * Features:
 * - Real-time metrics updates every 5 seconds
 * - WebSocket-based push notifications
 * - Integration with AgentRegistry and EnhancedMCPManager
 * - Performance metrics collection
 * - Event-driven architecture for instant updates
 */
export class RealtimeDashboardHandler extends EventEmitter {
  private wss?: WebSocketServer;
  private clients = new Set<WebSocket>();
  private metricsInterval?: NodeJS.Timeout;
  private mcpManager?: EnhancedMCPManager;
  private updateIntervalMs: number;
  private startTime: number;
  
  // Cache configuration
  private readonly CACHE_TTL = 4000; // 4 seconds (just under broadcast interval)
  
  // Backpressure control
  private broadcastPending: boolean = false;
  private lastBroadcastTime: number = 0;
  private readonly MIN_BROADCAST_INTERVAL = 100; // Minimum 100ms between broadcasts
  private messageQueue: Array<{ client: WebSocket; message: string }> = [];
  private readonly MAX_QUEUE_SIZE = 1000;
  private queueProcessInterval?: NodeJS.Timeout;

  constructor(options?: {
    port?: number;
    host?: string;
    updateIntervalMs?: number;
    mcpManager?: EnhancedMCPManager;
  }) {
    super();
    
    this.updateIntervalMs = options?.updateIntervalMs || 5000;
    this.mcpManager = options?.mcpManager;
    this.startTime = Date.now();

    if (options?.port) {
      this.startWebSocketServer(options.port, options.host || '127.0.0.1');
    }
    
    // Start queue processing - use unref to allow process to exit
    this.queueProcessInterval = setInterval(() => this.processMessageQueue(), 1000);
    this.queueProcessInterval.unref();

    logger.info({ 
      port: options?.port, 
      updateIntervalMs: this.updateIntervalMs 
    }, 'RealtimeDashboardHandler initialized');
  }

  /**
   * Start WebSocket server for dashboard connections
   */
  startWebSocketServer(port: number, host: string = '127.0.0.1'): void {
    if (this.wss) {
      logger.warn('WebSocket server already running');
      return;
    }

    this.wss = new WebSocketServer({ 
      port, 
      host,
      perMessageDeflate: true,
      maxPayload: 1024 * 1024 // 1MB max payload
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleClientConnection(ws);
    });

    this.wss.on('error', (error) => {
      logger.error({ error }, 'WebSocket server error');
    });

    logger.info({ port, host }, 'WebSocket server started for dashboard');
  }

  /**
   * Handle new client connection
   */
  private handleClientConnection(ws: WebSocket): void {
    this.clients.add(ws);
    logger.info({ clientCount: this.clients.size }, 'Dashboard client connected');

    // Send initial metrics immediately
    this.sendMetricsToClient(ws);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(ws, message);
      } catch (error) {
        logger.error({ error }, 'Failed to parse client message');
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      logger.info({ clientCount: this.clients.size }, 'Dashboard client disconnected');
    });

    ws.on('error', (error) => {
      logger.error({ error }, 'Client WebSocket error');
      this.clients.delete(ws);
    });
  }

  /**
   * Handle messages from dashboard clients
   */
  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'subscribe':
        // Client is subscribing to updates (already handled by connection)
        ws.send(JSON.stringify({ 
          type: 'subscribed', 
          timestamp: Date.now() 
        }));
        break;

      case 'request_metrics':
        // Client requesting immediate metrics update
        this.sendMetricsToClient(ws);
        break;

      case 'request_agents':
        // Client requesting full agent list
        this.sendAgentListToClient(ws);
        break;

      default:
        logger.warn({ messageType: message.type }, 'Unknown message type from client');
    }
  }

  /**
   * Start periodic metrics broadcasting
   */
  startMetricsBroadcast(): void {
    if (this.metricsInterval) {
      logger.warn('Metrics broadcast already running');
      return;
    }

    logger.info({ intervalMs: this.updateIntervalMs }, 'Starting metrics broadcast');

    // Broadcast immediately
    this.broadcastMetrics();

    // Then broadcast periodically
    this.metricsInterval = setInterval(() => {
      this.broadcastMetrics();
    }, this.updateIntervalMs);
  }

  /**
   * Stop periodic metrics broadcasting
   */
  stopMetricsBroadcast(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
      logger.info('Metrics broadcast stopped');
    }
  }

  /**
   * Collect current metrics
   */
  collectMetrics(): DashboardMetrics {
    // Cache expensive metric calculations
    return aggregationCache.getOrCompute(
      'dashboard:metrics',
      this.CACHE_TTL,
      () => {
        const agentStats = agentRegistry.getStats();
        const agents = agentRegistry.list();

        // Group agents by category and tag
        const byCategory: Record<string, number> = {};
        const byTag: Record<string, number> = {};

        for (const agent of agents) {
          if (agent.category) {
            byCategory[agent.category] = (byCategory[agent.category] || 0) + 1;
          }
          
          if (agent.tags) {
            for (const tag of agent.tags) {
              byTag[tag] = (byTag[tag] || 0) + 1;
            }
          }
        }

        // Memory metrics
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const memoryUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        const memoryPercentage = Math.round((memUsage.heapUsed / totalMem) * 100);

        // MCP server metrics (if manager available)
        let mcpServers;
        if (this.mcpManager) {
          mcpServers = this.mcpManager.getHealthStatus();
        }

        const metrics: DashboardMetrics = {
          timestamp: Date.now(),
          agents: {
            ...agentStats,
            byCategory,
            byTag,
          },
          mcpServers,
          performance: {
            memoryUsageMB,
            memoryPercentage,
            cpuLoadAverage: os.loadavg(),
            uptime: Math.round((Date.now() - this.startTime) / 1000),
          },
          connections: {
            websocketClients: this.clients.size,
            activeStreams: 0, // Could integrate with StreamHub if needed
          },
          cache: aggregationCache.getStats(),
          websocket: {
            connectedClients: this.clients.size,
            queuedMessages: this.messageQueue.length,
            broadcastPending: this.broadcastPending,
          },
        };

        return metrics;
      }
    );
  }

  /**
   * Broadcast metrics to all connected clients
   */
  broadcastMetrics(): void {
    const metrics = this.collectMetrics();
    const message = JSON.stringify({
      type: 'metrics:update',
      timestamp: metrics.timestamp,
      data: metrics,
    });

    this.broadcast(message);
    this.emit('metrics:broadcast', metrics);
  }

  /**
   * Send metrics to a specific client
   */
  private sendMetricsToClient(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    const metrics = this.collectMetrics();
    const message = JSON.stringify({
      type: 'metrics:update',
      timestamp: metrics.timestamp,
      data: metrics,
    });

    ws.send(message);
  }

  /**
   * Send full agent list to a specific client
   */
  private sendAgentListToClient(ws: WebSocket): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    const agents = agentRegistry.list();
    const message = JSON.stringify({
      type: 'agents:list',
      timestamp: Date.now(),
      data: agents,
    });

    ws.send(message);
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcast(message: string): void {
    // Skip if broadcast already in progress
    if (this.broadcastPending) {
      logger.debug('Skipping broadcast: previous broadcast still pending');
      return;
    }

    // Enforce minimum interval between broadcasts
    const now = Date.now();
    const timeSinceLastBroadcast = now - this.lastBroadcastTime;
    if (timeSinceLastBroadcast < this.MIN_BROADCAST_INTERVAL) {
      logger.debug(
        { waitTime: this.MIN_BROADCAST_INTERVAL - timeSinceLastBroadcast },
        'Skipping broadcast: too soon after last broadcast'
      );
      return;
    }

    this.broadcastPending = true;
    this.lastBroadcastTime = now;

    // Use setImmediate to avoid blocking event loop
    setImmediate(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          // Check client bufferedAmount (backpressure indicator)
          if (client.bufferedAmount < 100000) {
            // < 100KB buffer
            client.send(message, (err) => {
              if (err) {
                logger.error({ error: err.message }, 'WebSocket send error');
              }
            });
          } else {
            // Client buffer full - queue or drop
            logger.warn(
              { bufferedAmount: client.bufferedAmount },
              'Client buffer full, queuing message'
            );
            if (this.messageQueue.length < this.MAX_QUEUE_SIZE) {
              this.messageQueue.push({ client, message });
            } else {
              logger.error('Message queue full, dropping message');
            }
          }
        }
      }

      this.broadcastPending = false;
    });
  }

  /**
   * Process queued messages
   */
  private processMessageQueue(): void {
    if (this.messageQueue.length === 0) {
      return;
    }

    const batch = this.messageQueue.splice(0, 50); // Process 50 at a time
    for (const { client, message } of batch) {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount < 100000) {
        client.send(message, (err) => {
          if (err) {
            logger.error({ error: err.message }, 'WebSocket send error from queue');
          }
        });
      }
    }

    if (this.messageQueue.length > 0) {
      logger.warn({ queueSize: this.messageQueue.length }, 'Message queue still has pending messages');
    }
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcastEvent(event: DashboardEvent): void {
    const message = JSON.stringify(event);
    this.broadcast(message);
    this.emit('event:broadcast', event);
  }

  /**
   * Notify clients of agent deployment
   */
  notifyAgentDeployed(agentId: string): void {
    const agent = agentRegistry.get(agentId);
    if (!agent) return;

    this.broadcastEvent({
      type: 'agent:deployed',
      timestamp: Date.now(),
      data: { agentId, agent },
    });
  }

  /**
   * Notify clients of agent removal
   */
  notifyAgentRemoved(agentId: string): void {
    this.broadcastEvent({
      type: 'agent:removed',
      timestamp: Date.now(),
      data: { agentId },
    });
  }

  /**
   * Notify clients of agent update
   */
  notifyAgentUpdated(agentId: string): void {
    const agent = agentRegistry.get(agentId);
    if (!agent) return;

    this.broadcastEvent({
      type: 'agent:updated',
      timestamp: Date.now(),
      data: { agentId, agent },
    });
  }

  /**
   * Notify clients of server status change
   */
  notifyServerStatus(serverId: string, status: string): void {
    this.broadcastEvent({
      type: 'server:status',
      timestamp: Date.now(),
      data: { serverId, status },
    });
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Shutdown dashboard handler
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down RealtimeDashboardHandler');

    this.stopMetricsBroadcast();
    
    // Stop queue processing
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = undefined;
    }

    // Close all client connections
    for (const client of this.clients) {
      try {
        client.close(1000, 'Server shutting down');
      } catch (error) {
        logger.error({ error }, 'Error closing client connection');
      }
    }

    this.clients.clear();

    // Close WebSocket server
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => {
          logger.info('WebSocket server closed');
          resolve();
        });
      });
    }

    this.emit('shutdown');
    logger.info('RealtimeDashboardHandler shutdown complete');
  }
}
