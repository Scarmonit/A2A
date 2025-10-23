/**
 * A2A MCP Server - Production Infrastructure Integration Example
 *
 * This example demonstrates how to integrate all production enhancements:
 * - Rate Limiting
 * - Redis Caching
 * - PostgreSQL Persistence
 * - Distributed Tracing
 * - Enhanced Workflows
 */

import { rateLimiter } from '../src/infrastructure/rate-limiter.js';
import { redisAdapter, SessionManager } from '../src/infrastructure/redis-adapter.js';
import { postgresAdapter } from '../src/infrastructure/postgres-adapter.js';
import { telemetry } from '../src/infrastructure/telemetry.js';
import { workflowOrchestrator } from '../src/workflow-orchestrator.js';
import { PRODUCTION_WORKFLOW_TEMPLATES } from '../src/workflow-templates/production-templates.js';
import { agentRegistry } from '../src/agents.js';
import { EnhancedMCPManager } from '../src/enhanced-mcp-manager.js';
import { RealtimeDashboardHandler } from '../src/realtime-dashboard-handler.js';
import pino from 'pino';

const logger = pino({ name: 'production-integration-example' });

/**
 * Main application class with all production infrastructure
 */
class ProductionA2AServer {
  private mcpManager: EnhancedMCPManager;
  private dashboard: RealtimeDashboardHandler;
  private sessionManager: SessionManager;
  private initialized = false;

  constructor() {
    this.mcpManager = new EnhancedMCPManager();
    this.dashboard = new RealtimeDashboardHandler({
      port: parseInt(process.env.DASHBOARD_PORT || '9000', 10),
      mcpManager: this.mcpManager,
    });
    this.sessionManager = new SessionManager(redisAdapter);
  }

  /**
   * Initialize all infrastructure components
   */
  async initialize(): Promise<void> {
    logger.info('Initializing production infrastructure...');

    try {
      // 1. Initialize Redis (caching and sessions)
      logger.info('Connecting to Redis...');
      await redisAdapter.connect();
      logger.info('Redis connected successfully');

      // 2. Initialize PostgreSQL (persistence)
      logger.info('Connecting to PostgreSQL...');
      await postgresAdapter.connect();
      await postgresAdapter.initializeSchema();
      logger.info('PostgreSQL connected and schema initialized');

      // 3. Initialize OpenTelemetry (distributed tracing)
      logger.info('Initializing telemetry...');
      await telemetry.initialize();
      logger.info('Telemetry initialized');

      // 4. Load workflow templates
      logger.info('Loading workflow templates...');
      this.loadWorkflowTemplates();
      logger.info('Workflow templates loaded');

      // 5. Start health monitoring
      logger.info('Starting health monitoring...');
      this.mcpManager.startHealthMonitoring(30000); // 30 seconds
      logger.info('Health monitoring started');

      // 6. Start real-time dashboard
      logger.info('Starting real-time dashboard...');
      this.dashboard.startMetricsBroadcast();
      logger.info('Real-time dashboard started');

      // 7. Set up event listeners
      this.setupEventListeners();

      this.initialized = true;
      logger.info('Production infrastructure initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize infrastructure');
      throw error;
    }
  }

  /**
   * Load production workflow templates
   */
  private loadWorkflowTemplates(): void {
    for (const [name, template] of Object.entries(PRODUCTION_WORKFLOW_TEMPLATES)) {
      workflowOrchestrator.registerTemplate(name, template);
      logger.info({ templateName: name }, 'Loaded workflow template');
    }
  }

  /**
   * Set up event listeners for monitoring
   */
  private setupEventListeners(): void {
    // MCP Manager events
    this.mcpManager.on('server:started', ({ id }: { id: string }) => {
      logger.info({ serverId: id }, 'MCP server started');
      this.dashboard.notifyServerStatus(id, 'running');
    });

    this.mcpManager.on('server:recovered', ({ id, attempts }: { id: string; attempts: number }) => {
      logger.info({ serverId: id, attempts }, 'MCP server recovered');
    });

    this.mcpManager.on('server:failed', ({ id, restarts }: { id: string; restarts: number }) => {
      logger.error({ serverId: id, restarts }, 'MCP server failed');
      this.dashboard.notifyServerStatus(id, 'failed');
    });

    // Rate limiter events
    rateLimiter.on('rate-limit-exceeded', ({ key, retryAfter }: { key: string; retryAfter: number }) => {
      logger.warn({ key, retryAfter }, 'Rate limit exceeded');
    });

    // Redis events
    redisAdapter.on('connect', () => {
      logger.info('Redis connection established');
    });

    redisAdapter.on('disconnect', () => {
      logger.warn('Redis disconnected');
    });

    // PostgreSQL events
    postgresAdapter.on('connect', () => {
      logger.info('PostgreSQL connection established');
    });

    postgresAdapter.on('disconnect', () => {
      logger.warn('PostgreSQL disconnected');
    });

    // Telemetry events
    telemetry.on('trace:started', ({ traceId, name }: { traceId: string; name: string }) => {
      logger.debug({ traceId, name }, 'Trace started');
    });

    telemetry.on('trace:finished', (trace: { traceId: string; startTime: number; endTime?: number }) => {
      logger.debug(
        { traceId: trace.traceId, duration: trace.endTime! - trace.startTime },
        'Trace finished'
      );
    });
  }

  /**
   * Example: Execute a CI/CD workflow with tracing and rate limiting
   */
  async executeCICDWorkflow(repositoryPath: string): Promise<void> {
    // Check rate limit
    const rateLimitResult = await rateLimiter.limit('cicd-workflow', 1);
    if (!rateLimitResult.allowed) {
      throw new Error(`Rate limit exceeded. Retry after ${rateLimitResult.retryAfter}ms`);
    }

    // Start distributed trace
    return telemetry.trace('execute-cicd-workflow', async (span) => {
      span.setAttribute('repository.path', repositoryPath);

      // Create workflow from template
      const workflow = workflowOrchestrator.createFromTemplate('cicd-pipeline', {
        context: {
          repository_path: repositoryPath,
          language: 'javascript',
          staging_path: './staging',
          production_path: './production',
          timestamp: new Date().toISOString(),
        },
      });

      span.setAttribute('workflow.id', workflow.id);

      // Save workflow to database
      await postgresAdapter.saveWorkflow(workflow);

      // Execute workflow
      await workflowOrchestrator.executeWorkflow(workflow.id);

      // Cache the result
      await redisAdapter.set(`workflow:${workflow.id}:result`, workflow, 3600);

      logger.info({ workflowId: workflow.id }, 'CI/CD workflow completed successfully');
    });
  }

  /**
   * Example: Create and manage a user session
   */
  async createUserSession(userId: string, agentId: string): Promise<string> {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2)}`;

    await this.sessionManager.createSession(sessionId, {
      userId,
      agentId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    });

    logger.info({ sessionId, userId, agentId }, 'User session created');
    return sessionId;
  }

  /**
   * Example: Agent invocation with rate limiting and tracing
   */
  async invokeAgentWithTracking(agentId: string, capability: string, input: any): Promise<any> {
    // Check rate limit
    const rateLimitKey = `${agentId}:${capability}`;
    const rateLimitResult = await rateLimiter.limit(rateLimitKey, 1);

    if (!rateLimitResult.allowed) {
      throw new Error(`Rate limit exceeded for ${agentId}. Retry after ${rateLimitResult.retryAfter}ms`);
    }

    // Execute with tracing
    return telemetry.trace(`agent-invocation-${agentId}`, async (span) => {
      span.setAttribute('agent.id', agentId);
      span.setAttribute('agent.capability', capability);
      span.setAttribute('rate_limit.remaining', rateLimitResult.remaining);

      // Get agent from cache or database
      let agent = await redisAdapter.get(`agent:${agentId}`);

      if (!agent) {
        agent = await postgresAdapter.loadAgent(agentId);
        if (agent) {
          await redisAdapter.set(`agent:${agentId}`, agent, 300); // Cache for 5 minutes
        }
      }

      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Execute agent capability (simplified)
      const result = {
        success: true,
        agentId,
        capability,
        input,
        timestamp: Date.now(),
      };

      // Save audit log
      await postgresAdapter.saveAuditEvent({
        id: `audit-${Date.now()}`,
        timestamp: Date.now(),
        agentId,
        action: `invoke:${capability}`,
        metadata: { input, result },
      });

      span.addEvent('agent-invocation-completed', {
        'result.success': result.success,
      });

      return result;
    });
  }

  /**
   * Health check for all infrastructure components
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    components: Record<string, { healthy: boolean; latency: number }>;
  }> {
    const components: Record<string, { healthy: boolean; latency: number }> = {};

    // Check Redis
    components.redis = await redisAdapter.healthCheck();

    // Check PostgreSQL
    components.postgres = await postgresAdapter.healthCheck();

    // Check MCP Manager
    const mcpHealth = this.mcpManager.getHealthStatus();
    components.mcpManager = {
      healthy: mcpHealth.failed === 0,
      latency: 0,
    };

    // Check dashboard
    components.dashboard = {
      healthy: this.dashboard.getClientCount() >= 0,
      latency: 0,
    };

    const allHealthy = Object.values(components).every((c) => c.healthy);

    return {
      healthy: allHealthy,
      components,
    };
  }

  /**
   * Get comprehensive statistics
   */
  async getStatistics(): Promise<any> {
    const [dbStats, agentStats, rateLimiterStats, telemetryStats] = await Promise.all([
      postgresAdapter.getStats(),
      Promise.resolve(agentRegistry.getStats()),
      Promise.resolve(rateLimiter.getStats()),
      Promise.resolve(telemetry.getStats()),
    ]);

    return {
      database: dbStats,
      agents: agentStats,
      rateLimiter: rateLimiterStats,
      telemetry: telemetryStats,
      dashboard: {
        clients: this.dashboard.getClientCount(),
      },
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down production infrastructure...');

    try {
      // 1. Stop accepting new requests
      this.mcpManager.stopHealthMonitoring();

      // 2. Stop dashboard
      this.dashboard.stopMetricsBroadcast();
      await this.dashboard.shutdown();

      // 3. Shutdown MCP manager
      await this.mcpManager.shutdown();

      // 4. Disconnect infrastructure
      await telemetry.shutdown();
      await redisAdapter.disconnect();
      await postgresAdapter.disconnect();

      logger.info('Production infrastructure shut down successfully');
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      throw error;
    }
  }
}

/**
 * Example usage
 */
async function main() {
  const server = new ProductionA2AServer();

  try {
    // Initialize
    await server.initialize();

    // Example 1: Execute CI/CD workflow
    logger.info('Example 1: Executing CI/CD workflow...');
    await server.executeCICDWorkflow('./src');

    // Example 2: Create user session
    logger.info('Example 2: Creating user session...');
    const sessionId = await server.createUserSession('user-123', 'agent-456');
    logger.info({ sessionId }, 'Session created');

    // Example 3: Invoke agent with tracking
    logger.info('Example 3: Invoking agent with tracking...');
    const result = await server.invokeAgentWithTracking('echo', 'chat', {
      messages: [{ role: 'user', content: 'Hello!' }],
    });
    logger.info({ result }, 'Agent invocation completed');

    // Example 4: Health check
    logger.info('Example 4: Performing health check...');
    const health = await server.healthCheck();
    logger.info({ health }, 'Health check completed');

    // Example 5: Get statistics
    logger.info('Example 5: Getting statistics...');
    const stats = await server.getStatistics();
    logger.info({ stats }, 'Statistics retrieved');

    // Graceful shutdown on signals
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully...');
      await server.shutdown();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully...');
      await server.shutdown();
      process.exit(0);
    });

    logger.info('Production infrastructure example running. Press Ctrl+C to exit.');
  } catch (error) {
    logger.error({ error }, 'Error in production infrastructure example');
    await server.shutdown();
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { ProductionA2AServer };
