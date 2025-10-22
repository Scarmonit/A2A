// A2A MCP Dashboard WebSocket Server
// Real-time streaming analytics with autonomous execution capabilities
import WebSocket, { WebSocketServer } from 'ws';
import pino from 'pino';
import { AnalyticsEngine } from './analytics-engine.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface DashboardClient {
  ws: WebSocket;
  id: string;
  subscriptions: Set<string>;
  lastActivity: number;
  // track backpressure state
  bufferedBytes: number;
}

export interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'query' | 'command';
  data?: any;
  channels?: string[];
}

export class DashboardWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, DashboardClient> = new Map();
  private isPending = false;
  private broadcastInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private metricsHistory: any[] = [];
  private maxHistorySize = 1000;
  private broadcastPeriodMs = Math.max(250, Number(process.env.WS_BROADCAST_MS) || 1000); // allow faster cadence via env

  constructor(port: number = 8081) {
    this.wss = new WebSocketServer({
      port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3,
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024,
      },
      maxPayload: 2 * 1024 * 1024,
    });

    this.initialize();
    logger.info({ port }, 'Dashboard WebSocket Server initialized');
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      const client: DashboardClient = {
        ws,
        id: clientId,
        subscriptions: new Set(['realtime', 'insights', 'agents']),
        lastActivity: Date.now(),
        bufferedBytes: 0,
      };

      // Monitor per-socket backpressure
      ws.on('drain', () => {
        client.bufferedBytes = (ws as any).bufferedAmount ?? 0;
      });

      this.clients.set(clientId, client);

      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
          client.lastActivity = Date.now();
        } catch (err) {
          logger.error({ err, clientId }, 'Failed to parse WebSocket message');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info({ clientId }, 'Client disconnected');
      });

      ws.on('error', (err) => {
        logger.error({ err, clientId }, 'WebSocket error');
      });

      // Send initial welcome message with connection info
      const welcome = {
        type: 'welcome',
        clientId,
        timestamp: Date.now(),
        subscriptions: Array.from(client.subscriptions),
      };
      ws.send(JSON.stringify(welcome));

      logger.info({ clientId }, 'New client connected');
    });

    // Start metric broadcast and heartbeat loops
    this.startBroadcast();
    this.startHeartbeat();
  }

  private handleClientMessage(client: DashboardClient, message: WebSocketMessage): void {
    switch (message.type) {
      case 'subscribe':
        message.channels?.forEach((ch) => client.subscriptions.add(ch));
        logger.info({ clientId: client.id, channels: message.channels }, 'Client subscribed');
        break;
      case 'unsubscribe':
        message.channels?.forEach((ch) => client.subscriptions.delete(ch));
        logger.info({ clientId: client.id, channels: message.channels }, 'Client unsubscribed');
        break;
      case 'query':
        this.handleQuery(client, message.data);
        break;
      case 'command':
        this.handleCommand(client, message.data);
        break;
      default:
        logger.warn({ clientId: client.id, messageType: message.type }, 'Unknown message type');
    }
  }

  private handleQuery(client: DashboardClient, query: any): void {
    // Implement query handling logic (e.g., historical data, agent info)
    logger.info({ clientId: client.id, query }, 'Client query received');

    // Example: return last N metrics from history
    if (query?.type === 'history' && query.count) {
      const count = Math.min(query.count, this.metricsHistory.length);
      const history = this.metricsHistory.slice(-count);
      const response = {
        type: 'query-response',
        data: { history },
      };
      client.ws.send(JSON.stringify(response));
    }
  }

  private handleCommand(client: DashboardClient, command: any): void {
    // Implement command handling logic (e.g., agent control, config changes)
    logger.info({ clientId: client.id, command }, 'Client command received');

    // Example: adjust broadcast frequency
    if (command?.action === 'setBroadcastPeriod' && command.value) {
      const newPeriod = Math.max(250, Number(command.value));
      this.broadcastPeriodMs = newPeriod;
      this.restartBroadcast();
      const ack = {
        type: 'command-ack',
        success: true,
        message: `Broadcast period set to ${newPeriod}ms`,
      };
      client.ws.send(JSON.stringify(ack));
    }
  }

  private startBroadcast(): void {
    this.broadcastInterval = setInterval(() => {
      this.broadcastMetrics();
    }, this.broadcastPeriodMs);
    logger.info({ periodMs: this.broadcastPeriodMs }, 'Broadcast started');
  }

  private stopBroadcast(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
      logger.info('Broadcast stopped');
    }
  }

  private restartBroadcast(): void {
    this.stopBroadcast();
    this.startBroadcast();
  }

  private async broadcastMetrics(): Promise<void> {
    if (this.isPending || this.clients.size === 0) return;

    try {
      this.isPending = true;
      const metrics = await AnalyticsEngine.getInstance().getSnapshot();
      const timestamp = Date.now();

      // Store in history
      this.metricsHistory.push({ timestamp, metrics });
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      const payload = JSON.stringify({
        type: 'metrics',
        timestamp,
        data: metrics,
      });

      // Broadcast to subscribed clients
      for (const client of this.clients.values()) {
        if (client.subscriptions.has('realtime') && client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(payload);
            client.bufferedBytes = (client.ws as any).bufferedAmount ?? 0;
          } catch (err) {
            logger.error({ err, clientId: client.id }, 'Failed to send metrics to client');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Failed to broadcast metrics');
    } finally {
      this.isPending = false;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const client of this.clients.values()) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            const heartbeat = {
              type: 'heartbeat',
              timestamp: now,
              bufferedBytes: client.bufferedBytes,
            };
            client.ws.send(JSON.stringify(heartbeat));
          } catch (err) {
            logger.error({ err, clientId: client.id }, 'Failed to send heartbeat');
          }
        }
      }
    }, 30000); // heartbeat every 30s
    logger.info('Heartbeat started');
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  public close(): void {
    this.stopBroadcast();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.wss.close();
    logger.info('Dashboard WebSocket Server closed');
  }
}
