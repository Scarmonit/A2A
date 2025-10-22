// A2A MCP Dashboard WebSocket Server
// Real-time streaming analytics with autonomous execution capabilities
import WebSocket, { WebSocketServer } from 'ws';
import pino from 'pino';
import { analyticsEngine } from './analytics-engine.js';

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

      ws.on('pong', () => {
        client.lastActivity = Date.now();
      });

      this.clients.set(clientId, client);
      logger.info({ clientId, clientCount: this.clients.size }, 'Client connected');

      // Send initial state (as small as possible)
      this.sendToClient(client, {
        type: 'init',
        data: {
          clientId,
          metrics: analyticsEngine.getRealTimeMetrics(),
          insights: analyticsEngine
            .generateInsights({ start: Date.now() - 3600000, end: Date.now() })
            .slice(0, 5),
          timestamp: Date.now(),
        },
      });

      // Handle messages with minimal parsing work on hot path
      ws.on('message', (raw) => {
        try {
          // raw can be Buffer | string | ArrayBuffer
          const str = typeof raw === 'string' ? raw : (raw as any).toString();
          const parsed: WebSocketMessage = JSON.parse(str);
          this.handleClientMessage(client, parsed);
        } catch (error) {
          logger.error({ error, clientId }, 'Failed to parse message');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info({ clientId, clientCount: this.clients.size }, 'Client disconnected');
      });

      ws.on('error', (error) => {
        logger.error({ error, clientId }, 'WebSocket error');
      });
    });

    // Start broadcast loop and heartbeat loop
    this.startBroadcast();
    this.heartbeatInterval = setInterval(() => this.checkHeartbeats(), 30000);
  }

  private startBroadcast(): void {
    // Throttled broadcast loop with backpressure-aware skipping
    this.broadcastInterval = setInterval(() => {
      this.broadcast();
    }, this.broadcastPeriodMs);
  }

  private broadcast(): void {
    if (this.isPending) return; // Skip if previous broadcast pending
    this.isPending = true;

    try {
      const metrics = analyticsEngine.getRealTimeMetrics();

      // Add to history for trend analysis
      const now = Date.now();
      this.metricsHistory.push({ ...metrics, timestamp: now });
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
      }

      // Precompute trends once
      const trends = this.calculateTrends();

      // Prepare payload once and reuse buffer for all clients
      const message = { type: 'update', data: { metrics, trends, timestamp: now } };
      const messageStr = JSON.stringify(message);

      // Backpressure-aware broadcast: skip clients with large bufferedAmount to avoid event loop stall
      const MAX_BUFFERED = 512 * 1024; // 512KB per socket threshold
      this.clients.forEach((client) => {
        const socket = client.ws;
        if (client.subscriptions.has('realtime') && socket.readyState === WebSocket.OPEN) {
          const buffered = (socket as any).bufferedAmount ?? 0;
          client.bufferedBytes = buffered;
          if (buffered > MAX_BUFFERED) {
            // Drop non-critical update for this client; they will catch up on next tick
            return;
          }
          try {
            socket.send(messageStr, { compress: false });
          } catch (e) {
            logger.warn({ e }, 'Send failed, skipping client');
          }
        }
      });
    } catch (error) {
      logger.error({ error }, 'Broadcast error');
    } finally {
      this.isPending = false;
    }
  }

  private handleClientMessage(client: DashboardClient, message: WebSocketMessage): void {
    client.lastActivity = Date.now();
    switch (message.type) {
      case 'subscribe': {
        if (message.channels?.length) {
          for (const ch of message.channels) client.subscriptions.add(ch);
          this.sendToClient(client, { type: 'subscribed', channels: message.channels });
        }
        break;
      }
      case 'unsubscribe': {
        if (message.channels?.length) {
          for (const ch of message.channels) client.subscriptions.delete(ch);
          this.sendToClient(client, { type: 'unsubscribed', channels: message.channels });
        }
        break;
      }
      case 'query': {
        // run queries off the hot path and catch sync/async seamlessly
        Promise.resolve()
          .then(() => analyticsEngine.query(message.data))
          .then((result) => {
            this.sendToClient(client, { type: 'query_result', data: result, queryId: (message as any).data?.id });
          })
          .catch((error) => {
            logger.error({ error, query: (message as any).data }, 'Query error');
            this.sendToClient(client, { type: 'error', message: 'Query failed', queryId: (message as any).data?.id });
          });
        break;
      }
      case 'command': {
        Promise.resolve()
          .then(async () => {
            switch ((message as any).data?.action) {
              case 'analyze_text': {
                const textAnalysis = this.analyzeText((message as any).data.text || '');
                this.sendToClient(client, { type: 'command_result', data: textAnalysis, commandId: (message as any).data.id });
                break;
              }
              case 'monitor_tab': {
                const tabInfo = this.getTabMonitoring();
                this.sendToClient(client, { type: 'command_result', data: tabInfo, commandId: (message as any).data.id });
                break;
              }
              case 'generate_insights': {
                const timeRange = (message as any).data.timeRange || { start: Date.now() - 3600000, end: Date.now() };
                const insights = analyticsEngine.generateInsights(timeRange);
                this.sendToClient(client, { type: 'command_result', data: insights, commandId: (message as any).data.id });
                break;
              }
              case 'export_data': {
                const exportData = analyticsEngine.exportData(
                  (message as any).data.timeRange || { start: Date.now() - 86400000, end: Date.now() },
                  (message as any).data.format || 'json'
                );
                this.sendToClient(client, {
                  type: 'command_result',
                  data: { export: exportData, format: (message as any).data.format },
                  commandId: (message as any).data.id,
                });
                break;
              }
              default: {
                this.sendToClient(client, { type: 'error', message: 'Unknown command', commandId: (message as any).data?.id });
              }
            }
          })
          .catch((error) => {
            logger.error({ error, command: (message as any).data }, 'Command error');
            this.sendToClient(client, { type: 'error', message: 'Command failed', commandId: (message as any).data?.id });
          });
        break;
      }
      default: {
        this.sendToClient(client, { type: 'error', message: 'Unknown message type' });
      }
    }
  }

  private analyzeText(text: string): any {
    // Autonomous text analysis
    return {
      length: text.length,
      words: text.split(/\s+/).filter(Boolean).length,
      sentences: text.split(/[.!?]+/).filter(Boolean).length,
      sentiment: this.calculateSentiment(text),
      keywords: this.extractKeywords(text),
      timestamp: Date.now(),
    };
  }

  private calculateSentiment(text: string): string {
    // Basic sentiment analysis
    const positive = /good|great|excellent|amazing|wonderful|fantastic/gi;
    const negative = /bad|terrible|awful|poor|horrible|worst/gi;

    const positiveCount = (text.match(positive) || []).length;
    const negativeCount = (text.match(negative) || []).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const frequency: Record<string, number> = {};

    for (const word of words) {
      frequency[word] = (frequency[word] || 0) + 1;
    }

    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private getTabMonitoring(): any {
    // Tab monitoring capabilities
    return {
      activeClients: this.clients.size,
      subscriptions: Array.from(this.clients.values()).map((c) => ({
        id: c.id,
        subscriptions: Array.from(c.subscriptions),
        lastActivity: c.lastActivity,
        bufferedBytes: c.bufferedBytes,
      })),
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now(),
    };
  }

  private calculateTrends(): any {
    if (this.metricsHistory.length < 2) {
      return { available: false };
    }
    const recent = this.metricsHistory.slice(-60); // Last 60 seconds
    const requestCounts = recent.map((m) => m.requests?.total || 0);
    const avgTime = recent.map((m) => m.performance?.avgExecutionTime || 0);
    return {
      available: true,
      requestRate: {
        current: requestCounts[requestCounts.length - 1] || 0,
        trend: this.calculateTrendDirection(requestCounts),
        change: this.calculateChangePercent(requestCounts),
      },
      performance: {
        current: avgTime[avgTime.length - 1] || 0,
        trend: this.calculateTrendDirection(avgTime),
        change: this.calculateChangePercent(avgTime),
      },
    };
  }

  private calculateTrendDirection(values: number[]): 'up' | 'down' | 'stable' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-10);
    const older = values.slice(-20, -10);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / (older.length || 1);

    const change = ((recentAvg - olderAvg) / (olderAvg || 1)) * 100;

    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  private calculateChangePercent(values: number[]): number {
    if (values.length < 2) return 0;

    const current = values[values.length - 1];
    const previous = values[values.length - 2];

    if (previous === 0) return 0;

    return ((current - previous) / previous) * 100;
  }

  private sendJSON(socket: WebSocket, payload: any) {
    const str = JSON.stringify(payload);
    socket.send(str);
  }

  private broadcastToSubscribers(channel: string, message: any): void {
    const messageStr = JSON.stringify(message);
    this.clients.forEach((client) => {
      if (client.subscriptions.has(channel) && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(messageStr);
      }
    });
  }

  private sendToClient(client: DashboardClient, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (e) {
        logger.warn({ e }, 'sendToClient failed');
      }
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds
    this.clients.forEach((client, clientId) => {
      if (now - client.lastActivity > timeout) {
        logger.info({ clientId }, 'Client timeout, closing connection');
        try {
          client.ws.close();
        } finally {
          this.clients.delete(clientId);
        }
      } else {
        // Send ping if socket is open
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.ping();
          } catch (e) {
            logger.warn({ e, clientId }, 'Ping failed');
          }
        }
      }
    });
  }

  private generateClientId(): string {
    try {
      const rnd = Math.random().toString(36).slice(2, 11);
      return `client_${Date.now()}_${rnd}`;
    } catch {
      return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  public stop(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((client) => {
      try { client.ws.close(); } catch {}
    });

    this.wss.close();
    logger.info('WebSocket server stopped');
  }

  public getStats(): any {
    return {
      connectedClients: this.clients.size,
      metricsHistorySize: this.metricsHistory.length,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      // aggregate backpressure for
