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
        confidence: 0.9,
        title: 'High MCP Server Error Rate',
        description: `Error rate is ${(errorRate * 100).toFixed(1)}% in recent calls`,
        data: { errorRate, recentCalls: recentCalls.length }
      });
    }
    // Check for slow responses
    const avgDuration = recentCalls.reduce((sum, c) => sum + c.duration, 0) / recentCalls.length;
    if (avgDuration > 5000) {
      insights.push({
        type: 'trend',
        severity: 'warning',
        confidence: 0.85,
        title: 'Slow MCP Server Responses',
        description: `Average response time is ${avgDuration.toFixed(0)}ms`,
        data: { avgDuration, threshold: 5000 }
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
