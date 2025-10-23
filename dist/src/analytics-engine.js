import pino from 'pino';
import { Counter, Histogram, Gauge, Registry } from 'prom-client';
// Platform/context awareness for deployments (Railway/Vercel/Cloudflare)
const PLATFORM = process.env.DEPLOY_PLATFORM || (process.env.VERCEL ? 'vercel' : process.env.RAILWAY_STATIC_URL ? 'railway' : process.env.CF_PAGES ? 'cloudflare' : 'unknown');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
class RingBuffer {
    capacity;
    buf;
    head = 0;
    size = 0;
    constructor(capacity) {
        this.capacity = capacity;
        this.buf = new Array(capacity);
    }
    push(item) {
        this.buf[this.head] = item;
        this.head = (this.head + 1) % this.capacity;
        if (this.size < this.capacity)
            this.size++;
    }
    toArray() {
        const out = [];
        for (let i = 0; i < this.size; i++) {
            const idx = (this.head - this.size + i + this.capacity) % this.capacity;
            const val = this.buf[idx];
            if (val !== undefined)
                out.push(val);
        }
        return out;
    }
}
export class AnalyticsEngine {
    static instance = null;
    registry;
    events = new RingBuffer(10_000);
    metrics = new Map();
    last5mCounters = {
        requests: 0,
        errors: 0,
        activeAgents: new Set()
    };
    constructor() {
        this.registry = new Registry();
    }
    static getInstance() {
        if (!AnalyticsEngine.instance) {
            AnalyticsEngine.instance = new AnalyticsEngine();
        }
        return AnalyticsEngine.instance;
    }
    track(event) {
        const fullEvent = { ...event, timestamp: Date.now() };
        this.events.push(fullEvent);
        if (fullEvent.agentId) {
            this.last5mCounters.activeAgents.add(fullEvent.agentId);
        }
        this.last5mCounters.requests++;
        if (fullEvent.eventType === 'error') {
            this.last5mCounters.errors++;
        }
        logger.debug({ event: fullEvent }, 'Analytics event tracked');
    }
    defineMetric(def) {
        if (this.metrics.has(def.name))
            return;
        let metric;
        switch (def.type) {
            case 'counter':
                metric = new Counter({
                    name: def.name,
                    help: def.help,
                    labelNames: def.labels || [],
                    registers: [this.registry]
                });
                break;
            case 'histogram':
                metric = new Histogram({
                    name: def.name,
                    help: def.help,
                    labelNames: def.labels || [],
                    buckets: def.buckets || [0.1, 0.5, 1, 2, 5, 10],
                    registers: [this.registry]
                });
                break;
            case 'gauge':
                metric = new Gauge({
                    name: def.name,
                    help: def.help,
                    labelNames: def.labels || [],
                    registers: [this.registry]
                });
                break;
        }
        this.metrics.set(def.name, metric);
    }
    incrementCounter(name, labels, value = 1) {
        const counter = this.metrics.get(name);
        if (counter) {
            labels ? counter.inc(labels, value) : counter.inc(value);
        }
    }
    observeHistogram(name, value, labels) {
        const hist = this.metrics.get(name);
        if (hist) {
            labels ? hist.observe(labels, value) : hist.observe(value);
        }
    }
    setGauge(name, value, labels) {
        const gauge = this.metrics.get(name);
        if (gauge) {
            labels ? gauge.set(labels, value) : gauge.set(value);
        }
    }
    async query(q) {
        const filtered = this.events.toArray().filter(e => {
            if (e.timestamp < q.timeRange.start || e.timestamp > q.timeRange.end)
                return false;
            if (q.filters?.agentId && e.agentId !== q.filters.agentId)
                return false;
            if (q.filters?.eventType && e.eventType !== q.filters.eventType)
                return false;
            if (q.filters?.userId && e.userId !== q.filters.userId)
                return false;
            if (q.filters?.tags) {
                for (const [k, v] of Object.entries(q.filters.tags)) {
                    if (e.tags?.[k] !== v)
                        return false;
                }
            }
            return true;
        });
        if (!q.aggregation)
            return filtered.slice(0, q.limit || 100);
        if (q.groupBy && q.groupBy.length > 0) {
            const agentStats = new Map();
            for (const ev of filtered) {
                const key = q.groupBy.map(field => ev[field] ?? 'unknown').join('__');
                const stats = agentStats.get(key) || { count: 0, successes: 0 };
                stats.count++;
                if (ev.eventType === 'success')
                    stats.successes++;
                agentStats.set(key, stats);
            }
            return Array.from(agentStats.entries()).map(([k, v]) => ({
                key: k,
                count: v.count,
                successRate: v.count > 0 ? (v.successes / v.count) * 100 : 0
            }));
        }
        switch (q.aggregation.type) {
            case 'count':
                return [{ value: filtered.length }];
            case 'sum': {
                const field = q.aggregation.field || 'value';
                const sum = filtered.reduce((acc, e) => acc + (e.data[field] || 0), 0);
                return [{ value: sum }];
            }
            case 'avg': {
                const field = q.aggregation.field || 'value';
                const vals = filtered.map(e => e.data[field] || 0);
                const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                return [{ value: avg }];
            }
            case 'min': {
                const field = q.aggregation.field || 'value';
                const vals = filtered.map(e => e.data[field] || 0);
                return [{ value: vals.length > 0 ? Math.min(...vals) : 0 }];
            }
            case 'max': {
                const field = q.aggregation.field || 'value';
                const vals = filtered.map(e => e.data[field] || 0);
                return [{ value: vals.length > 0 ? Math.max(...vals) : 0 }];
            }
            case 'percentile': {
                const field = q.aggregation.field || 'value';
                const p = q.aggregation.percentile || 95;
                const vals = filtered.map(e => e.data[field] || 0).sort((a, b) => a - b);
                const idx = Math.ceil((p / 100) * vals.length) - 1;
                return [{ value: vals.length > 0 ? vals[Math.max(0, idx)] : 0 }];
            }
            default:
                return [];
        }
    }
    async generateInsights() {
        const insights = [];
        const now = Date.now();
        const last5m = now - 5 * 60 * 1000;
        const recentEvents = await this.query({
            timeRange: { start: last5m, end: now },
            filters: {},
            limit: 10000
        });
        const errorRate = recentEvents.filter(e => e.eventType === 'error').length / Math.max(recentEvents.length, 1);
        if (errorRate > 0.1) {
            insights.push({
                type: 'threshold',
                severity: 'warning',
                title: 'High Error Rate',
                description: `Error rate is ${(errorRate * 100).toFixed(2)}% in the last 5 minutes`,
                data: { errorRate, recentErrorCount: recentEvents.filter(e => e.eventType === 'error').length },
                recommendations: ['Check recent logs for recurring error patterns', 'Review agent health metrics'],
                confidence: 0.95
            });
        }
        const uniqueAgents = new Set(recentEvents.filter(e => e.agentId).map(e => e.agentId));
        if (uniqueAgents.size > 50) {
            insights.push({
                type: 'usage_pattern',
                severity: 'info',
                title: 'High Agent Activity',
                description: `${uniqueAgents.size} unique agents active in the last 5 minutes`,
                data: { activeAgents: uniqueAgents.size },
                recommendations: ['Consider scaling resources if response times are increasing'],
                confidence: 0.9
            });
        }
        return insights;
    }
    async getSnapshot() {
        return {
            last5mRequests: this.last5mCounters.requests,
            last5mErrors: this.last5mCounters.errors,
            activeAgents: this.last5mCounters.activeAgents.size,
            insights: await this.generateInsights()
        };
    }
    async getMetrics() {
        return this.registry.metrics();
    }
}
export default AnalyticsEngine;
