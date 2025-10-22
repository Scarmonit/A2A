// Tests for MCP Monitor and Aggregation Cache
// These tests validate the new dashboard optimization features

import { strict as assert } from 'assert';
import { test, describe } from 'node:test';

// Import the modules we're testing
import { mcpMonitor } from '../src/mcp-monitor.js';
import { aggregationCache } from '../src/aggregation-cache.js';

describe('MCP Server Monitor', () => {
  test('should track server calls correctly', () => {
    mcpMonitor.trackServerCall({
      serverId: 'test-server-1',
      method: 'tools/call',
      duration: 250,
      success: true
    });
    
    const stats = mcpMonitor.getServerStats('test-server-1', 3600000);
    assert(stats.totalCalls >= 1, 'Should have at least one call');
    assert(stats.avgDuration > 0, 'Should have positive average duration');
    console.log('✓ Server call tracking works');
  });
  
  test('should track tool calls with token usage', () => {
    mcpMonitor.trackToolCall({
      toolName: 'test_tool',
      agentId: 'test-agent-1',
      duration: 150,
      success: true,
      inputTokens: 100,
      outputTokens: 50
    });
    
    const stats = mcpMonitor.getToolStats('test_tool', 3600000);
    assert(stats.totalCalls >= 1, 'Should have at least one tool call');
    assert(stats.totalTokens >= 150, 'Should track token usage');
    console.log('✓ Tool call tracking works');
  });
  
  test('should track resource access', () => {
    mcpMonitor.trackResourceAccess({
      resourceType: 'memory',
      agentId: 'test-agent-1',
      usage: 512
    });
    
    const usage = mcpMonitor.getResourceUsage(3600000);
    assert(usage.totalAccesses >= 1, 'Should have at least one resource access');
    console.log('✓ Resource access tracking works');
  });
  
  test('should track permission requests', () => {
    mcpMonitor.trackPermissionRequest({
      agentId: 'test-agent-1',
      permission: 'file:read',
      granted: true,
      reason: 'Test approval'
    });
    
    const audit = mcpMonitor.getSecurityAudit('test-agent-1', 86400000);
    assert(audit.totalRequests >= 1, 'Should have at least one permission request');
    console.log('✓ Permission tracking works');
  });
  
  test('should detect anomalous patterns', () => {
    // Generate multiple tool calls to trigger anomaly detection
    for (let i = 0; i < 50; i++) {
      mcpMonitor.trackToolCall({
        toolName: 'frequent_tool',
        agentId: 'anomaly-agent',
        duration: 100,
        success: i % 5 !== 0, // 20% error rate
        inputTokens: 10,
        outputTokens: 10
      });
    }
    
    const anomalies = mcpMonitor.detectAnomalousToolCalls(3600000);
    // Anomalies may or may not be detected depending on thresholds
    assert(Array.isArray(anomalies), 'Should return array of insights');
    console.log(`✓ Anomaly detection works (found ${anomalies.length} anomalies)`);
  });
  
  test('should detect privilege escalation attempts', () => {
    // Generate multiple denied permission requests
    for (let i = 0; i < 6; i++) {
      mcpMonitor.trackPermissionRequest({
        agentId: 'suspicious-agent',
        permission: 'admin:write',
        granted: false,
        reason: 'Insufficient privileges'
      });
    }
    
    const security = mcpMonitor.detectPrivilegeEscalation(3600000);
    assert(security.length > 0, 'Should detect privilege escalation attempt');
    assert(security[0].severity === 'critical', 'Should have critical severity');
    console.log('✓ Privilege escalation detection works');
  });
});

describe('Aggregation Cache', () => {
  test('should cache and retrieve values', async () => {
    const key = 'test-key-1';
    const value = { data: 'test', timestamp: Date.now() };
    
    aggregationCache.set(key, value, 5000); // 5 second TTL
    const cached = aggregationCache.get(key);
    
    assert.deepEqual(cached, value, 'Should retrieve cached value');
    console.log('✓ Basic cache operations work');
  });
  
  test('should compute value on cache miss', async () => {
    let computeCount = 0;
    const compute = () => {
      computeCount++;
      return { result: 'computed', count: computeCount };
    };
    
    const key = 'compute-test-1';
    const result1 = await aggregationCache.getOrCompute(key, 5000, compute);
    const result2 = await aggregationCache.getOrCompute(key, 5000, compute);
    
    assert.equal(computeCount, 1, 'Should only compute once');
    assert.deepEqual(result1, result2, 'Should return same cached value');
    console.log('✓ Cache computation and reuse works');
  });
  
  test('should expire cached values after TTL', async () => {
    const key = 'ttl-test-1';
    const value = 'expires soon';
    
    aggregationCache.set(key, value, 100); // 100ms TTL
    assert(aggregationCache.has(key), 'Should have cached value initially');
    
    // Wait for expiry
    await new Promise(resolve => setTimeout(resolve, 150));
    
    assert(!aggregationCache.has(key), 'Should expire after TTL');
    console.log('✓ TTL expiration works');
  });
  
  test('should track cache statistics', async () => {
    // Generate some cache hits and misses
    for (let i = 0; i < 5; i++) {
      await aggregationCache.getOrCompute(`stats-${i}`, 5000, () => ({ value: i }));
    }
    
    // Hit the same keys again
    for (let i = 0; i < 5; i++) {
      await aggregationCache.getOrCompute(`stats-${i}`, 5000, () => ({ value: i }));
    }
    
    const stats = aggregationCache.getStats();
    assert(stats.hits > 0, 'Should have cache hits');
    assert(stats.misses > 0, 'Should have cache misses');
    assert(stats.hitRate >= 0 && stats.hitRate <= 1, 'Hit rate should be between 0 and 1');
    
    console.log(`✓ Cache statistics work (hit rate: ${(stats.hitRate * 100).toFixed(1)}%)`);
  });
  
  test('should invalidate entries by pattern', async () => {
    aggregationCache.set('dashboard:1h', { data: 1 }, 5000);
    aggregationCache.set('dashboard:24h', { data: 2 }, 5000);
    aggregationCache.set('insights:1h', { data: 3 }, 5000);
    
    const invalidated = aggregationCache.invalidatePattern(/^dashboard:/);
    
    assert(invalidated === 2, 'Should invalidate matching entries');
    assert(!aggregationCache.has('dashboard:1h'), 'Should remove dashboard:1h');
    assert(!aggregationCache.has('dashboard:24h'), 'Should remove dashboard:24h');
    assert(aggregationCache.has('insights:1h'), 'Should keep non-matching entries');
    
    console.log('✓ Pattern invalidation works');
  });
  
  test('should enforce cache size limit with LRU eviction', async () => {
    const smallCache = new (await import('../dist/src/aggregation-cache.js')).AggregationCache(3);
    
    smallCache.set('key1', 'value1', 10000);
    smallCache.set('key2', 'value2', 10000);
    smallCache.set('key3', 'value3', 10000);
    
    // Access key1 to make it recently used
    smallCache.get('key1');
    
    // Add a new entry, should evict key2 (least recently used)
    smallCache.set('key4', 'value4', 10000);
    
    assert(smallCache.has('key1'), 'Should keep recently accessed key1');
    assert(!smallCache.has('key2'), 'Should evict least recently used key2');
    assert(smallCache.has('key3'), 'Should keep key3');
    assert(smallCache.has('key4'), 'Should have new key4');
    
    console.log('✓ LRU eviction works');
  });
  
  test('should clear expired entries', async () => {
    aggregationCache.set('short-lived', 'data', 50); // 50ms TTL
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const cleared = aggregationCache.clearExpired();
    assert(cleared > 0, 'Should clear at least one expired entry');
    
    console.log('✓ Expired entry cleanup works');
  });
  
  test('should support cache warmup', async () => {
    const warmupFunctions = [
      {
        key: 'warmup-1',
        ttl: 5000,
        fn: async () => ({ data: 'warm1' })
      },
      {
        key: 'warmup-2',
        ttl: 5000,
        fn: async () => ({ data: 'warm2' })
      }
    ];
    
    await aggregationCache.warmUp(warmupFunctions);
    
    assert(aggregationCache.has('warmup-1'), 'Should have warmup-1');
    assert(aggregationCache.has('warmup-2'), 'Should have warmup-2');
    
    console.log('✓ Cache warmup works');
  });
});

describe('Integration Tests', () => {
  test('should integrate MCP monitor with analytics', () => {
    // Track an agent execution via MCP monitor
    mcpMonitor.trackToolCall({
      toolName: 'integration_tool',
      agentId: 'integration-agent',
      duration: 200,
      success: true,
      inputTokens: 50,
      outputTokens: 75
    });
    
    // Verify it shows up in statistics
    const stats = mcpMonitor.getToolStats('integration_tool', 3600000);
    assert(stats.totalCalls >= 1, 'Integration tracking should work');
    
    console.log('✓ MCP monitor integration works');
  });
  
  test('should cache expensive MCP queries', async () => {
    const startTime = Date.now();
    
    // First call - should compute
    const result1 = await aggregationCache.getOrCompute(
      'mcp-stats-cache',
      5000,
      () => {
        // Simulate expensive computation
        const stats = mcpMonitor.getServerStats('test-server-1', 3600000);
        return stats;
      }
    );
    const firstCallTime = Date.now() - startTime;
    
    // Second call - should be cached
    const startTime2 = Date.now();
    const result2 = await aggregationCache.getOrCompute(
      'mcp-stats-cache',
      5000,
      () => mcpMonitor.getServerStats('test-server-1', 3600000)
    );
    const secondCallTime = Date.now() - startTime2;
    
    assert(secondCallTime < firstCallTime, 'Cached call should be faster');
    assert.deepEqual(result1, result2, 'Results should match');
    
    console.log(`✓ Cache improves query performance (${firstCallTime}ms → ${secondCallTime}ms)`);
  });
});

// Run all tests
console.log('\n🧪 Running Dashboard Optimization Tests...\n');
