/**
 * MCP Monitor - Tracks MCP server calls and detects anomalies
 * 
 * This is a stub implementation for testing purposes.
 */

export interface MCPCall {
  serverId: string;
  method: string;
  duration: number;
  success: boolean;
  errorType?: string;
  timestamp?: number;
}

export interface ServerMetrics {
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
}

export interface Anomaly {
  type: 'high_error_rate' | 'high_latency' | 'unusual_pattern';
  severity: 'low' | 'medium' | 'high';
  description: string;
  timestamp: number;
}

class MCPMonitor {
  private calls = new Map<string, MCPCall[]>();
  private readonly maxStoredCalls = 10000;

  trackServerCall(call: MCPCall): void {
    const callWithTimestamp = {
      ...call,
      timestamp: call.timestamp || Date.now(),
    };

    if (!this.calls.has(call.serverId)) {
      this.calls.set(call.serverId, []);
    }

    const serverCalls = this.calls.get(call.serverId)!;
    serverCalls.push(callWithTimestamp);

    // Keep only recent calls
    if (serverCalls.length > this.maxStoredCalls) {
      serverCalls.shift();
    }
  }

  getServerMetrics(serverId: string, timeWindow: string = '5m'): ServerMetrics {
    const calls = this.calls.get(serverId) || [];
    const now = Date.now();
    const windowMs = this.parseTimeWindow(timeWindow);
    
    const recentCalls = calls.filter(
      (call) => now - (call.timestamp || 0) <= windowMs
    );

    if (recentCalls.length === 0) {
      return {
        totalCalls: 0,
        successRate: 0,
        avgLatency: 0,
        p95Latency: 0,
        errorRate: 0,
      };
    }

    const successfulCalls = recentCalls.filter((c) => c.success).length;
    const durations = recentCalls.map((c) => c.duration).sort((a, b) => a - b);
    const avgLatency = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95Index = Math.floor(durations.length * 0.95);
    const p95Latency = durations[p95Index] || 0;

    return {
      totalCalls: recentCalls.length,
      successRate: successfulCalls / recentCalls.length,
      avgLatency,
      p95Latency,
      errorRate: 1 - successfulCalls / recentCalls.length,
    };
  }

  detectAnomalies(serverId: string): Anomaly[] {
    const metrics = this.getServerMetrics(serverId, '5m');
    const anomalies: Anomaly[] = [];

    // High error rate detection
    if (metrics.errorRate > 0.5 && metrics.totalCalls >= 10) {
      anomalies.push({
        type: 'high_error_rate',
        severity: 'high',
        description: `Error rate is ${(metrics.errorRate * 100).toFixed(1)}%`,
        timestamp: Date.now(),
      });
    }

    // High latency detection
    if (metrics.p95Latency > 5000 && metrics.totalCalls >= 10) {
      anomalies.push({
        type: 'high_latency',
        severity: 'medium',
        description: `P95 latency is ${metrics.p95Latency.toFixed(0)}ms`,
        timestamp: Date.now(),
      });
    }

    return anomalies;
  }

  clear(serverId?: string): void {
    if (serverId) {
      this.calls.delete(serverId);
    } else {
      this.calls.clear();
    }
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([smhd])$/);
    if (!match) return 5 * 60 * 1000; // Default 5 minutes

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 5 * 60 * 1000;
    }
  }
}

export const mcpMonitor = new MCPMonitor();
