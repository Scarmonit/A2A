/**
 * Agent Performance Monitoring System
 *
 * Tracks and analyzes agent performance to optimize:
 * - Execution speed and efficiency
 * - Success rates and error patterns
 * - Resource utilization
 * - Agent selection recommendations
 */

import { AgentDescriptor } from './agents.js';

export interface PerformanceMetric {
  agentId: string;
  agentName: string;
  executionTime: number;
  success: boolean;
  error?: string;
  timestamp: number;
  inputSize?: number;
  outputSize?: number;
  memoryUsed?: number;
}

export interface AgentPerformanceProfile {
  agentId: string;
  agentName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  totalTime: number;
  lastExecuted?: number;
  errorPatterns: Map<string, number>;
  performanceScore: number; // 0-100
}

export class AgentPerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 10000; // Keep last 10k metrics

  /**
   * Record an agent execution
   */
  recordExecution(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get performance profile for an agent
   */
  getAgentProfile(agentId: string): AgentPerformanceProfile | null {
    const agentMetrics = this.metrics.filter(m => m.agentId === agentId);
    if (agentMetrics.length === 0) {
      return null;
    }

    const successfulExecutions = agentMetrics.filter(m => m.success).length;
    const failedExecutions = agentMetrics.length - successfulExecutions;
    const executionTimes = agentMetrics.map(m => m.executionTime);
    const totalTime = executionTimes.reduce((sum, time) => sum + time, 0);
    const avgExecutionTime = totalTime / agentMetrics.length;

    // Analyze error patterns
    const errorPatterns = new Map<string, number>();
    agentMetrics.filter(m => m.error).forEach(m => {
      const errorType = m.error!.split(':')[0];
      errorPatterns.set(errorType, (errorPatterns.get(errorType) || 0) + 1);
    });

    // Calculate performance score
    const successRate = successfulExecutions / agentMetrics.length;
    const speedScore = Math.max(0, 100 - (avgExecutionTime / 1000) * 10); // Penalty for slow execution
    const reliabilityScore = successRate * 100;
    const performanceScore = (speedScore * 0.3 + reliabilityScore * 0.7);

    return {
      agentId,
      agentName: agentMetrics[0].agentName,
      totalExecutions: agentMetrics.length,
      successfulExecutions,
      failedExecutions,
      successRate,
      avgExecutionTime: Math.round(avgExecutionTime),
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      totalTime,
      lastExecuted: agentMetrics[agentMetrics.length - 1].timestamp,
      errorPatterns,
      performanceScore: Math.round(performanceScore)
    };
  }

  /**
   * Get top performing agents
   */
  getTopPerformers(limit: number = 10): AgentPerformanceProfile[] {
    const agentIds = [...new Set(this.metrics.map(m => m.agentId))];
    const profiles = agentIds
      .map(id => this.getAgentProfile(id))
      .filter(p => p !== null) as AgentPerformanceProfile[];

    return profiles
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .slice(0, limit);
  }

  /**
   * Get agents with performance issues
   */
  getProblematicAgents(threshold: number = 50): AgentPerformanceProfile[] {
    const agentIds = [...new Set(this.metrics.map(m => m.agentId))];
    const profiles = agentIds
      .map(id => this.getAgentProfile(id))
      .filter(p => p !== null) as AgentPerformanceProfile[];

    return profiles
      .filter(p => p.performanceScore < threshold)
      .sort((a, b) => a.performanceScore - b.performanceScore);
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(agentId: string, timeWindow: number = 3600000): any {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(
      m => m.agentId === agentId && m.timestamp > now - timeWindow
    );

    if (recentMetrics.length === 0) {
      return null;
    }

    // Group by time buckets (15 min intervals)
    const bucketSize = 15 * 60 * 1000;
    const buckets = new Map<number, PerformanceMetric[]>();

    recentMetrics.forEach(metric => {
      const bucket = Math.floor(metric.timestamp / bucketSize) * bucketSize;
      if (!buckets.has(bucket)) {
        buckets.set(bucket, []);
      }
      buckets.get(bucket)!.push(metric);
    });

    // Calculate stats for each bucket
    const trends = Array.from(buckets.entries()).map(([timestamp, metrics]) => ({
      timestamp,
      executions: metrics.length,
      successRate: metrics.filter(m => m.success).length / metrics.length,
      avgTime: metrics.reduce((sum, m) => sum + m.executionTime, 0) / metrics.length
    }));

    return {
      agentId,
      timeWindow,
      buckets: trends.length,
      trends: trends.sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  /**
   * Get system-wide performance statistics
   */
  getSystemStats(): any {
    const totalExecutions = this.metrics.length;
    const successfulExecutions = this.metrics.filter(m => m.success).length;
    const uniqueAgents = new Set(this.metrics.map(m => m.agentId)).size;
    const avgExecutionTime = this.metrics.reduce((sum, m) => sum + m.executionTime, 0) / totalExecutions;

    // Recent performance (last hour)
    const oneHourAgo = Date.now() - 3600000;
    const recentMetrics = this.metrics.filter(m => m.timestamp > oneHourAgo);
    const recentSuccessRate = recentMetrics.filter(m => m.success).length / recentMetrics.length || 0;

    return {
      totalExecutions,
      successfulExecutions,
      failedExecutions: totalExecutions - successfulExecutions,
      overallSuccessRate: (successfulExecutions / totalExecutions * 100).toFixed(2) + '%',
      uniqueAgents,
      avgExecutionTime: Math.round(avgExecutionTime) + 'ms',
      recentPerformance: {
        lastHour: recentMetrics.length,
        successRate: (recentSuccessRate * 100).toFixed(2) + '%'
      }
    };
  }

  /**
   * Recommend best agent for a task based on performance history
   */
  recommendAgent(candidateAgentIds: string[], taskType?: string): string | null {
    if (candidateAgentIds.length === 0) {
      return null;
    }

    const profiles = candidateAgentIds
      .map(id => this.getAgentProfile(id))
      .filter(p => p !== null) as AgentPerformanceProfile[];

    if (profiles.length === 0) {
      // No history, return random
      return candidateAgentIds[0];
    }

    // Sort by performance score
    profiles.sort((a, b) => b.performanceScore - a.performanceScore);

    return profiles[0].agentId;
  }

  /**
   * Get performance comparison between agents
   */
  compareAgents(agentIds: string[]): any {
    const profiles = agentIds
      .map(id => this.getAgentProfile(id))
      .filter(p => p !== null) as AgentPerformanceProfile[];

    if (profiles.length === 0) {
      return { comparison: [] };
    }

    const comparison = profiles.map(profile => ({
      agentId: profile.agentId,
      agentName: profile.agentName,
      performanceScore: profile.performanceScore,
      successRate: (profile.successRate * 100).toFixed(2) + '%',
      avgTime: profile.avgExecutionTime + 'ms',
      executions: profile.totalExecutions
    }));

    // Determine best overall
    const best = comparison.reduce((best, current) =>
      current.performanceScore > best.performanceScore ? current : best
    );

    return {
      comparison: comparison.sort((a, b) => b.performanceScore - a.performanceScore),
      recommendation: best.agentId,
      reason: `Best overall performance score: ${best.performanceScore}/100`
    };
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThan: number = 7 * 24 * 3600000): number {
    const cutoff = Date.now() - olderThan;
    const beforeCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    return beforeCount - this.metrics.length;
  }

  /**
   * Export metrics for analysis
   */
  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.metrics, null, 2);
    } else {
      const headers = 'agentId,agentName,executionTime,success,timestamp,error\n';
      const rows = this.metrics.map(m =>
        `${m.agentId},${m.agentName},${m.executionTime},${m.success},${m.timestamp},${m.error || ''}`
      ).join('\n');
      return headers + rows;
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new AgentPerformanceMonitor();

// Helper function to track agent execution
export async function trackExecution<T>(
  agent: AgentDescriptor,
  operation: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();
  let success = false;
  let error: string | undefined;

  try {
    const result = await operation();
    success = true;
    return result;
  } catch (e: any) {
    error = e.message;
    throw e;
  } finally {
    performanceMonitor.recordExecution({
      agentId: agent.id,
      agentName: agent.name,
      executionTime: Date.now() - startTime,
      success,
      error,
      timestamp: Date.now()
    });
  }
}
