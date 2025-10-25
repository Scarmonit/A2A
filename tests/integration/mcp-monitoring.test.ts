/**
 * MCP Monitoring Integration Tests
 * 
 * Tests MCP server monitoring, call tracking, and anomaly detection
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { TestEnvironment } from './setup.js';
import { mcpMonitor } from '../../src/mcp-monitor.js';

describe('MCP Monitoring Integration', () => {
  const env = new TestEnvironment(3002);

  before(async () => {
    await env.setup();
    
    // Register test MCP server
    env.mcpManager.registerServer({
      id: 'test-mcp-server',
      type: 'test',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
      autoRestart: false,
    });
    
    await env.mcpManager.startServer('test-mcp-server');
    
    // Give the server time to start
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  after(async () => {
    await env.cleanup();
  });

  it('should track all MCP server calls', async () => {
    // Clear any existing data - commented out if clearCache is not implemented
    // mcpMonitor.clearCache('test-mcp-server');
    
    // Simulate 10 MCP calls
    for (let i = 0; i < 10; i++) {
      mcpMonitor.trackServerCall({
        serverId: 'test-mcp-server',
        method: 'tools/list',
        duration: 50 + Math.random() * 100,
        success: i < 9, // 1 failure
        timestamp: new Date(),
      });
    }

    const metrics = mcpMonitor.getServerMetrics('test-mcp-server', '5m');
    
    assert.strictEqual(metrics.totalCalls, 10, 'Should track all 10 calls');
    assert.strictEqual(metrics.successRate, 0.9, 'Success rate should be 90%');
    assert.ok(metrics.avgLatency > 0, 'Should calculate average latency');
    assert.ok(metrics.p95Latency > 0, 'Should calculate P95 latency');
  });

  it('should detect anomalous patterns', async () => {
    // Clear previous data - commented out if clearCache is not implemented
    // mcpMonitor.clearCache('test-mcp-server');
    
    // Simulate error spike
    for (let i = 0; i < 20; i++) {
      mcpMonitor.trackServerCall({
        serverId: 'test-mcp-server',
        method: 'tools/call',
        duration: 100,
        success: false,
        errorType: 'TimeoutError',
        timestamp: new Date(),
      });
    }

    const anomalies = mcpMonitor.detectAnomalies('test-mcp-server');

    assert.ok(
      anomalies.some((a) => a.type === 'anomaly' && a.title.includes('Error Rate')),
      'Should detect error spike anomaly'
    );
  });

  it('should track metrics over different time windows', async () => {
    // mcpMonitor.clearCache('test-mcp-server');
    
    // Track calls spread over time
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      mcpMonitor.trackServerCall({
        serverId: 'test-mcp-server',
        method: 'test',
        duration: 100,
        success: true,
        timestamp: new Date(now - i * 60 * 1000), // Spread over 5 minutes
      });
    }

    const metrics1m = mcpMonitor.getServerMetrics('test-mcp-server', '1m');
    const metrics5m = mcpMonitor.getServerMetrics('test-mcp-server', '5m');
    
    assert.ok(metrics1m.totalCalls <= metrics5m.totalCalls, 
      'Shorter time window should have fewer or equal calls');
    assert.strictEqual(metrics5m.totalCalls, 5, 'Should track all calls in 5m window');
  });

  it('should track different methods separately', async () => {
    // mcpMonitor.clearCache('test-mcp-server');
    
    // Track different methods
    mcpMonitor.trackServerCall({
      serverId: 'test-mcp-server',
      method: 'tools/list',
      duration: 50,
      success: true,
      timestamp: new Date(),
    });

    mcpMonitor.trackServerCall({
      serverId: 'test-mcp-server',
      method: 'tools/call',
      duration: 150,
      success: true,
      timestamp: new Date(),
    });

    const metrics = mcpMonitor.getServerMetrics('test-mcp-server', '5m');
    
    assert.strictEqual(metrics.totalCalls, 2, 'Should track both method calls');
  });

  it('should detect high latency anomalies', async () => {
    // mcpMonitor.clearCache('test-mcp-server');
    
    // Simulate high latency calls
    for (let i = 0; i < 15; i++) {
      mcpMonitor.trackServerCall({
        serverId: 'test-mcp-server',
        method: 'tools/call',
        duration: 6000, // 6 seconds - high latency
        success: true,
        timestamp: new Date(),
      });
    }

    const anomalies = mcpMonitor.detectAnomalies('test-mcp-server');

    assert.ok(
      anomalies.some((a) => a.type === 'trend' && a.title.includes('Slow')),
      'Should detect high latency anomaly'
    );
  });

  it('should verify MCP server is tracked by manager', async () => {
    const state = env.mcpManager.getServerState('test-mcp-server');
    
    assert.ok(state, 'Server should be registered');
    assert.strictEqual(state?.status, 'running', 'Server should be running');
  });
});
