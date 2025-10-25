// src/mcp-monitor.ts
/**
 * MCP Server Monitoring and Observability
 * Tracks MCP server calls, detects anomalies, and provides security monitoring
 */
import { AnalyticsEngine, AnalyticsInsight } from './analytics-engine.js';
import pino from 'pino';

const logger = pino({ name: 'mcp-monitor' });

export interface MCPServerCall {
  serverId: string;
  method: string;
  duration: number;
  success: boolean;
  errorType?: string;
  timestamp: Date;
  inputTokens?: number;
  outputTokens?: number;
}

export interface ResourceAccess {
  resourceType: 'memory' | 'cpu' | 'network' | 'mcp_server';
  agentId: string;
  usage: number;
  timestamp: Date;
}

export interface ToolCallMetrics {
  toolName: string;
  agentId: string;
  duration: number;
  success: boolean;
  inputTokens: number;
  outputTokens: number;
  timestamp: Date;
}

export class MCPServerMonitor {
  private serverCallHistory: MCPServerCall[] = [];
  private toolCallHistory: ToolCallMetrics[] = [];
  private resourceAccessHistory: ResourceAccess[] = [];
  private readonly MAX_HISTORY = 10000;

  /**
   * Track an MCP server call with full metrics
   */
  trackServerCall(params: MCPServerCall): void {
    this.serverCallHistory.push(params);

    // Trim history if needed
    if (this.serverCallHistory.length > this.MAX_HISTORY) {
      this.serverCallHistory = this.serverCallHistory.slice(-this.MAX_HISTORY);
    }

    // Track in analytics engine
    AnalyticsEngine.getInstance().track({
      eventType: 'mcp_server_call',
      data: params,
      tags: {
        server: params.serverId,
        method: params.method,
        status: params.success ? 'success' : 'error'
      }
    });

    logger.info({ params }, 'MCP server call tracked');
  }

  /**
   * Track tool call metrics
   */
  trackToolCall(metrics: ToolCallMetrics): void {
    this.toolCallHistory.push(metrics);

    if (this.toolCallHistory.length > this.MAX_HISTORY) {
      this.toolCallHistory = this.toolCallHistory.slice(-this.MAX_HISTORY);
    }

    AnalyticsEngine.getInstance().track({
      eventType: 'tool_call',
      data: metrics,
      tags: {
        tool: metrics.toolName,
        agent: metrics.agentId,
        status: metrics.success ? 'success' : 'error'
      }
    });
  }

  /**
   * Track resource access
   */
  trackResourceAccess(access: ResourceAccess): void {
    this.resourceAccessHistory.push(access);

    if (this.resourceAccessHistory.length > this.MAX_HISTORY) {
      this.resourceAccessHistory = this.resourceAccessHistory.slice(-this.MAX_HISTORY);
    }

    AnalyticsEngine.getInstance().track({
      eventType: 'resource_access',
      data: access,
      tags: {
        resource: access.resourceType,
        agent: access.agentId
      }
    });
  }

  /**
   * Detect anomalies in MCP server behavior
   */
  detectAnomalies(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const recentCalls = this.serverCallHistory.slice(-100);

    if (recentCalls.length < 10) return insights;

    // Check for high error rate
    const errorRate = recentCalls.filter(c => !c.success).length / recentCalls.length;
    if (errorRate > 0.2) {
      insights.push({
        type: 'anomaly',
        severity: 'critical',
        title: 'High MCP Server Error Rate',
        description: `Error rate is ${(errorRate * 100).toFixed(1)}% in recent calls`,
        data: { errorRate, recentCalls: recentCalls.length },
        timestamp: new Date()
      });
    }

    // Check for slow responses
    const avgDuration = recentCalls.reduce((sum, c) => sum + c.duration, 0) / recentCalls.length;
    if (avgDuration > 5000) {
      insights.push({
        type: 'performance',
        severity: 'warning',
        title: 'Slow MCP Server Responses',
        description: `Average response time is ${avgDuration.toFixed(0)}ms`,
        data: { avgDuration, threshold: 5000 },
        timestamp: new Date()
      });
    }

    return insights;
  }

  /**
   * Get server performance metrics
   */
  getServerMetrics(serverId?: string): {
    totalCalls: number;
    successRate: number;
    averageDuration: number;
    errorsByType: Map<string, number>;
  } {
    const calls = serverId
      ? this.serverCallHistory.filter(c => c.serverId === serverId)
      : this.serverCallHistory;

    const totalCalls = calls.length;
    const successfulCalls = calls.filter(c => c.success).length;
    const successRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;
    const totalDuration = calls.reduce((sum, c) => sum + c.duration, 0);
    const averageDuration = totalCalls > 0 ? totalDuration / totalCalls : 0;

    const errorsByType = new Map<string, number>();
    calls.filter(c => !c.success && c.errorType).forEach(c => {
      errorsByType.set(c.errorType!, (errorsByType.get(c.errorType!) || 0) + 1);
    });

    return {
      totalCalls,
      successRate,
      averageDuration,
      errorsByType
    };
  }

  /**
   * Get resource usage summary
   */
  getResourceUsageSummary(): Map<string, { total: number; average: number; peak: number }> {
    const summary = new Map<string, { total: number; average: number; peak: number }>();

    ['memory', 'cpu', 'network', 'mcp_server'].forEach(type => {
      const resources = this.resourceAccessHistory.filter(r => r.resourceType === type);
      const total = resources.reduce((sum, r) => sum + r.usage, 0);
      const average = resources.length > 0 ? total / resources.length : 0;
      const peak = resources.length > 0 ? Math.max(...resources.map(r => r.usage)) : 0;

      summary.set(type, { total, average, peak });
    });

    return summary;
  }

  /**
   * Clear old history (for memory management)
   */
  clearHistory(olderThan: Date): void {
    const timestamp = olderThan.getTime();

    this.serverCallHistory = this.serverCallHistory.filter(c => c.timestamp.getTime() > timestamp);
    this.toolCallHistory = this.toolCallHistory.filter(c => c.timestamp.getTime() > timestamp);
    this.resourceAccessHistory = this.resourceAccessHistory.filter(r => r.timestamp.getTime() > timestamp);

    logger.info({ olderThan }, 'Cleared old monitoring history');
  }
}

// Export singleton instance
export const mcpMonitor = new MCPServerMonitor();
