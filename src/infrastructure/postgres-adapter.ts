import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ name: 'postgres-adapter' });

/**
 * PostgreSQL Adapter for A2A MCP Server
 *
 * Provides persistent storage for agents, workflows, permissions, and audit logs.
 * This is a mock implementation for demonstration.
 * For production, use pg or pg-pool libraries.
 *
 * Features:
 * - Agent persistence
 * - Workflow storage
 * - Permission grants
 * - Audit logging
 * - Connection pooling ready
 * - Transaction support
 * - Health monitoring
 */

export interface PostgresConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number; // Max pool size
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  command: string;
}

export class PostgresAdapter extends EventEmitter {
  private connected = false;
  private config: PostgresConfig;
  private mockDb = new Map<string, any[]>();

  constructor(config?: PostgresConfig) {
    super();
    this.config = {
      host: config?.host || process.env.POSTGRES_HOST || 'localhost',
      port: config?.port || parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: config?.database || process.env.POSTGRES_DB || 'a2a_mcp',
      user: config?.user || process.env.POSTGRES_USER || 'postgres',
      max: config?.max || 20,
      idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
      connectionTimeoutMillis: config?.connectionTimeoutMillis || 2000,
      ...config,
    };

    this.initializeMockTables();
    logger.info({ config: this.safeConfig() }, 'PostgresAdapter initialized (mock mode)');
  }

  /**
   * Connect to PostgreSQL
   */
  async connect(): Promise<void> {
    // In production, create connection pool
    // const { Pool } = require('pg');
    // this.pool = new Pool(this.config);

    this.connected = true;
    this.emit('connect');
    logger.info('PostgreSQL connection established (mock)');
  }

  /**
   * Disconnect from PostgreSQL
   */
  async disconnect(): Promise<void> {
    // await this.pool?.end();
    this.connected = false;
    this.mockDb.clear();
    this.emit('disconnect');
    logger.info('PostgreSQL disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Execute query
   */
  async query<T = any>(sql: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.connected) {
      throw new Error('Not connected to database');
    }

    logger.debug({ sql, params }, 'Executing query');

    // Mock implementation - return empty results
    return {
      rows: [],
      rowCount: 0,
      command: sql.split(' ')[0].toUpperCase(),
    };
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    const schema = `
      -- Agents table
      CREATE TABLE IF NOT EXISTS agents (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        category VARCHAR(100),
        tags TEXT[],
        enabled BOOLEAN DEFAULT true,
        deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        config JSONB,
        capabilities JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
      CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);
      CREATE INDEX IF NOT EXISTS idx_agents_tags ON agents USING GIN(tags);

      -- Workflows table
      CREATE TABLE IF NOT EXISTS workflows (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) NOT NULL,
        steps JSONB NOT NULL,
        global_context JSONB,
        created_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        metadata JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);
      CREATE INDEX IF NOT EXISTS idx_workflows_created_by ON workflows(created_by);

      -- Permission grants table
      CREATE TABLE IF NOT EXISTS permission_grants (
        id VARCHAR(255) PRIMARY KEY,
        granted_by VARCHAR(255) NOT NULL,
        granted_to VARCHAR(255) NOT NULL,
        permission VARCHAR(255) NOT NULL,
        delegable BOOLEAN DEFAULT false,
        expires_at TIMESTAMP,
        conditions JSONB,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked BOOLEAN DEFAULT false,
        revoked_at TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_grants_granted_to ON permission_grants(granted_to);
      CREATE INDEX IF NOT EXISTS idx_grants_permission ON permission_grants(permission);
      CREATE INDEX IF NOT EXISTS idx_grants_revoked ON permission_grants(revoked);

      -- Audit log table
      CREATE TABLE IF NOT EXISTS audit_log (
        id VARCHAR(255) PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        agent_id VARCHAR(255),
        server_id VARCHAR(255),
        action VARCHAR(255) NOT NULL,
        user_id VARCHAR(255),
        metadata JSONB,
        ip_address INET,
        user_agent TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_agent ON audit_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

      -- MCP servers table
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        restarts INTEGER DEFAULT 0,
        last_restart TIMESTAMP,
        last_health_check TIMESTAMP,
        health_status BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_servers_status ON mcp_servers(status);
      CREATE INDEX IF NOT EXISTS idx_servers_type ON mcp_servers(type);

      -- Sessions table
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        agent_id VARCHAR(255),
        user_id VARCHAR(255),
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id);
    `;

    logger.info('Database schema initialized');
  }

  /**
   * Save agent to database
   */
  async saveAgent(agent: any): Promise<void> {
    const sql = `
      INSERT INTO agents (id, name, version, category, tags, enabled, config, capabilities)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        name = $2,
        version = $3,
        category = $4,
        tags = $5,
        enabled = $6,
        config = $7,
        capabilities = $8,
        updated_at = CURRENT_TIMESTAMP
    `;

    const params = [
      agent.id,
      agent.name,
      agent.version,
      agent.category,
      agent.tags || [],
      agent.enabled ?? true,
      JSON.stringify(agent.config || {}),
      JSON.stringify(agent.capabilities || []),
    ];

    await this.query(sql, params);
    logger.info({ agentId: agent.id }, 'Agent saved to database');
  }

  /**
   * Load agent from database
   */
  async loadAgent(agentId: string): Promise<any | null> {
    const sql = 'SELECT * FROM agents WHERE id = $1';
    const result = await this.query(sql, [agentId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      name: row.name,
      version: row.version,
      category: row.category,
      tags: row.tags,
      enabled: row.enabled,
      deployedAt: row.deployed_at,
      config: row.config,
      capabilities: row.capabilities,
    };
  }

  /**
   * List all agents
   */
  async listAgents(filter?: { enabled?: boolean; category?: string }): Promise<any[]> {
    let sql = 'SELECT * FROM agents WHERE 1=1';
    const params: any[] = [];

    if (filter?.enabled !== undefined) {
      params.push(filter.enabled);
      sql += ` AND enabled = $${params.length}`;
    }

    if (filter?.category) {
      params.push(filter.category);
      sql += ` AND category = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    const sql = 'DELETE FROM agents WHERE id = $1';
    await this.query(sql, [agentId]);
    logger.info({ agentId }, 'Agent deleted from database');
  }

  /**
   * Save workflow
   */
  async saveWorkflow(workflow: any): Promise<void> {
    const sql = `
      INSERT INTO workflows (id, name, description, status, steps, global_context, created_by, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        status = $4,
        steps = $5,
        global_context = $6,
        metadata = $8
    `;

    const params = [
      workflow.id,
      workflow.name,
      workflow.description,
      workflow.status,
      JSON.stringify(workflow.steps),
      JSON.stringify(workflow.globalContext || {}),
      workflow.createdBy,
      JSON.stringify(workflow.metadata || {}),
    ];

    await this.query(sql, params);
    logger.info({ workflowId: workflow.id }, 'Workflow saved to database');
  }

  /**
   * Save audit event
   */
  async saveAuditEvent(event: any): Promise<void> {
    const sql = `
      INSERT INTO audit_log (id, timestamp, agent_id, server_id, action, user_id, metadata, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    const params = [
      event.id,
      new Date(event.timestamp),
      event.agentId,
      event.serverId,
      event.action,
      event.userId,
      JSON.stringify(event.metadata || {}),
      event.ipAddress,
      event.userAgent,
    ];

    await this.query(sql, params);
  }

  /**
   * Query audit log
   */
  async queryAuditLog(filter: {
    agentId?: string;
    action?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<any[]> {
    let sql = 'SELECT * FROM audit_log WHERE 1=1';
    const params: any[] = [];

    if (filter.agentId) {
      params.push(filter.agentId);
      sql += ` AND agent_id = $${params.length}`;
    }

    if (filter.action) {
      params.push(filter.action);
      sql += ` AND action = $${params.length}`;
    }

    if (filter.startTime) {
      params.push(new Date(filter.startTime));
      sql += ` AND timestamp >= $${params.length}`;
    }

    if (filter.endTime) {
      params.push(new Date(filter.endTime));
      sql += ` AND timestamp <= $${params.length}`;
    }

    sql += ' ORDER BY timestamp DESC';

    if (filter.limit) {
      params.push(filter.limit);
      sql += ` LIMIT $${params.length}`;
    }

    const result = await this.query(sql, params);
    return result.rows;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    const start = Date.now();

    try {
      await this.query('SELECT 1');
      const latency = Date.now() - start;
      return { healthy: true, latency };
    } catch (error) {
      return { healthy: false, latency: Date.now() - start };
    }
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{
    agents: number;
    workflows: number;
    permissions: number;
    auditEvents: number;
  }> {
    const [agents, workflows, permissions, auditEvents] = await Promise.all([
      this.query('SELECT COUNT(*) as count FROM agents'),
      this.query('SELECT COUNT(*) as count FROM workflows'),
      this.query('SELECT COUNT(*) as count FROM permission_grants'),
      this.query('SELECT COUNT(*) as count FROM audit_log'),
    ]);

    return {
      agents: parseInt(agents.rows[0]?.count || '0', 10),
      workflows: parseInt(workflows.rows[0]?.count || '0', 10),
      permissions: parseInt(permissions.rows[0]?.count || '0', 10),
      auditEvents: parseInt(auditEvents.rows[0]?.count || '0', 10),
    };
  }

  /**
   * Safe config for logging (hide password)
   */
  private safeConfig(): any {
    return {
      ...this.config,
      password: this.config.password ? '***' : undefined,
    };
  }

  /**
   * Initialize mock tables
   */
  private initializeMockTables(): void {
    this.mockDb.set('agents', []);
    this.mockDb.set('workflows', []);
    this.mockDb.set('permission_grants', []);
    this.mockDb.set('audit_log', []);
    this.mockDb.set('mcp_servers', []);
    this.mockDb.set('sessions', []);
  }
}

// Global PostgreSQL adapter instance
export const postgresAdapter = new PostgresAdapter();
