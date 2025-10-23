import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ name: 'redis-adapter' });

/**
 * Redis Adapter for A2A MCP Server
 *
 * Provides caching and session management capabilities.
 * This is a mock implementation that uses in-memory storage.
 * For production, replace with actual Redis client (ioredis or node-redis).
 *
 * Features:
 * - Key-value storage with TTL
 * - Pub/Sub messaging
 * - Session management
 * - Connection pooling ready
 * - Health monitoring
 */

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  retryStrategy?: (times: number) => number | void;
  maxRetriesPerRequest?: number;
  enableReadyCheck?: boolean;
  enableOfflineQueue?: boolean;
}

export interface CacheEntry<T = any> {
  value: T;
  expiresAt?: number;
  createdAt: number;
}

export class RedisAdapter extends EventEmitter {
  private cache = new Map<string, CacheEntry>();
  private subscribers = new Map<string, Set<(message: any) => void>>();
  private connected = false;
  private cleanupInterval?: NodeJS.Timeout;
  private config: RedisConfig;

  constructor(config?: RedisConfig) {
    super();
    this.config = {
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '6379', 10),
      keyPrefix: config?.keyPrefix || 'a2a:',
      ...config,
    };

    logger.info({ config: this.config }, 'RedisAdapter initialized (mock mode)');
  }

  /**
   * Connect to Redis (mock implementation)
   */
  async connect(): Promise<void> {
    // In production, connect to actual Redis instance
    // const Redis = require('ioredis');
    // this.client = new Redis(this.config);

    this.connected = true;
    this.emit('connect');

    // Start cleanup interval for expired keys
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 60000); // Every minute

    logger.info('Redis connection established (mock)');
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    this.connected = false;

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cache.clear();
    this.subscribers.clear();
    this.emit('disconnect');

    logger.info('Redis disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Set a value with optional TTL
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const entry: CacheEntry = {
      value,
      createdAt: Date.now(),
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    };

    this.cache.set(fullKey, entry);
    logger.debug({ key: fullKey, ttl: ttlSeconds }, 'Value set in cache');
  }

  /**
   * Get a value
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Delete a key
   */
  async del(key: string): Promise<void> {
    const fullKey = this.getFullKey(key);
    this.cache.delete(fullKey);
    logger.debug({ key: fullKey }, 'Value deleted from cache');
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(fullKey);
      return false;
    }

    return true;
  }

  /**
   * Set expiration on existing key
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (entry) {
      entry.expiresAt = Date.now() + ttlSeconds * 1000;
    }
  }

  /**
   * Get TTL for key
   */
  async ttl(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);
    const entry = this.cache.get(fullKey);

    if (!entry || !entry.expiresAt) {
      return -1;
    }

    const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  /**
   * Increment a value
   */
  async incr(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);
    const current = (await this.get<number>(key)) || 0;
    const newValue = current + 1;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Decrement a value
   */
  async decr(key: string): Promise<number> {
    const fullKey = this.getFullKey(key);
    const current = (await this.get<number>(key)) || 0;
    const newValue = current - 1;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Get keys matching pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    const matchingKeys: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        matchingKeys.push(key.replace(this.config.keyPrefix || '', ''));
      }
    }

    return matchingKeys;
  }

  /**
   * Publish message to channel
   */
  async publish(channel: string, message: any): Promise<void> {
    const subscribers = this.subscribers.get(channel);
    if (subscribers) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      subscribers.forEach((callback) => {
        try {
          callback(messageStr);
        } catch (error) {
          logger.error({ channel, error }, 'Error in subscriber callback');
        }
      });
    }
  }

  /**
   * Subscribe to channel
   */
  subscribe(channel: string, callback: (message: any) => void): void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(callback);
    logger.info({ channel }, 'Subscribed to channel');
  }

  /**
   * Unsubscribe from channel
   */
  unsubscribe(channel: string, callback?: (message: any) => void): void {
    if (callback) {
      this.subscribers.get(channel)?.delete(callback);
    } else {
      this.subscribers.delete(channel);
    }
    logger.info({ channel }, 'Unsubscribed from channel');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalKeys: number;
    expiredKeys: number;
    activeSubscribers: number;
    memoryUsage: number;
  } {
    let expiredKeys = 0;
    const now = Date.now();

    for (const entry of this.cache.values()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        expiredKeys++;
      }
    }

    return {
      totalKeys: this.cache.size,
      expiredKeys,
      activeSubscribers: this.subscribers.size,
      memoryUsage: 0, // Would calculate actual memory usage in production
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();
    const testKey = 'health:check';

    try {
      await this.set(testKey, 'ok', 10);
      const value = await this.get(testKey);
      await this.del(testKey);

      const latency = Date.now() - start;
      const healthy = value === 'ok';

      return { healthy, latency };
    } catch (error) {
      return { healthy: false, latency: Date.now() - start };
    }
  }

  /**
   * Clean up expired keys
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned, remaining: this.cache.size }, 'Cleaned up expired cache entries');
    }
  }

  /**
   * Get full key with prefix
   */
  private getFullKey(key: string): string {
    return `${this.config.keyPrefix || ''}${key}`;
  }
}

// Global Redis adapter instance
export const redisAdapter = new RedisAdapter();

/**
 * Session manager using Redis
 */
export class SessionManager {
  private redis: RedisAdapter;
  private defaultTTL: number;

  constructor(redis: RedisAdapter, defaultTTL: number = 3600) {
    this.redis = redis;
    this.defaultTTL = defaultTTL;
  }

  async createSession(sessionId: string, data: any, ttl?: number): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.set(key, data, ttl || this.defaultTTL);
  }

  async getSession<T = any>(sessionId: string): Promise<T | null> {
    const key = `session:${sessionId}`;
    return this.redis.get<T>(key);
  }

  async updateSession(sessionId: string, data: any): Promise<void> {
    const key = `session:${sessionId}`;
    const existing = await this.getSession(sessionId);
    if (existing) {
      await this.redis.set(key, { ...existing, ...data }, this.defaultTTL);
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.del(key);
  }

  async refreshSession(sessionId: string, ttl?: number): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.expire(key, ttl || this.defaultTTL);
  }
}
