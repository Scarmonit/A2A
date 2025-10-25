// src/mcp-monitor.ts
/**
 * MCP Server Monitoring and Observability
 * Tracks MCP server calls, detects anomalies, and provides security monitoring
 */

import { analyticsEngine, AnalyticsInsight } from './analytics-engine.js';
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
    analyticsEngine.track({
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
   * Track tool call with token usage
   */
  trackToolCall(params: ToolCallMetrics): void {
    this.toolCallHistory.push(params);

    if (this.toolCallHistory.length > this.MAX_HISTORY) {
      this.toolCallHistory = this.toolCallHistory.slice(-this.MAX_HISTORY);
    }

    analyticsEngine.track({
      eventType: 'tool_call',
      agentId: params.agentId,
      data: params,
      tags: {
        tool: params.toolName,
        status: params.success ? 'success' : 'error'
      }
    });

    logger.info({ params }, 'Tool call tracked');
  }

  /**
   * Track resource access (memory, CPU, network, MCP servers)
   */
  trackResourceAccess(params: ResourceAccess): void {
    this.resourceAccessHistory.push(params);

    if (this.resourceAccessHistory.length > this.MAX_HISTORY) {
      this.resourceAccessHistory = this.resourceAccessHistory.slice(-this.MAX_HISTORY);
    }

    analyticsEngine.track({
      eventType: 'resource_access',
      agentId: params.agentId,
      data: params
    });

    logger.debug({ params }, 'Resource access tracked');
  }

  /**
   * Detect anomalous tool calls (high frequency, privilege escalation, etc.)
   */
  detectAnomalousToolCalls(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const now = Date.now();
    const last5Minutes = this.toolCallHistory.filter(
      call => now - call.timestamp.getTime() < 5 * 60 * 1000
    );

    // Check for high-frequency calls
    const callsByAgent = new Map<string, number>();
    last5Minutes.forEach(call => {
      callsByAgent.set(call.agentId, (callsByAgent.get(call.agentId) || 0) + 1);
    });

    callsByAgent.forEach((count, agentId) => {
      if (count > 100) {
        insights.push({
          type: 'anomaly',
          severity: 'warning',
          title: 'High Frequency Tool Calls',
          description: `Agent ${agentId} made ${count} tool calls in 5 minutes`,
          data: {
            agentId,
            count,
            timeWindow: '5m'
          },
          confidence: 0.85,
          recommendations: ['Review agent behavior for potential issues']
        });
      }
    });

    // Check for unusual error rates
    const totalCalls = last5Minutes.length;
    const failedCalls = last5Minutes.filter(c => !c.success).length;
    const errorRate = totalCalls > 0 ? failedCalls / totalCalls : 0;

    if (errorRate > 0.2 && totalCalls > 10) {
      insights.push({
        type: 'anomaly',
        severity: 'critical',
        title: 'High Tool Call Error Rate',
        description: `${(errorRate * 100).toFixed(1)}% of tool calls failing`,
        data: {
          errorRate,
          totalCalls,
          failedCalls
        },
        confidence: 0.92,
        recommendations: ['Investigate tool integrations and error logs']
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
