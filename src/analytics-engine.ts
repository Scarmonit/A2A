import pino from 'pino';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type AnalyticsEvent = {
  timestamp: number;
  eventType: string;
  agentId?: string;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  data: Record<string, any>;
  tags?: Record<string, string>;
};

export type MetricDefinition = {
  name: string;
  help: string;
  type: 'counter' | 'histogram' | 'gauge';
  labels?: string[];
  buckets?: number[]; // For histograms
};

export type AnalyticsQuery = {
  timeRange: {
    start: number;
    end: number;
  };
  filters?: {
    agentId?: string;
    eventType?: string;
    userId?: string;
    tags?: Record<string, string>;
  };
  aggregation?: {
    type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'percentile';
    field?: string;
    percentile?: number; // For percentile aggregation
  };
  groupBy?: string[];
  limit?: number;
};

export type AnalyticsInsight = {
  type: 'trend' | 'anomaly' | 'threshold' | 'usage_pattern';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  data: any;
  recommendations?: string[];
  confidence: number; // 0-1
};

export type UsagePattern = {
  agentId: string;
  pattern: 'peak_hours' | 'declining_usage' | 'error_spike' | 'new_user_growth';
  timeRange: { start: number; end: number };
  metrics: Record<string, number>;
  description: string;
};

export class AnalyticsEngine {
  private events: AnalyticsEvent[] = [];
  private metrics = new Map<string, any>();
  private registry = new Registry();
  private insights: AnalyticsInsight[] = [];
  private maxEventHistory = 100000; // Keep last 100k events in memory
  
  constructor() {
    this.initializeMetrics();
    this.startAnalyticsJobs();
  }
  
  // Track events
  track(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    const analyticsEvent: AnalyticsEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    this.events.push(analyticsEvent);
    
    // Maintain event history limit
    if (this.events.length > this.maxEventHistory) {
      this.events = this.events.slice(-this.maxEventHistory);
    }
    
    // Update Prometheus metrics
    this.updateMetrics(analyticsEvent);
    
    logger.debug({
      eventType: event.eventType,
      agentId: event.agentId,
      dataSize: Object.keys(event.data).length
    }, 'Analytics event tracked');
  }
  
  // Track agent execution
  trackAgentExecution(params: {
    agentId: string;
    requestId: string;
    capability: string;
    success: boolean;
    executionTime: number;
    toolsUsed: string[];
    errorType?: string;
    userId?: string;
  }): void {
    this.track({
      eventType: 'agent_execution',
      agentId: params.agentId,
      requestId: params.requestId,
      userId: params.userId,
      data: {
        capability: params.capability,
        success: params.success,
        executionTime: params.executionTime,
        toolsUsed: params.toolsUsed,
        errorType: params.errorType
      },
      tags: {
        status: params.success ? 'success' : 'error',
        capability: params.capability
      }
    });
  }
  
  // Track workflow execution
  trackWorkflowExecution(params: {
    workflowId: string;
    templateName?: string;
    stepCount: number;
    success: boolean;
    executionTime: number;
    failedSteps?: number;
    userId?: string;
  }): void {
    this.track({
      eventType: 'workflow_execution',
      requestId: params.workflowId,
      userId: params.userId,
      data: {
        templateName: params.templateName,
        stepCount: params.stepCount,
        success: params.success,
        executionTime: params.executionTime,
        failedSteps: params.failedSteps || 0
      },
      tags: {
        status: params.success ? 'success' : 'error',
        template: params.templateName || 'custom'
      }
    });
  }
  
  // Query analytics data
  query(query: AnalyticsQuery): {
    data: any[];
    metadata: {
      totalCount: number;
      timeRange: { start: number; end: number };
      groupedBy?: string[];
    };
  } {
    let filteredEvents = this.events.filter(event => 
      event.timestamp >= query.timeRange.start && 
      event.timestamp <= query.timeRange.end
    );
    
    // Apply filters
    if (query.filters) {
      if (query.filters.agentId) {
        filteredEvents = filteredEvents.filter(e => e.agentId === query.filters!.agentId);
      }
      if (query.filters.eventType) {
        filteredEvents = filteredEvents.filter(e => e.eventType === query.filters!.eventType);
      }
      if (query.filters.userId) {
        filteredEvents = filteredEvents.filter(e => e.userId === query.filters!.userId);
      }
      if (query.filters.tags) {
        filteredEvents = filteredEvents.filter(e => {
          return Object.entries(query.filters!.tags!).every(([key, value]) => 
            e.tags?.[key] === value
          );
        });
      }
    }
    
    let result: any = filteredEvents;
    
    // Group by if specified
    if (query.groupBy && query.groupBy.length > 0) {
      const grouped = this.groupEvents(filteredEvents, query.groupBy);
      result = Object.entries(grouped).map(([key, events]) => ({
        key,
        count: events.length,
        events: query.limit ? events.slice(0, query.limit) : events
      }));
    }
    
    // Apply limit
    if (query.limit && !query.groupBy) {
      result = result.slice(0, query.limit);
    }
    
    return {
      data: result,
      metadata: {
        totalCount: filteredEvents.length,
        timeRange: query.timeRange,
        groupedBy: query.groupBy
      }
    };
  }
  
  // Generate insights
  generateInsights(timeRange: { start: number; end: number }): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = [];
    
    const events = this.events.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );
    
    // Error rate analysis
    const agentExecutions = events.filter(e => e.eventType === 'agent_execution');
    if (agentExecutions.length > 0) {
      const errorRate = agentExecutions.filter(e => !e.data.success).length / agentExecutions.length;
      
      if (errorRate > 0.1) { // 10% error rate threshold
        insights.push({
          type: 'threshold',
          severity: errorRate > 0.3 ? 'critical' : 'warning',
          title: 'High Error Rate Detected',
          description: `Agent execution error rate is ${(errorRate * 100).toFixed(1)}%`,
          data: { errorRate, totalExecutions: agentExecutions.length },
          recommendations: [
            'Review agent configurations',
            'Check system resources',
            'Analyze error patterns'
          ],
          confidence: 0.9
        });
      }
    }
    
    // Performance trends
    const executionTimes = agentExecutions
      .map(e => e.data.executionTime as number)
      .filter(t => typeof t === 'number');
    
    if (executionTimes.length > 10) {
      const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const recentExecutions = agentExecutions.slice(-Math.ceil(agentExecutions.length * 0.3));
      const recentAvgTime = recentExecutions
        .map(e => e.data.executionTime as number)
        .reduce((a, b) => a + b, 0) / recentExecutions.length;
      
      if (recentAvgTime > avgExecutionTime * 1.5) {
        insights.push({
          type: 'trend',
          severity: 'warning',
          title: 'Performance Degradation Trend',
          description: `Recent executions are 50% slower than average (${recentAvgTime.toFixed(0)}ms vs ${avgExecutionTime.toFixed(0)}ms)`,
          data: { avgExecutionTime, recentAvgTime, degradation: (recentAvgTime / avgExecutionTime - 1) * 100 },
          recommendations: [
            'Scale up resources',
            'Optimize agent code',
            'Check for resource contention'
          ],
          confidence: 0.8
        });
      }
    }
    
    // Usage patterns
    const usagePatterns = this.detectUsagePatterns(events);
    usagePatterns.forEach(pattern => {
      insights.push({
        type: 'usage_pattern',
        severity: 'info',
        title: `Usage Pattern: ${pattern.pattern}`,
        description: pattern.description,
        data: pattern,
        confidence: 0.7
      });
    });
    
    // Cache insights
    this.insights = insights;
    
    logger.info({ insightCount: insights.length, timeRange }, 'Generated analytics insights');
    
    return insights;
  }
  
  // Get usage analytics
  getUsageAnalytics(timeRange: { start: number; end: number }): {
    totalRequests: number;
    uniqueAgents: number;
    uniqueUsers: number;
    averageExecutionTime: number;
    successRate: number;
    topAgents: Array<{ agentId: string; count: number; successRate: number }>;
    topCapabilities: Array<{ capability: string; count: number; avgTime: number }>;
    hourlyDistribution: Array<{ hour: number; count: number }>;
  } {
    const events = this.events.filter(e => 
      e.timestamp >= timeRange.start && 
      e.timestamp <= timeRange.end &&
      e.eventType === 'agent_execution'
    );
    
    const uniqueAgents = new Set(events.map(e => e.agentId)).size;
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean)).size;
    
    const executionTimes = events.map(e => e.data.executionTime as number).filter(Boolean);
    const averageExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length || 0;
    
    const successfulEvents = events.filter(e => e.data.success);
    const successRate = events.length > 0 ? successfulEvents.length / events.length : 0;
    
    // Top agents
    const agentStats = new Map<string, { count: number; successes: number }>();
    events.forEach(e => {
      if (e.agentId) {
        const stats = agentStats.get(e.agentId) || { count: 0, successes: 0 };
        stats.count++;
        if (e.data.success) stats.successes++;
        agentStats.set(e.agentId, stats);
      }
    });
    
    const topAgents = Array.from(agentStats.entries())
      .map(([agentId, stats]) => ({
        agentId,
        count: stats.count,
        successRate: stats.successes / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Top capabilities
    const capabilityStats = new Map<string, { count: number; totalTime: number }>();
    events.forEach(e => {
      const capability = e.data.capability as string;
      if (capability) {
        const stats = capabilityStats.get(capability) || { count: 0, totalTime: 0 };
        stats.count++;
        stats.totalTime += (e.data.executionTime as number) || 0;
        capabilityStats.set(capability, stats);
      }
    });
    
    const topCapabilities = Array.from(capabilityStats.entries())
      .map(([capability, stats]) => ({
        capability,
        count: stats.count,
        avgTime: stats.totalTime / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Hourly distribution
    const hourlyMap = new Map<number, number>();
    events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
    });
    
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourlyMap.get(hour) || 0
    }));
    
    return {
      totalRequests: events.length,
      uniqueAgents,
      uniqueUsers,
      averageExecutionTime,
      successRate,
      topAgents,
      topCapabilities,
      hourlyDistribution
    };
  }
  
  // Get real-time metrics
  getRealTimeMetrics(): Record<string, any> {
    const now = Date.now();
    const last5Min = now - 5 * 60 * 1000;
    const recentEvents = this.events.filter(e => e.timestamp >= last5Min);
    
    const agentExecutions = recentEvents.filter(e => e.eventType === 'agent_execution');
    const workflowExecutions = recentEvents.filter(e => e.eventType === 'workflow_execution');
    
    return {
      timestamp: now,
      period: '5m',
      requests: {
        total: agentExecutions.length,
        successful: agentExecutions.filter(e => e.data.success).length,
        rate: agentExecutions.length / (5 * 60) // per second
      },
      workflows: {
        total: workflowExecutions.length,
        successful: workflowExecutions.filter(e => e.data.success).length
      },
      performance: {
        avgExecutionTime: agentExecutions.length > 0 
          ? agentExecutions.reduce((sum, e) => sum + (e.data.executionTime || 0), 0) / agentExecutions.length
          : 0,
        activeAgents: new Set(agentExecutions.map(e => e.agentId)).size
      }
    };
  }
  
  private initializeMetrics(): void {
    const metrics: MetricDefinition[] = [
      {
        name: 'a2a_agent_executions_total',
        help: 'Total number of agent executions',
        type: 'counter',
        labels: ['agent_id', 'capability', 'status']
      },
      {
        name: 'a2a_agent_execution_duration_seconds',
        help: 'Agent execution duration in seconds',
        type: 'histogram',
        labels: ['agent_id', 'capability'],
        buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
      },
      {
        name: 'a2a_workflow_executions_total',
        help: 'Total number of workflow executions',
        type: 'counter',
        labels: ['template', 'status']
      },
      {
        name: 'a2a_active_agents',
        help: 'Number of active agents',
        type: 'gauge'
      }
    ];
    
    metrics.forEach(metric => {
      let promMetric;
      switch (metric.type) {
        case 'counter':
          promMetric = new Counter({
            name: metric.name,
            help: metric.help,
            labelNames: metric.labels,
            registers: [this.registry]
          });
          break;
        case 'histogram':
          promMetric = new Histogram({
            name: metric.name,
            help: metric.help,
            labelNames: metric.labels,
            buckets: metric.buckets,
            registers: [this.registry]
          });
          break;
        case 'gauge':
          promMetric = new Gauge({
            name: metric.name,
            help: metric.help,
            labelNames: metric.labels || [],
            registers: [this.registry]
          });
          break;
      }
      if (promMetric) {
        this.metrics.set(metric.name, promMetric);
      }
    });
  }
  
  private updateMetrics(event: AnalyticsEvent): void {
    switch (event.eventType) {
      case 'agent_execution':
        const executionsCounter = this.metrics.get('a2a_agent_executions_total');
        const executionHistogram = this.metrics.get('a2a_agent_execution_duration_seconds');
        
        if (executionsCounter) {
          executionsCounter.inc({
            agent_id: event.agentId,
            capability: event.data.capability,
            status: event.data.success ? 'success' : 'error'
          });
        }
        
        if (executionHistogram && event.data.executionTime) {
          executionHistogram.observe({
            agent_id: event.agentId,
            capability: event.data.capability
          }, event.data.executionTime / 1000);
        }
        break;
        
      case 'workflow_execution':
        const workflowCounter = this.metrics.get('a2a_workflow_executions_total');
        if (workflowCounter) {
          workflowCounter.inc({
            template: event.data.templateName || 'custom',
            status: event.data.success ? 'success' : 'error'
          });
        }
        break;
    }
  }
  
  private groupEvents(events: AnalyticsEvent[], groupBy: string[]): Record<string, AnalyticsEvent[]> {
    const grouped: Record<string, AnalyticsEvent[]> = {};
    
    events.forEach(event => {
      const keyParts = groupBy.map(field => {
        switch (field) {
          case 'agentId': return event.agentId || 'unknown';
          case 'eventType': return event.eventType;
          case 'hour': return new Date(event.timestamp).getHours().toString();
          case 'date': return new Date(event.timestamp).toISOString().split('T')[0];
          default: return event.data[field] || event.tags?.[field] || 'unknown';
        }
      });
      
      const key = keyParts.join('|');
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    
    return grouped;
  }
  
  private detectUsagePatterns(events: AnalyticsEvent[]): UsagePattern[] {
    const patterns: UsagePattern[] = [];
    
    // Detect peak hours
    const hourlyUsage = new Map<number, number>();
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      hourlyUsage.set(hour, (hourlyUsage.get(hour) || 0) + 1);
    });
    
    const maxUsage = Math.max(...hourlyUsage.values());
    const peakHours = Array.from(hourlyUsage.entries())
      .filter(([_, usage]) => usage > maxUsage * 0.8)
      .map(([hour]) => hour);
    
    if (peakHours.length > 0) {
      patterns.push({
        agentId: 'system',
        pattern: 'peak_hours',
        timeRange: { start: events[0]?.timestamp || 0, end: events[events.length - 1]?.timestamp || 0 },
        metrics: { peakHours: peakHours.length, maxUsage },
        description: `Peak usage detected during hours: ${peakHours.join(', ')}`
      });
    }
    
    return patterns;
  }
  
  private startAnalyticsJobs(): void {
    // Generate insights every hour
    setInterval(() => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.generateInsights({ start: oneHourAgo, end: Date.now() });
    }, 60 * 60 * 1000);
    
    // Clean old events daily
    setInterval(() => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const initialCount = this.events.length;
      this.events = this.events.filter(e => e.timestamp > oneDayAgo);
      
      logger.info({ 
        removed: initialCount - this.events.length, 
        remaining: this.events.length 
      }, 'Cleaned old analytics events');
    }, 24 * 60 * 60 * 1000);
  }
  
  // Export data for external analysis
  exportData(timeRange: { start: number; end: number }, format: 'json' | 'csv' = 'json'): string {
    const events = this.events.filter(e => 
      e.timestamp >= timeRange.start && e.timestamp <= timeRange.end
    );
    
    if (format === 'csv') {
      const headers = ['timestamp', 'eventType', 'agentId', 'requestId', 'data'];
      const rows = events.map(e => [
        new Date(e.timestamp).toISOString(),
        e.eventType,
        e.agentId || '',
        e.requestId || '',
        JSON.stringify(e.data)
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }
    
    return JSON.stringify(events, null, 2);
  }
  
  // Get Prometheus metrics
  async getMetrics(): Promise<string> {
    return await this.registry.metrics();
  }
}

export const analyticsEngine = new AnalyticsEngine();