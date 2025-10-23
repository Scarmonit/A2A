/**
 * Aggregation Cache Module
 * 
 * Provides intelligent caching for expensive metric calculations
 * to reduce CPU overhead and improve dashboard performance.
 */

export interface CacheEntry<T> {
  data: T;
  expiry: number;
  computeTime: number;
}

export class AggregationCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private hits: number = 0;
  private misses: number = 0;

  /**
   * Get cached data or compute if expired
   * @param key - Cache key
   * @param ttl - Time-to-live in milliseconds
   * @param compute - Function to compute data if cache miss
   */
  getOrCompute<T>(key: string, ttl: number, compute: () => T): T {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && cached.expiry > now) {
      this.hits++;
      return cached.data;
    }

    this.misses++;
    const startTime = Date.now();
    const data = compute();
    const computeTime = Date.now() - startTime;

    this.cache.set(key, {
      data,
      expiry: now + ttl,
      computeTime,
    });

    return data;
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys matching pattern
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    avgComputeTime: number;
  } {
    const entries = Array.from(this.cache.values());
    const avgComputeTime =
      entries.reduce((sum, e) => sum + e.computeTime, 0) / entries.length || 0;

    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      avgComputeTime,
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

export const aggregationCache = new AggregationCache();

// Cleanup expired entries every 60 seconds
const cleanupInterval = setInterval(() => aggregationCache.cleanup(), 60000);
// Allow process to exit even if interval is active
cleanupInterval.unref();
