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
      logger.debug({ event: analyticsEvent }, 'Analytics event tracked')
    } catch (error) {
      logger.error({ error }, 'Error tracking analytics event')
    }
  }

  private updateRealtime(event: AnalyticsEvent): void {
    const now = Date.now()
    const fiveMinAgo = now - 5 * 60 * 1000
    this.last5mWindow = this.last5mWindow.filter(e => e.t >= fiveMinAgo)
    if (event.eventType === 'agent.execute') {
      this.last5mCounters.agentExec++
      this.last5mWindow.push({ t: now, type: 'agent', success: event.data.success, execTime: event.data.executionTime, agentId: event.agentId })
      if (event.agentId) this.last5mCounters.activeAgents.add(event.agentId)
      if (event.data.success) this.last5mCounters.successes++
      if (typeof event.data.executionTime === 'number') this.last5mCounters.execTimeSum += event.data.executionTime
    } else if (event.eventType === 'workflow.execute') {
      this.last5mCounters.workflowExec++
      this.last5mWindow.push({ t: now, type: 'workflow', success: event.data.success, execTime: event.data.executionTime })
      if (event.data.success) this.last5mCounters.successes++
      if (typeof event.data.executionTime === 'number') this.last5mCounters.execTimeSum += event.data.executionTime
    }
  }

  private updateMetrics(event: AnalyticsEvent): void {
    const counter = this.metrics.get(`event_${event.eventType}_total`) as Counter<any> | undefined
    if (counter) counter.inc({ platform: PLATFORM, agent_id: event.agentId || 'unknown' })
    if (event.eventType === 'agent.execute' && typeof event.data.executionTime === 'number') {
      const hist = this.metrics.get('agent_execution_duration_seconds') as Histogram<any> | undefined
      if (hist) hist.observe({ platform: PLATFORM, agent_id: event.agentId || 'unknown' }, event.data.executionTime / 1000)
    }
  }

  getRealTimeStats(): any {
    const events = this.last5mWindow
    const executionTimes = events.map(e => e.execTime).filter((t): t is number => t !== undefined)
    const averageExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / (executionTimes.length || 1)
    const successfulEvents = events.filter(e => e.success === true)
    const successRate = events.length > 0 ? successfulEvents.length / events.length : 0
    const agentStats = new Map<string, { count: number; successes: number }>()
    events.forEach(e => {
      if (e.agentId) {
        const stat = agentStats.get(e.agentId) || { count: 0, successes: 0 }
        stat.count++
        if (e.success) stat.successes++
        agentStats.set(e.agentId, stat)
      }
    })
    return {
      window: '5m',
      timestamp: Date.now(),
      agentExecutions: this.last5mCounters.agentExec,
      workflowExecutions: this.last5mCounters.workflowExec,
      totalExecutions: this.last5mCounters.agentExec + this.last5mCounters.workflowExec,
      successRate,
      averageExecutionTime,
      activeAgents: this.last5mCounters.activeAgents.size,
      agentStats: Object.fromEntries(agentStats)
    }
  }

  query(q: AnalyticsQuery): AnalyticsEvent[] {
    let results = this.events.toArray().filter(e => e.timestamp >= q.timeRange.start && e.timestamp <= q.timeRange.end)
    if (q.filters) {
      if (q.filters.agentId) results = results.filter(e => e.agentId === q.filters!.agentId)
      if (q.filters.eventType) results = results.filter(e => e.eventType === q.filters!.eventType)
      if (q.filters.userId) results = results.filter(e => e.userId === q.filters!.userId)
      if (q.filters.tags) results = results.filter(e => e.tags && Object.entries(q.filters!.tags!).every(([k, v]) => e.tags![k] === v))
    }
    if (q.limit) results = results.slice(0, q.limit)
    return results
  }

  aggregate(q: AnalyticsQuery): any {
    const events = this.query(q)
    if (!q.aggregation) return { count: events.length }
    const agg = q.aggregation
    if (agg.type === 'count') return { count: events.length }
    if (!agg.field) return { error: 'field required for aggregation' }
    const values = events.map(e => e.data[agg.field!]).filter(v => typeof v === 'number')
    switch (agg.type) {
      case 'sum': return { sum: values.reduce((a, b) => a + b, 0) }
      case 'avg': return { avg: values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0 }
      case 'min': return { min: values.length > 0 ? Math.min(...values) : null }
      case 'max': return { max: values.length > 0 ? Math.max(...values) : null }
      case 'percentile': {
        const p = agg.percentile || 50
        const sorted = values.sort((a, b) => a - b)
        const idx = Math.ceil((p / 100) * sorted.length) - 1
        return { percentile: sorted[idx] || null }
      }
      default: return { error: 'unknown aggregation type' }
    }
  }

  generateInsights(): AnalyticsInsight[] {
    const insights: AnalyticsInsight[] = []
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const recentEvents = this.events.toArray().filter(e => e.timestamp >= oneHourAgo)
    const errorEvents = recentEvents.filter(e => e.eventType.endsWith('.error'))
    if (errorEvents.length > 10) {
      insights.push({
        type: 'anomaly',
        severity: 'warning',
        title: 'High error rate detected',
        description: `${errorEvents.length} errors in the last hour`,
        data: { errorCount: errorEvents.length, timeRange: { start: oneHourAgo, end: now } },
        recommendations: ['Check logs for error details', 'Investigate agent configurations'],
        confidence: 0.8
      })
    }
    return insights
  }

  private initializeMetrics(): void {
    const eventCounter = new Counter({ name: 'analytics_events_total', help: 'Total analytics events', labelNames: ['platform', 'event_type'], registers: [this.registry] })
    this.metrics.set('event_total', eventCounter)
    const agentExecDuration = new Histogram({ name: 'agent_execution_duration_seconds', help: 'Agent execution duration', labelNames: ['platform', 'agent_id'], registers: [this.registry] })
    this.metrics.set('agent_execution_duration_seconds', agentExecDuration)
  }

  private startAnalyticsJobs(): void {
    setInterval(() => {
      const stats = this.getRealTimeStats()
      logger.info({ stats }, 'Real-time analytics stats')
      const insights = this.generateInsights()
      if (insights.length > 0) {
        this.insights = insights
        logger.info({ insights }, 'Generated analytics insights')
      }
    }, 60000)
  }

  getMetrics(): string {
    return this.registry.metrics()
  }
}
