import pino from 'pino'
import { Counter, Histogram, Gauge, Registry } from 'prom-client'
// Platform/context awareness for deployments (Railway/Vercel/Cloudflare)
const PLATFORM = process.env.DEPLOY_PLATFORM || (process.env.VERCEL ? 'vercel' : process.env.RAILWAY_STATIC_URL ? 'railway' : process.env.CF_PAGES ? 'cloudflare' : 'unknown')
const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
export type AnalyticsEvent = {
  timestamp: number
  eventType: string
  agentId?: string
  requestId?: string
  sessionId?: string
  userId?: string
  data: Record<string, any>
  tags?: Record<string, string>
}
export type MetricDefinition = {
  name: string
  help: string
  type: 'counter' | 'histogram' | 'gauge'
  labels?: string[]
  buckets?: number[] // For histograms
}
export type AnalyticsQuery = {
  timeRange: { start: number; end: number }
  filters?: { agentId?: string; eventType?: string; userId?: string; tags?: Record<string, string> }
  aggregation?: { type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'percentile'; field?: string; percentile?: number }
  groupBy?: string[]
  limit?: number
}
export type AnalyticsInsight = {
  type: 'trend' | 'anomaly' | 'threshold' | 'usage_pattern'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  data: any
  recommendations?: string[]
  confidence: number // 0-1
}
export type UsagePattern = {
  agentId: string
  pattern: 'peak_hours' | 'declining_usage' | 'error_spike' | 'new_user_growth'
  timeRange: { start: number; end: number }
  metrics: Record<string, number>
  description: string
}
class RingBuffer<T> {
  private buf: Array<T | undefined>
  private head = 0
  private size = 0
  constructor(private capacity: number) { this.buf = new Array(capacity) }
  push(item: T) { this.buf[this.head] = item; this.head = (this.head + 1) % this.capacity; if (this.size < this.capacity) this.size++ }
  toArray(): T[] { const out: T[] = []; for (let i = 0; i < this.size; i++) { const idx = (this.head - this.size + i + this.capacity) % this.capacity; const v = this.buf[idx]; if (v !== undefined) out.push(v) } return out }
  get length() { return this.size }
}
export class AnalyticsEngine {
  private events = new RingBuffer<AnalyticsEvent>(Number(process.env.ANALYTICS_MAX_EVENTS || 100000))
  private metrics = new Map<string, any>()
  private registry = new Registry()
  private insights: AnalyticsInsight[] = []
  private last5mCounters = { agentExec: 0, workflowExec: 0, successes: 0, execTimeSum: 0, activeAgents: new Set<string>() }
  private last5mWindow: Array<{ t: number; type: 'agent' | 'workflow'; success?: boolean; execTime?: number; agentId?: string }> = []
  constructor() { this.initializeMetrics(); this.startAnalyticsJobs() }
  track(event: Omit<AnalyticsEvent, 'timestamp'>): void {
    try {
      const analyticsEvent: AnalyticsEvent = { ...event, timestamp: Date.now() }
      const sampleRate = Number(process.env.ANALYTICS_SAMPLE_RATE || 1)
      if (sampleRate < 1 && Math.random() > sampleRate) { this.updateMetrics(analyticsEvent); this.updateRealtime(analyticsEvent); return }
      this.events.push(analyticsEvent)
      this.updateMetrics(analyticsEvent)
      this.updateRealtime(analyticsEvent)
      logger.debug({ eventType: event.eventType, agentId: event.agentId, dataSize: Object.keys(event.data || {}).length }, 'Analytics event tracked')
    } catch (err) { logger.warn({ err }, 'Failed to track analytics event') }
  }
  trackAgentExecution(params: { agentId: string; requestId: string; capability: string; success: boolean; executionTime: number; toolsUsed: string[]; errorType?: string; userId?: string; platform?: string }): void {
    this.track({ eventType: 'agent_execution', agentId: params.agentId, requestId: params.requestId, userId: params.userId, data: { capability: params.capability, success: params.success, executionTime: params.executionTime, toolsUsed: params.toolsUsed, errorType: params.errorType, platform: params.platform || PLATFORM }, tags: { status: params.success ? 'success' : 'error', capability: params.capability, platform: params.platform || PLATFORM } })
  }
  trackWorkflowExecution(params: { workflowId: string; templateName?: string; stepCount: number; success: boolean; executionTime: number; failedSteps?: number; userId?: string; platform?: string }): void {
    this.track({ eventType: 'workflow_execution', requestId: params.workflowId, userId: params.userId, data: { templateName: params.templateName, stepCount: params.stepCount, success: params.success, executionTime: params.executionTime, failedSteps: params.failedSteps || 0, platform: params.platform || PLATFORM }, tags: { status: params.success ? 'success' : 'error', template: params.templateName || 'custom', platform: params.platform || PLATFORM } })
  }
  query(query: AnalyticsQuery): { data: any[]; metadata: { totalCount: number; timeRange: { start: number; end: number }; groupedBy?: string[] } } {
    const all = this.events.toArray()
    let filteredEvents = all.filter(e => e.timestamp >= query.timeRange.start && e.timestamp <= query.timeRange.end)
    if (query.filters) {
      if (query.filters.agentId) filteredEvents = filteredEvents.filter(e => e.agentId === query.filters!.agentId)
      if (query.filters.eventType) filteredEvents = filteredEvents.filter(e => e.eventType === query.filters!.eventType)
      if (query.filters.userId) filteredEvents = filteredEvents.filter(e => e.userId === query.filters!.userId)
      if (query.filters.tags) filteredEvents = filteredEvents.filter(e => Object.entries(query.filters!.tags!).every(([k, v]) => e.tags?.[k] === v))
    }
    let result: any = filteredEvents
    if (query.groupBy && query.groupBy.length > 0) { const grouped = this.groupEvents(filteredEvents, query.groupBy); result = Object.entries(grouped).map(([key, events]) => ({ key, count: events.length, events: query.limit ? events.slice(0, query.limit) : events })) }
    if (query.limit && !query.groupBy) result = result.slice(0, query.limit)
    return { data: result, metadata: { totalCount: filteredEvents.length, timeRange: query.timeRange, groupedBy: query.groupBy } }
  }
  generateInsights(timeRange: { start: number; end: number }): AnalyticsInsight[] {
    const events = this.events.toArray().filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
    const insights: AnalyticsInsight[] = []
    const agentExecutions = events.filter(e => e.eventType === 'agent_execution')
    if (agentExecutions.length > 0) {
      const errorRate = agentExecutions.filter(e => !e.data.success).length / agentExecutions.length
      if (errorRate > 0.1) { insights.push({ type: 'threshold', severity: errorRate > 0.3 ? 'critical' : 'warning', title: 'High Error Rate Detected', description: `Agent execution error rate is ${(errorRate * 100).toFixed(1)}%`, data: { errorRate, totalExecutions: agentExecutions.length }, recommendations: ['Review agent configurations', 'Check system resources', 'Analyze error patterns'], confidence: 0.9 }) }
    }
    const executionTimes = agentExecutions.map(e => e.data.executionTime as number).filter(t => typeof t === 'number')
    if (executionTimes.length > 10) {
      const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      const recentExecutions = agentExecutions.slice(-Math.ceil(agentExecutions.length * 0.3))
      const recentAvgTime = recentExecutions.map(e => e.data.executionTime as number).reduce((a, b) => a + b, 0) / recentExecutions.length
      if (recentAvgTime > avgExecutionTime * 1.5) { insights.push({ type: 'trend', severity: 'warning', title: 'Performance Degradation Trend', description: `Recent executions are 50% slower than average (${recentAvgTime.toFixed(0)}ms vs ${avgExecutionTime.toFixed(0)}ms)`, data: { avgExecutionTime, recentAvgTime, degradation: (recentAvgTime / avgExecutionTime - 1) * 100 }, recommendations: ['Scale up resources', 'Optimize agent code', 'Check for resource contention'], confidence: 0.8 }) }
    }
    const byPlatform = this.groupEvents(agentExecutions, ['platform'])
    Object.entries(byPlatform).forEach(([platform, evts]) => {
      const rate = evts.filter(e => !e.data.success).length / (evts.length || 1)
      if (rate > 0.2) insights.push({ type: 'anomaly', severity: 'warning', title: `Elevated errors on ${platform}`, description: `Error rate ${(rate * 100).toFixed(1)}% detected on ${platform}`, data: { platform, total: evts.length, errorRate: rate }, recommendations: ['Check platform logs', 'Verify env vars and DNS', 'Redeploy service if needed'], confidence: 0.75 })
    })
    const usagePatterns = this.detectUsagePatterns(events)
    usagePatterns.forEach(pattern => insights.push({ type: 'usage_pattern', severity: 'info', title: `Usage Pattern: ${pattern.pattern}`, description: pattern.description, data: pattern, confidence: 0.7 }))
    this.insights = insights
    logger.info({ insightCount: insights.length, timeRange }, 'Generated analytics insights')
    return insights
  }
  getUsageAnalytics(timeRange: { start: number; end: number }): { totalRequests: number; uniqueAgents: number; uniqueUsers: number; averageExecutionTime: number; successRate: number; topAgents: Array<{ agentId: string; count: number; successRate: number }>; topCapabilities: Array<{ capability: string; count: number; avgTime: number }>; hourlyDistribution: Array<{ hour: number; count: number }> } {
    const events = this.events.toArray().filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end && e.eventType === 'agent_execution')
    const uniqueAgents = new Set(events.map(e => e.agentId).filter(Boolean)).size
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean)).size
    const executionTimes = events.map(e => e.data.executionTime as number).filter((v): v is number => typeof v === 'number' && !isNaN(v))
    const averageExecutionTime = executionTimes reduce((a, b) => a + b, 0) / (executionTimes.length || 1)
    const successfulEvents = events.filter(e => e.data.success)
    const successRate = events length > 0 ? successfulEvents.length / events.length : 0
    const agentStats = new Map<string, { count: number; successes: number }>()
    events.forEach(e => { if (e.agentId) { const stats = agentStats.get(e.agentId) || { count: 0, successes: 0 }; stats.count++; if (e.data.success) stats.successes++; agentStats.set(e.agentId, stats) } })
    const topAgents = Array.from(agentStats.entries()).map(([agentId, stats]) => ({ agentId, count: stats.count, successRate: stats.successes / (stats.count || 1) })).sort((a, b) => b.count - a.count).slice(0, 10)
    const capabilityStats = new Map<string, { count: number; totalTime: number }>()
    events.forEach(e => { const capability = e.data.capability as string; if (capability) { const stats = capabilityStats.get(capability) || { count: 0, totalTime: 0 }; stats.count++; stats.totalTime += (e.data.executionTime as number) || 0; capabilityStats.set(capability, stats) } })
    const topCapabilities = Array.from(capabilityStats.entries()).map(([capability, stats]) => ({ capability, count: stats.count, avgTime: stats.totalTime / (stats.count || 1) })).sort((a, b) => b.count - a.count).slice(0, 10)
    const hourlyMap = new Map<number, number>()
    events.forEach(e => { const hour = new Date(e.timestamp).getHours(); hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1) })
    const hourlyDistribution = Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourlyMap.get(hour) || 0 }))
    return { totalRequests: events.length, uniqueAgents, uniqueUsers, averageExecutionTime, successRate, topAgents, topCapabilities, hourlyDistribution }
  }
  getRealTimeMetrics(): Record<string, any> {
    const now = Date.now()
    const fiveMinAgo = now - 5 * 60 * 1000
    while (this.last5mWindow.length > 0 && this.last5mWindow[0].t < fiveMinAgo) {
      const old = this.last5mWindow.shift()!
      if (old.type === 'agent') {
        this.last5mCounters.agentExec--
        if (old.success) this.last5mCounters.successes--
        if (old.execTime) this.last5mCounters.execTimeSum -= old.execTime
      } else {
        this.last5mCounters.workflowExec--
      }
    }
    const active = new Set<string>()
    for (const p of this.last5mWindow) if (p.agentId) active.add(p.agentId)
    this.last5mCounters.activeAgents = active
    return {
      timestamp: now,
      period: '5m',
      requests: { total: this.last5mCounters.agentExec, successful: this.last5mCounters.successes, rate: this.last5mCounters.agentExec / (5 * 60) },
      workflows: { total: this.last5mCounters.workflowExec, successful: 0 },
      performance: { avgExecutionTime: this.last5mCounters.agentExec ? this.last5mCounters.execTimeSum / this.last5mCounters.agentExec : 0, activeAgents: this.last5mCounters.activeAgents.size }
    }
  }
  private initializeMetrics(): void {
    const metrics: MetricDefinition[] = [
      { name: 'a2a_agent_executions_total', help: 'Total number of agent executions', type: 'counter', labels: ['agent_id', 'capability', 'status', 'platform'] },
      { name: 'a2a_agent_execution_duration_seconds', help: 'Agent execution duration in seconds', type: 'histogram', labels: ['agent_id', 'capability', 'platform'], buckets: [0.05, 0.1, 0.5, 1, 2, 5, 10, 30, 60] },
      { name: 'a2a_workflow_executions_total', help: 'Total number of workflow executions', type: 'counter', labels: ['template', 'status', 'platform'] },
      { name: 'a2a_active_agents', help: 'Number of active agents', type: 'gauge' }
    ]
    metrics.forEach(metric => {
      let promMetric
      switch (metric.type) {
        case 'counter':
          promMetric = new Counter({ name: metric.name, help: metric.help, labelNames: metric.labels, registers: [this.registry] })
          break
        case 'histogram':
          promMetric = new Histogram({ name: metric.name, help: metric.help, labelNames: metric.labels, buckets: metric.buckets, registers: [this.registry] })
          break
        case 'gauge':
          promMetric = new Gauge({ name: metric.name, help: metric.help, labelNames: metric.labels, registers: [this.registry] })
          break
      }
      if (promMetric) this.metrics.set(metric.name, promMetric)
    })
  }
  private updateMetrics(event: AnalyticsEvent): void {
    switch (event.eventType) {
      case 'agent_execution': {
        const executionsCounter = this.metrics.get('a2a_agent_executions_total') as Counter | undefined
        if (executionsCounter) {
          executionsCounter.inc({
            agent_id: event.agentId || 'unknown',
