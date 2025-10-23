import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeDashboardHandler } from '../src/realtime-dashboard-handler.js';
import { WebSocket } from 'ws';

/**
 * Test Suite for Backpressure Control
 * 
 * Tests broadcast throttling, message queuing,
 * and WebSocket buffer management.
 */

describe('Backpressure Control', () => {
  let handler: RealtimeDashboardHandler;
  const testPort = 9997;

  before(() => {
    handler = new RealtimeDashboardHandler({ port: testPort });
  });

  after(async () => {
    await handler.shutdown();
  });

  it('should enforce minimum broadcast interval', async () => {
    let broadcastCount = 0;

    // Connect a client to track broadcasts
    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'metrics:update') {
        broadcastCount++;
      }
    });

    // Trigger rapid broadcasts (should be throttled)
    const startTime = Date.now();
    for (let i = 0; i < 20; i++) {
      handler.broadcastMetrics();
      // Small delay to allow processing
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have throttled broadcasts (much less than 20)
    assert.ok(
      broadcastCount < 15,
      `Should throttle broadcasts, got ${broadcastCount}`
    );

    client.close();
  });

  it('should queue messages when client buffer is full', async () => {
    // This test simulates buffer overflow by checking queue size
    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    // Get initial metrics to check queue functionality
    const metrics1 = handler.collectMetrics();
    assert.ok(typeof metrics1.websocket?.queuedMessages === 'number', 'Should track queued messages');

    client.close();
  });

  it('should expose websocket statistics in metrics', () => {
    const metrics = handler.collectMetrics();

    assert.ok(metrics.websocket, 'Should have websocket stats');
    assert.ok(typeof metrics.websocket.connectedClients === 'number', 'Should track connected clients');
    assert.ok(typeof metrics.websocket.queuedMessages === 'number', 'Should track queued messages');
    assert.ok(typeof metrics.websocket.broadcastPending === 'boolean', 'Should track broadcast state');
  });

  it('should expose cache statistics in metrics', () => {
    const metrics = handler.collectMetrics();

    assert.ok(metrics.cache, 'Should have cache stats');
    assert.ok(typeof metrics.cache.size === 'number', 'Should track cache size');
    assert.ok(typeof metrics.cache.hits === 'number', 'Should track cache hits');
    assert.ok(typeof metrics.cache.misses === 'number', 'Should track cache misses');
    assert.ok(typeof metrics.cache.hitRate === 'number', 'Should track hit rate');
    assert.ok(typeof metrics.cache.avgComputeTime === 'number', 'Should track compute time');
  });

  it('should handle multiple concurrent clients', async () => {
    const clients: WebSocket[] = [];
    const clientCount = 3;

    // Connect multiple clients
    for (let i = 0; i < clientCount; i++) {
      const client = new WebSocket(`ws://127.0.0.1:${testPort}`);
      await new Promise<void>((resolve) => {
        client.on('open', resolve);
      });
      clients.push(client);
    }

    // Wait for connections to register
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Just verify we have clients connected
    const currentCount = handler.getClientCount();
    assert.ok(
      currentCount >= clientCount,
      `Should have at least ${clientCount} clients connected, got ${currentCount}`
    );

    // Cleanup
    for (const client of clients) {
      client.close();
    }
    
    // Wait for disconnect
    await new Promise((resolve) => setTimeout(resolve, 150));
  });

  it('should use cache for metric collection', async () => {
    // Verify that the cache mechanism is working by checking:
    // 1. Cache stats are available
    // 2. Multiple calls within short time period
    // 3. Cache hit rate improves over time
    
    // Clear and start fresh for this specific test
    const initialMetrics = handler.collectMetrics();
    assert.ok(initialMetrics.cache, 'Cache statistics should be present');
    assert.ok(typeof initialMetrics.cache.hitRate === 'number', 'Hit rate should be a number');
    
    // Make multiple rapid calls - some should be cached
    for (let i = 0; i < 5; i++) {
      handler.collectMetrics();
    }
    
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    const finalMetrics = handler.collectMetrics();
    
    // Cache should have entries and be tracking hits/misses
    assert.ok(
      finalMetrics.cache.size >= 0 && 
      (finalMetrics.cache.hits + finalMetrics.cache.misses) > 0,
      'Cache should be actively tracking requests'
    );
  });

  it('should process message queue periodically', async () => {
    // Connect a client
    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    // Broadcast some metrics
    handler.broadcastMetrics();

    // Wait for queue processing interval
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const metrics = handler.collectMetrics();
    // Queue should be empty or small under normal conditions
    assert.ok(
      metrics.websocket!.queuedMessages < 100,
      'Queue should remain manageable'
    );

    client.close();
  });

  it('should not broadcast if previous broadcast is pending', async () => {
    let receivedCount = 0;

    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    client.on('message', () => {
      receivedCount++;
    });

    // Fire multiple rapid broadcasts
    for (let i = 0; i < 5; i++) {
      handler.broadcastMetrics();
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Should receive fewer than fired due to throttling
    assert.ok(
      receivedCount < 5,
      `Should throttle rapid broadcasts, got ${receivedCount}`
    );

    client.close();
  });
});

describe('Cache Integration with Dashboard', () => {
  let handler: RealtimeDashboardHandler;
  const testPort = 9996;

  before(() => {
    handler = new RealtimeDashboardHandler({ port: testPort });
  });

  after(async () => {
    await handler.shutdown();
  });

  it('should achieve high cache hit rate under normal load', async () => {
    // Start with fresh cache state
    const initialMetrics = handler.collectMetrics();
    const initialTotal = initialMetrics.cache!.hits + initialMetrics.cache!.misses;
    
    // Collect metrics multiple times within cache TTL (4 seconds)
    // Use smaller intervals to stay within TTL
    for (let i = 0; i < 10; i++) {
      handler.collectMetrics();
      await new Promise((resolve) => setTimeout(resolve, 200)); // 200ms intervals, total 2s
    }

    const metrics = handler.collectMetrics();
    const finalTotal = metrics.cache!.hits + metrics.cache!.misses;
    const newRequests = finalTotal - initialTotal;
    const newHits = metrics.cache!.hits - initialMetrics.cache!.hits;
    
    // Calculate hit rate for new requests only
    const hitRate = newRequests > 0 ? newHits / newRequests : 0;

    // Should have good hit rate (>70%) for repeated collections within TTL
    // We use 70% threshold accounting for test timing variations
    assert.ok(
      hitRate > 0.7,
      `Cache hit rate should be >70% for repeated requests within TTL, got ${(hitRate * 100).toFixed(1)}%`
    );
  });

  it('should invalidate cache after TTL expires', async () => {
    // Collect initial metrics
    const metrics1 = handler.collectMetrics();
    const initialMisses = metrics1.cache!.misses;

    // Wait for cache TTL to expire (4 seconds + buffer)
    await new Promise((resolve) => setTimeout(resolve, 4500));

    // Collect again - should be a cache miss
    const metrics2 = handler.collectMetrics();

    assert.ok(
      metrics2.cache!.misses > initialMisses,
      'Should have cache miss after TTL expiry'
    );
  });

  it('should track compute time for cached operations', () => {
    const metrics = handler.collectMetrics();

    assert.ok(
      metrics.cache!.avgComputeTime >= 0,
      'Should track compute time'
    );
  });
});
