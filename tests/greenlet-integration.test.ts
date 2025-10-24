/**
 * Greenlet Integration Tests
 * 
 * Tests for greenlet bridge adapter and process pool
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { GreenletBridgeAdapter } from '../dist/src/agents/greenlet-bridge-adapter.js';
import { GreenletProcessPool } from '../dist/src/agents/greenlet-process-pool.js';

const pythonDependencyCheck = spawnSync('python3', ['-c', 'import greenlet'], {
  stdio: 'ignore'
});

const describeIfGreenletAvailable = pythonDependencyCheck.status === 0 ? describe : describe.skip;

describeIfGreenletAvailable('Greenlet Bridge Adapter', () => {
  let adapter: GreenletBridgeAdapter;
  
  before(async () => {
    adapter = new GreenletBridgeAdapter({
      pythonPath: 'python3',
      scriptPath: 'src/agents/python/greenlet_a2a_agent.py'
    });
  });
  
  after(async () => {
    if (adapter) {
      await adapter.disconnect();
    }
  });
  
  it('should connect to greenlet agent', async () => {
    await adapter.connect();
    assert.strictEqual(adapter.isConnected(), true);
  });
  
  it('should send and receive messages', async () => {
    await adapter.connect();
    
    const responsePromise = new Promise((resolve) => {
      adapter.once('agent.pong', (data: any) => {
        resolve(data);
      });
    });
    
    adapter.sendMessage({ type: 'agent.ping' });
    
    const response = await responsePromise;
    assert.ok(response);
  });
  
  it('should handle echo messages', async () => {
    await adapter.connect();
    
    const testData = { message: 'test echo' };
    
    const responsePromise = new Promise((resolve) => {
      adapter.once('agent.echo_response', (data: any) => {
        resolve(data);
      });
    });
    
    adapter.sendMessage({ type: 'agent.echo', data: testData });
    
    const response = await responsePromise;
    assert.deepStrictEqual(response, testData);
  });
});

describeIfGreenletAvailable('Greenlet Process Pool', () => {
  let pool: GreenletProcessPool;
  
  after(async () => {
    if (pool) {
      await pool.shutdown();
    }
  });
  
  it('should create process pool with min workers', async () => {
    pool = new GreenletProcessPool({
      minWorkers: 2,
      maxWorkers: 5,
      pythonPath: 'python3',
      scriptPath: 'src/agents/python/greenlet_a2a_agent.py'
    });
    
    await pool.start();
    
    const stats = pool.getStats();
    assert.strictEqual(stats.total, 2);
    assert.strictEqual(stats.available, 2);
  });
  
  it('should allocate and release workers', async () => {
    pool = new GreenletProcessPool({
      minWorkers: 2,
      maxWorkers: 5
    });
    
    await pool.start();
    
    const worker1 = await pool.getWorker();
    assert.ok(worker1);
    
    const stats1 = pool.getStats();
    assert.strictEqual(stats1.available, 1);
    assert.strictEqual(stats1.busy, 1);
    
    pool.releaseWorker(worker1);
    
    const stats2 = pool.getStats();
    assert.strictEqual(stats2.available, 2);
    assert.strictEqual(stats2.busy, 0);
  });
  
  it('should scale up to max workers', async () => {
    pool = new GreenletProcessPool({
      minWorkers: 2,
      maxWorkers: 4
    });
    
    await pool.start();
    
    const workers = [];
    for (let i = 0; i < 4; i++) {
      workers.push(await pool.getWorker());
    }
    
    const stats = pool.getStats();
    assert.strictEqual(stats.total, 4);
    assert.strictEqual(stats.busy, 4);
    
    // Release workers
    workers.forEach(w => pool.releaseWorker(w));
  });
});
