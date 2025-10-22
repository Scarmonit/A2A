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
