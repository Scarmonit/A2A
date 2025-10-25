/**
 * Test Environment Setup for Integration Tests
 * 
 * Provides reusable test infrastructure for setting up and tearing down
 * the complete monitoring and dashboard stack.
 */
import { EnhancedMCPManager } from '../../src/enhanced-mcp-manager.js';
import { RealtimeDashboardHandler } from '../../src/realtime-dashboard-handler.js';
import { mcpMonitor } from '../../src/mcp-monitor.js';
import { auditLogger } from '../../src/audit-logger.js';
import { aggregationCache } from '../../src/aggregation-cache.js';
import WebSocket from 'ws';

// Re-export for external use
export { aggregationCache, mcpMonitor, auditLogger };

export class TestEnvironment {
  mcpManager: EnhancedMCPManager;
  dashboardHandler: RealtimeDashboardHandler;
  wsClients: WebSocket[] = [];
  private port: number;

  constructor(port: number = 3000) {
    this.port = port;
    this.mcpManager = new EnhancedMCPManager();
    this.dashboardHandler = new RealtimeDashboardHandler({
      port: this.port,
      host: '127.0.0.1',
      updateIntervalMs: 5000,
      mcpManager: this.mcpManager,
    });
  }

  async setup(): Promise<void> {
    // Start dashboard WebSocket server
    this.dashboardHandler.startWebSocketServer(this.port, '127.0.0.1');
    // Start metrics broadcast
    this.dashboardHandler.startMetricsBroadcast();
    // Wait for initialization
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  async cleanup(): Promise<void> {
    // Close all WebSocket clients
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    this.wsClients = [];

    // Shutdown services
    await this.dashboardHandler.shutdown();
    await this.mcpManager.shutdown();

    // Clear test data
    auditLogger.clear();
    mcpMonitor.clearHistory(new Date(0)); // Clear all history
    aggregationCache.clearAll();

    // Give some time for cleanup
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  createWebSocketClient(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
      
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Connection timeout'));
      }, 5000);

      ws.on('open', () => {
        clearTimeout(timeout);
        this.wsClients.push(ws);
        resolve(ws);
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Wait for a specific number of messages from a WebSocket
   */
  waitForMessages(ws: WebSocket, count: number, timeoutMs: number = 20000): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const messages: any[] = [];
      const timeout = setTimeout(() => {
        resolve(messages); // Return what we have on timeout
      }, timeoutMs);

      const messageHandler = (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          messages.push(message);
          if (messages.length >= count) {
            clearTimeout(timeout);
            ws.off('message', messageHandler);
            resolve(messages);
          }
        } catch (error) {
          // Ignore parse errors
        }
      };

      ws.on('message', messageHandler);
    });
  }

  /**
   * Wait for at least one message from a WebSocket
   */
  waitForMessage(ws: WebSocket, timeoutMs: number = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message timeout'));
      }, timeoutMs);

      const messageHandler = (data: Buffer) => {
        clearTimeout(timeout);
        ws.off('message', messageHandler);
        try {
          resolve(JSON.parse(data.toString()));
        } catch (error) {
          reject(error);
        }
      };

      ws.on('message', messageHandler);
    });
  }
}
