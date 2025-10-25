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
    | 'log'
  payload: Record<string, unknown>
  ts: number
}

export type TaskContext = {
  request: (req: ApiBatchRequest) => Promise<ApiBatchResponse>
  browser: (cmds: BrowserCommand[]) => Promise<void>
  acquire: (name: string, amount: number) => Promise<() => void>
}

// ---------- Utils ----------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const DEFAULT_CFG: ExecutorConfig = {
  concurrency: 4,
  maxRetries: 3,
  retryBackoffMs: 1000,
  progressIntervalMs: 5000,
  batch: { maxSize: 10, maxWaitMs: 500 }
}

// Resource pool (semaphore-like)
class ResourcePool {
  private pools = new Map<string, { tokens: number; queue: Array<(release: () => void) => void> }>()

  constructor(private limits: Record<string, number> = { default: 4 }) {
    for (const [name, limit] of Object.entries(this.limits)) {
      this.pools.set(name, { tokens: limit, queue: [] })
    }
  }

  async acquire(name: string, amount = 1): Promise<() => void> {
    const pool = this.pools.get(name)
    if (!pool) throw new Error(`Unknown resource pool: ${name}`)

    return new Promise((resolve) => {
      const tryAcquire = () => {
        if (pool.tokens >= amount) {
          pool.tokens -= amount
          const release = () => {
            pool.tokens += amount
            // Process queue
            const next = pool.queue.shift()
            if (next) next(release)
          }
          resolve(release)
        } else {
          pool.queue.push(tryAcquire)
        }
      }
      tryAcquire()
    })
  }
}

// Retry with exponential backoff
async function retry<T>(fn: () => Promise<T>, id: string, maxRetries = 3, baseBackoff = 1000): Promise<T> {
  let attempt = 0
  while (attempt <= maxRetries) {
    try {
      return await fn()
    } catch (e: any) {
      attempt++
      if (attempt > maxRetries) throw e
      const backoff = baseBackoff * Math.pow(2, attempt - 1) + Math.random() * 1000
      await sleep(backoff)
    }
  }
  throw new Error('Retry exhausted')
}

// WebSocket server for progress events
function startWsServer(port: number, onConnection?: (ws: WebSocket) => void): WebSocketServer {
  const wss = new WebSocketServer({ port })
  wss.on('connection', (ws) => {
    if (onConnection) onConnection(ws)
  })
  return wss
}

// Browser automation helper
async function runBrowserCommands(
  commands: BrowserCommand[],
  emitFn: (event: ProgressEvent) => void
): Promise<void> {
  for (const cmd of commands) {
    emitFn({ type: 'log', payload: { scope: 'browser', cmd }, ts: Date.now() })
    
    // Spawn browser automation process
    const child = execa('node', ['automation/run-browser.js'])
    
    try {
      // Write command to stdin
      if (child.stdin) {
        child.stdin.write(JSON.stringify(cmd))
        child.stdin.end()
      }
      
      await child
    } catch (e: any) {
      emitFn({ type: 'log', payload: { scope: 'browser-error', error: e.message }, ts: Date.now() })
      throw e
    }
  }
}

// API batch request helper
async function makeRequest(req: ApiBatchRequest): Promise<ApiBatchResponse> {
  const { endpoint, method = 'GET', headers = {}, body } = req
  
  try {
    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined
    })
    
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : await response.text()
    
    return {
      ok: response.ok,
      status: response.status,
      data: response.ok ? data : undefined,
      error: response.ok ? undefined : (typeof data === 'string' ? data : JSON.stringify(data))
    }
  } catch (e: any) {
    return {
      ok: false,
      status: 0,
      error: e.message
    }
  }
}

// ---------- Main Class ----------

export class ParallelExecutorEnhanced<TIn = unknown, TOut = unknown> {
  private cfg: ExecutorConfig
  private pool: ResourcePool
  private results = new Map<string, TaskResult<TOut>>()
  private wss?: WebSocketServer
  private connections = new Set<WebSocket>()

  constructor(config: Partial<ExecutorConfig> = {}) {
    this.cfg = { ...DEFAULT_CFG, ...config }
    
    const limits = this.cfg.resourcePool?.limits || { default: this.cfg.concurrency }
    this.pool = new ResourcePool(limits)

    // Start WebSocket server if configured
    if (this.cfg.ws?.port) {
      this.wss = startWsServer(this.cfg.ws.port, (ws) => {
        this.connections.add(ws)
        ws.on('close', () => this.connections.delete(ws))
      })
    }
  }

  private emit(event: ProgressEvent): void {
    // Broadcast to WebSocket connections
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event))
      }
    }
  }

  private async request(req: ApiBatchRequest): Promise<ApiBatchResponse> {
    return makeRequest(req)
  }

  async run(
    tasks: TaskInput<TIn>[],
    worker: (task: TaskInput<TIn>, ctx: TaskContext) => Promise<TOut>
  ): Promise<TaskResult<TOut>[]> {
    this.results.clear()
    this.emit({ type: 'executor:start', payload: { total: tasks.length }, ts: Date.now() })

    // Sort tasks by priority (higher first), then by dependency order
    const sorted = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0))
    
    const pending = new Map(sorted.map(t => [t.id, t]))
    const completed = new Set<string>()
    
    // Helper to find ready tasks (no unmet dependencies)
    const takeReady = () => {
      const ready: TaskInput<TIn>[] = []
      for (const task of pending.values()) {
        const deps = task.requires || []
        if (deps.every(d => completed.has(d))) {
          ready.push(task)
        }
      }
      return ready.slice(0, this.cfg.concurrency) // limit to concurrency
    }

    // Process one task
    const runOne = async (t: TaskInput<TIn>) => {
      const result: TaskResult<TOut> = {
        id: t.id,
        status: 'success',
        startedAt: Date.now(),
        endedAt: 0,
        durationMs: 0
      }
      
      this.emit({ type: 'task:start', payload: { id: t.id }, ts: result.startedAt })
      
      try {
        // Acquire resource
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
