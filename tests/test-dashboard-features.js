// Simple standalone test for new dashboard features
// Tests MCP Monitor and Aggregation Cache without full analytics engine

console.log('\n🧪 Testing Dashboard Optimization Features...\n');

// Test 1: MCP Monitor basic functionality
console.log('Test 1: MCP Monitor Construction');
try {
  const { MCPServerMonitor } = await import('../dist/src/mcp-monitor.js');
  const monitor = new MCPServerMonitor();
  
  // Track a server call
  monitor.trackServerCall({
    serverId: 'test-server',
    method: 'tools/call',
    duration: 250,
    success: true
  });
  
  // Get stats
  const stats = monitor.getServerStats('test-server', 3600000);
  if (stats.totalCalls >= 1 && stats.avgDuration > 0) {
    console.log('✓ MCP Monitor basic tracking works');
    console.log(`  - Total calls: ${stats.totalCalls}`);
    console.log(`  - Avg duration: ${stats.avgDuration.toFixed(2)}ms`);
  } else {
    throw new Error('Stats not tracked correctly');
  }
} catch (error) {
  console.error('✗ MCP Monitor test failed:', error.message);
  process.exit(1);
}

// Test 2: Tool Call Tracking
console.log('\nTest 2: Tool Call Tracking');
try {
  const { MCPServerMonitor } = await import('../dist/src/mcp-monitor.js');
  const monitor = new MCPServerMonitor();
  
  monitor.trackToolCall({
    toolName: 'test_tool',
    agentId: 'test-agent',
    duration: 150,
    success: true,
    inputTokens: 100,
    outputTokens: 50
  });
  
  const stats = monitor.getToolStats('test_tool', 3600000);
  if (stats.totalCalls >= 1 && stats.totalTokens >= 150) {
    console.log('✓ Tool call tracking works');
    console.log(`  - Tool calls: ${stats.totalCalls}`);
    console.log(`  - Total tokens: ${stats.totalTokens}`);
  } else {
    throw new Error('Tool stats not tracked correctly');
  }
} catch (error) {
  console.error('✗ Tool call test failed:', error.message);
  process.exit(1);
}

// Test 3: Aggregation Cache
console.log('\nTest 3: Aggregation Cache Basic Operations');
try {
  const { AggregationCache } = await import('../dist/src/aggregation-cache.js');
  const cache = new AggregationCache(100);
  
  const key = 'test-key';
  const value = { data: 'test', timestamp: Date.now() };
  
  cache.set(key, value, 5000);
  const cached = cache.get(key);
  
  if (JSON.stringify(cached) === JSON.stringify(value)) {
    console.log('✓ Cache set/get works');
    console.log(`  - Cached value retrieved successfully`);
  } else {
    throw new Error('Cache value mismatch');
  }
} catch (error) {
  console.error('✗ Cache test failed:', error.message);
  process.exit(1);
}

// Test 4: Cache getOrCompute
console.log('\nTest 4: Cache getOrCompute');
try {
  const { AggregationCache } = await import('../dist/src/aggregation-cache.js');
  const cache = new AggregationCache(100);
  
  let computeCount = 0;
  const compute = () => {
    computeCount++;
    return { result: 'computed', count: computeCount };
  };
  
  const key = 'compute-test';
  const result1 = await cache.getOrCompute(key, 5000, compute);
  const result2 = await cache.getOrCompute(key, 5000, compute);
  
  if (computeCount === 1 && JSON.stringify(result1) === JSON.stringify(result2)) {
    console.log('✓ Cache getOrCompute works');
    console.log(`  - Compute called only once: ${computeCount} time`);
  } else {
    throw new Error(`Compute called ${computeCount} times instead of 1`);
  }
} catch (error) {
  console.error('✗ getOrCompute test failed:', error.message);
  process.exit(1);
}

// Test 5: Cache Statistics
console.log('\nTest 5: Cache Statistics');
try {
  const { AggregationCache } = await import('../dist/src/aggregation-cache.js');
  const cache = new AggregationCache(100);
  
  // Generate some cache activity
  for (let i = 0; i < 5; i++) {
    await cache.getOrCompute(`key-${i}`, 5000, () => ({ value: i }));
  }
  
  // Access again for cache hits
  for (let i = 0; i < 5; i++) {
    await cache.getOrCompute(`key-${i}`, 5000, () => ({ value: i }));
  }
  
  const stats = cache.getStats();
  if (stats.hits > 0 && stats.misses > 0 && stats.hitRate > 0) {
    console.log('✓ Cache statistics tracking works');
    console.log(`  - Hits: ${stats.hits}, Misses: ${stats.misses}`);
    console.log(`  - Hit rate: ${(stats.hitRate * 100).toFixed(1)}%`);
  } else {
    throw new Error('Cache statistics not working');
  }
} catch (error) {
  console.error('✗ Statistics test failed:', error.message);
  process.exit(1);
}

// Test 6: Pattern Invalidation
console.log('\nTest 6: Pattern Invalidation');
try {
  const { AggregationCache } = await import('../dist/src/aggregation-cache.js');
  const cache = new AggregationCache(100);
  
  cache.set('dashboard:1h', { data: 1 }, 5000);
  cache.set('dashboard:24h', { data: 2 }, 5000);
  cache.set('insights:1h', { data: 3 }, 5000);
  
  const invalidated = cache.invalidatePattern(/^dashboard:/);
  
  if (invalidated === 2 && !cache.has('dashboard:1h') && cache.has('insights:1h')) {
    console.log('✓ Pattern invalidation works');
    console.log(`  - Invalidated ${invalidated} entries`);
  } else {
    throw new Error('Pattern invalidation failed');
  }
} catch (error) {
  console.error('✗ Pattern invalidation test failed:', error.message);
  process.exit(1);
}

// Test 7: Permission Tracking
console.log('\nTest 7: Permission Tracking');
try {
  const { MCPServerMonitor } = await import('../dist/src/mcp-monitor.js');
  const monitor = new MCPServerMonitor();
  
  monitor.trackPermissionRequest({
    agentId: 'test-agent',
    permission: 'file:read',
    granted: true,
    reason: 'Test'
  });
  
  const audit = monitor.getSecurityAudit('test-agent', 86400000);
  if (audit.totalRequests >= 1) {
    console.log('✓ Permission tracking works');
    console.log(`  - Total requests: ${audit.totalRequests}`);
  } else {
    throw new Error('Permission not tracked');
  }
} catch (error) {
  console.error('✗ Permission tracking test failed:', error.message);
  process.exit(1);
}

// Test 8: Cache TTL Expiration
console.log('\nTest 8: Cache TTL Expiration');
try {
  const { AggregationCache } = await import('../dist/src/aggregation-cache.js');
  const cache = new AggregationCache(100);
  
  cache.set('short-lived', 'data', 100); // 100ms TTL
  
  if (!cache.has('short-lived')) {
    throw new Error('Cache entry should exist immediately');
  }
  
  // Wait for expiration
  await new Promise(resolve => setTimeout(resolve, 150));
  
  if (cache.has('short-lived')) {
    throw new Error('Cache entry should have expired');
  }
  
  console.log('✓ Cache TTL expiration works');
  console.log('  - Entry expired after 100ms');
} catch (error) {
  console.error('✗ TTL test failed:', error.message);
  process.exit(1);
}

console.log('\n✅ All dashboard optimization tests passed!\n');
console.log('Summary:');
console.log('  - MCP Monitor: ✓ Working');
console.log('  - Tool Tracking: ✓ Working');
console.log('  - Aggregation Cache: ✓ Working');
console.log('  - Cache Statistics: ✓ Working');
console.log('  - Pattern Invalidation: ✓ Working');
console.log('  - Permission Tracking: ✓ Working');
console.log('  - TTL Expiration: ✓ Working');
console.log('');
