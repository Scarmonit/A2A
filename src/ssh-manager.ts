/*
 * SSH Manager for A2A
 * Provides connection pooling, key management, command execution, retry logic, and logging.
 */

import { Client, ConnectConfig } from 'ssh2';
import { promises as fs } from 'fs';
import path from 'path';

// Simple logger interface and default console-based logger
export interface Logger {
  debug: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

const defaultLogger: Logger = console;

// Types for A2A agent integration hooks
export interface A2AAgentHooks {
  // Called before a command executes
  onBeforeCommand?: (ctx: CommandContext) => Promise<void> | void;
  // Called after a command executes (success or failure)
  onAfterCommand?: (ctx: CommandResultContext) => Promise<void> | void;
}

export interface SSHCredentials {
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string; // optional path to a private key file
  privateKey?: string; // raw private key contents
  passphrase?: string; // optional key passphrase
  readyTimeoutMs?: number;
}

export interface CommandOptions {
  cwd?: string; // working directory on remote
  env?: Record<string, string>;
  timeoutMs?: number; // kill command if it exceeds this
  allocatePty?: boolean;
  // retry configuration
  retries?: number;
  retryDelayMs?: number;
}

export interface CommandContext {
  connId: string;
  command: string;
  options?: CommandOptions;
  startTime: number;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number | null; // null if unknown
  signal?: string | null;
  durationMs: number;
}

export interface CommandResultContext extends CommandContext {
  result?: CommandResult;
  error?: unknown;
}

// Internal pooled connection state
interface PooledConnection {
  id: string;
  client: Client;
  busy: boolean;
  lastUsed: number;
  creds: SSHCredentials;
}

export interface PoolOptions {
  maxSize?: number; // maximum simultaneous connections for same host key
  idleTtlMs?: number; // close idle connections after this
  acquireTimeoutMs?: number; // timeout when waiting to acquire a connection
}

const DEFAULT_POOL_OPTS: Required<PoolOptions> = {
  maxSize: 5,
  idleTtlMs: 60_000,
  acquireTimeoutMs: 15_000,
};

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function credsKey(creds: SSHCredentials): string {
  return [
    creds.username,
    creds.host,
    String(creds.port ?? 22),
    creds.privateKeyPath ? `key:${creds.privateKeyPath}` : creds.privateKey ? 'key:inline' : creds.password ? 'pw' : 'none',
  ].join('@');
}

async function loadPrivateKey(creds: SSHCredentials): Promise<string | undefined> {
  if (creds.privateKey) return creds.privateKey;
  if (creds.privateKeyPath) {
    const abs = path.isAbsolute(creds.privateKeyPath)
      ? creds.privateKeyPath
      : path.join(process.cwd(), creds.privateKeyPath);
    return fs.readFile(abs, 'utf8');
  }
  return undefined;
}

function toConnectConfig(creds: SSHCredentials, privateKey?: string): ConnectConfig {
  const cfg: ConnectConfig = {
    host: creds.host,
    port: creds.port ?? 22,
    username: creds.username,
    readyTimeout: creds.readyTimeoutMs ?? 20_000,
  } as ConnectConfig;
  if (privateKey) {
    Object.assign(cfg, {
      privateKey,
      passphrase: creds.passphrase,
    });
  } else if (creds.password) {
    Object.assign(cfg, { password: creds.password });
  }
  return cfg;
}

export class SSHManager {
  private pools: Map<string, PooledConnection[]> = new Map();
  private poolOptions: Required<PoolOptions>;
  private hooks?: A2AAgentHooks;
  private logger: Logger;

  constructor(opts?: { pool?: PoolOptions; hooks?: A2AAgentHooks; logger?: Logger }) {
    this.poolOptions = { ...DEFAULT_POOL_OPTS, ...(opts?.pool ?? {}) };
    this.hooks = opts?.hooks;
    this.logger = opts?.logger ?? defaultLogger;
  }

  // Acquire a connection from pool or create a new one
  async acquire(creds: SSHCredentials): Promise<PooledConnection> {
    const key = credsKey(creds);
    const pool = this.pools.get(key) ?? [];

    // purge idle
    const now = Date.now();
    for (const pc of [...pool]) {
      if (!pc.busy && now - pc.lastUsed > this.poolOptions.idleTtlMs) {
        this.logger.debug('[SSH] Closing idle connection', pc.id);
        pc.client.end();
        const idx = pool.indexOf(pc);
        if (idx >= 0) pool.splice(idx, 1);
      }
    }

    // try reuse
    const idle = pool.find((p) => !p.busy);
    if (idle) {
      idle.busy = true;
      idle.lastUsed = Date.now();
      this.logger.debug('[SSH] Reusing connection', idle.id);
      return idle;
    }

    // wait if pool is full
    if (pool.length >= this.poolOptions.maxSize) {
      const deadline = Date.now() + this.poolOptions.acquireTimeoutMs;
      this.logger.info('[SSH] Pool full, waiting for connection release');
      while (Date.now() < deadline) {
        const available = pool.find((p) => !p.busy);
        if (available) {
          available.busy = true;
          available.lastUsed = Date.now();
          return available;
        }
        await sleep(250);
      }
      throw new Error('Timeout acquiring SSH connection from pool');
    }

    // create new
    const privateKey = await loadPrivateKey(creds);
    const cfg = toConnectConfig(creds, privateKey);
    const client = new Client();
    const id = `${key}#${pool.length + 1}`;
    const pc: PooledConnection = { id, client, busy: true, lastUsed: Date.now(), creds };

    await new Promise<void>((resolve, reject) => {
      const onReady = () => {
        this.logger.info('[SSH] Connected', id);
        client.removeListener('error', onError);
        resolve();
      };
      const onError = (err: any) => {
        this.logger.error('[SSH] Connection error', id, err);
        client.removeListener('ready', onReady);
        reject(err);
      };
      client.once('ready', onReady);
      client.once('error', onError);
      try {
        client.connect(cfg);
      } catch (e) {
        client.removeListener('ready', onReady);
        client.removeListener('error', onError);
        reject(e);
      }
    });

    // add to pool
    pool.push(pc);
    this.pools.set(key, pool);
    return pc;
  }

  // Release a connection back to pool
  release(conn: PooledConnection) {
    conn.busy = false;
    conn.lastUsed = Date.now();
  }

  // Force close all connections and clear pool
  dispose() {
    for (const [, pool] of this.pools) {
      for (const pc of pool) {
        try { pc.client.end(); } catch {}
      }
    }
    this.pools.clear();
  }

  // Execute a command on remote. Handles retries and PTY allocation.
  async exec(creds: SSHCredentials, command: string, options?: CommandOptions): Promise<CommandResult> {
    const retries = options?.retries ?? 1;
    const retryDelayMs = options?.retryDelayMs ?? 750;

    let attempt = 0;
    let lastError: unknown;
    while (attempt <= retries) {
      try {
        return await this.execOnce(creds, command, options);
      } catch (err) {
        lastError = err;
        attempt++;
        if (attempt > retries) break;
        this.logger.warn('[SSH] Exec failed, retrying', { attempt, error: String(err) });
        await sleep(retryDelayMs * attempt); // backoff
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private async execOnce(creds: SSHCredentials, command: string, options?: CommandOptions): Promise<CommandResult> {
    const conn = await this.acquire(creds);
    const startTime = Date.now();
    const ctx: CommandContext = { connId: conn.id, command, options, startTime };
    try {
      await this.hooks?.onBeforeCommand?.(ctx);
      const result = await new Promise<CommandResult>((resolve, reject) => {
        const onResult = (stdout: string, stderr: string, code: number | null, signal?: string | null) => {
          resolve({ stdout, stderr, code, signal, durationMs: Date.now() - startTime });
        };

        const execOptions: any = { env: options?.env };
        const invoke = () => conn.client.exec(command, execOptions, (err, stream) => {
          if (err) return reject(err);
          let stdout = '';
          let stderr = '';

          const timeout = options?.timeoutMs ? setTimeout(() => {
            try { stream.signal('KILL'); } catch {}
            reject(new Error(`Command timed out after ${options?.timeoutMs} ms`));
          }, options.timeoutMs) : undefined;

          stream.on('close', (code: number, signal: string) => {
            if (timeout) clearTimeout(timeout);
            onResult(stdout, stderr, code ?? null, signal ?? null);
          }).on('data', (data: Buffer) => {
            stdout += data.toString();
          }).stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
          });
        });

        if (options?.cwd) {
          // Run in a login shell with cwd managed
          const wrapped = `cd ${JSON.stringify(options.cwd)} && (${command})`;
          execOptions.shell = '/bin/bash';
          conn.client.exec(wrapped, execOptions, (err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            const timeout = options?.timeoutMs ? setTimeout(() => {
              try { stream.signal('KILL'); } catch {}
              reject(new Error(`Command timed out after ${options?.timeoutMs} ms`));
            }, options.timeoutMs) : undefined;
            stream.on('close', (code: number, signal: string) => {
              if (timeout) clearTimeout(timeout);
              onResult(stdout, stderr, code ?? null, signal ?? null);
            }).on('data', (data: Buffer) => { stdout += data.toString(); })
              .stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
          });
        } else if (options?.allocatePty) {
          conn.client.shell((err, stream) => {
            if (err) return reject(err);
            let stdout = '';
            let stderr = '';
            const timeout = options?.timeoutMs ? setTimeout(() => {
              try { stream.signal('KILL'); } catch {}
              reject(new Error(`Command timed out after ${options?.timeoutMs} ms`));
            }, options.timeoutMs) : undefined;
            stream.on('close', (code: number, signal: string) => {
              if (timeout) clearTimeout(timeout);
              onResult(stdout, stderr, code ?? null, signal ?? null);
            }).on('data', (data: Buffer) => { stdout += data.toString(); })
              .stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
            stream.end(`${command}\nexit\n`);
          });
        } else {
          invoke();
        }
      });

      const resultCtx: CommandResultContext = { ...ctx, result };
      await this.hooks?.onAfterCommand?.(resultCtx);
      return result;
    } catch (error) {
      const resultCtx: CommandResultContext = { ...ctx, error };
      await this.hooks?.onAfterCommand?.(resultCtx);
      // If connection appears broken, drop it from pool
      try { conn.client.end(); } catch {}
      const key = credsKey(conn.creds);
      const pool = this.pools.get(key) ?? [];
      const idx = pool.indexOf(conn);
      if (idx >= 0) pool.splice(idx, 1);
      this.pools.set(key, pool);
      throw error;
    } finally {
      // If still in pool, mark as idle
      const key = credsKey(conn.creds);
      const pool = this.pools.get(key);
      if (pool && pool.includes(conn)) this.release(conn);
    }
  }
}

// Example minimal integration wrapper for A2A tasks
export class A2AAgentSSH {
  private ssh: SSHManager;
  constructor(ssh?: SSHManager) {
    this.ssh = ssh ?? new SSHManager();
  }

  async runTask(creds: SSHCredentials, steps: Array<{ cmd: string; cwd?: string }>): Promise<Array<CommandResult>> {
    const results: CommandResult[] = [];
    for (const step of steps) {
      const res = await this.ssh.exec(creds, step.cmd, { cwd: step.cwd, retries: 2, retryDelayMs: 500 });
      results.push(res);
      if (res.code && res.code !== 0) {
        throw new Error(`Step failed with code ${res.code}: ${step.cmd}\nSTDERR: ${res.stderr}`);
      }
    }
    return results;
  }
}
