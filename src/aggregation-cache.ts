// Aggregation Cache for Performance Optimization
// Intelligent caching with TTL and LRU eviction

import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface CacheEntry<T = any> {
  data: T;
  expiry: number;
  hits: number;
  lastAccess: number;
  computeTime: number;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  totalComputeTimeSaved: number;
  avgComputeTime: number;
}

export interface CachedMetrics {
  realTimeMetrics: any;
  usageAnalytics: any;
  insights: any;
  agentStats: any;
  timestamp: number;
}

export class AggregationCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private stats = {
    hits: 0,
    misses: 0,
    totalComputeTimeSaved: 0,
    computeTimes: [] as number[]
  };
  
  // Default TTLs for different data types (in milliseconds)
  private readonly DEFAULT_TTLS = {
    realtime: 1000,        // 1 second for real-time metrics
    shortTerm: 5000,       // 5 seconds for frequently changing data
    mediumTerm: 30000,     // 30 seconds for moderate data
    longTerm: 300000,      // 5 minutes for stable data
    analytics: 60000,      // 1 minute for analytics
    insights: 300000,      // 5 minutes for insights
    custom: 10000          // 10 seconds default
  };
  
  /**
   * @param maxSize Maximum number of entries to keep in cache. Can be overridden by CACHE_MAX_SIZE environment variable.
   */
  constructor(maxSize?: number) {
    const envMax = process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE, 10) : undefined;
    this.maxSize = maxSize ?? envMax ?? 1000;
    this.startCleanupJobs();
  }
  
  /**
   * Get cached value or compute if not available
   */
  getOrCompute<T>(
    key: string, 
    ttl: number, 
    compute: () => T | Promise<T>
  ): Promise<T> {
    return this.getOrComputeAsync(key, ttl, compute);
  }
  
  /**
   * Async version of getOrCompute
   */
  private async getOrComputeAsync<T>(
    key: string,
    ttl: number,
    compute: () => T | Promise<T>
  ): Promise<T> {
    const cached = this.cache.get(key);
    
    // Check if cached and not expired
    if (cached && cached.expiry > Date.now()) {
      this.stats.hits++;
      cached.hits++;
      cached.lastAccess = Date.now();
      
      // Track compute time saved
      this.stats.totalComputeTimeSaved += cached.computeTime;
      
      logger.debug({ key, hits: cached.hits }, 'Cache hit');
      return cached.data as T;
    }
    
    // Cache miss - compute value
    this.stats.misses++;
    const startTime = Date.now();
    
    try {
      const data = await Promise.resolve(compute());
      const computeTime = Date.now() - startTime;
      
      // Store in cache
      this.set(key, data, ttl, computeTime);
      
      logger.debug({ key, computeTime, ttl }, 'Cache miss - computed and stored');
      return data;
    } catch (error) {
      logger.error({ key, error }, 'Error computing cached value');
      throw error;
    }
  }
  
  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number, computeTime: number = 0): void {
    // Enforce size limit with LRU eviction
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }
    
    const entry: CacheEntry<T> = {
      data,
      expiry: Date.now() + ttl,
      hits: 0,
      lastAccess: Date.now(),
      computeTime
    };
    
    this.cache.set(key, entry);
    this.stats.computeTimes.push(computeTime);
    
    // Keep compute times history limited
    if (this.stats.computeTimes.length > 1000) {
      this.stats.computeTimes = this.stats.computeTimes.slice(-1000);
    }
  }
  
  /**
   * Get value from cache
   */
  get<T>(key: string): T | undefined {
    const cached = this.cache.get(key);
    
    if (!cached) {
      this.stats.misses++;
      return undefined;
    }
    
    // Check expiry
    if (cached.expiry <= Date.now()) {
      this.cache.delete(key);
      this.stats.misses++;
      return undefined;
    }
    
    this.stats.hits++;
    cached.hits++;
    cached.lastAccess = Date.now();
    this.stats.totalComputeTimeSaved += cached.computeTime;
    
    return cached.data as T;
  }
  
  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    if (cached.expiry <= Date.now()) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }
  
  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiry <= now) {
        this.cache.delete(key);
        cleared++;
      }
    }
    
    if (cleared > 0) {
      logger.debug({ cleared }, 'Expired cache entries cleared');
    }
    
    return cleared;
  }
  
  /**
   * Get pre-computed aggregations with intelligent TTL
   */
  getCachedMetrics(timeRange: '5m' | '1h' | '24h' | '7d'): Promise<CachedMetrics | null> {
    const key = `metrics:${timeRange}`;
    const ttl = this.getTTLForTimeRange(timeRange);
    
    return this.getOrCompute(key, ttl, () => null);
  }
  
  /**
   * Cache dashboard data with appropriate TTL
   */
  cacheDashboardData(timeRange: string, data: any): void {
    const key = `dashboard:${timeRange}`;
    const ttl = this.DEFAULT_TTLS.analytics;
    this.set(key, data, ttl, 0);
  }
  
  /**
   * Get cached dashboard data
   */
  getCachedDashboardData(timeRange: string): any | undefined {
    const key = `dashboard:${timeRange}`;
    return this.get(key);
  }
  
  /**
   * Cache real-time metrics with short TTL
   */
  cacheRealTimeMetrics(data: any): void {
    const key = 'realtime:metrics';
    this.set(key, data, this.DEFAULT_TTLS.realtime, 0);
  }
  
  /**
   * Get cached real-time metrics
   */
  getCachedRealTimeMetrics(): any | undefined {
    return this.get('realtime:metrics');
  }
  
  /**
   * Cache insights with medium TTL
   */
  cacheInsights(timeRange: string, insights: any): void {
    const key = `insights:${timeRange}`;
    this.set(key, insights, this.DEFAULT_TTLS.insights, 0);
  }
  
  /**
   * Get cached insights
   */
  getCachedInsights(timeRange: string): any | undefined {
    const key = `insights:${timeRange}`;
    return this.get(key);
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;
    const avgComputeTime = this.stats.computeTimes.length > 0
      ? this.stats.computeTimes.reduce((a, b) => a + b, 0) / this.stats.computeTimes.length
      : 0;
    
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalComputeTimeSaved: this.stats.totalComputeTimeSaved,
      avgComputeTime
    };
  }
  
  /**
   * Get detailed cache entries info
   */
  getEntries(): Array<{ key: string; hits: number; ttl: number; size: number }> {
    const now = Date.now();
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        hits: entry.hits,
        ttl: Math.max(0, entry.expiry - now),
        size: this.estimateSize(entry.data)
      }))
      .sort((a, b) => b.hits - a.hits);
  }
  
  /**
   * Get most frequently accessed entries
   */
  getHotEntries(limit: number = 10): Array<{ key: string; hits: number; lastAccess: number }> {
    return Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        hits: entry.hits,
        lastAccess: entry.lastAccess
      }))
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit);
  }
  
  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug({ key: oldestKey }, 'LRU eviction');
    }
  }
  
  /**
   * Get TTL based on time range
   */
  private getTTLForTimeRange(timeRange: string): number {
    switch (timeRange) {
      case '5m': return this.DEFAULT_TTLS.realtime;
      case '1h': return this.DEFAULT_TTLS.shortTerm;
      case '24h': return this.DEFAULT_TTLS.mediumTerm;
      case '7d': return this.DEFAULT_TTLS.longTerm;
      default: return this.DEFAULT_TTLS.custom;
    }
  }
  
  /**
   * Estimate data size in bytes
   */
  private estimateSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }
  
  /**
   * Start background cleanup jobs
   */
  private startCleanupJobs(): void {
    // Clear expired entries every 30 seconds
    setInterval(() => {
      this.clearExpired();
    }, 30000);
    
    // Log stats every 5 minutes
    setInterval(() => {
      const stats = this.getStats();
      logger.info({
        cacheSize: stats.size,
        hitRate: (stats.hitRate * 100).toFixed(2) + '%',
        timeSaved: (stats.totalComputeTimeSaved / 1000).toFixed(2) + 's',
        avgComputeTime: stats.avgComputeTime.toFixed(2) + 'ms'
      }, 'Cache statistics');
    }, 300000);
  }
  
  /**
   * Invalidate cache entries matching pattern
   */
  invalidatePattern(pattern: RegExp): number {
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    if (invalidated > 0) {
      logger.debug({ pattern: pattern.source, invalidated }, 'Pattern invalidation');
    }
    
    return invalidated;
  }
  
  /**
   * Warm up cache with commonly accessed data
   */
  async warmUp(warmupFunctions: Array<{ key: string; ttl: number; fn: () => Promise<any> }>): Promise<void> {
    logger.info({ count: warmupFunctions.length }, 'Starting cache warmup');
    
    const startTime = Date.now();
    const results = await Promise.allSettled(
      warmupFunctions.map(({ key, ttl, fn }) => 
        this.getOrCompute(key, ttl, fn)
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const duration = Date.now() - startTime;
    
    logger.info({
      successful,
      failed,
      duration,
      cacheSize: this.cache.size
    }, 'Cache warmup completed');
  }
}

// Export singleton instance
export const aggregationCache = new AggregationCache(1000);
