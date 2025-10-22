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
        logger.error({ err, clientId }, 'WebSocket client error');
      });

      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        timestamp: Date.now(),
      }));
    });
  }

  private handleMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe':
        if (message.channel) {
          client.subscriptions.add(message.channel);
          logger.debug({ clientId, channel: message.channel }, 'Client subscribed to channel');
        }
        break;
      case 'unsubscribe':
        if (message.channel) {
          client.subscriptions.delete(message.channel);
          logger.debug({ clientId, channel: message.channel }, 'Client unsubscribed from channel');
        }
        break;
      case 'getHistory':
        client.ws.send(JSON.stringify({
          type: 'history',
          data: this.metricsHistory,
          timestamp: Date.now(),
        }));
        break;
    }
  }

  private startBroadcast(): void {
    this.broadcastInterval = setInterval(() => {
      this.broadcastMetrics();
    }, 5000);
    logger.info('Dashboard metrics broadcast started');
  }

  private stopBroadcast(): void {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
      logger.info('Dashboard metrics broadcast stopped');
    }
  }

  private async broadcastMetrics(): Promise<void> {
    if (this.isPending || this.clients.size === 0) return;
    
    try {
      this.isPending = true;
      const analytics = new AnalyticsEngine();
      const metricsString = await analytics.getMetrics();
      const timestamp = Date.now();

      this.metricsHistory.push({ timestamp, metrics: metricsString });
      if (this.metricsHistory.length > this.maxHistorySize) {
        this.metricsHistory.shift();
      }

      const payload = JSON.stringify({
        type: 'metrics',
        timestamp,
        data: metricsString,
      });

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
    }, 30000);
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
