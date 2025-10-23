import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ name: 'rate-limiter' });

/**
 * Token Bucket Rate Limiter
 *
 * Implements the token bucket algorithm for rate limiting:
 * - Tokens are added at a constant rate (refill rate)
 * - Each request consumes tokens
 * - Requests are denied if insufficient tokens available
 * - Burst capacity allows temporary spikes in traffic
 */

export interface RateLimitConfig {
  maxTokens: number; // Bucket capacity (burst size)
  refillRate: number; // Tokens per second
  refillInterval: number; // Refill interval in ms (default 1000ms)
  keyPrefix?: string; // Redis key prefix
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;

  constructor(config: RateLimitConfig) {
    this.maxTokens = config.maxTokens;
    this.refillRate = config.refillRate;
    this.refillInterval = config.refillInterval || 1000;
    this.tokens = this.maxTokens;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const intervalsElapsed = Math.floor(timePassed / this.refillInterval);

    if (intervalsElapsed > 0) {
      const tokensToAdd = intervalsElapsed * this.refillRate;
      this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  consume(tokens: number = 1): RateLimitResult {
    this.refill();

    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return {
        allowed: true,
        remaining: Math.floor(this.tokens),
        resetAt: this.lastRefill + this.refillInterval,
      };
    }

    const tokensNeeded = tokens - this.tokens;
    const intervalsNeeded = Math.ceil(tokensNeeded / this.refillRate);
    const retryAfter = intervalsNeeded * this.refillInterval;

    return {
      allowed: false,
      remaining: 0,
      resetAt: this.lastRefill + this.refillInterval,
      retryAfter,
    };
  }

  getStatus(): { tokens: number; maxTokens: number; lastRefill: number } {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      maxTokens: this.maxTokens,
      lastRefill: this.lastRefill,
    };
  }
}

export class RateLimiter extends EventEmitter {
  private buckets = new Map<string, TokenBucket>();
  private cleanupInterval: NodeJS.Timeout;
  private defaultConfig: RateLimitConfig;

  constructor(defaultConfig?: Partial<RateLimitConfig>) {
    super();
    this.defaultConfig = {
      maxTokens: defaultConfig?.maxTokens || 100,
      refillRate: defaultConfig?.refillRate || 10,
      refillInterval: defaultConfig?.refillInterval || 1000,
      keyPrefix: defaultConfig?.keyPrefix || 'ratelimit',
    };

    // Clean up inactive buckets every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);

    logger.info({ config: this.defaultConfig }, 'RateLimiter initialized');
  }

  /**
   * Check rate limit for a given key
   */
  async limit(
    key: string,
    tokens: number = 1,
    config?: Partial<RateLimitConfig>
  ): Promise<RateLimitResult> {
    const fullKey = `${this.defaultConfig.keyPrefix}:${key}`;
    let bucket = this.buckets.get(fullKey);

    if (!bucket) {
      const bucketConfig = { ...this.defaultConfig, ...config };
      bucket = new TokenBucket(bucketConfig);
      this.buckets.set(fullKey, bucket);
    }

    const result = bucket.consume(tokens);

    if (!result.allowed) {
      this.emit('rate-limit-exceeded', {
        key,
        remaining: result.remaining,
        retryAfter: result.retryAfter,
      });

      logger.warn(
        { key, remaining: result.remaining, retryAfter: result.retryAfter },
        'Rate limit exceeded'
      );
    }

    return result;
  }

  /**
   * Get current status for a key
   */
  getStatus(key: string): { tokens: number; maxTokens: number } | null {
    const fullKey = `${this.defaultConfig.keyPrefix}:${key}`;
    const bucket = this.buckets.get(fullKey);
    return bucket ? bucket.getStatus() : null;
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    const fullKey = `${this.defaultConfig.keyPrefix}:${key}`;
    this.buckets.delete(fullKey);
    logger.info({ key }, 'Rate limit reset');
  }

  /**
   * Clean up old buckets (called periodically)
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes
    let cleaned = 0;

    for (const [key, bucket] of this.buckets.entries()) {
      const status = bucket.getStatus();
      if (now - status.lastRefill > maxAge) {
        this.buckets.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned, total: this.buckets.size }, 'Cleaned up inactive rate limit buckets');
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalBuckets: number;
    activeKeys: string[];
  } {
    return {
      totalBuckets: this.buckets.size,
      activeKeys: Array.from(this.buckets.keys()),
    };
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
    logger.info('RateLimiter shutdown complete');
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter({
  maxTokens: 100, // 100 requests burst
  refillRate: 10, // 10 requests per second steady state
  refillInterval: 1000, // 1 second
});

/**
 * Rate limit decorator for agent tools
 */
export function RateLimit(config?: Partial<RateLimitConfig>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const agentId = (this as any).agentId || 'unknown';
      const key = `${agentId}:${propertyKey}`;

      const result = await rateLimiter.limit(key, 1, config);

      if (!result.allowed) {
        throw new Error(
          `Rate limit exceeded. Retry after ${result.retryAfter}ms. Key: ${key}`
        );
      }

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
