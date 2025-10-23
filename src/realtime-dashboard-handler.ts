import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { agentRegistry } from './agents.js';
import { EnhancedMCPManager } from './enhanced-mcp-manager.js';
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
    };

    return metrics;
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
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          logger.error({ error }, 'Failed to send message to client');
        }
      }
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
