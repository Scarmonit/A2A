import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mcpMonitor, MCPServerMonitor } from '../src/mcp-monitor.js';
import AnalyticsEngine from '../src/analytics-engine.js';

/**
 * Test Suite for MCP Server Monitoring
 * 
 * Tests:
 * - trackServerCall tracks individual calls
 * - getServerMetrics calculates statistics correctly
 * - detectAnomalies identifies high error rates
 * - detectAnomalies identifies high latency
 * - detectAnomalies identifies error spikes
 */

describe('MCPServerMonitor', () => {
  let monitor: MCPServerMonitor;
  const testServerId = 'test-mcp-server';

  before(() => {
    monitor = new MCPServerMonitor();
  });

  it('should track MCP server calls', async () => {
    monitor.trackServerCall({
      serverId: testServerId,
      method: 'tools/list',
      duration: 150,
      success: true,
    });

    // Wait a bit for the event to be tracked
    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics = await monitor.getServerMetrics(testServerId, '5m');
    assert.ok(metrics.totalCalls >= 1, 'Should have tracked at least 1 call');
    assert.ok(metrics.successRate > 0, 'Should have non-zero success rate');
  });

  it('should calculate success rate correctly', async () => {
    const serverId = 'test-success-rate';

    // Track successful calls
    for (let i = 0; i < 8; i++) {
      monitor.trackServerCall({
        serverId,
        method: 'tools/call',
        duration: 100,
        success: true,
      });
    }

    // Track failed calls
    for (let i = 0; i < 2; i++) {
      monitor.trackServerCall({
        serverId,
        method: 'tools/call',
        duration: 100,
        success: false,
        errorType: 'TimeoutError',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics = await monitor.getServerMetrics(serverId, '5m');
    assert.ok(metrics.totalCalls >= 10, 'Should have at least 10 calls');
    // Success rate should be around 80% (8 successful out of 10)
    assert.ok(metrics.successRate >= 0.7 && metrics.successRate <= 0.9, 
      `Success rate should be around 0.8, got ${metrics.successRate}`);
  });

  it('should calculate latency percentiles', async () => {
    const serverId = 'test-latency';

    // Track calls with various durations
    const durations = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500,
                       550, 600, 650, 700, 750, 800, 850, 900, 950, 1000];
    
    for (const duration of durations) {
      monitor.trackServerCall({
        serverId,
        method: 'tools/call',
        duration,
        success: true,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics = await monitor.getServerMetrics(serverId, '5m');
    assert.ok(metrics.avgLatency > 0, 'Should have average latency');
    assert.ok(metrics.p95Latency > 0, 'Should have P95 latency');
    assert.ok(metrics.p99Latency > 0, 'Should have P99 latency');
    assert.ok(metrics.p95Latency >= metrics.avgLatency, 'P95 should be >= average');
    assert.ok(metrics.p99Latency >= metrics.p95Latency, 'P99 should be >= P95');
  });

  it('should group errors by type', async () => {
    const serverId = 'test-error-types';

    monitor.trackServerCall({
      serverId,
      method: 'tools/call',
      duration: 100,
      success: false,
      errorType: 'TimeoutError',
    });

    monitor.trackServerCall({
      serverId,
      method: 'tools/call',
      duration: 100,
      success: false,
      errorType: 'TimeoutError',
    });

    monitor.trackServerCall({
      serverId,
      method: 'tools/call',
      duration: 100,
      success: false,
      errorType: 'NetworkError',
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics = await monitor.getServerMetrics(serverId, '5m');
    assert.ok(metrics.errorsByType, 'Should have errorsByType');
    assert.ok(metrics.errorsByType['TimeoutError'] >= 2, 'Should have 2 TimeoutErrors');
    assert.ok(metrics.errorsByType['NetworkError'] >= 1, 'Should have 1 NetworkError');
  });

  it('should group calls by method', async () => {
    const serverId = 'test-methods';

    monitor.trackServerCall({
      serverId,
      method: 'tools/list',
      duration: 100,
      success: true,
    });

    monitor.trackServerCall({
      serverId,
      method: 'tools/call',
      duration: 150,
      success: true,
    });

    monitor.trackServerCall({
      serverId,
      method: 'tools/call',
      duration: 120,
      success: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics = await monitor.getServerMetrics(serverId, '5m');
    assert.ok(metrics.callsByMethod, 'Should have callsByMethod');
    assert.ok(metrics.callsByMethod['tools/list'] >= 1, 'Should have tools/list calls');
    assert.ok(metrics.callsByMethod['tools/call'] >= 2, 'Should have tools/call calls');
  });

  it('should detect high error rates', async () => {
    const serverId = 'failing-server';

    // Track multiple failed calls
    for (let i = 0; i < 20; i++) {
      monitor.trackServerCall({
        serverId,
        method: 'tools/call',
        duration: 100,
        success: false,
        errorType: 'TimeoutError',
      });
    }

    // Track a few successful calls to ensure we're not at 0% success
    for (let i = 0; i < 2; i++) {
      monitor.trackServerCall({
        serverId,
        method: 'tools/call',
        duration: 100,
        success: true,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const anomalies = await monitor.detectAnomalies(serverId);
    const highErrorAnomaly = anomalies.find(a => a.type === 'high_error_rate');
    
    assert.ok(highErrorAnomaly, 'Should detect high error rate');
    assert.equal(highErrorAnomaly.severity, 'high', 'Should have high severity');
    assert.ok(highErrorAnomaly.description.includes('90%'), 'Should mention threshold');
  });

  it('should detect high latency', async () => {
    const serverId = 'slow-server';

    // Track calls with high latency
    for (let i = 0; i < 20; i++) {
      monitor.trackServerCall({
        serverId,
        method: 'tools/call',
        duration: 1200 + Math.random() * 200, // 1200-1400ms
        success: true,
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const anomalies = await monitor.detectAnomalies(serverId);
    const highLatencyAnomaly = anomalies.find(a => a.type === 'high_latency');
    
    assert.ok(highLatencyAnomaly, 'Should detect high latency');
    assert.equal(highLatencyAnomaly.severity, 'medium', 'Should have medium severity');
    assert.ok(highLatencyAnomaly.description.includes('1000ms'), 'Should mention threshold');
  });

  it('should detect error spikes', async () => {
    const serverId = 'spiking-server';

    // Track many errors in a short time
    for (let i = 0; i < 15; i++) {
      monitor.trackServerCall({
        serverId,
        method: 'tools/call',
        duration: 100,
        success: false,
        errorType: 'ServerError',
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));

    const anomalies = await monitor.detectAnomalies(serverId);
    const errorSpikeAnomaly = anomalies.find(a => a.type === 'error_spike');
    
    assert.ok(errorSpikeAnomaly, 'Should detect error spike');
    assert.equal(errorSpikeAnomaly.severity, 'high', 'Should have high severity');
    assert.ok(errorSpikeAnomaly.description.includes('5 minutes'), 'Should mention time window');
  });

  it('should return empty metrics for unknown server', async () => {
    const metrics = await monitor.getServerMetrics('unknown-server', '5m');
    
    assert.equal(metrics.totalCalls, 0, 'Should have 0 total calls');
    assert.equal(metrics.successRate, 0, 'Should have 0 success rate');
    assert.equal(metrics.avgLatency, 0, 'Should have 0 average latency');
  });

  it('should track input and output sizes', async () => {
    const serverId = 'test-sizes';

    monitor.trackServerCall({
      serverId,
      method: 'tools/call',
      duration: 100,
      success: true,
      inputSize: 512,
      outputSize: 1024,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics = await monitor.getServerMetrics(serverId, '5m');
    assert.ok(metrics.totalCalls >= 1, 'Should have tracked the call');
  });

  it('should handle different time ranges', async () => {
    const serverId = 'test-time-ranges';

    monitor.trackServerCall({
      serverId,
      method: 'tools/call',
      duration: 100,
      success: true,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const metrics5m = await monitor.getServerMetrics(serverId, '5m');
    const metrics1h = await monitor.getServerMetrics(serverId, '1h');
    const metrics24h = await monitor.getServerMetrics(serverId, '24h');

    assert.ok(metrics5m.totalCalls >= 1, 'Should have calls in 5m range');
    assert.ok(metrics1h.totalCalls >= 1, 'Should have calls in 1h range');
    assert.ok(metrics24h.totalCalls >= 1, 'Should have calls in 24h range');
  });
});

describe('mcpMonitor singleton', () => {
  it('should export a singleton instance', () => {
    assert.ok(mcpMonitor, 'Should export mcpMonitor singleton');
    assert.ok(typeof mcpMonitor.trackServerCall === 'function', 'Should have trackServerCall method');
    assert.ok(typeof mcpMonitor.getServerMetrics === 'function', 'Should have getServerMetrics method');
    assert.ok(typeof mcpMonitor.detectAnomalies === 'function', 'Should have detectAnomalies method');
  });
});
