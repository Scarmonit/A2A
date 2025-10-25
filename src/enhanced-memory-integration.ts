/*
  enhanced-memory-integration.ts
  Integrates Claude's Memory Tool API with A2A Agent memory system.
  - BetaAbstractMemoryTool subclass for A2A backend
  - Integration with AgentMemorySystem persistence
  - Supports commands: view, create, str_replace, insert, delete, rename
  - Path traversal protection for /memories directory
  - Context editing integration with automatic preservation
  - Parallel execution support for memory operations
  - WebSocket streaming for memory events
  - Error handling, logging with pino, and rich TypeScript types
*/

import pino from 'pino'
import { WebSocketServer } from 'ws'

// Hypothetical A2A imports – adapt names to repository actual structure if they differ
// These are typed in a way that they can be easily mapped to existing code
export interface MemoryRecord {
  id: string
  path: string // normalized relative path under /memories
  content: string
  createdAt: number
  updatedAt: number
  meta?: Record<string, any>
}

export interface AgentMemorySystem {
  rootDir: string // absolute path to repo root
  listMemories(): Promise<MemoryRecord[]>
  readMemory(path: string): Promise<MemoryRecord | null>
  writeMemory(path: string, content: string, meta?: Record<string, any>): Promise<MemoryRecord>
  deleteMemory(path: string): Promise<boolean>
  renameMemory(oldPath: string, newPath: string): Promise<MemoryRecord>
}

// Claude BetaAbstractMemoryTool interface (simplified to avoid external deps)
export type MemoryCommand = 'view' | 'create' | 'str_replace' | 'insert' | 'delete' | 'rename'

export interface MemoryToolRequest {
  command: MemoryCommand
  path?: string
  newPath?: string
  content?: string
  replace?: { search: string | RegExp; replace: string; flags?: string }
  insert?: { position: 'start' | 'end' | number; text: string }
  context?: { before?: string; after?: string; selection?: string }
  meta?: Record<string, any>
}

export interface MemoryToolResponse<T = any> {
  ok: boolean
  data?: T
  error?: string
}

// Event streaming types
export type MemoryEventType =
  | 'memory:view'
  | 'memory:create'
  | 'memory:update'
  | 'memory:delete'
  | 'memory:rename'
  | 'memory:error'

export interface MemoryEvent {
  type: MemoryEventType
  timestamp: number
  payload: Record<string, any>
}

// Utilities
import { promises as fs } from 'fs'
import path from 'path'

const logger = pino({ name: 'a2a-memory', level: process.env.LOG_LEVEL || 'info' })

// WebSocket broadcaster
class MemoryEventBus {
  private wss?: WebSocketServer

  constructor(private port: number = Number(process.env.MEMORY_WS_PORT || 0)) {
    if (this.port) {
      try {
        this.wss = new WebSocketServer({ port: this.port })
        logger.info({ port: this.port }, 'Memory WebSocket server started')
      } catch (e) {
        logger.warn({ err: e }, 'Failed to start WebSocket server; continuing without WS')
      }
    }
  }

  broadcast(event: MemoryEvent) {
    if (!this.wss) return
    const data = JSON.stringify(event)
    for (const client of this.wss.clients) {
      try {
        if ((client as any).readyState === 1) (client as any).send(data)
      } catch (e) {
        logger.warn({ err: e }, 'WS broadcast error')
      }
    }
  }
}

const eventBus = new MemoryEventBus()

// Secure path helpers
const MEM_DIR = 'memories'

function normalizeMemPath(inputPath: string): string {
  const sanitized = inputPath.replace(/\\/g, '/').replace(/^\/+/, '')
  const joined = path.posix.join(MEM_DIR, sanitized)
  const normalized = path.posix.normalize(joined)
  if (!normalized.startsWith(MEM_DIR + '/')) {
    throw new Error('Path traversal detected')
  }
  return normalized
}

async function ensureMemDir(root: string) {
  const full = path.join(root, MEM_DIR)
  await fs.mkdir(full, { recursive: true })
}

// Parallel execution utility using Promise.allSettled with concurrency guard
type Task<T> = () => Promise<T>

async function runInParallel<T>(tasks: Task<T>[], concurrency = Math.max(1, Number(process.env.MEMORY_PARALLEL || 4))): Promise<T[]> {
  const results: T[] = []
  let index = 0

  async function worker() {
    while (true) {
      const current = index++
      if (current >= tasks.length) break
      try {
        const value = await tasks[current]()
        results[current] = value
      } catch (e) {
        logger.error({ err: e }, 'Parallel task failed')
        throw e
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker())
  await Promise.all(workers)
  return results
}

// Context editor support: preserve selection into memory automatically
function preserveContext(content: string, req: MemoryToolRequest): string {
  if (!req.context || !req.context.selection) return content
  const markerStart = '/*<CTX:START>*/'
  const markerEnd = '/*<CTX:END>*/'
  return `${markerStart}\n${req.context.selection}\n${markerEnd}\n\n${content}`
}

// A2A Memory Tool implementation
export class A2ABetaMemoryTool {
  constructor(private store: AgentMemorySystem, private enableContextPreservation = true) {}

  private emit(type: MemoryEventType, payload: Record<string, any>) {
    const event: MemoryEvent = { type, timestamp: Date.now(), payload }
    eventBus.broadcast(event)
  }

  async handle(req: MemoryToolRequest): Promise<MemoryToolResponse> {
    try {
      switch (req.command) {
        case 'view':
          return this.view(req)
        case 'create':
          return this.create(req)
        case 'str_replace':
          return this.strReplace(req)
        case 'insert':
          return this.insert(req)
        case 'delete':
          return this.remove(req)
        case 'rename':
          return this.rename(req)
        default:
          return { ok: false, error: `Unsupported command: ${req.command}` }
      }
    } catch (err: any) {
      const message = err?.message || 'Unknown error'
      logger.error({ err }, 'Memory tool error')
      this.emit('memory:error', { command: req.command, error: message })
      return { ok: false, error: message }
    }
  }

  private async view(req: MemoryToolRequest): Promise<MemoryToolResponse<MemoryRecord | MemoryRecord[] | null>> {
    if (req.path) {
      const memPath = normalizeMemPath(req.path)
      const rec = await this.store.readMemory(memPath)
      this.emit('memory:view', { path: memPath, found: !!rec })
      return { ok: true, data: rec }
    } else {
      const list = await this.store.listMemories()
      this.emit('memory:view', { count: list.length })
      return { ok: true, data: list }
    }
  }

  private async create(req: MemoryToolRequest): Promise<MemoryToolResponse<MemoryRecord>> {
    if (!req.path) return { ok: false, error: 'path is required' }
    const memPath = normalizeMemPath(req.path)
    let content = req.content ?? ''
    if (this.enableContextPreservation) content = preserveContext(content, req)
    await ensureMemDir(this.store.rootDir)
    const rec = await this.store.writeMemory(memPath, content, req.meta)
    this.emit('memory:create', { path: memPath, id: rec.id })
    return { ok: true, data: rec }
  }

  private async strReplace(req: MemoryToolRequest): Promise<MemoryToolResponse<MemoryRecord>> {
    if (!req.path) return { ok: false, error: 'path is required' }
    if (!req.replace) return { ok: false, error: 'replace is required' }
    const memPath = normalizeMemPath(req.path)
    const rec = await this.store.readMemory(memPath)
    if (!rec) return { ok: false, error: 'memory not found' }

    let { search, replace, flags } = req.replace
    let newContent: string
    if (typeof search === 'string') {
      const rx = new RegExp(escapeRegExp(search), flags || 'g')
      newContent = rec.content.replace(rx, replace)
    } else {
      const rx = new RegExp(search, flags || 'g')
      newContent = rec.content.replace(rx, replace)
    }

    const updated = await this.store.writeMemory(memPath, newContent, rec.meta)
    this.emit('memory:update', { path: memPath, op: 'str_replace' })
    return { ok: true, data: updated }
  }

  private async insert(req: MemoryToolRequest): Promise<MemoryToolResponse<MemoryRecord>> {
    if (!req.path) return { ok: false, error: 'path is required' }
    if (!req.insert) return { ok: false, error: 'insert is required' }
    const memPath = normalizeMemPath(req.path)
    const rec = await this.store.readMemory(memPath)
    if (!rec) return { ok: false, error: 'memory not found' }

    const { position, text } = req.insert
    let content = rec.content

    if (position === 'start') content = text + content
    else if (position === 'end') content = content + text
    else if (typeof position === 'number') {
      const idx = Math.max(0, Math.min(position, content.length))
      content = content.slice(0, idx) + text + content.slice(idx)
    } else {
      return { ok: false, error: 'invalid position' }
    }

    const updated = await this.store.writeMemory(memPath, content, rec.meta)
    this.emit('memory:update', { path: memPath, op: 'insert' })
    return { ok: true, data: updated }
  }

  private async remove(req: MemoryToolRequest): Promise<MemoryToolResponse<{ path: string }>> {
    if (!req.path) return { ok: false, error: 'path is required' }
    const memPath = normalizeMemPath(req.path)
    const ok = await this.store.deleteMemory(memPath)
    if (!ok) return { ok: false, error: 'memory not found' }
    this.emit('memory:delete', { path: memPath })
    return { ok: true, data: { path: memPath } }
  }

  private async rename(req: MemoryToolRequest): Promise<MemoryToolResponse<MemoryRecord>> {
    if (!req.path || !req.newPath) return { ok: false, error: 'path and newPath are required' }
    const oldP = normalizeMemPath(req.path)
    const newP = normalizeMemPath(req.newPath)
    const rec = await this.store.renameMemory(oldP, newP)
    this.emit('memory:rename', { from: oldP, to: newP, id: rec.id })
    return { ok: true, data: rec }
  }

  // Batch API with parallel execution
  async batch(requests: MemoryToolRequest[], concurrency?: number): Promise<MemoryToolResponse[]> {
    const tasks = requests.map((r) => async () => this.handle(r))
    const res = await runInParallel(tasks, concurrency)
    return res
  }
}

// Escape regex helper
function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// A lightweight filesystem-based AgentMemorySystem implementation for /memories
export class FsAgentMemory implements AgentMemorySystem {
  constructor(public rootDir: string) {}

  private full(p: string) {
    return path.join(this.rootDir, p)
  }

  async listMemories(): Promise<MemoryRecord[]> {
    await ensureMemDir(this.rootDir)
    const base = this.full(MEM_DIR)
    const items: MemoryRecord[] = []

    async function walk(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) await walk(p)
        else if (e.isFile()) {
          const rel = path.relative(base, p).replace(/\\/g, '/')
          const content = await fs.readFile(p, 'utf8')
          const st = await fs.stat(p)
          items.push({
            id: Buffer.from(rel).toString('base64url'),
            path: `${MEM_DIR}/${rel}`,
            content,
            createdAt: st.birthtimeMs || st.ctimeMs,
            updatedAt: st.mtimeMs,
          })
        }
      }
    }

    await walk(base)
    return items
  }

  async readMemory(memPath: string): Promise<MemoryRecord | null> {
    const full = this.full(memPath)
    try {
      const content = await fs.readFile(full, 'utf8')
      const st = await fs.stat(full)
      return {
        id: Buffer.from(memPath).toString('base64url'),
        path: memPath,
        content,
        createdAt: st.birthtimeMs || st.ctimeMs,
        updatedAt: st.mtimeMs,
      }
    } catch (e: any) {
      if (e?.code === 'ENOENT') return null
      throw e
    }
  }

  async writeMemory(memPath: string, content: string, meta?: Record<string, any>): Promise<MemoryRecord> {
    const full = this.full(memPath)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, content, 'utf8')
    const st = await fs.stat(full)
    return {
      id: Buffer.from(memPath).toString('base64url'),
      path: memPath,
      content,
      createdAt: st.birthtimeMs || st.ctimeMs,
      updatedAt: st.mtimeMs,
      meta,
    }
  }

  async deleteMemory(memPath: string): Promise<boolean> {
    const full = this.full(memPath)
    try {
      await fs.unlink(full)
      return true
    } catch (e: any) {
      if (e?.code === 'ENOENT') return false
      throw e
    }
  }

  async renameMemory(oldPath: string, newPath: string): Promise<MemoryRecord> {
    const fullOld = this.full(oldPath)
    const fullNew = this.full(newPath)
    await fs.mkdir(path.dirname(fullNew), { recursive: true })
    await fs.rename(fullOld, fullNew)
    const st = await fs.stat(fullNew)
    const content = await fs.readFile(fullNew, 'utf8')
    return {
      id: Buffer.from(newPath).toString('base64url'),
      path: newPath,
      content,
      createdAt: st.birthtimeMs || st.ctimeMs,
      updatedAt: st.mtimeMs,
    }
  }
}

// Example factory to wire into A2A
export function createClaudeMemoryTool(rootDir: string, options?: { preserveContext?: boolean }) {
  const store = new FsAgentMemory(rootDir)
  const tool = new A2ABetaMemoryTool(store, options?.preserveContext !== false)
  return tool
}

// Optional: default export for convenience
export default {
  createClaudeMemoryTool,
  A2ABetaMemoryTool,
  FsAgentMemory,
}
