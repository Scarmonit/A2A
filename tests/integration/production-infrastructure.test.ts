/**
 * Integration Tests for Production Infrastructure
 *
 * Tests the production-ready components:
 * - Rate Limiter
 * - Redis Adapter
 * - PostgreSQL Adapter
 * - Telemetry Provider
 * - Safe Expression Evaluator
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { rateLimiter } from '../../src/infrastructure/rate-limiter.js';
import { redisAdapter, SessionManager } from '../../src/infrastructure/redis-adapter.js';
import { postgresAdapter } from '../../src/infrastructure/postgres-adapter.js';
import { telemetry } from '../../src/infrastructure/telemetry.js';
import { SafeExpressionEvaluator } from '../../src/infrastructure/safe-expression-evaluator.js';

describe('Production Infrastructure Integration Tests', () => {
  before(async () => {
    // Initialize all infrastructure components
    await redisAdapter.connect();
    await postgresAdapter.connect();
    await postgresAdapter.initializeSchema();
    await telemetry.initialize();
  });

  after(async () => {
    // Cleanup all infrastructure components
    await telemetry.shutdown();
    await redisAdapter.disconnect();
    await postgresAdapter.disconnect();
  });

  describe('Rate Limiter', () => {
    it('should allow requests within limit', async () => {
      const key = 'test-rate-limit-1';
      const result = await rateLimiter.limit(key, 1);

      assert.strictEqual(result.allowed, true);
      assert.ok(result.remaining >= 0);
    });

    it('should block requests exceeding limit', async () => {
      const key = 'test-rate-limit-2';

      // Exhaust the limit (default is 100 tokens)
      for (let i = 0; i < 100; i++) {
        await rateLimiter.limit(key, 1);
      }

      // This should be blocked
      const result = await rateLimiter.limit(key, 1);
      assert.strictEqual(result.allowed, false);
      assert.ok(result.retryAfter !== undefined && result.retryAfter > 0);
    });

    it('should reset limit after calling reset', async () => {
      const key = 'test-rate-limit-3';

      // Exhaust the limit
      for (let i = 0; i < 100; i++) {
        await rateLimiter.limit(key, 1);
      }

      // Reset
      await rateLimiter.reset(key);

      // Should allow again
      const result = await rateLimiter.limit(key, 1);
      assert.strictEqual(result.allowed, true);
    });

    it('should return stats', () => {
      const stats = rateLimiter.getStats();
      assert.ok(stats.totalBuckets > 0);
      assert.ok(stats.activeKeys.length > 0);
    });
  });

  describe('Redis Adapter', () => {
    it('should set and get values', async () => {
      await redisAdapter.set('test-key-1', { foo: 'bar' }, 60);
      const value = await redisAdapter.get('test-key-1');

      assert.deepStrictEqual(value, { foo: 'bar' });
    });

    it('should delete values', async () => {
      await redisAdapter.set('test-key-2', 'value', 60);
      await redisAdapter.del('test-key-2');

      const value = await redisAdapter.get('test-key-2');
      assert.strictEqual(value, null);
    });

    it('should support key patterns', async () => {
      await redisAdapter.set('pattern:1', 'value1', 60);
      await redisAdapter.set('pattern:2', 'value2', 60);

      const keys = await redisAdapter.keys('pattern:*');
      assert.ok(keys.length >= 2);
    });

    it('should perform health check', async () => {
      const health = await redisAdapter.healthCheck();
      assert.strictEqual(health.healthy, true);
      assert.ok(health.latency >= 0);
    });
  });

  describe('Session Manager', () => {
    const sessionManager = new SessionManager(redisAdapter);

    it('should create and get session', async () => {
      const sessionId = 'test-session-1';
      const data = { userId: 'user-123', agentId: 'agent-456' };

      await sessionManager.createSession(sessionId, data);
      const retrieved = await sessionManager.getSession(sessionId);

      assert.deepStrictEqual(retrieved, data);
    });

    it('should update session', async () => {
      const sessionId = 'test-session-2';
      await sessionManager.createSession(sessionId, { count: 1 });
      await sessionManager.updateSession(sessionId, { count: 2 });

      const session = await sessionManager.getSession(sessionId);
      assert.strictEqual(session.count, 2);
    });

    it('should delete session', async () => {
      const sessionId = 'test-session-3';
      await sessionManager.createSession(sessionId, {});
      await sessionManager.deleteSession(sessionId);

      const session = await sessionManager.getSession(sessionId);
      assert.strictEqual(session, null);
    });
  });

  describe('PostgreSQL Adapter', () => {
    it('should save and load agent', async () => {
      const agent = {
        id: 'test-agent-1',
        name: 'Test Agent',
        capabilities: [],
        status: 'active' as const,
        createdAt: Date.now(),
      };

      await postgresAdapter.saveAgent(agent);
      const loaded = await postgresAdapter.loadAgent('test-agent-1');

      assert.strictEqual(loaded?.id, agent.id);
      assert.strictEqual(loaded?.name, agent.name);
    });

    it('should save workflow', async () => {
      const workflow = {
        id: 'test-workflow-1',
        name: 'Test Workflow',
        steps: [],
        status: 'pending' as const,
        createdAt: Date.now(),
      };

      await postgresAdapter.saveWorkflow(workflow);
      // Workflow saved successfully (no error thrown)
      assert.ok(true);
    });

    it('should save audit events', async () => {
      const event = {
        id: 'audit-1',
        timestamp: Date.now(),
        agentId: 'agent-1',
        action: 'test-action',
        metadata: { test: true },
      };

      await postgresAdapter.saveAuditEvent(event);
      // Audit event saved successfully (no error thrown)
      assert.ok(true);
    });

    it('should perform health check', async () => {
      const health = await postgresAdapter.healthCheck();
      assert.strictEqual(health.healthy, true);
      assert.ok(health.latency >= 0);
    });
  });

  describe('Telemetry Provider', () => {
    it('should create and complete traces', async () => {
      const result = await telemetry.trace('test-operation', async (span) => {
        span.setAttribute('test.attribute', 'value');
        span.addEvent('test-event');
        return 'success';
      });

      assert.strictEqual(result, 'success');
    });

    it('should create child spans', async () => {
      await telemetry.trace('parent-operation', async (parentSpan) => {
        await telemetry.trace('child-operation', async (childSpan) => {
          childSpan.setAttribute('child', true);
        });
        parentSpan.setAttribute('parent', true);
      });

      const stats = telemetry.getStats();
      assert.ok(stats.totalTraces > 0);
      assert.ok(stats.totalSpans > 0);
    });

    it('should handle errors in traces', async () => {
      try {
        await telemetry.trace('error-operation', async () => {
          throw new Error('Test error');
        });
        assert.fail('Should have thrown an error');
      } catch (error) {
        assert.ok(error instanceof Error);
        assert.strictEqual(error.message, 'Test error');
      }
    });

    it('should return statistics', () => {
      const stats = telemetry.getStats();
      assert.ok(typeof stats.totalTraces === 'number');
      assert.ok(typeof stats.activeTraces === 'number');
      assert.ok(typeof stats.totalSpans === 'number');
      assert.ok(typeof stats.activeSpans === 'number');
    });
  });

  describe('Safe Expression Evaluator', () => {
    describe('Boolean Expressions', () => {
      it('should evaluate simple comparisons', () => {
        const context = { status: 'active', count: 10 };

        assert.strictEqual(
          SafeExpressionEvaluator.evaluate("status === 'active'", context),
          true
        );
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate("status === 'inactive'", context),
          false
        );
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('count > 5', context),
          true
        );
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('count < 5', context),
          false
        );
      });

      it('should evaluate logical operators', () => {
        const context = { a: true, b: false, c: true };

        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('a && c', context),
          true
        );
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('a && b', context),
          false
        );
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('a || b', context),
          true
        );
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('!b', context),
          true
        );
      });

      it('should evaluate property access', () => {
        const context = {
          user: {
            status: 'active',
            profile: {
              verified: true,
            },
          },
        };

        assert.strictEqual(
          SafeExpressionEvaluator.evaluate("user.status === 'active'", context),
          true
        );
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('user.profile.verified', context),
          true
        );
      });

      it('should reject dangerous expressions', () => {
        const context = {};

        assert.strictEqual(
          SafeExpressionEvaluator.isSafe('eval("code")'),
          false
        );
        assert.strictEqual(
          SafeExpressionEvaluator.isSafe('new Function()'),
          false
        );
        assert.strictEqual(
          SafeExpressionEvaluator.isSafe('require("fs")'),
          false
        );
        assert.strictEqual(
          SafeExpressionEvaluator.isSafe('process.exit()'),
          false
        );
      });

      it('should return false for invalid expressions', () => {
        const context = { value: 10 };

        // Invalid syntax should return false safely
        assert.strictEqual(
          SafeExpressionEvaluator.evaluate('invalid syntax &&& &&', context),
          false
        );
      });
    });

    describe('Value Resolution', () => {
      it('should resolve string literals', () => {
        const { SafeValueEvaluator } = require('../../src/infrastructure/safe-expression-evaluator.js');
        const context = {};

        assert.strictEqual(
          SafeValueEvaluator.resolve("'hello'", context),
          'hello'
        );
        assert.strictEqual(
          SafeValueEvaluator.resolve('"world"', context),
          'world'
        );
      });

      it('should resolve number literals', () => {
        const { SafeValueEvaluator } = require('../../src/infrastructure/safe-expression-evaluator.js');
        const context = {};

        assert.strictEqual(SafeValueEvaluator.resolve('42', context), 42);
        assert.strictEqual(SafeValueEvaluator.resolve('3.14', context), 3.14);
        assert.strictEqual(SafeValueEvaluator.resolve('-10', context), -10);
      });

      it('should resolve boolean literals', () => {
        const { SafeValueEvaluator } = require('../../src/infrastructure/safe-expression-evaluator.js');
        const context = {};

        assert.strictEqual(SafeValueEvaluator.resolve('true', context), true);
        assert.strictEqual(SafeValueEvaluator.resolve('false', context), false);
      });

      it('should resolve variables', () => {
        const { SafeValueEvaluator } = require('../../src/infrastructure/safe-expression-evaluator.js');
        const context = { name: 'Alice', age: 30 };

        assert.strictEqual(SafeValueEvaluator.resolve('name', context), 'Alice');
        assert.strictEqual(SafeValueEvaluator.resolve('age', context), 30);
      });

      it('should resolve property access', () => {
        const { SafeValueEvaluator } = require('../../src/infrastructure/safe-expression-evaluator.js');
        const context = {
          user: {
            name: 'Bob',
            address: {
              city: 'NYC',
            },
          },
        };

        assert.strictEqual(
          SafeValueEvaluator.resolve('user.name', context),
          'Bob'
        );
        assert.strictEqual(
          SafeValueEvaluator.resolve('user.address.city', context),
          'NYC'
        );
      });
    });
  });

  describe('Full Stack Integration', () => {
    it('should work together: rate limit -> trace -> cache -> persist', async () => {
      const operationKey = 'full-stack-test';

      // 1. Check rate limit
      const rateLimitResult = await rateLimiter.limit(operationKey, 1);
      assert.strictEqual(rateLimitResult.allowed, true);

      // 2. Perform operation with tracing
      const result = await telemetry.trace('full-stack-operation', async (span) => {
        span.setAttribute('operation', operationKey);

        // 3. Save to PostgreSQL
        const workflow = {
          id: 'full-stack-workflow',
          name: 'Full Stack Test',
          steps: [],
          status: 'completed' as const,
          createdAt: Date.now(),
        };
        await postgresAdapter.saveWorkflow(workflow);

        // 4. Cache in Redis
        await redisAdapter.set(`workflow:${workflow.id}`, workflow, 300);

        // 5. Verify cache hit
        const cached = await redisAdapter.get(`workflow:${workflow.id}`);
        assert.deepStrictEqual(cached, workflow);

        return workflow;
      });

      assert.strictEqual(result.id, 'full-stack-workflow');

      // Verify all components tracked the operation
      const telemetryStats = telemetry.getStats();
      const rateLimiterStats = rateLimiter.getStats();

      assert.ok(telemetryStats.totalTraces > 0);
      assert.ok(rateLimiterStats.totalBuckets > 0);
    });
  });
});
