import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';

/**
 * WebSocket server for handling real-time metrics and agent communication
 */
export class WebSocketMetricsServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket>;
  private metricsInterval: NodeJS.Timeout | null = null;
  private lastMetrics: any = {};

  constructor(port: number = 8080) {
    // Create HTTP server
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('WebSocket Metrics Server Running');
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ server });
    this.clients = new Set();

    // Setup connection handler
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');
      this.clients.add(ws);

      // Send initial metrics
      if (Object.keys(this.lastMetrics).length > 0) {
        ws.send(JSON.stringify(this.lastMetrics));
      }

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(ws, data);
        } catch (err: unknown) {
          console.error('Error parsing message:', err);
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          ws.send(JSON.stringify({ error: 'Invalid message format', details: errorMessage }));
        }
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (err: Error) => {
        console.error('WebSocket error:', err);
        this.clients.delete(ws);
      });
    });

    // Start HTTP server
    server.listen(port, () => {
      console.log(`WebSocket Metrics Server listening on port ${port}`);
    });

    // Start metrics collection
    this.startMetricsCollection();
  }

  private handleMessage(ws: WebSocket, data: any): void {
    if (data.type === 'subscribe') {
      ws.send(JSON.stringify({ type: 'subscribed', timestamp: Date.now() }));
    } else if (data.type === 'unsubscribe') {
      ws.send(JSON.stringify({ type: 'unsubscribed', timestamp: Date.now() }));
    }
  }

  private startMetricsCollection(): void {
    // Send metrics every 5 seconds
    this.metricsInterval = setInterval(() => {
      const metrics = this.collectMetrics();
      this.lastMetrics = metrics;
      this.broadcastMetrics(metrics);
    }, 5000);
  }

  private collectMetrics(): any {
    return {
      timestamp: Date.now(),
      clients: this.clients.size,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  private broadcastMetrics(metrics: any): void {
    const message = JSON.stringify(metrics);
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  public stop(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    this.wss.close();
    console.log('WebSocket Metrics Server stopped');
  }
}

// Export a factory function to create the server
export function createMetricsServer(port?: number): WebSocketMetricsServer {
  return new WebSocketMetricsServer(port);
}
