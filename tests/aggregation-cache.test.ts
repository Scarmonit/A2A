import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AggregationCache } from '../src/aggregation-cache.js';

/**
 * Test Suite for AggregationCache
 * 
 * Tests caching functionality, TTL expiration, statistics,
 * and cache invalidation patterns.
 */

describe('AggregationCache', () => {
  let cache: AggregationCache;

  beforeEach(() => {
    cache = new AggregationCache();
  });

  it('should cache computed values within TTL', () => {
    let computeCount = 0;
    const compute = () => {
      computeCount++;
      return { value: Math.random() };
    };

    const result1 = cache.getOrCompute('test', 1000, compute);
    const result2 = cache.getOrCompute('test', 1000, compute);

    assert.strictEqual(result1, result2, 'Should return same object reference');
    assert.strictEqual(computeCount, 1, 'Should only compute once');
  });

  it('should recompute after TTL expires', async () => {
    let computeCount = 0;
    const compute = () => {
      computeCount++;
      return { value: Math.random() };
    };

    const result1 = cache.getOrCompute('test', 100, compute);
    await new Promise((resolve) => setTimeout(resolve, 150));
    const result2 = cache.getOrCompute('test', 100, compute);

    assert.notStrictEqual(result1, result2, 'Should return different object after TTL');
    assert.strictEqual(computeCount, 2, 'Should compute twice');
  });

  it('should report accurate cache statistics', () => {
    cache.getOrCompute('key1', 1000, () => 'value1');
    cache.getOrCompute('key1', 1000, () => 'value1'); // hit
    cache.getOrCompute('key2', 1000, () => 'value2'); // miss

    const stats = cache.getStats();
    assert.strictEqual(stats.hits, 1, 'Should have 1 hit');
    assert.strictEqual(stats.misses, 2, 'Should have 2 misses');
    assert.ok(Math.abs(stats.hitRate - 0.33) < 0.01, 'Hit rate should be ~0.33');
    assert.strictEqual(stats.size, 2, 'Cache should contain 2 entries');
  });

  it('should invalidate specific cache key', () => {
    cache.getOrCompute('key1', 1000, () => 'value1');
    cache.getOrCompute('key2', 1000, () => 'value2');

    cache.invalidate('key1');

    const stats = cache.getStats();
    assert.strictEqual(stats.size, 1, 'Should have 1 entry after invalidation');
  });

  it('should invalidate keys matching pattern', () => {
    cache.getOrCompute('dashboard:metrics', 1000, () => ({ a: 1 }));
    cache.getOrCompute('dashboard:agents', 1000, () => ({ b: 2 }));
    cache.getOrCompute('other:data', 1000, () => ({ c: 3 }));

    cache.invalidatePattern(/^dashboard:/);

    const stats = cache.getStats();
    assert.strictEqual(stats.size, 1, 'Should have 1 entry after pattern invalidation');
  });

  it('should cleanup expired entries', async () => {
    cache.getOrCompute('short', 50, () => 'value1');
    cache.getOrCompute('long', 5000, () => 'value2');

    await new Promise((resolve) => setTimeout(resolve, 100));
    cache.cleanup();

    const stats = cache.getStats();
    assert.strictEqual(stats.size, 1, 'Should have 1 entry after cleanup');
  });

  it('should clear all cache entries', () => {
    cache.getOrCompute('key1', 1000, () => 'value1');
    cache.getOrCompute('key2', 1000, () => 'value2');
    cache.getOrCompute('key1', 1000, () => 'value1'); // hit

    cache.clear();

    const stats = cache.getStats();
    assert.strictEqual(stats.size, 0, 'Cache should be empty');
    assert.strictEqual(stats.hits, 0, 'Hits should be reset');
    assert.strictEqual(stats.misses, 0, 'Misses should be reset');
  });

  it('should track compute time in statistics', () => {
    const slowCompute = () => {
      const start = Date.now();
      while (Date.now() - start < 10); // Busy wait for 10ms
      return 'value';
    };

    cache.getOrCompute('slow', 1000, slowCompute);

    const stats = cache.getStats();
    assert.ok(stats.avgComputeTime >= 10, 'Average compute time should be at least 10ms');
  });

  it('should handle multiple cache keys independently', () => {
    let count1 = 0;
    let count2 = 0;

    cache.getOrCompute('key1', 1000, () => ++count1);
    cache.getOrCompute('key2', 1000, () => ++count2);
    cache.getOrCompute('key1', 1000, () => ++count1); // hit
    cache.getOrCompute('key2', 1000, () => ++count2); // hit

    assert.strictEqual(count1, 1, 'key1 should only compute once');
    assert.strictEqual(count2, 1, 'key2 should only compute once');
  });

  it('should return correct value on cache miss', () => {
    const value = { data: 'test', number: 42 };
    const result = cache.getOrCompute('new-key', 1000, () => value);

    assert.deepStrictEqual(result, value, 'Should return computed value');
  });

  it('should handle zero TTL correctly', () => {
    let computeCount = 0;
    const compute = () => ++computeCount;

    cache.getOrCompute('zero-ttl', 0, compute);
    cache.getOrCompute('zero-ttl', 0, compute);

    assert.strictEqual(computeCount, 2, 'Should recompute with zero TTL');
  });

  it('should handle high-frequency access patterns', () => {
    let computeCount = 0;
    const compute = () => ++computeCount;

    // Access same key 100 times within TTL
    for (let i = 0; i < 100; i++) {
      cache.getOrCompute('frequent', 1000, compute);
    }

    assert.strictEqual(computeCount, 1, 'Should only compute once for frequent access');

    const stats = cache.getStats();
    assert.strictEqual(stats.hits, 99, 'Should have 99 hits');
    assert.strictEqual(stats.misses, 1, 'Should have 1 miss');
  });
});
