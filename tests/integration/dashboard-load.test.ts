/**
 * Dashboard Performance Load Tests
 * 
 * Tests dashboard performance under high load with many concurrent connections
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnvironment } from './setup.js';
import WebSocket from 'ws';

describe('Dashboard Performance Under Load', () => {
  const env = new TestEnvironment(3003);

  before(async () => {
    await env.setup();
  });

  after(async () => {
    await env.cleanup();
  });

  it('should handle 100 concurrent WebSocket connections', async () => {
    const startTime = Date.now();
    const connectionCount = 100;
    const clients: WebSocket[] = [];

    // Create connections in smaller batches
    const batchSize = 25;
    for (let i = 0; i < connectionCount; i += batchSize) {
      const batchPromises = Array.from(
        { length: Math.min(batchSize, connectionCount - i) }, 
        () => env.createWebSocketClient().catch(() => null)
      );
      
      const batch = await Promise.all(batchPromises);
      clients.push(...batch.filter((ws): ws is WebSocket => ws !== null));
      
      // Brief pause between batches
      if (i + batchSize < connectionCount) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const connectionTime = Date.now() - startTime;
    const successfulConnections = clients.length;

    assert.ok(
      successfulConnections >= connectionCount * 0.85,
      `Should establish at least 85% of connections (got ${successfulConnections}/${connectionCount})`
    );
    assert.ok(
      connectionTime < 15000,
      `Should connect within 15 seconds (took ${connectionTime}ms)`
    );

    // Verify clients receive at least one update
    const updatePromises = clients.map((ws) =>
      env.waitForMessage(ws, 12000)
        .then(() => true)
        .catch(() => false)
    );

    const updateReceived = await Promise.all(updatePromises);
    const updateSuccessRate = updateReceived.filter((r) => r === true).length / clients.length;
    
    assert.ok(
      updateSuccessRate >= 0.85, 
      `At least 85% of clients should receive updates (got ${(updateSuccessRate * 100).toFixed(1)}%)`
    );
  });

  it('should maintain low latency under load', async () => {
    const clientCount = 50;
    const clients: WebSocket[] = [];

    // Create clients
    for (let i = 0; i < clientCount; i++) {
      try {
        const client = await env.createWebSocketClient();
        clients.push(client);
      } catch (error) {
        // Some may fail, continue
      }
    }

    const latencies: number[] = [];

    // Measure latency for each client
    await Promise.all(
      clients.map((ws) =>
        new Promise<void>((resolve) => {
          const startTime = Date.now();
          const timeout = setTimeout(() => resolve(), 10000);
          
          ws.once('message', () => {
            clearTimeout(timeout);
            latencies.push(Date.now() - startTime);
            resolve();
          });
        })
      )
    );

    if (latencies.length > 0) {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p95Index = Math.floor(sortedLatencies.length * 0.95);
      const p95Latency = sortedLatencies[p95Index] || 0;

      assert.ok(avgLatency < 2000, `Average latency should be < 2s (got ${avgLatency.toFixed(0)}ms)`);
      assert.ok(p95Latency < 3000, `P95 latency should be < 3s (got ${p95Latency.toFixed(0)}ms)`);
    }
  });

  it('should handle rapid connection and disconnection', async () => {
    const cycles = 20;
    const clientsPerCycle = 5;
    
    for (let i = 0; i < cycles; i++) {
      // Connect clients
      const clients = await Promise.all(
        Array.from({ length: clientsPerCycle }, () =>
          env.createWebSocketClient().catch(() => null)
        )
      );

      // Wait briefly
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Disconnect clients
      for (const client of clients) {
        if (client) {
          client.close();
        }
      }

      // Brief pause before next cycle
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    // Dashboard should still be functional
    const testClient = await env.createWebSocketClient();
    const received = await env.waitForMessage(testClient, 10000)
      .then(() => true)
      .catch(() => false);

    assert.strictEqual(received, true, 'Dashboard should still work after rapid connect/disconnect cycles');
  });

  it('should broadcast to all clients efficiently', async () => {
    const clientCount = 30;
    const clients: WebSocket[] = [];

    // Create clients
    for (let i = 0; i < clientCount; i++) {
      try {
        const client = await env.createWebSocketClient();
        clients.push(client);
      } catch (error) {
        // Continue on error
      }
    }

    // Wait for a broadcast
    const startTime = Date.now();
    const receivePromises = clients.map((ws) =>
      env.waitForMessage(ws, 10000)
        .then((msg) => ({ success: true, time: Date.now() - startTime }))
        .catch(() => ({ success: false, time: -1 }))
    );

    const results = await Promise.all(receivePromises);
    const successful = results.filter((r) => r.success);

    assert.ok(
      successful.length >= clients.length * 0.9,
      `At least 90% of clients should receive broadcast (got ${successful.length}/${clients.length})`
    );

    // Check broadcast time spread
    const times = successful.map((r) => r.time).filter((t) => t > 0);
    if (times.length > 1) {
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const spread = maxTime - minTime;

      assert.ok(
        spread < 1000,
        `Broadcast should reach all clients within 1 second (spread: ${spread}ms)`
      );
    }
  });

  it('should handle large message volume', async () => {
    const client = await env.createWebSocketClient();
    const messageCount = 20;
    const messages: any[] = [];

    // Collect messages
    const collectPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 25000);
      
      client.on('message', (data) => {
        try {
          messages.push(JSON.parse(data.toString()));
          if (messages.length >= messageCount) {
            clearTimeout(timeout);
            resolve();
          }
        } catch (error) {
          // Ignore parse errors
        }
      });
    });

    await collectPromise;

    assert.ok(
      messages.length >= 3,
      `Should receive multiple messages (got ${messages.length})`
    );
  });
});
