// A2A MCP Dashboard WebSocket Server
import WebSocket from 'ws';
import { EventEmitter } from 'events';
import express from 'express';
import { AnalyticsEngine } from './analytics-engine.js';
import logger from './logger.js';

interface DashboardClient {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  bufferedBytes: number;
}

interface MetricsSnapshot {
  timestamp: number;
  metrics: any;
}

export class DashboardServer extends EventEmitter {
  private wss: WebSocket.Server;
  private clients: Map<string, DashboardClient>;
  private broadcastInterval: NodeJS.Timeout | null;
  private heartbeatInterval: NodeJS.Timeout | null;
  private metricsHistory: MetricsSnapshot[];
  private maxHistorySize: number;
  private isPending: boolean;

  constructor(port: number = 8086) {
    super();
    this.wss = new WebSocket.Server({ port });
    this.clients = new Map();
    this.broadcastInterval = null;
    this.heartbeatInterval = null;
    this.metricsHistory = [];
    this.maxHistorySize = 100;
    this.isPending = false;

    this.setupWebSocketServer();
    this.startBroadcast();
    this.startHeartbeat();

    logger.info(`Dashboard WebSocket Server listening on port ${port}`);
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      const client: DashboardClient = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        bufferedBytes: 0,
      };

      this.clients.set(clientId, client);
      logger.info({ clientId }, 'Client connected to dashboard');

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (err) {
          logger.error({ err, clientId }, 'Failed to parse WebSocket message');
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        logger.info({ clientId }, 'Client disconnected from dashboard');
      });

      ws.on('error', (err) => {
        logger.error({ err, clientId }, 'WebSocket error');
      });

      // Send initial metrics
      this.sendMetrics(client);
    });

    this.wss.on('error', (err) => {
      logger.error({ err }, 'WebSocket Server error');
    });
  }

  private handleMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (message.type === 'subscribe') {
      const topics = Array.isArray(message.topics) ? message.topics : [message.topics];
      topics.forEach((topic: string) => client.subscriptions.add(topic));
      logger.debug({ clientId, topics }, 'Client subscribed to topics');
    } else if (message.type === 'unsubscribe') {
      const topics = Array.isArray(message.topics) ? message.topics : [message.topics];
      topics.forEach((topic: string) => client.subscriptions.delete(topic));
      logger.debug({ clientId, topics }, 'Client unsubscribed from topics');
    } else if (message.type === 'request_history') {
      this.sendHistory(client);
    }
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private startBroadcast(): void {
    this.broadcastInterval = setInterval(() => {
      this.broadcastMetrics();
    }, 5000); // Broadcast every 5 seconds
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      });
    }, 30000); // Heartbeat every 30 seconds
  }

  private async broadcastMetrics(): Promise<void> {
    if (this.isPending) return;

    this.isPending = true;
    try {
      const metrics = await AnalyticsEngine.getInstance().getSnapshot();
      const snapshot: MetricsSnapshot = {
        timestamp: Date.now(),
        metrics,
      };

      this.metricsHistory.push(snapshot);
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      this.clients.forEach((client) => {
        if (client.subscriptions.has('metrics') || client.subscriptions.size === 0) {
          this.sendMetrics(client, snapshot);
        }
      });
    } catch (err) {
      logger.error({ err }, 'Failed to broadcast metrics');
    } finally {
      this.isPending = false;
    }
  }

  private sendMetrics(client: DashboardClient, snapshot?: MetricsSnapshot): void {
    if (client.ws.readyState !== WebSocket.OPEN) return;

    const data = snapshot || (this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1] : null);
    if (!data) return;

    try {
      const message = JSON.stringify({
        type: 'metrics',
        data,
      });

      client.ws.send(message);
    } catch (err) {
      logger.error({ err, clientId: client.id }, 'Failed to send metrics');
    }
  }

  private sendHistory(client: DashboardClient): void {
    if (client.ws.readyState !== WebSocket.OPEN) return;

    try {
      const message = JSON.stringify({
        type: 'history',
        data: this.metricsHistory,
      });

      client.ws.send(message);
    } catch (err) {
      logger.error({ err, clientId: client.id }, 'Failed to send history');
    }
  }

  public close(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.clients.forEach((client) => {
      client.ws.close();
    });

    this.wss.close();
    logger.info('Dashboard WebSocket Server closed');
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }
}

export default DashboardServer;
