/**
 * Dashboard WebSocket Integration Tests
 * 
 * Tests real-time metrics updates via WebSocket connections
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnvironment } from './setup.js';
import WebSocket from 'ws';

describe('Dashboard WebSocket Integration', () => {
  const env = new TestEnvironment(3001);

  before(async () => {
    await env.setup();
  });

  after(async () => {
    await env.cleanup();
  });

  it('should receive real-time metrics updates', async () => {
    const ws = await env.createWebSocketClient();
    
    // Collect metrics for 15 seconds (3 updates at 5-second intervals)
    const metrics = await env.waitForMessages(ws, 3, 16000);

    assert.ok(metrics.length >= 2, `Should receive at least 2 metric updates (got ${metrics.length})`);
    assert.ok(metrics[0].timestamp, 'Metrics should have timestamp');
    
    // Check for expected structure
    const firstMetric = metrics[0];
    if (firstMetric.type === 'metrics:update' && firstMetric.data) {
      assert.ok(firstMetric.data.agents, 'Metrics should have agents data');
      assert.ok(firstMetric.data.performance, 'Metrics should have performance data');
    }
  });

  it('should handle multiple concurrent connections', async () => {
    const connectionCount = 50;
    const clients: WebSocket[] = [];
    
    // Create connections
    for (let i = 0; i < connectionCount; i++) {
      try {
        const client = await env.createWebSocketClient();
        clients.push(client);
      } catch (error) {
        // Some connections may fail under load, which is acceptable
      }
    }

    assert.ok(
      clients.length >= connectionCount * 0.9,
      `Should establish at least 90% of connections (got ${clients.length}/${connectionCount})`
    );

    // Verify all clients receive updates
    const receivedUpdates = await Promise.all(
      clients.map((ws) =>
        env.waitForMessage(ws, 10000)
          .then(() => true)
          .catch(() => false)
      )
    );

    const successCount = receivedUpdates.filter((r) => r === true).length;
    assert.ok(
      successCount >= clients.length * 0.9,
      `At least 90% of clients should receive updates (got ${successCount}/${clients.length})`
    );
  });

  it('should handle client disconnection gracefully', async () => {
    const ws1 = await env.createWebSocketClient();
    const ws2 = await env.createWebSocketClient();

    // Wait for initial connection
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Close first client
    ws1.close();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Second client should still receive updates
    const received = await env.waitForMessage(ws2, 10000)
      .then(() => true)
      .catch(() => false);

    assert.strictEqual(received, true, 'Remaining client should still receive updates');
  });

  it('should support request_metrics message type', async () => {
    const ws = await env.createWebSocketClient();
    
    // Wait for connection to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Request metrics explicitly
    ws.send(JSON.stringify({ type: 'request_metrics' }));

    // Should receive a metrics update
    const message = await env.waitForMessage(ws, 5000);
    
    assert.ok(message, 'Should receive response to request_metrics');
    assert.ok(
      message.type === 'metrics:update' || message.timestamp,
      'Response should be a metrics update'
    );
  });

  it('should maintain connection state properly', async () => {
    const initialCount = env.dashboardHandler.getClientCount();
    
    const ws = await env.createWebSocketClient();
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const afterConnectCount = env.dashboardHandler.getClientCount();
    assert.ok(afterConnectCount > initialCount, 'Client count should increase after connection');

    ws.close();
    await new Promise((resolve) => setTimeout(resolve, 500));

    const afterDisconnectCount = env.dashboardHandler.getClientCount();
    assert.ok(afterDisconnectCount < afterConnectCount, 'Client count should decrease after disconnection');
  });
});
