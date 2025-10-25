import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { TestEnvironment } from '../helpers/test-environment.js';
import { AuditLogger } from '../../src/audit-logger.js';
import { MCPServerMonitor } from '../../src/mcp-monitor.js';
import { AggregationCache } from '../../src/aggregation-cache.js';

describe('E2E Monitoring and Observability', () => {
  let env: TestEnvironment;
  let auditLogger: AuditLogger;
  let mcpMonitor: MCPServerMonitor;
  let aggregationCache: AggregationCache<any>;

  before(async () => {
    env = new TestEnvironment();
    await env.setup();

    auditLogger = (env as any).context.auditLogger;
    mcpMonitor = (env as any).context.mcpMonitor;
    aggregationCache = (env as any).context.aggregationCache;
  });

  after(async () => {
    await env.cleanup();
  });

  it('should integrate all monitoring components', async () => {
    const ws = await env.createWebSocketClient();

    // Generate some activity
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
    mcpMonitor.clearHistory();
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

  it('should provide accurate cache statistics', async () => {
    aggregationCache.clear();

    // Add some cache entries
    for (let i = 0; i < 10; i++) {
      aggregationCache.set(`test-key-${i}`, { data: i });
    }

    // Access some entries (creates hits)
    for (let i = 0; i < 5; i++) {
      aggregationCache.get(`test-key-${i}`);
    }

    // Access non-existent entries (creates misses)
    for (let i = 10; i < 15; i++) {
      aggregationCache.get(`test-key-${i}`);
    }

    const stats = aggregationCache.getStats();
    assert.ok(stats.size === 10, `Cache should have 10 entries, got ${stats.size}`);
    assert.ok(stats.hitCount >= 5, `Should have at least 5 hits, got ${stats.hitCount}`);
    assert.ok(stats.missCount >= 5, `Should have at least 5 misses, got ${stats.missCount}`);
    assert.ok(stats.hitRate >= 0 && stats.hitRate <= 1, 'Hit rate should be between 0 and 1');
    assert.ok(typeof stats.memoryUsage === 'number', 'Should report memory usage');
  });

  it('should handle server monitoring metrics', async () => {
    mcpMonitor.clearHistory();

    // Track some server calls
    for (let i = 0; i < 5; i++) {
      mcpMonitor.trackServerCall({
        serverId: 'test-server',
        method: 'testMethod',
        duration: 50 + i * 10,
        success: i < 4, // One failure
      });
    }

    const metrics = mcpMonitor.getMetrics();
    assert.ok(metrics['test-server'], 'Should have metrics for test-server');

    const serverMetrics = metrics['test-server'];
    assert.ok(serverMetrics.totalCalls === 5, `Should have 5 total calls, got ${serverMetrics.totalCalls}`);
    assert.ok(serverMetrics.successfulCalls === 4, `Should have 4 successful calls, got ${serverMetrics.successfulCalls}`);
    assert.ok(serverMetrics.failedCalls === 1, `Should have 1 failed call, got ${serverMetrics.failedCalls}`);
  });
});
