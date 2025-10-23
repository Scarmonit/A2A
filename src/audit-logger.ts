/**
 * Audit Logger - Records audit events for agents and servers
 * 
 * This is a stub implementation for testing purposes.
 */

export interface AuditEvent {
  id: string;
  timestamp: number;
  agentId?: string;
  serverId?: string;
  action: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface QueryOptions {
  agentId?: string;
  serverId?: string;
  action?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

class AuditLogger {
  private events: AuditEvent[] = [];
  private readonly maxEvents = 100000;

  log(event: Omit<AuditEvent, 'id' | 'timestamp'>): void {
    const auditEvent: AuditEvent = {
      ...event,
      id: this.generateId(),
      timestamp: Date.now(),
    };

    this.events.push(auditEvent);

    // Keep only recent events
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }

  query(options: QueryOptions = {}): AuditEvent[] {
    let filtered = [...this.events];

    if (options.agentId) {
      filtered = filtered.filter((e) => e.agentId === options.agentId);
    }

    if (options.serverId) {
      filtered = filtered.filter((e) => e.serverId === options.serverId);
    }

    if (options.action) {
      filtered = filtered.filter((e) => e.action.includes(options.action!));
    }

    if (options.startTime) {
      filtered = filtered.filter((e) => e.timestamp >= options.startTime!);
    }

    if (options.endTime) {
      filtered = filtered.filter((e) => e.timestamp <= options.endTime!);
    }

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (options.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  clear(): void {
    this.events = [];
  }

  getEventCount(): number {
    return this.events.length;
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const auditLogger = new AuditLogger();
