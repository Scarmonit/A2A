import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import pino from 'pino';

const logger = pino({ name: 'audit-logger' });

export enum AuditEventType {
  AGENT_REGISTERED = 'agent.registered',
  AGENT_DEREGISTERED = 'agent.deregistered',
  MCP_CALL = 'mcp.call',
  TOOL_EXECUTED = 'tool.executed',
  RESOURCE_ACCESSED = 'resource.accessed',
  CONFIG_CHANGED = 'config.changed',
  AUTH_SUCCESS = 'auth.success',
  AUTH_FAILURE = 'auth.failure',
  POLICY_VIOLATION = 'policy.violation',
}

export enum AuditSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface AuditEvent {
  id: string; // UUID
  timestamp: number;
  eventType: AuditEventType;
  severity: AuditSeverity;
  agentId?: string;
  userId?: string; // For future RBAC
  action: string; // Human-readable action description
  resource?: string; // Resource affected (tool name, file path, etc.)
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

export interface QueryFilters {
  startTime?: number;
  endTime?: number;
  eventType?: AuditEventType[];
  severity?: AuditSeverity[];
  agentId?: string;
  userId?: string;
  success?: boolean;
  limit?: number;
  offset?: number;
}

export interface SecurityAnomaly {
  type: string;
  severity: AuditSeverity;
  description: string;
  events: AuditEvent[];
}

export class AuditLogger {
  private db: Database.Database;
  private readonly MAX_EVENTS = 100000; // Keep last 100k events
  private readonly ARCHIVE_PATH: string;
  private readonly dbPath: string;

  constructor(dbPath: string = './data/audit.db') {
    this.dbPath = dbPath;
    this.ARCHIVE_PATH = path.join(path.dirname(dbPath), 'audit-archive');
    
    // Ensure directories exist
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    if (!fs.existsSync(this.ARCHIVE_PATH)) {
      fs.mkdirSync(this.ARCHIVE_PATH, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.initializeDatabase();
    logger.info({ dbPath }, 'AuditLogger initialized');
  }

  private initializeDatabase(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        agent_id TEXT,
        user_id TEXT,
        action TEXT NOT NULL,
        resource TEXT,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER NOT NULL,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_timestamp ON audit_events(timestamp);
      CREATE INDEX IF NOT EXISTS idx_event_type ON audit_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_agent_id ON audit_events(agent_id);
      CREATE INDEX IF NOT EXISTS idx_severity ON audit_events(severity);
      CREATE INDEX IF NOT EXISTS idx_success ON audit_events(success);
    `);
  }

  /**
   * Log an audit event
   */
  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      id: randomUUID(),
      timestamp: Date.now(),
      ...event,
    };

    const stmt = this.db.prepare(`
      INSERT INTO audit_events (
        id, timestamp, event_type, severity, agent_id, user_id,
        action, resource, metadata, ip_address, user_agent,
        success, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      auditEvent.id,
      auditEvent.timestamp,
      auditEvent.eventType,
      auditEvent.severity,
      auditEvent.agentId || null,
      auditEvent.userId || null,
      auditEvent.action,
      auditEvent.resource || null,
      JSON.stringify(auditEvent.metadata),
      auditEvent.ipAddress || null,
      auditEvent.userAgent || null,
      auditEvent.success ? 1 : 0,
      auditEvent.errorMessage || null
    );

    // Check if archival needed
    this.checkAndArchive();
  }

  /**
   * Query audit events with filters
   */
  query(filters: QueryFilters = {}): AuditEvent[] {
    let sql = 'SELECT * FROM audit_events WHERE 1=1';
    const params: any[] = [];

    if (filters.startTime) {
      sql += ' AND timestamp >= ?';
      params.push(filters.startTime);
    }

    if (filters.endTime) {
      sql += ' AND timestamp <= ?';
      params.push(filters.endTime);
    }

    if (filters.eventType?.length) {
      sql += ` AND event_type IN (${filters.eventType.map(() => '?').join(',')})`;
      params.push(...filters.eventType);
    }

    if (filters.severity?.length) {
      sql += ` AND severity IN (${filters.severity.map(() => '?').join(',')})`;
      params.push(...filters.severity);
    }

    if (filters.agentId) {
      sql += ' AND agent_id = ?';
      params.push(filters.agentId);
    }

    if (filters.userId) {
      sql += ' AND user_id = ?';
      params.push(filters.userId);
    }

    if (filters.success !== undefined) {
      sql += ' AND success = ?';
      params.push(filters.success ? 1 : 0);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.rowToEvent);
  }

  /**
   * Search audit logs by text
   */
  search(query: string, limit: number = 100): AuditEvent[] {
    const sql = `
      SELECT * FROM audit_events
      WHERE action LIKE ? OR resource LIKE ? OR error_message LIKE ?
      ORDER BY timestamp DESC
      LIMIT ?
    `;
    const searchTerm = `%${query}%`;
    const rows = this.db.prepare(sql).all(searchTerm, searchTerm, searchTerm, limit) as any[];
    return rows.map(this.rowToEvent);
  }

  /**
   * Export audit logs to CSV
   */
  exportCSV(filters: QueryFilters = {}): string {
    const events = this.query(filters);
    const headers = [
      'Timestamp',
      'Event Type',
      'Severity',
      'Agent ID',
      'Action',
      'Resource',
      'Success',
      'Error',
    ];

    const csv = [
      headers.join(','),
      ...events.map((e) =>
        [
          new Date(e.timestamp).toISOString(),
          e.eventType,
          e.severity,
          e.agentId || '',
          `"${e.action.replace(/"/g, '""')}"`,
          e.resource || '',
          e.success,
          e.errorMessage ? `"${e.errorMessage.replace(/"/g, '""')}"` : '',
        ].join(',')
      ),
    ].join('\n');

    return csv;
  }

  /**
   * Detect security anomalies
   */
  detectSecurityAnomalies(agentId: string, timeWindow: number = 3600000): SecurityAnomaly[] {
    const anomalies: SecurityAnomaly[] = [];
    const now = Date.now();

    // Detect rapid failures (potential brute force)
    const failures = this.query({
      agentId,
      success: false,
      startTime: now - timeWindow,
    });

    if (failures.length > 10) {
      anomalies.push({
        type: 'rapid_failures',
        severity: AuditSeverity.WARNING,
        description: `${failures.length} failures in last ${timeWindow / 60000} minutes`,
        events: failures.slice(0, 5),
      });
    }

    // Detect policy violations
    const violations = this.query({
      agentId,
      eventType: [AuditEventType.POLICY_VIOLATION],
      startTime: now - timeWindow,
    });

    if (violations.length > 0) {
      anomalies.push({
        type: 'policy_violations',
        severity: AuditSeverity.CRITICAL,
        description: `${violations.length} policy violations detected`,
        events: violations,
      });
    }

    return anomalies;
  }

  /**
   * Archive old events
   */
  private checkAndArchive(): void {
    const result = this.db.prepare('SELECT COUNT(*) as count FROM audit_events').get() as any;
    const count = result.count;

    if (count > this.MAX_EVENTS) {
      const toArchive = count - this.MAX_EVENTS;
      const oldEvents = this.db
        .prepare('SELECT * FROM audit_events ORDER BY timestamp ASC LIMIT ?')
        .all(toArchive) as any[];

      // Convert to AuditEvent objects
      const eventsToArchive = oldEvents.map(this.rowToEvent);

      // Save to archive file
      const archiveFile = path.join(this.ARCHIVE_PATH, `audit-${Date.now()}.json`);
      fs.writeFileSync(archiveFile, JSON.stringify(eventsToArchive, null, 2));

      // Delete from database
      this.db
        .prepare(
          'DELETE FROM audit_events WHERE id IN (SELECT id FROM audit_events ORDER BY timestamp ASC LIMIT ?)'
        )
        .run(toArchive);

      logger.info({ count: toArchive, file: archiveFile }, 'Archived old audit events');
    }
  }

  private rowToEvent(row: any): AuditEvent {
    return {
      id: row.id,
      timestamp: row.timestamp,
      eventType: row.event_type,
      severity: row.severity,
      agentId: row.agent_id,
      userId: row.user_id,
      action: row.action,
      resource: row.resource,
      metadata: JSON.parse(row.metadata || '{}'),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      success: row.success === 1,
      errorMessage: row.error_message,
    };
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
    logger.info('AuditLogger database connection closed');
  }
}

// Singleton instance for global use
export const auditLogger = new AuditLogger();
