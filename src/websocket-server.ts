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
  private metricsHistory: any[] = [];
  private maxHistorySize = 1000;

  constructor(port: number = 8081) {
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: {
        zlibDeflateOptions: {
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
      }
    });
    
    this.initialize();
    logger.info({ port }, 'Dashboard WebSocket Server initialized');
  }

  private initialize(): void {
    this.wss.on('connection', (ws: WebSocket, re: any) => {
      const clientId = this.generateClientId();
      const client: DashboardClient = {
        ws,
        id: clientId,
        subscriptions: new Set(['realtime', 'insights', 'agents']),
        lastActivity: Date.now()
      };

      this.clients.set(clientId, client);
      logger.info({ clientId, clientCount: this.clients.size }, 'Client connected');

      // Send initial state
      this.sendToClient(client, {
        type: 'init',
        data: {
          clientId,
          metrics: analyticsEngine.getRealTimeMetrics(),
          insights: analyticsEngine.generateInsights({ 
            start: Date.now() - 3600000, 
            end: Date.now() 
          }).slice(0, 5),
          timestamp: Date.now()
        }
      });

      // Handle messages
      ws.on('message', (message: string) => {
        try {
          const parsed: WebSocketMessage = JSON.parse(message.toString());
          this.handleClientMessage(client, parsed);
        } catch (error) {
          logger.error({ error, clientId }, 'Failed to parse message');
        }
      });

      // Handle close
      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info({ clientId, clientCount: this.clients.size }, 'Client disconnected');
      });

      // Handle errors
      ws.on('error', (error) => {
        logger.error({ error, clientId }, 'WebSocket error');
      });

      // Heartbeat
      ws.on('pong', () => {
        client.lastActivity = Date.now();
      });
    });

    // Start broadcast loop
    this.startBroadcast();

    // Heartbeat check
    setInterval(() => this.checkHeartbeats(), 30000);
  }

  private startBroadcast(): void {
    // Broadcast updates every 1 second with backpressure control
    this.broadcastInterval = setInterval(() => {
      this.broadcast();
    }, 1000);
  }

  private broadcast(): void {
    if (this.isPending) return; // Skip if previous broadcast pending
    
    this.isPending = true;

    try {
      const metrics = analyticsEngine.getRealTimeMetrics();
      
      // Add to history for trend analysis
      this.metricsHistory.push({ ...metrics, timestamp: Date.now() });
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
      }

      const message = {
        type: 'update',
        data: {
          metrics,
          trends: this.calculateTrends(),
          timestamp: Date.now()
        }
      };

      this.broadcastToSubscribers('realtime', message);
    } catch (error) {
      logger.error({ error }, 'Broadcast error');
    } finally {
      this.isPending = false;
    }
  }

  private handleClientMessage(client: DashboardClient, message: WebSocketMessage): void {
    client.lastActivity = Date.now();

    switch (message.type) {
      case 'subscribe':
        if (message.channels) {
          message.channels.forEach(ch => client.subscriptions.add(ch));
          this.sendToClient(client, { type: 'subscribed', channels: message.channels });
        }
        break;

      case 'unsubscribe':
        if (message.channels) {
          message.channels.forEach(ch => client.subscriptions.delete(ch));
          this.sendToClient(client, { type: 'unsubscribed', channels: message.channels });
        }
        break;

      case 'query':
        this.handleQuery(client, message.data);
        break;

      case 'command':
        this.handleCommand(client, message.data);
        break;

      default:
        this.sendToClient(client, { type: 'error', message: 'Unknown message type' });
    }
  }

  private async handleQuery(client: DashboardClient, query: any): Promise<void> {
    try {
      const result = analyticsEngine.query(query);
      this.sendToClient(client, {
        type: 'query_result',
        data: result,
        queryId: query.id
      });
    } catch (error) {
      logger.error({ error, query }, 'Query error');
      this.sendToClient(client, {
        type: 'error',
        message: 'Query failed',
        queryId: query.id
      });
    }
  }

  private async handleCommand(client: DashboardClient, command: any): Promise<void> {
    try {
      // Autonomous execution commands
      switch (command.action) {
        case 'analyze_text':
          const textAnalysis = this.analyzeText(command.text);
          this.sendToClient(client, {
            type: 'command_result',
            data: textAnalysis,
            commandId: command.id
          });
          break;

        case 'monitor_tab':
          const tabInfo = this.getTabMonitoring();
          this.sendToClient(client, {
            type: 'command_result',
            data: tabInfo,
            commandId: command.id
          });
          break;

        case 'generate_insights':
          const timeRange = command.timeRange || { start: Date.now() - 3600000, end: Date.now() };
          const insights = analyticsEngine.generateInsights(timeRange);
          this.sendToClient(client, {
            type: 'command_result',
            data: insights,
            commandId: command.id
          });
          break;

        case 'export_data':
          const exportData = analyticsEngine.exportData(
            command.timeRange || { start: Date.now() - 86400000, end: Date.now() },
            command.format || 'json'
          );
          this.sendToClient(client, {
            type: 'command_result',
            data: { export: exportData, format: command.format },
            commandId: command.id
          });
          break;

        default:
          this.sendToClient(client, {
            type: 'error',
            message: 'Unknown command',
            commandId: command.id
          });
      }
    } catch (error) {
      logger.error({ error, command }, 'Command error');
      this.sendToClient(client, {
        type: 'error',
        message: 'Command failed',
        commandId: command.id
      });
    }
  }

  private analyzeText(text: string): any {
    // Autonomous text analysis
    return {
      length: text.length,
      words: text.split(/\s+/).length,
      sentences: text.split(/[.!?]+/).length,
      sentiment: this.calculateSentiment(text),
      keywords: this.extractKeywords(text),
      timestamp: Date.now()
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
    
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private getTabMonitoring(): any {
    // Tab monitoring capabilities
    return {
      activeClients: this.clients.size,
      subscriptions: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        subscriptions: Array.from(c.subscriptions),
        lastActivity: c.lastActivity
      })),
      serverUptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: Date.now()
    };
  }

  private calculateTrends(): any {
    if (this.metricsHistory.length < 2) {
      return { available: false };
    }

    const recent = this.metricsHistory.slice(-60); // Last 60 seconds
    const requestCounts = recent.map(m => m.requests?.total || 0);
    const avgTime = recent.map(m => m.performance?.avgExecutionTime || 0);

    return {
      available: true,
      requestRate: {
        current: requestCounts[requestCounts.length - 1] || 0,
        trend: this.calculateTrendDirection(requestCounts),
        change: this.calculateChangePercent(requestCounts)
      },
      performance: {
        current: avgTime[avgTime.length - 1] || 0,
        trend: this.calculateTrendDirection(avgTime),
        change: this.calculateChangePercent(avgTime)
      }
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
      client.ws.send(JSON.stringify(message));
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = 60000; // 60 seconds

    this.clients.forEach((client, clientId) => {
      if (now - client.lastActivity > timeout) {
        logger.info({ clientId }, 'Client timeout, closing connection');
        client.ws.close();
        this.clients.delete(clientId);
      } else {
        // Send ping
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public stop(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }
    
    this.clients.forEach((client) => {
      client.ws.close();
    });
    
    this.wss.close();
    logger.info('WebSocket server stopped');
  }

  public getStats(): any {
    return {
      connectedClients: this.clients.size,
      metricsHistorySize: this.metricsHistory.length,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }
}

// Auto-start if running directly
if (require.main === module) {
  const port = parseInt(process.env.WS_PORT || '8081');
  const server = new DashboardWebSocketServer(port);
  
  process.on('SIGINT', () => {
    logger.info('Shutting down WebSocket server');
    server.stop();
    process.exit(0);
  });
}

export default DashboardWebSocketServer;
