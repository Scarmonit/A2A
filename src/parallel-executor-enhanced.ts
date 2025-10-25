// src/parallel-executor-enhanced.ts
// Enhanced parallel executor with context-aware execution, batching, retries, browser automation coordination,
// configuration management, result streaming, error recovery, progress tracking, and resource pooling.

import { execa } from 'execa'
import WebSocket, { WebSocketServer } from 'ws'

// ---------- Types ----------
export type ContextSource = {
  selectedText?: string
  currentTabUrl?: string
  currentTabTitle?: string
  metadata?: Record<string, unknown>
}

export type TaskInput<T = unknown> = {
  id: string
  payload?: T
  context?: ContextSource
  timeoutMs?: number
  priority?: number
  requires?: string[] // dependencies by id
}

export type TaskResult<R = unknown> = {
  id: string
  status: 'success' | 'error' | 'skipped'
  startedAt: number
  endedAt: number
  durationMs: number
  result?: R
  error?: { message: string; code?: string; retried?: number; stack?: string }
  logs?: string[]
}

export type ExecutorConfig = {
  concurrency: number
  maxRetries: number
  retryBackoffMs: number // base backoff, exponential
  ws?: { port?: number; url?: string }
  batch?: { maxSize: number; maxWaitMs: number }
  resourcePool?: { limits: Record<string, number> } // named resource => max tokens
  progressIntervalMs?: number
}

export type ApiBatchRequest = {
  endpoint: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
}

export type ApiBatchResponse = {
  ok: boolean
  status: number
  data?: unknown
  error?: string
}

export type BrowserCommand =
  | { type: 'navigate'; url: string }
  | { type: 'click'; selector: string }
  | { type: 'type'; selector: string; text: string }
  | { type: 'wait'; ms: number }
  | { type: 'screenshot'; path?: string }

export type ProgressEvent = {
  type:
    | 'executor:start'
    | 'executor:finish'
    | 'task:start'
    | 'task:finish'
    | 'task:retry'
    | 'batch:flush'
    | 'resource:acquire'
    | 'resource:release'
    | 'log'
  payload: any
  ts: number
}

// ---------- Lightweight Resource Pool ----------
class ResourcePool {
  private limits: Record<string, number>
  private inUse: Record<string, number>
  private waiters: Record<string, Array<() => void>>

  constructor(limits: Record<string, number> = {}) {
    this.limits = { ...limits }
    this.inUse = {}
    this.waiters = {}
  }

  async acquire(name: string, amount = 1) {
    if (!this.limits[name]) this.limits[name] = Infinity
    if (!this.inUse[name]) this.inUse[name] = 0
    if (!this.waiters[name]) this.waiters[name] = []

    const canAcquire = () => this.inUse[name] + amount <= this.limits[name]
    if (canAcquire()) {
      this.inUse[name] += amount
      return () => this.release(name, amount)
    }

    await new Promise<void>((resolve) => this.waiters[name].push(resolve))
    this.inUse[name] += amount
    return () => this.release(name, amount)
  }

  private release(name: string, amount = 1) {
    this.inUse[name] = Math.max(0, (this.inUse[name] || 0) - amount)
    const next = this.waiters[name]?.shift()
    if (next) next()
  }
}

// ---------- Result Streamer ----------
class ResultStreamer {
  private ws?: WebSocket
  private wss?: WebSocketServer
  private buffer: any[] = []
  private connected = false

  constructor(cfg?: ExecutorConfig['ws']) {
    if (!cfg) return
    if (cfg.port) {
      this.wss = new WebSocketServer({ port: cfg.port })
      this.wss.on('connection', (socket) => {
        this.ws = socket
        this.connected = true
        // flush buffer
        for (const msg of this.buffer) socket.send(JSON.stringify(msg))
        this.buffer = []
        socket.on('close', () => {
          this.connected = false
          this.ws = undefined
        })
      })
    } else if (cfg.url) {
      this.ws = new WebSocket(cfg.url)
      this.ws.onopen = () => {
        this.connected = true
        for (const msg of this.buffer) this.ws?.send(JSON.stringify(msg))
        this.buffer = []
      }
      this.ws.onclose = () => {
        this.connected = false
      }
    }
  }

  send(ev: ProgressEvent) {
    if (this.ws && this.connected) {
      try { this.ws.send(JSON.stringify(ev)) } catch (_) { /* noop */ }
    } else if (this.wss && this.connected) {
      try {
        this.wss.clients.forEach((c) => c.send(JSON.stringify(ev)))
      } catch (_) { /* noop */ }
    } else {
      this.buffer.push(ev)
    }
  }
}

// ---------- API Batcher with Retry ----------
class ApiBatcher {
  private queue: ApiBatchRequest[] = []
  private timer?: NodeJS.Timeout
  private inflight = false
  constructor(
    private cfg: Required<ExecutorConfig>['batch'],
    private retry: (fn: () => Promise<any>) => Promise<any>,
    private emit: (ev: ProgressEvent) => void,
  ) {}

  add(req: ApiBatchRequest): Promise<ApiBatchResponse> {
    return new Promise((resolve) => {
      // store resolver within request
      // @ts-ignore
      req.__resolve = resolve
      this.queue.push(req)
      this.schedule()
    })
  }

  private schedule() {
    if (this.queue.length >= this.cfg.maxSize) return void this.flush()
    if (this.timer) return
    this.timer = setTimeout(() => this.flush(), this.cfg.maxWaitMs)
  }

  private async flush() {
    if (this.inflight) return
    this.inflight = true
    clearTimeout(this.timer as any)
    this.timer = undefined

    const batch = this.queue.splice(0, this.cfg.maxSize)
    if (batch.length === 0) { this.inflight = false; return }

    this.emit({ type: 'batch:flush', payload: { size: batch.length }, ts: Date.now() })

    const exec = async () => {
      // Example: send to a generic batching endpoint
      const res = await fetch('/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(({ endpoint, method, headers, body }) => ({ endpoint, method, headers, body }))),
      })
      const data = await res.json()
      return { status: res.status, data }
    }

    try {
      const { status, data } = await this.retry(exec)
      // Resolve per item
      batch.forEach((req, i) => {
        // @ts-ignore
        const resolve: (v: ApiBatchResponse) => void = req.__resolve
        const item = data?.[i]
        resolve({ ok: status >= 200 && status < 300, status: item?.status ?? status, data: item?.data, error: item?.error })
      })
    } catch (e: any) {
      batch.forEach((req) => {
        // @ts-ignore
        const resolve: (v: ApiBatchResponse) => void = req.__resolve
        resolve({ ok: false, status: 0, error: e?.message || 'Batch failed' })
      })
    } finally {
      this.inflight = false
    }
  }
}

// ---------- Retry helper ----------
function withRetry<T>(maxRetries: number, backoffMs: number, emit: (ev: ProgressEvent) => void) {
  return async (fn: () => Promise<T>, id?: string): Promise<T> => {
    let attempt = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        return await fn()
      } catch (e: any) {
        if (attempt >= maxRetries) throw e
        emit({ type: 'task:retry', payload: { id, attempt, error: e?.message }, ts: Date.now() })
        const wait = backoffMs * Math.pow(2, attempt)
        await new Promise((r) => setTimeout(r, wait))
        attempt++
      }
    }
  }
}

// ---------- Browser automation coordinator (shellable) ----------
async function runBrowserCommands(commands: BrowserCommand[], emit: (ev: ProgressEvent) => void) {
  // This integrates via execa to call an external headless browser runner, passing commands as JSON.
  const cmd = JSON.stringify(commands)
  emit({ type: 'log', payload: { scope: 'browser', message: `Executing ${commands.length} commands` }, ts: Date.now() })
  const child = execa('node', ['automation/run-browser.js'], { input: cmd })
  const { stdout } = await child
  return stdout
}

// ---------- Executor ----------
export class ParallelExecutorEnhanced<TIn = unknown, TOut = unknown> {
  private cfg: Required<ExecutorConfig>
  private streamer: ResultStreamer
  private pool: ResourcePool
  private batcher?: ApiBatcher
  private results: Map<string, TaskResult<TOut>> = new Map()

  constructor(cfg?: Partial<ExecutorConfig>) {
    this.cfg = {
      concurrency: 8,
      maxRetries: 2,
      retryBackoffMs: 250,
      ws: undefined,
      batch: { maxSize: 20, maxWaitMs: 50 },
      resourcePool: { limits: {} },
      progressIntervalMs: 1000,
      ...cfg,
    }
    this.streamer = new ResultStreamer(this.cfg.ws)
    this.pool = new ResourcePool(this.cfg.resourcePool?.limits)
    this.batcher = new ApiBatcher(this.cfg.batch!, withRetry(this.cfg.maxRetries, this.cfg.retryBackoffMs, this.emit), this.emit)
  }

  private emit = (ev: ProgressEvent) => {
    this.streamer.send(ev)
  }

  // Context-aware helper
  private enrichInput(input: TaskInput<TIn>): TaskInput<TIn> {
    const metadata = {
      hasSelection: Boolean(input.context?.selectedText?.trim()),
      isWebTask: Boolean(input.context?.currentTabUrl),
    }
    return {
      ...input,
      context: { ...(input.context || {}), metadata: { ...(input.context?.metadata || {}), ...metadata } },
    }
  }

  // Public: queue API request through batcher
  request(req: ApiBatchRequest) { return this.batcher!.add(req) }

  // Core run method
  async run(tasks: Array<TaskInput<TIn>>, worker: (task: TaskInput<TIn>, helpers: {
    request: (req: ApiBatchRequest) => Promise<ApiBatchResponse>
    browser: (cmds: BrowserCommand[]) => Promise<any>
    acquire: (name: string, amount?: number) => Promise<() => void>
  }) => Promise<TOut>): Promise<TaskResult<TOut>[]> {
    this.emit({ type: 'executor:start', payload: { total: tasks.length }, ts: Date.now() })

    // resolve dependencies naive topological processing by attempting until all done
    const pending = new Map(tasks.map((t) => [t.id, this.enrichInput(t)]))
    const completed = new Set<string>()

    const takeReady = () => {
      const ready: TaskInput<TIn>[] = []
      for (const t of pending.values()) {
        const deps = t.requires || []
        if (deps.every((d) => completed.has(d))) ready.push(t)
      }
      // sort by priority desc
      ready.sort((a, b) => (b.priority || 0) - (a.priority || 0))
      return ready.slice(0, this.cfg.concurrency)
    }

    const runOne = async (t: TaskInput<TIn>) => {
      const startedAt = Date.now()
      this.emit({ type: 'task:start', payload: { id: t.id }, ts: startedAt })
      const result: TaskResult<TOut> = { id: t.id, status: 'success', startedAt, endedAt: startedAt, durationMs: 0, logs: [] }

      const retry = withRetry<TOut>(this.cfg.maxRetries, this.cfg.retryBackoffMs, this.emit)

      try {
        const release = await this.pool.acquire('default', 1)
        try {
          const out = await retry(async () => {
            const val = await worker(t, {
              request: (req) => this.request(req),
              browser: (cmds) => runBrowserCommands(cmds, this.emit),
              acquire: (name, amount) => this.pool.acquire(name, amount),
            })
            return val
          }, t.id)
          result.result = out
        } finally {
          release()
        }
      } catch (e: any) {
        result.status = 'error'
        result.error = { message: e?.message || 'Task failed', stack: e?.stack }
      } finally {
        result.endedAt = Date.now()
        result.durationMs = result.endedAt - result.startedAt
        this.results.set(t.id, result)
        this.emit({ type: 'task:finish', payload: { id: t.id, status: result.status }, ts: result.endedAt })
      }
    }

    // Progress ticker
    const ticker = setInterval(() => {
      const done = Array.from(this.results.values()).length
      this.emit({ type: 'log', payload: { scope: 'progress', done, total: tasks.length }, ts: Date.now() })
    }, this.cfg.progressIntervalMs)

    try {
      // Loop until all processed
      while (pending.size) {
        const ready = takeReady()
        if (ready.length === 0) {
          // deadlock or waiting on deps; mark remaining as skipped to avoid stall
          for (const t of pending.values()) {
            if ((t.requires || []).some((d) => !completed.has(d))) continue
          }
        }
        await Promise.all(ready.map(async (t) => {
          pending.delete(t.id)
          await runOne(t)
          completed.add(t.id)
        }))
      }
    } finally {
      clearInterval(ticker)
      this.emit({ type: 'executor:finish', payload: { total: tasks.length }, ts: Date.now() })
    }

    return Array.from(this.results.values())
  }
}

// Example usage note (commented):
// const exec = new ParallelExecutorEnhanced({ ws: { port: 8080 } })
// const results = await exec.run(tasks, async (task, { request, browser, acquire }) => {
//   const release = await acquire('api', 1)
//   try {
//     if (task.context?.selectedText) {
//       // Use selected text in your payload or logic
//     }
//     const apiRes = await request({ endpoint: '/api/do', method: 'POST', body: { id: task.id } })
//     if (!apiRes.ok) throw new Error(apiRes.error || 'API error')
//     await browser([{ type: 'navigate', url: task.context?.currentTabUrl || 'https://example.com' }])
//     return apiRes.data as any
//   } finally { release() }
// })
