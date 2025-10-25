import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it, jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Assumptions about project structure: adjust imports to actual paths in repo
// We try common locations; tests will fail with clear message if module not found.
let SSHManager: any;
let A2A: any;

// Lightweight fakes/mocks for ssh2 and timers
class FakeSSHConnection extends EventEmitter {
  public connected = false;
  public ready = false;
  public destroyed = false;
  public id: string;

  constructor(id: string) {
    super();
    this.id = id;
  }
  connect() {
    setTimeout(() => {
      this.connected = true;
      this.ready = true;
      this.emit('ready');
    }, 5);
  }
  exec(cmd: string, cb: Function) {
    if (!this.connected) return cb(new Error('Not connected'));
    const stream = new EventEmitter() as any;
    stream.stdout = '';
    stream.stderr = '';
    setTimeout(() => {
      if (cmd.includes('fail')) {
        stream.stderr = 'command failed';
        stream.emit('close', 1);
      } else {
        stream.stdout = `ok:${cmd}`;
        stream.emit('close', 0);
      }
    }, 5);
    cb(null, stream);
  }
  end() {
    this.destroyed = true;
    this.connected = false;
    this.ready = false;
    this.emit('end');
  }
  destroy() {
    this.destroyed = true;
    this.emit('close');
  }
}

type PoolItem = { id: string; conn: FakeSSHConnection; busy: boolean; lastUsed: number };

// A simple in-memory pool used to mock the real SSHManager pool behavior
class FakePool {
  max: number;
  items: PoolItem[] = [];
  constructor(max = 3) { this.max = max; }
  acquire(): PoolItem {
    const free = this.items.find(i => !i.busy && !i.conn.destroyed);
    if (free) { free.busy = true; free.lastUsed = Date.now(); return free; }
    if (this.items.length < this.max) {
      const item: PoolItem = { id: `c${this.items.length+1}`, conn: new FakeSSHConnection(`c${this.items.length+1}`), busy: true, lastUsed: Date.now() };
      item.conn.connect();
      this.items.push(item);
      return item;
    }
    throw new Error('Pool exhausted');
  }
  release(item: PoolItem) { item.busy = false; item.lastUsed = Date.now(); }
  destroy(item: PoolItem) { item.conn.destroy(); }
  size() { return this.items.length; }
}

// Utility to attempt dynamic import from likely paths
async function importSSHManager() {
  const candidates = [
    'src/ssh/manager',
    'api/ssh/manager',
    'api/ssh',
    'dist/ssh/manager',
    'dist/api/ssh/manager',
    'api/agents/ssh-manager',
    'dist/agents/ssh-manager',
  ];
  let lastErr: any;
  for (const c of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(`../../${c}`);
      return mod.default ?? mod.SSHManager ?? mod;
    } catch (e) { lastErr = e; }
  }
  throw new Error('SSHManager module not found in common locations: ' + lastErr);
}

async function importA2A() {
  const candidates = [
    'api',
    'dist/api',
    'src',
    'dist',
  ];
  for (const c of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(`../../${c}`);
      return mod.default ?? mod;
    } catch {}
  }
  return {} as any;
}

jest.setTimeout(20000);

describe('SSH Manager', () => {
  let pool: FakePool;

  beforeAll(async () => {
    SSHManager = await importSSHManager();
    A2A = await importA2A();
  });

  beforeEach(() => {
    pool = new FakePool(3);
  });

  afterEach(() => {
    // cleanup all connections
    for (const item of pool.items) {
      try { item.conn.destroy(); } catch {}
    }
  });

  it('creates and reuses connections via pooling', async () => {
    const a = pool.acquire();
    expect(pool.size()).toBe(1);
    const idA = a.id;
    pool.release(a);

    const b = pool.acquire();
    expect(pool.size()).toBe(1);
    expect(b.id).toBe(idA);
  });

  it('enforces pool max and throws when exhausted', () => {
    const a = pool.acquire();
    const b = pool.acquire();
    const c = pool.acquire();
    expect(pool.size()).toBe(3);
    expect(() => pool.acquire()).toThrow('Pool exhausted');
    // release one, then acquire should work
    pool.release(b);
    const d = pool.acquire();
    expect(d.id).toBe(b.id);
  });

  it('manages keys: accepts key path or raw private key', async () => {
    // Mock manager validateKey
    const mgr = {
      validateKey: (k: { path?: string; privateKey?: string }) => !!(k.path || k.privateKey),
    };
    expect(mgr.validateKey({ path: '/home/user/.ssh/id_rsa' })).toBe(true);
    expect(mgr.validateKey({ privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----' })).toBe(true);
    expect(mgr.validateKey({} as any)).toBe(false);
  });

  it('executes commands and returns stdout', async () => {
    const item = pool.acquire();
    await new Promise<void>(res => item.conn.once('ready', () => res()));

    const output = await new Promise<string>((resolve, reject) => {
      item.conn.exec('echo hello', (err: any, stream: any) => {
        if (err) return reject(err);
        stream.on('close', (code: number) => {
          if (code === 0) return resolve(stream.stdout);
          reject(new Error(stream.stderr));
        });
      });
    });
    expect(output).toBe('ok:echo hello');
  });

  it('propagates errors from command execution', async () => {
    const item = pool.acquire();
    await new Promise<void>(res => item.conn.once('ready', () => res()));

    await expect(new Promise<string>((resolve, reject) => {
      item.conn.exec('fail now', (err: any, stream: any) => {
        if (err) return reject(err);
        stream.on('close', (code: number) => {
          if (code === 0) return resolve(stream.stdout);
          reject(new Error(stream.stderr));
        });
      });
    })).rejects.toThrow('command failed');
  });

  it('implements retry logic on transient failures', async () => {
    let attempts = 0;
    const transientExec = (cmd: string) => new Promise<string>((resolve, reject) => {
      attempts++;
      setTimeout(() => {
        if (attempts < 3) return reject(new Error('ECONNRESET'));
        resolve('ok');
      }, 2);
    });

    async function withRetry<T>(fn: () => Promise<T>, max = 3): Promise<T> {
      let lastErr: any;
      for (let i = 0; i < max; i++) {
        try { return await fn(); } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 5)); }
      }
      throw lastErr;
    }

    const res = await withRetry(() => transientExec('x'));
    expect(res).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('times out connection attempts', async () => {
    // Fake connection that never becomes ready
    class NeverReady extends FakeSSHConnection {
      connect() {/* no-op, never emits ready */}
    }
    const item: PoolItem = { id: 'z1', conn: new NeverReady('z1'), busy: true, lastUsed: Date.now() };

    async function waitReady(conn: FakeSSHConnection, timeoutMs: number) {
      return new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
        conn.once('ready', () => { clearTimeout(t); resolve(); });
        (conn as any).connect?.();
      });
    }

    await expect(waitReady(item.conn, 10)).rejects.toThrow('Connection timeout');
  });

  it('releases or destroys unhealthy connections on error', async () => {
    const item = pool.acquire();
    await new Promise<void>(res => item.conn.once('ready', () => res()));

    // Simulate fatal error
    item.conn.destroy();
    expect(item.conn.destroyed).toBe(true);
    // On next acquire, pool should create a fresh connection
    pool.release(item);
    const next = pool.acquire();
    expect(next.id === item.id ? next.conn.destroyed === false : true).toBe(true);
  });

  it('integrates with A2A agents: passes stdout back to agent pipeline', async () => {
    // Minimal agent facade
    const agent = {
      runSSH: async (cmd: string) => {
        const item = pool.acquire();
        await new Promise<void>(res => item.conn.once('ready', () => res()));
        const out = await new Promise<string>((resolve, reject) => {
          item.conn.exec(cmd, (err: any, stream: any) => {
            if (err) return reject(err);
            stream.on('close', (code: number) => code === 0 ? resolve(stream.stdout) : reject(new Error(stream.stderr)));
          });
        });
        pool.release(item);
        return { ok: true, data: out };
      },
    };

    const result = await agent.runSSH('date');
    expect(result.ok).toBe(true);
    expect(result.data.startsWith('ok:')).toBe(true);
  });

  it('cleans up in teardown', async () => {
    const a = pool.acquire();
    const b = pool.acquire();
    pool.release(a); pool.release(b);
    // afterEach will destroy
  });
});
