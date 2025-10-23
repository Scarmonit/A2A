// MCP Server-Specific Monitoring
// Enhanced monitoring for Model Context Protocol servers with security auditing

import pino from 'pino';
import { analyticsEngine, AnalyticsInsight } from './analytics-engine.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface MCPServerCall {
  serverId: string;
  method: string;
  duration: number;
  success: boolean;
  errorType?: string;
  timestamp: number;
}

export interface ToolCall {
  toolName: string;
  agentId: string;
  duration: number;
  success: boolean;
  inputTokens?: number;
  outputTokens?: number;
  timestamp: number;
}

export interface ResourceAccess {
  resourceType: 'memory' | 'cpu' | 'network' | 'mcp_server';
  agentId: string;
  usage: number;
  timestamp: number;
}

export interface PermissionRequest {
  agentId: string;
  permission: string;
  granted: boolean;
  reason?: string;
  timestamp: number;
}

export class MCPServerMonitor {
  private serverCalls: MCPServerCall[] = [];
  private toolCalls: ToolCall[] = [];
  private resourceAccesses: ResourceAccess[] = [];
  private permissionRequests: PermissionRequest[] = [];
  private maxHistorySize: number;
  
  // Anomaly detection thresholds
  private readonly HIGH_FREQUENCY_THRESHOLD = 100; // calls per minute
  private readonly HIGH_ERROR_RATE_THRESHOLD = 0.2; // 20% error rate
  private readonly HIGH_LATENCY_THRESHOLD = 5000; // 5 seconds
  
  constructor(maxHistorySize?: number) {
    const envMax = process.env.MCP_MONITOR_MAX_HISTORY_SIZE ? parseInt(process.env.MCP_MONITOR_MAX_HISTORY_SIZE, 10) : undefined;
    this.maxHistorySize = maxHistorySize ?? envMax ?? 10000;
    this.startCleanupJobs();
  }
  
  /**
   * Track MCP server call with full metrics
   */
  trackServerCall(params: Omit<MCPServerCall, 'timestamp'>): void {
    const call: MCPServerCall = {
      ...params,
      timestamp: Date.now()
    };
    
    this.serverCalls.push(call);
    this.maintainHistoryLimit(this.serverCalls);
    
    // Track in analytics engine
    analyticsEngine.track({
      eventType: 'mcp_server_call',
      data: {
        serverId: params.serverId,
        method: params.method,
        duration: params.duration,
        success: params.success,
        errorType: params.errorType
      },
      tags: {
        server: params.serverId,
        method: params.method,
        status: params.success ? 'success' : 'error'
      }
    });
    
    logger.debug({
      serverId: params.serverId,
      method: params.method,
      duration: params.duration,
      success: params.success
    }, 'MCP server call tracked');
  }
  
  /**
   * Track tool call with token usage
   */
  trackToolCall(params: Omit<ToolCall, 'timestamp'>): void {
    const toolCall: ToolCall = {
      ...params,
      timestamp: Date.now()
    };
    
    this.toolCalls.push(toolCall);
    this.maintainHistoryLimit(this.toolCalls);
    
    // Track in analytics engine
    analyticsEngine.track({
      eventType: 'tool_call',
      agentId: params.agentId,
      data: {
        toolName: params.toolName,
        duration: params.duration,
        success: params.success,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens
      },
      tags: {
        tool: params.toolName,
        status: params.success ? 'success' : 'error'
      }
    });
    
    logger.debug({
      toolName: params.toolName,
      agentId: params.agentId,
      duration: params.duration,
      tokens: (params.inputTokens || 0) + (params.outputTokens || 0)
    }, 'Tool call tracked');
  }
  
  /**
   * Track resource access and usage
   */
  trackResourceAccess(params: Omit<ResourceAccess, 'timestamp'>): void {
    const access: ResourceAccess = {
      ...params,
      timestamp: Date.now()
    };
    
    this.resourceAccesses.push(access);
    this.maintainHistoryLimit(this.resourceAccesses);
    
    // Track in analytics engine
    analyticsEngine.track({
      eventType: 'resource_access',
      agentId: params.agentId,
      data: {
        resourceType: params.resourceType,
        usage: params.usage
      },
      tags: {
        resource: params.resourceType
      }
    });
  }
  
  /**
   * Track permission request for security auditing
   */
  trackPermissionRequest(params: Omit<PermissionRequest, 'timestamp'>): void {
    const request: PermissionRequest = {
      ...params,
      timestamp: Date.now()
    };
    
    this.permissionRequests.push(request);
    this.maintainHistoryLimit(this.permissionRequests);
    
    // Track in analytics engine
    analyticsEngine.track({
      eventType: 'permission_request',
      agentId: params.agentId,
      data: {
        permission: params.permission,
        granted: params.granted,
        reason: params.reason
      },
      tags: {
        permission: params.permission,
        status: params.granted ? 'granted' : 'denied'
      }
    });
    
    logger.info({
      agentId: params.agentId,
      permission: params.permission,
      granted: params.granted
    }, 'Permission request tracked');
  }
  
  /**
   * Detect anomalous tool call patterns
   */
  detectAnomalousToolCalls(timeWindow: number = 3600000): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const now = Date.now();
    const recentCalls = this.toolCalls.filter(c => c.timestamp > now - timeWindow);
    
    if (recentCalls.length === 0) return insights;
    
    // High frequency detection per agent
    const callsByAgent = new Map<string, ToolCall[]>();
    recentCalls.forEach(call => {
      if (!callsByAgent.has(call.agentId)) {
        callsByAgent.set(call.agentId, []);
      }
      callsByAgent.get(call.agentId)!.push(call);
    });
    
    callsByAgent.forEach((calls, agentId) => {
      const callsPerMinute = (calls.length / (timeWindow / 60000));
      
      if (callsPerMinute > this.HIGH_FREQUENCY_THRESHOLD) {
        insights.push({
          type: 'anomaly',
          severity: 'warning',
          title: 'High Tool Call Frequency Detected',
          description: `Agent ${agentId} is making ${callsPerMinute.toFixed(1)} tool calls per minute`,
          data: {
            agentId,
            callsPerMinute,
            totalCalls: calls.length,
            timeWindow: timeWindow / 60000
          },
          recommendations: [
            'Review agent behavior for potential loops',
            'Check if agent is functioning as expected',
            'Consider rate limiting for this agent'
          ],
          confidence: 0.85
        });
      }
      
      // High error rate detection
      const errorCalls = calls.filter(c => !c.success);
      const errorRate = errorCalls.length / calls.length;
      
      if (errorRate > this.HIGH_ERROR_RATE_THRESHOLD && calls.length > 10) {
        insights.push({
          type: 'anomaly',
          severity: errorRate > 0.5 ? 'critical' : 'warning',
          title: 'High Tool Call Error Rate',
          description: `Agent ${agentId} has ${(errorRate * 100).toFixed(1)}% error rate on tool calls`,
          data: {
            agentId,
            errorRate,
            totalCalls: calls.length,
            errorCalls: errorCalls.length
          },
          recommendations: [
            'Review tool configurations',
            'Check agent permissions',
            'Investigate error patterns'
          ],
          confidence: 0.9
        });
      }
      
      // High latency detection
      const avgLatency = calls.reduce((sum, c) => sum + c.duration, 0) / calls.length;
      if (avgLatency > this.HIGH_LATENCY_THRESHOLD) {
        insights.push({
          type: 'anomaly',
          severity: 'warning',
          title: 'High Tool Call Latency',
          description: `Agent ${agentId} experiencing average latency of ${avgLatency.toFixed(0)}ms`,
          data: {
            agentId,
            avgLatency,
            callCount: calls.length
          },
          recommendations: [
            'Check network connectivity',
            'Review tool performance',
            'Consider caching strategies'
          ],
          confidence: 0.8
        });
      }
    });
    
    // Unusual tool usage patterns
    const toolFrequency = new Map<string, number>();
    recentCalls.forEach(call => {
      toolFrequency.set(call.toolName, (toolFrequency.get(call.toolName) || 0) + 1);
    });
    
    const sortedTools = Array.from(toolFrequency.entries())
      .sort((a, b) => b[1] - a[1]);
    
    // Alert if one tool is dominating usage (>70% of calls)
    if (sortedTools.length > 0 && sortedTools[0][1] / recentCalls.length > 0.7) {
      insights.push({
        type: 'usage_pattern',
        severity: 'info',
        title: 'Tool Usage Concentration',
        description: `Tool '${sortedTools[0][0]}' accounts for ${((sortedTools[0][1] / recentCalls.length) * 100).toFixed(1)}% of all calls`,
        data: {
          dominantTool: sortedTools[0][0],
          usage: sortedTools[0][1],
          percentage: (sortedTools[0][1] / recentCalls.length) * 100
        },
        recommendations: [
          'Verify if this usage pattern is expected',
          'Consider optimizing this tool for better performance',
          'Review if other tools could be utilized'
        ],
        confidence: 0.7
      });
    }
    
    return insights;
  }
  
  /**
   * Detect privilege escalation attempts
   */
  detectPrivilegeEscalation(timeWindow: number = 3600000): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    const now = Date.now();
    const recentRequests = this.permissionRequests.filter(r => r.timestamp > now - timeWindow);
    
    // Group by agent
    const requestsByAgent = new Map<string, PermissionRequest[]>();
    recentRequests.forEach(req => {
      if (!requestsByAgent.has(req.agentId)) {
        requestsByAgent.set(req.agentId, []);
      }
      requestsByAgent.get(req.agentId)!.push(req);
    });
    
    requestsByAgent.forEach((requests, agentId) => {
      // Multiple denied requests in short time
      const deniedRequests = requests.filter(r => !r.granted);
      
      if (deniedRequests.length > 5) {
        insights.push({
          type: 'anomaly',
          severity: 'critical',
          title: 'Potential Privilege Escalation Attempt',
          description: `Agent ${agentId} has ${deniedRequests.length} denied permission requests`,
          data: {
            agentId,
            deniedCount: deniedRequests.length,
            totalRequests: requests.length,
            permissions: deniedRequests.map(r => r.permission)
          },
          recommendations: [
            'Review agent behavior immediately',
            'Check if agent configuration is correct',
            'Consider restricting agent access',
            'Audit recent agent activities'
          ],
          confidence: 0.95
        });
      }
    });
    
    return insights;
  }
  
  /**
   * Get MCP server statistics
   */
  getServerStats(serverId?: string, timeWindow: number = 3600000): any {
    const now = Date.now();
    let calls = this.serverCalls.filter(c => c.timestamp > now - timeWindow);
    
    if (serverId) {
      calls = calls.filter(c => c.serverId === serverId);
    }
    
    if (calls.length === 0) {
      return {
        serverId: serverId || 'all',
        totalCalls: 0,
        successRate: 0,
        avgDuration: 0,
        errorRate: 0
      };
    }
    
    const successfulCalls = calls.filter(c => c.success);
    const avgDuration = calls.reduce((sum, c) => sum + c.duration, 0) / calls.length;
    
    // Method distribution
    const methodStats = new Map<string, { count: number; successes: number; totalDuration: number }>();
    calls.forEach(call => {
      const stats = methodStats.get(call.method) || { count: 0, successes: 0, totalDuration: 0 };
      stats.count++;
      if (call.success) stats.successes++;
      stats.totalDuration += call.duration;
      methodStats.set(call.method, stats);
    });
    
    const methods = Array.from(methodStats.entries()).map(([method, stats]) => ({
      method,
      count: stats.count,
      successRate: stats.successes / stats.count,
      avgDuration: stats.totalDuration / stats.count
    }));
    
    return {
      serverId: serverId || 'all',
      totalCalls: calls.length,
      successRate: successfulCalls.length / calls.length,
      avgDuration,
      errorRate: 1 - (successfulCalls.length / calls.length),
      methods: methods.sort((a, b) => b.count - a.count).slice(0, 10),
      timeWindow: timeWindow / 60000 // in minutes
    };
  }
  
  /**
   * Get tool usage statistics
   */
  getToolStats(toolName?: string, timeWindow: number = 3600000): any {
    const now = Date.now();
    let calls = this.toolCalls.filter(c => c.timestamp > now - timeWindow);
    
    if (toolName) {
      calls = calls.filter(c => c.toolName === toolName);
    }
    
    if (calls.length === 0) {
      return {
        toolName: toolName || 'all',
        totalCalls: 0,
        successRate: 0,
        avgDuration: 0,
        totalTokens: 0
      };
    }
    
    const successfulCalls = calls.filter(c => c.success);
    const avgDuration = calls.reduce((sum, c) => sum + c.duration, 0) / calls.length;
    const totalTokens = calls.reduce((sum, c) => (c.inputTokens || 0) + (c.outputTokens || 0), 0);
    
    return {
      toolName: toolName || 'all',
      totalCalls: calls.length,
      successRate: successfulCalls.length / calls.length,
      avgDuration,
      totalTokens,
      avgTokensPerCall: totalTokens / calls.length,
      timeWindow: timeWindow / 60000
    };
  }
  
  /**
   * Get resource usage summary
   */
  getResourceUsage(timeWindow: number = 3600000): any {
    const now = Date.now();
    const recentAccesses = this.resourceAccesses.filter(a => a.timestamp > now - timeWindow);
    
    const byType = new Map<string, { count: number; totalUsage: number; agents: Set<string> }>();
    
    recentAccesses.forEach(access => {
      const stats = byType.get(access.resourceType) || { 
        count: 0, 
        totalUsage: 0, 
        agents: new Set<string>() 
      };
      stats.count++;
      stats.totalUsage += access.usage;
      stats.agents.add(access.agentId);
      byType.set(access.resourceType, stats);
    });
    
    const usage = Array.from(byType.entries()).map(([type, stats]) => ({
      resourceType: type,
      accessCount: stats.count,
      totalUsage: stats.totalUsage,
      avgUsage: stats.totalUsage / stats.count,
      uniqueAgents: stats.agents.size
    }));
    
    return {
      timeWindow: timeWindow / 60000,
      totalAccesses: recentAccesses.length,
      byType: usage
    };
  }
  
  /**
   * Get security audit trail
   */
  getSecurityAudit(agentId?: string, timeWindow: number = 86400000): any {
    const now = Date.now();
    let requests = this.permissionRequests.filter(r => r.timestamp > now - timeWindow);
    
    if (agentId) {
      requests = requests.filter(r => r.agentId === agentId);
    }
    
    const granted = requests.filter(r => r.granted);
    const denied = requests.filter(r => !r.granted);
    
    // Group by permission type
    const byPermission = new Map<string, { granted: number; denied: number }>();
    requests.forEach(req => {
      const stats = byPermission.get(req.permission) || { granted: 0, denied: 0 };
      if (req.granted) {
        stats.granted++;
      } else {
        stats.denied++;
      }
      byPermission.set(req.permission, stats);
    });
    
    return {
      agentId: agentId || 'all',
      timeWindow: timeWindow / 3600000, // in hours
      totalRequests: requests.length,
      granted: granted.length,
      denied: denied.length,
      approvalRate: requests.length > 0 ? granted.length / requests.length : 0,
      byPermission: Array.from(byPermission.entries()).map(([permission, stats]) => ({
        permission,
        granted: stats.granted,
        denied: stats.denied,
        approvalRate: (stats.granted + stats.denied) > 0 
          ? stats.granted / (stats.granted + stats.denied) 
          : 0
      })).sort((a, b) => (b.granted + b.denied) - (a.granted + a.denied)),
      recentDenials: denied.slice(-10).map(r => ({
        agentId: r.agentId,
        permission: r.permission,
        reason: r.reason,
        timestamp: r.timestamp
      }))
    };
  }
  
  /**
   * Maintain history limit for memory management
   */
  private maintainHistoryLimit(array: any[]): void {
    if (array.length > this.maxHistorySize) {
      array.splice(0, array.length - this.maxHistorySize);
    }
  }
  
  /**
   * Start cleanup jobs
   */
  private startCleanupJobs(): void {
    // Clean old data every hour
    setInterval(() => {
      const oneDayAgo = Date.now() - 86400000;
      
      this.serverCalls = this.serverCalls.filter(c => c.timestamp > oneDayAgo);
      this.toolCalls = this.toolCalls.filter(c => c.timestamp > oneDayAgo);
      this.resourceAccesses = this.resourceAccesses.filter(a => a.timestamp > oneDayAgo);
      this.permissionRequests = this.permissionRequests.filter(r => r.timestamp > oneDayAgo);
      
      logger.info('MCP monitor data cleanup completed');
    }, 3600000); // Every hour
  }
  
  /**
   * Get general stats (wrapper for other stats methods)
   */
  getStats(timeWindow: number = 3600000): any {
    return {
      serverStats: this.getServerStats(undefined, timeWindow),
      toolStats: this.getToolStats(undefined, timeWindow),
      resourceUsage: this.getResourceUsage(timeWindow),
      recentCalls: this.serverCalls.slice(-100),
      totalTracked: {
        serverCalls: this.serverCalls.length,
        toolCalls: this.toolCalls.length,
        resourceAccesses: this.resourceAccesses.length,
        permissionRequests: this.permissionRequests.length
      }
    };
  }
}

// Export singleton instance
export const mcpMonitor = new MCPServerMonitor();
