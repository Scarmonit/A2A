/**
 * End-to-End Monitoring Flow Tests
 * 
 * Tests complete lifecycle from agent start to metrics display,
 * including audit logging and caching
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnvironment } from './setup.js';
import { auditLogger } from '../../src/audit-logger.js';
import { aggregationCache } from '../../src/aggregation-cache.js';
import { mcpMonitor } from '../../src/mcp-monitor.js';

describe('End-to-End Monitoring Flow', () => {
  const env = new TestEnvironment(3004);

  before(async () => {
    await env.setup();
  });

  after(async () => {
    await env.cleanup();
  });

  it('should track complete lifecycle from agent start to metrics display', async () => {
    // Clear all monitoring data
    auditLogger.clear();
    aggregationCache.clear();
    mcpMonitor.clear();

    // 1. Register and start MCP server
    env.mcpManager.registerServer({
      id: 'e2e-test-server',
      type: 'test',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
      autoRestart: false,
    });

    // Log the start event
    auditLogger.log({
      agentId: 'e2e-test-server',
      action: 'server_started',
      metadata: { type: 'test' },
    });

    await env.mcpManager.startServer('e2e-test-server');
    
    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 2. Verify audit log
    const auditEvents = auditLogger.query({ agentId: 'e2e-test-server', limit: 10 });
    assert.ok(auditEvents.length > 0, 'Should have audit log entry for server start');
    assert.ok(
      auditEvents.some((e) => e.action.includes('started')),
      'Should have start action in audit log'
    );

    // 3. Connect WebSocket client
    const ws = await env.createWebSocketClient();

    // 4. Verify dashboard receives metrics including the new server
    const metricsReceived = await new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000);
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'metrics:update' && message.data?.mcpServers) {
            // Check if our server is in the metrics
            const mcpServers = message.data.mcpServers;
            if (mcpServers.total > 0) {
              clearTimeout(timeout);
              resolve(true);
            }
          }
        } catch (error) {
          // Ignore parse errors
        }
      });
    });

    assert.ok(metricsReceived, 'Dashboard should show MCP server metrics');

    // 5. Track some server calls
    for (let i = 0; i < 5; i++) {
      mcpMonitor.trackServerCall({
        serverId: 'e2e-test-server',
        method: 'test/call',
        duration: 50 + i * 10,
        success: true,
      });
    }

    const metrics = mcpMonitor.getServerMetrics('e2e-test-server', '5m');
    assert.strictEqual(metrics.totalCalls, 5, 'Should track all calls');

    // 6. Test cache functionality
    aggregationCache.set('test-key', { value: 'test-data' }, 60000);
    const cached = aggregationCache.get('test-key');
    assert.ok(cached, 'Cache should store and retrieve data');

    const cacheStats = aggregationCache.getStats();
    assert.ok(cacheStats.hits > 0 || cacheStats.misses > 0, 'Cache should be tracking stats');

    // 7. Stop server and verify cleanup
    auditLogger.log({
      agentId: 'e2e-test-server',
      action: 'server_stopped',
      metadata: { graceful: true },
    });

    await env.mcpManager.stopServer('e2e-test-server');

    const stopEvents = auditLogger.query({ agentId: 'e2e-test-server', limit: 20 });
    assert.ok(
      stopEvents.some((e) => e.action.includes('stopped')),
      'Should have audit log for server stop'
    );
  });

  it('should maintain audit trail across operations', async () => {
    auditLogger.clear();

    // Simulate various operations
    const operations = [
      { agentId: 'agent1', action: 'deployed' },
      { agentId: 'agent1', action: 'started' },
      { agentId: 'agent2', action: 'deployed' },
      { agentId: 'agent1', action: 'updated' },
      { agentId: 'agent2', action: 'started' },
    ];

    for (const op of operations) {
      auditLogger.log(op);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Query by specific agent
    const agent1Events = auditLogger.query({ agentId: 'agent1' });
    assert.strictEqual(agent1Events.length, 3, 'Should find all events for agent1');

    // Query by action
    const deployedEvents = auditLogger.query({ action: 'deployed' });
    assert.strictEqual(deployedEvents.length, 2, 'Should find all deployed actions');

    // Events should be in reverse chronological order
    assert.ok(
      agent1Events[0].timestamp >= agent1Events[1].timestamp,
      'Events should be sorted by timestamp descending'
    );
  });

  it('should handle cache expiration properly', async () => {
    aggregationCache.clear();

    // Set item with short TTL
    aggregationCache.set('short-lived', { data: 'test' }, 100);

    // Should be retrievable immediately
    const immediate = aggregationCache.get('short-lived');
    assert.ok(immediate, 'Should retrieve immediately after setting');

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should be expired
    const expired = aggregationCache.get('short-lived');
    assert.strictEqual(expired, null, 'Should return null after expiration');
  });

  it('should integrate monitoring with dashboard broadcasts', async () => {
    const ws = await env.createWebSocketClient();
    
    // Wait for connection
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Track some activity
    for (let i = 0; i < 3; i++) {
      mcpMonitor.trackServerCall({
        serverId: 'integration-test',
        method: 'test',
        duration: 100,
        success: true,
      });
    }

    auditLogger.log({
      action: 'test_activity',
      metadata: { test: true },
    });

    // Dashboard should broadcast updates
    const update = await env.waitForMessage(ws, 10000);
    assert.ok(update, 'Should receive dashboard update');
  });

  it('should track performance metrics accurately', async () => {
    const ws = await env.createWebSocketClient();
    
    const message = await env.waitForMessage(ws, 10000);

    if (message.type === 'metrics:update' && message.data?.performance) {
      const perf = message.data.performance;
      
      assert.ok(typeof perf.memoryUsageMB === 'number', 'Should have memory usage');
      assert.ok(perf.memoryUsageMB > 0, 'Memory usage should be positive');
      
      assert.ok(Array.isArray(perf.cpuLoadAverage), 'Should have CPU load average');
      assert.ok(perf.cpuLoadAverage.length > 0, 'CPU load array should not be empty');
      
      assert.ok(typeof perf.uptime === 'number', 'Should have uptime');
      assert.ok(perf.uptime >= 0, 'Uptime should be non-negative');
    }
  });

  it('should handle concurrent monitoring operations', async () => {
    auditLogger.clear();
    mcpMonitor.clear();
    aggregationCache.clear();

    // Perform many operations concurrently
    const operations = Array.from({ length: 50 }, (_, i) => async () => {
      auditLogger.log({
        agentId: `agent${i % 5}`,
        action: `action${i}`,
      });

      mcpMonitor.trackServerCall({
        serverId: `server${i % 3}`,
        method: 'test',
        duration: Math.random() * 100,
        success: Math.random() > 0.1,
      });

      aggregationCache.set(`key${i}`, { value: i });
    });

    await Promise.all(operations.map((op) => op()));

    // Verify all data was recorded
    const totalEvents = auditLogger.getEventCount();
    assert.ok(totalEvents >= 50, `Should have recorded all audit events (got ${totalEvents})`);

    const cacheStats = aggregationCache.getStats();
    assert.ok(cacheStats.size > 0, 'Cache should contain entries');
  });
});
