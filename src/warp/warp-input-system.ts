// warp-input-system.ts
// Comprehensive implementation of Warp-like input architecture for A2A
// Features: Git Diff chip rendering, font size management, semantic search integration,
// code indexing, and build system integration. Uses TypeScript with strong typing,
// async/await patterns, and robust error handling.

/*
  High-level architecture
  - InputController: orchestrates input pipeline, plugins, state, and events
  - GitDiffChipRenderer: parses and renders Git diff metadata as inline chips
  - FontSizeManager: reactive font sizing with persistence and accessibility constraints
  - SemanticSearchService: embeds, indexes, and searches code and context
  - CodeIndexer: incremental repo file indexing with watchers and cancellation
  - BuildSystem: integrates with project build tools (npm/yarn/pnpm/turbo) and exposes APIs
  - Types and utilities for resilience, diagnostics, and cancellation
*/

//#region Types
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

export interface Disposable { dispose(): void }

export interface Cancellable {
  cancel(reason?: string): void
  readonly signal: AbortSignal
}

export interface ILogger {
  debug(msg: string, meta?: Record<string, unknown>): void
  info(msg: string, meta?: Record<string, unknown>): void
  warn(msg: string, meta?: Record<string, unknown>): void
  error(msg: string | Error, meta?: Record<string, unknown>): void
}

export interface InputState {
  text: string
  cursor: number
  selection?: { start: number; end: number }
  readonly timestamp: number
}

export interface Chip {
  kind: 'git-diff' | 'link' | 'command' | 'token'
  label: string
  data?: Record<string, Json>
  range: { start: number; end: number }
}

export interface InputEventMap {
  change: InputState
  submit: InputState
  cancel: undefined
  fontSizeChanged: number
  chipsUpdated: Chip[]
  indexProgress: { completed: number; total: number }
  buildStatus: { phase: 'idle' | 'building' | 'success' | 'failed'; details?: string }
}

export type Listener<K extends keyof InputEventMap> = (payload: InputEventMap[K]) => void

//#endregion

//#region Utilities
export class Emitter {
  private listeners = new Map<string, Set<Function>>()
  on<K extends keyof InputEventMap>(event: K, listener: Listener<K>): Disposable {
    const set = this.listeners.get(event as string) ?? new Set()
    set.add(listener as unknown as Function)
    this.listeners.set(event as string, set)
    return { dispose: () => set.delete(listener as unknown as Function) }
  }
  emit<K extends keyof InputEventMap>(event: K, payload: InputEventMap[K]): void {
    const set = this.listeners.get(event as string)
    if (!set) return
    for (const l of [...set]) {
      try {
        ;(l as Listener<K>)(payload)
      } catch (err) {
        console.error('Emitter listener error', err)
      }
    }
  }
}

export function ok<T>(value: T): Result<T> { return { ok: true, value } }
export function err<E = Error>(error: E): Result<never, E> { return { ok: false, error } }

export function withTimeout<T>(p: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  const controller = new AbortController()
  const to = setTimeout(() => controller.abort(`${label} timed out after ${ms}ms`), ms)
  return Promise.race([
    p.finally(() => clearTimeout(to)) as unknown as Promise<T>,
    new Promise<T>((_, reject) => controller.signal.addEventListener('abort', () => reject(new Error((controller.signal as any).reason || 'timeout')))),
  ])
}

export class CancelToken implements Cancellable {
  private controller = new AbortController()
  get signal(): AbortSignal { return this.controller.signal }
  cancel(reason?: string): void { this.controller.abort(reason) }
}

export function delay(ms: number): Promise<void> { return new Promise(res => setTimeout(res, ms)) }
//#endregion

//#region Git Diff chip rendering
export type GitHunk = {
  file: string
  additions: number
  deletions: number
  header?: string
}

export class GitDiffChipRenderer {
  constructor(private readonly logger: ILogger) {}

  parseUnifiedDiff(diffText: string): Chip[] {
    const chips: Chip[] = []
    const lines = diffText.split(/\r?\n/)
    let idx = 0
    for (const line of lines) {
      const start = idx
      const end = idx + line.length
      if (line.startsWith('diff --git')) {
        const file = this.extractFileFromDiffHeader(line)
        chips.push({ kind: 'git-diff', label: file ?? 'diff', data: { type: 'file' }, range: { start, end } })
      } else if (line.startsWith('@@')) {
        const hunk = line.replace(/^@@\s*/, '').replace(/\s*@@$/, '')
        chips.push({ kind: 'git-diff', label: `hunk ${hunk}`, data: { type: 'hunk' }, range: { start, end } })
      } else if (line.startsWith('+')) {
        chips.push({ kind: 'git-diff', label: '+', data: { type: 'add' }, range: { start, end } })
      } else if (line.startsWith('-')) {
        chips.push({ kind: 'git-diff', label: '-', data: { type: 'del' }, range: { start, end } })
      }
      idx = end + 1
    }
    this.logger.debug('Parsed diff chips', { count: chips.length })
    return chips
  }

  private extractFileFromDiffHeader(header: string): string | undefined {
    const match = header.match(/a\/(\S+)\s+b\/(\S+)/)
    return match?.[2]
  }
}
//#endregion

//#region Font size management
export interface FontSizeOptions {
  min: number
  max: number
  step: number
  defaultSize: number
  storageKey?: string
}

export class FontSizeManager {
  private current: number
  private readonly emitter = new Emitter()
  private readonly key: string
  constructor(private readonly options: FontSizeOptions, private readonly logger: ILogger) {
    this.key = options.storageKey ?? 'warp.fontSize'
    const stored = this.safeGetNumber(this.key)
    this.current = clamp(stored ?? options.defaultSize, options.min, options.max)
  }

  onChange(listener: Listener<'fontSizeChanged'>): Disposable {
    return this.emitter.on('fontSizeChanged', listener)
  }

  get size(): number { return this.current }

  increase(): number { return this.set(this.current + this.options.step) }
  decrease(): number { return this.set(this.current - this.options.step) }
  reset(): number { return this.set(this.options.defaultSize) }

  set(value: number): number {
    const clamped = clamp(value, this.options.min, this.options.max)
    if (clamped === this.current) return this.current
    this.current = clamped
    try { localStorage.setItem(this.key, String(this.current)) } catch {}
    this.logger.info('Font size changed', { size: this.current })
    this.emitter.emit('fontSizeChanged', this.current)
    return this.current
  }

  private safeGetNumber(key: string): number | undefined {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return
      const n = Number(raw)
      return Number.isFinite(n) ? n : undefined
    } catch {
      return undefined
    }
  }
}

function clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, n)) }
//#endregion

//#region Semantic search integration
export interface EmbeddingProvider {
  embed(texts: string[], options?: { signal?: AbortSignal }): Promise<number[][]>
  dim: number
}

export interface SemanticSearchDoc {
  id: string
  content: string
  metadata?: Record<string, Json>
}

export class SemanticSearchService {
  private index: { id: string; vector: Float32Array; metadata?: Record<string, Json> }[] = []
  private readonly dim: number

  constructor(private readonly provider: EmbeddingProvider, private readonly logger: ILogger) {
    this.dim = provider.dim
  }

  async addDocuments(docs: SemanticSearchDoc[], token?: Cancellable): Promise<Result<number>> {
    try {
      const vectors = await this.provider.embed(
        docs.map(d => d.content),
        { signal: token?.signal }
      )
      if (vectors.length !== docs.length) throw new Error('Embedding provider count mismatch')
      docs.forEach((d, i) => {
        const v = new Float32Array(vectors[i])
        if (v.length !== this.dim) throw new Error('Embedding dimension mismatch')
        this.index.push({ id: d.id, vector: v, metadata: d.metadata })
      })
      this.logger.info('Indexed documents', { count: docs.length })
      return ok(docs.length)
    } catch (e) {
      this.logger.error(e instanceof Error ? e : String(e))
      return err(e as Error)
    }
  }

  async search(query: string, k = 5, token?: Cancellable): Promise<Result<{ id: string; score: number; metadata?: Record<string, Json> }[]>> {
    try {
      const [qvec] = await this.provider.embed([query], { signal: token?.signal })
      const q = new Float32Array(qvec)
      const scored = this.index.map(({ id, vector, metadata }) => ({ id, score: cosineSim(q, vector), metadata }))
      scored.sort((a, b) => b.score - a.score)
      return ok(scored.slice(0, k))
    } catch (e) {
      this.logger.error(e instanceof Error ? e : String(e))
      return err(e as Error)
    }
  }
}

function cosineSim(a: Float32Array, b: Float32Array): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb)
  return denom ? dot / denom : 0
}
//#endregion

//#region Code indexing
export interface FileSystemLike {
  readFile(path: string): Promise<string>
  listFiles(root: string, opts?: { exts?: string[] }): Promise<string[]>
  watch?(root: string, onChange: (path: string) => void): Disposable
}

export interface CodeIndexerOptions {
  exts: string[]
  root: string
  batchSize?: number
}

export class CodeIndexer {
  private disposed = false
  private readonly emitter = new Emitter()
  constructor(private readonly fs: FileSystemLike, private readonly search: SemanticSearchService, private readonly logger: ILogger, private readonly opts: CodeIndexerOptions) {}

  onProgress(listener: Listener<'indexProgress'>): Disposable { return this.emitter.on('indexProgress', listener) }

  async buildIndex(token?: Cancellable): Promise<Result<number>> {
    try {
      const files = await this.fs.listFiles(this.opts.root, { exts: this.opts.exts })
      const total = files.length
      let completed = 0
      const batch = this.opts.batchSize ?? 25
      for (let i = 0; i < files.length; i += batch) {
        if (token?.signal.aborted) throw new Error(`Indexing aborted: ${token.signal.reason || ''}`)
        const chunk = files.slice(i, i + batch)
        const docs: SemanticSearchDoc[] = []
        for (const f of chunk) {
          try {
            const content = await this.fs.readFile(f)
            docs.push({ id: f, content })
          } catch (e) {
            this.logger.warn('Failed to read file', { file: f, error: String(e) })
          }
        }
        const res = await this.search.addDocuments(docs, token)
        if (!res.ok) this.logger.warn('Partial indexing failure', { error: String(res.error) })
        completed = Math.min(total, completed + chunk.length)
        this.emitter.emit('indexProgress', { completed, total })
      }
      return ok(completed)
    } catch (e) {
      this.logger.error(e instanceof Error ? e : String(e))
      return err(e as Error)
    }
  }
}
//#endregion

//#region Build system integration
export type BuildTool = 'npm' | 'yarn' | 'pnpm' | 'turbo'

export interface BuildRunnerOptions {
  cwd: string
  script?: string // default: build
  env?: Record<string, string>
  onOutput?: (line: string) => void
}

export class BuildSystem {
  private status: InputEventMap['buildStatus'] = { phase: 'idle' }
  private readonly emitter = new Emitter()
  constructor(private readonly logger: ILogger) {}
  onStatus(listener: Listener<'buildStatus'>): Disposable { return this.emitter.on('buildStatus', listener) }
  get current(): InputEventMap['buildStatus'] { return this.status }

  async run(tool: BuildTool, opts: BuildRunnerOptions): Promise<Result<number>> {
    this.setStatus({ phase: 'building', details: `${tool} ${opts.script ?? 'build'}` })
    try {
      const exit = await this.simulateProcess(tool, opts)
      if (exit === 0) {
        this.setStatus({ phase: 'success' })
        return ok(exit)
      } else {
        const e = new Error(`Build failed with code ${exit}`)
        this.setStatus({ phase: 'failed', details: e.message })
        return err(e)
      }
    } catch (e) {
      this.setStatus({ phase: 'failed', details: e instanceof Error ? e.message : String(e) })
      this.logger.error(e instanceof Error ? e : String(e))
      return err(e as Error)
    }
  }

  private setStatus(s: InputEventMap['buildStatus']) {
    this.status = s
    this.emitter.emit('buildStatus', s)
  }

  // NOTE: In-browser stub; in Node/Electron this would spawn the actual process.
  private async simulateProcess(tool: BuildTool, opts: BuildRunnerOptions): Promise<number> {
    this.logger.info('Build start', { tool, cwd: opts.cwd, script: opts.script ?? 'build' })
    opts.onOutput?.(`[${tool}] running ${opts.script ?? 'build'} in ${opts.cwd}`)
    await delay(250)
    opts.onOutput?.(`[${tool}] compiling...`)
    await delay(300)
    const okFlag = Math.random() > 0.05
    opts.onOutput?.(`[${tool}] ${okFlag ? 'done' : 'error'}`)
    return okFlag ? 0 : 1
  }
}
//#endregion

//#region InputController
export interface InputControllerOptions {
  logger?: ILogger
  fontSize?: Partial<FontSizeOptions>
}

export class ConsoleLogger implements ILogger {
  debug(msg: string, meta?: Record<string, unknown>) { console.debug(msg, meta ?? {}) }
  info(msg: string, meta?: Record<string, unknown>) { console.info(msg, meta ?? {}) }
  warn(msg: string, meta?: Record<string, unknown>) { console.warn(msg, meta ?? {}) }
  error(msg: string | Error, meta?: Record<string, unknown>) { console.error(msg, meta ?? {}) }
}

export class InputController {
  private state: InputState = { text: '', cursor: 0, timestamp: Date.now() }
  private chips: Chip[] = []
  private readonly emitter = new Emitter()

  readonly logger: ILogger
  readonly font: FontSizeManager
  readonly git: GitDiffChipRenderer

  constructor(options: InputControllerOptions = {}) {
    this
