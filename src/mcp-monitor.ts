import AnalyticsEngine from './analytics-engine.js';

const analyticsEngine = AnalyticsEngine.getInstance();

// Configurable thresholds for anomaly detection
export const ANOMALY_THRESHOLDS = {
  MIN_SUCCESS_RATE: 0.9, // 90%
  MAX_P95_LATENCY_MS: 1000,
  ERROR_SPIKE_COUNT: 10,
  ERROR_SPIKE_WINDOW_MS: 5 * 60 * 1000, // 5 minutes
};

export interface MCPServerCallParams {
  serverId: string;
  method: string;
  duration: number;
  success: boolean;
  errorType?: string;
  inputSize?: number;
  outputSize?: number;
}

/**
 * MCPServerMonitor - Track and analyze MCP server call performance
 * 
 * Features:
 * - Track individual MCP server calls with detailed metrics
 * - Calculate performance statistics (latency percentiles, success rates)
 * - Detect anomalies (high error rates, latency spikes, error bursts)
 * - Integration with AnalyticsEngine for centralized tracking
 */
export class MCPServerMonitor {
  /**
   * Track individual MCP server call
   */
  trackServerCall(params: MCPServerCallParams): void {
    analyticsEngine.track({
      eventType: 'mcp_server_call',
      agentId: params.serverId,
      data: {
        method: params.method,
        duration: params.duration,
        success: params.success,
        errorType: params.errorType,
        inputSize: params.inputSize,
        outputSize: params.outputSize,
      },
      tags: {
        server: params.serverId,
        method: params.method,
        status: params.success ? 'success' : 'error',
        error_type: params.errorType || 'none',
      },
    });
  }

  /**
   * Get performance metrics for a specific MCP server
   */
  async getServerMetrics(serverId: string, timeRange: '5m' | '1h' | '24h' = '1h'): Promise<{
    totalCalls: number;
    successRate: number;
    avgLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorsByType: Record<string, number>;
    callsByMethod: Record<string, number>;
  }> {
    const now = Date.now();
    const timeRangeMs = timeRange === '5m' ? 5 * 60 * 1000 : timeRange === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const eventsList = await analyticsEngine.query({
      timeRange: { start: now - timeRangeMs, end: now },
      filters: {
        eventType: 'mcp_server_call',
        agentId: serverId,
      },
      limit: 100000,
    });

    if (eventsList.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        errorsByType: {},
        callsByMethod: {},
      };
    }

    const durations = eventsList
      .filter((e) => e.data.success)
      .map((e) => e.data.duration)
      .sort((a, b) => a - b);

    const successCount = eventsList.filter((e) => e.data.success).length;
    const successRate = eventsList.length > 0 ? successCount / eventsList.length : 0;

    const avgLatency = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length 
      : 0;

    const p95Latency = durations.length > 0 
      ? durations[Math.min(Math.floor(durations.length * 0.95), durations.length - 1)]
      : 0;

    const p99Latency = durations.length > 0 
      ? durations[Math.min(Math.floor(durations.length * 0.99), durations.length - 1)]
      : 0;

    return {
      totalCalls: eventsList.length,
      successRate,
      avgLatency,
      p95Latency,
      p99Latency,
      errorsByType: this.groupBy(
        eventsList.filter((e) => !e.data.success),
        (e) => e.data.errorType || 'unknown'
      ),
      callsByMethod: this.groupBy(eventsList, (e) => e.data.method),
    };
  }

  /**
   * Detect anomalous patterns in MCP server calls
   */
  async detectAnomalies(serverId: string): Promise<Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    data: any;
  }>> {
    const metrics = await this.getServerMetrics(serverId, '1h');
    const anomalies: Array<{
      type: string;
      severity: 'low' | 'medium' | 'high';
      description: string;
      data: any;
    }> = [];

    // High error rate
    if (metrics.successRate < ANOMALY_THRESHOLDS.MIN_SUCCESS_RATE && metrics.totalCalls > 0) {
      anomalies.push({
        type: 'high_error_rate',
        severity: 'high',
        description: `Success rate is ${(metrics.successRate * 100).toFixed(1)}% (below ${ANOMALY_THRESHOLDS.MIN_SUCCESS_RATE * 100}% threshold)`,
        data: { successRate: metrics.successRate, errorsByType: metrics.errorsByType },
      });
    }

    // High latency
    if (metrics.p95Latency > ANOMALY_THRESHOLDS.MAX_P95_LATENCY_MS) {
      anomalies.push({
        type: 'high_latency',
        severity: 'medium',
        description: `P95 latency is ${metrics.p95Latency}ms (above ${ANOMALY_THRESHOLDS.MAX_P95_LATENCY_MS}ms threshold)`,
        data: { p95: metrics.p95Latency, p99: metrics.p99Latency },
      });
    }

    // Sudden spike in errors (last 5 minutes)
    const now = Date.now();
    const recentEvents = await analyticsEngine.query({
      timeRange: { start: now - ANOMALY_THRESHOLDS.ERROR_SPIKE_WINDOW_MS, end: now },
      filters: {
        eventType: 'mcp_server_call',
        agentId: serverId,
      },
      limit: 100000,
    });

    const recentErrors = recentEvents.filter((e: any) => !e.data.success).length;

    if (recentErrors > ANOMALY_THRESHOLDS.ERROR_SPIKE_COUNT) {
      anomalies.push({
        type: 'error_spike',
        severity: 'high',
        description: `${recentErrors} errors in last ${ANOMALY_THRESHOLDS.ERROR_SPIKE_WINDOW_MS / 60000} minutes`,
        data: { count: recentErrors },
      });
    }

    return anomalies;
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
    return items.reduce((acc, item) => {
      const key = keyFn(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

export const mcpMonitor = new MCPServerMonitor();
