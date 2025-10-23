# Audit Trail System Documentation

## Overview

The A2A MCP Server includes a comprehensive audit logging system that tracks all agent actions, MCP calls, system events, and security-related activities. The audit trail provides searchable history, user attribution, security event detection, and compliance export capabilities.

## Features

- **Complete audit trail** of all agent actions and MCP operations
- **Searchable logs** with filtering by user, agent, timestamp, event type, and severity
- **Security anomaly detection** including rapid failures and policy violations
- **Compliance exports** in CSV format for audits
- **Automatic archival** of old events to maintain performance
- **Indexed database** for fast queries on large datasets

## Architecture

### Core Components

1. **AuditLogger** (`src/audit-logger.ts`) - Main audit logging module
2. **SQLite Database** - Persistent storage with indexed queries
3. **Archive System** - Automatic archival of events exceeding retention limits
4. **REST API** (`api/audit.ts`) - HTTP endpoints for querying and exporting

### Database Schema

```sql
CREATE TABLE audit_events (
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

-- Indexed columns for fast queries
CREATE INDEX idx_timestamp ON audit_events(timestamp);
CREATE INDEX idx_event_type ON audit_events(event_type);
CREATE INDEX idx_agent_id ON audit_events(agent_id);
CREATE INDEX idx_severity ON audit_events(severity);
CREATE INDEX idx_success ON audit_events(success);
```

## Event Types

```typescript
enum AuditEventType {
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
```

## Severity Levels

```typescript
enum AuditSeverity {
  INFO = 'info',        // Normal operations
  WARNING = 'warning',  // Potential issues
  CRITICAL = 'critical' // Security events requiring attention
}
```

## Usage

### Logging Events

```typescript
import { auditLogger, AuditEventType, AuditSeverity } from './audit-logger.js';

// Log a successful operation
auditLogger.log({
  eventType: AuditEventType.TOOL_EXECUTED,
  severity: AuditSeverity.INFO,
  agentId: 'agent-123',
  action: 'Executed data processing tool',
  resource: 'tools/process-data',
  metadata: { inputSize: 1024, outputSize: 512 },
  success: true,
});

// Log a failure
auditLogger.log({
  eventType: AuditEventType.TOOL_EXECUTED,
  severity: AuditSeverity.WARNING,
  agentId: 'agent-123',
  action: 'Failed to execute tool',
  resource: 'tools/process-data',
  metadata: { inputSize: 1024 },
  success: false,
  errorMessage: 'Invalid input format',
});
```

### Querying Logs

```typescript
// Query by agent ID
const events = auditLogger.query({
  agentId: 'agent-123',
  limit: 100,
});

// Query by time range
const recentEvents = auditLogger.query({
  startTime: Date.now() - 3600000, // Last hour
  endTime: Date.now(),
  limit: 50,
});

// Query by event type and severity
const criticalEvents = auditLogger.query({
  eventType: [AuditEventType.POLICY_VIOLATION, AuditEventType.AUTH_FAILURE],
  severity: [AuditSeverity.CRITICAL],
});

// Query failed operations
const failures = auditLogger.query({
  success: false,
  startTime: Date.now() - 86400000, // Last 24 hours
});
```

### Text Search

```typescript
// Search across action, resource, and error message fields
const results = auditLogger.search('unauthorized access', 100);
```

### Security Anomaly Detection

```typescript
// Detect anomalies for a specific agent
const anomalies = auditLogger.detectSecurityAnomalies('agent-123', 3600000);

anomalies.forEach(anomaly => {
  console.log(`Type: ${anomaly.type}`);
  console.log(`Severity: ${anomaly.severity}`);
  console.log(`Description: ${anomaly.description}`);
  console.log(`Event count: ${anomaly.events.length}`);
});
```

**Detected Anomaly Types:**
- `rapid_failures` - More than 10 failures in the time window
- `policy_violations` - Any policy violation events

### CSV Export

```typescript
// Export with filters
const csv = auditLogger.exportCSV({
  startTime: Date.now() - 86400000,
  eventType: [AuditEventType.TOOL_EXECUTED],
  limit: 10000,
});

// Save to file
fs.writeFileSync('audit-export.csv', csv);
```

## REST API

### Query Audit Logs

**Endpoint:** `GET /api/audit`

**Query Parameters:**
- `eventType` - Filter by event type
- `severity` - Filter by severity
- `agentId` - Filter by agent ID
- `userId` - Filter by user ID
- `startTime` - Start timestamp (milliseconds)
- `endTime` - End timestamp (milliseconds)
- `success` - Filter by success status (true/false)
- `limit` - Maximum results (default: 100)
- `offset` - Pagination offset

**Example:**
```bash
curl "http://localhost:3000/api/audit?agentId=agent-123&limit=50"
```

**Response:**
```json
{
  "events": [
    {
      "id": "uuid-123",
      "timestamp": 1234567890000,
      "eventType": "tool.executed",
      "severity": "info",
      "agentId": "agent-123",
      "action": "Executed data processing tool",
      "resource": "tools/process-data",
      "metadata": { "inputSize": 1024 },
      "success": true
    }
  ],
  "count": 1
}
```

### Search Audit Logs

**Endpoint:** `GET /api/audit?action=search&query=<search_term>`

**Example:**
```bash
curl "http://localhost:3000/api/audit?action=search&query=failed&limit=50"
```

### Detect Anomalies

**Endpoint:** `GET /api/audit?action=anomalies&agentId=<agent_id>`

**Example:**
```bash
curl "http://localhost:3000/api/audit?action=anomalies&agentId=agent-123"
```

**Response:**
```json
{
  "anomalies": [
    {
      "type": "rapid_failures",
      "severity": "warning",
      "description": "15 failures in last 60 minutes",
      "events": [...]
    }
  ]
}
```

### Export to CSV

**Endpoint:** `POST /api/audit?action=export`

**Body:**
```json
{
  "filters": {
    "startTime": 1234567890000,
    "endTime": 1234567900000,
    "agentId": "agent-123"
  }
}
```

**Example:**
```bash
curl -X POST "http://localhost:3000/api/audit?action=export" \
  -H "Content-Type: application/json" \
  -d '{"filters":{"agentId":"agent-123"}}' \
  --output audit-export.csv
```

## Configuration

### Database Location

Default: `./data/audit.db`

To use a custom location:

```typescript
import { AuditLogger } from './audit-logger.js';

const customLogger = new AuditLogger('/custom/path/audit.db');
```

### Retention Policy

- **Maximum events:** 100,000 (configurable in `AuditLogger.MAX_EVENTS`)
- **Archive location:** `./data/audit-archive/`
- **Archive format:** JSON files with timestamp-based names

When the event count exceeds the maximum, older events are automatically archived to JSON files and removed from the database.

### Archive Files

Archived events are saved as:
```
./data/audit-archive/audit-{timestamp}.json
```

Each archive file contains an array of audit events in the same format as the database records.

## Integration with EnhancedMCPManager

The audit logger is automatically integrated with the EnhancedMCPManager to log:

- **Agent registration** - When MCP servers are registered
- **Agent start** - When MCP servers start successfully
- **Agent stop** - When MCP servers are stopped
- **Agent failures** - When MCP servers fail to start

Example integration:

```typescript
import { auditLogger, AuditEventType, AuditSeverity } from './audit-logger.js';

async startServer(id: string): Promise<void> {
  try {
    // ... start server logic
    
    auditLogger.log({
      eventType: AuditEventType.AGENT_REGISTERED,
      severity: AuditSeverity.INFO,
      agentId: id,
      action: `MCP server ${id} started`,
      resource: id,
      metadata: { pid: proc.pid },
      success: true,
    });
  } catch (error) {
    auditLogger.log({
      eventType: AuditEventType.AGENT_REGISTERED,
      severity: AuditSeverity.WARNING,
      agentId: id,
      action: `Failed to start MCP server ${id}`,
      resource: id,
      metadata: {},
      success: false,
      errorMessage: error.message,
    });
    throw error;
  }
}
```

## Performance

- **Query response time:** < 100ms for 100k events (with indexes)
- **CSV export time:** < 5 seconds for 10k events
- **Database size:** ~1MB per 10,000 events
- **Archive performance:** Automatic, non-blocking background operation

## Security Considerations

1. **Access Control:** The audit logs contain sensitive information. Ensure the REST API is protected with authentication.

2. **Data Retention:** Configure appropriate retention periods based on compliance requirements.

3. **Archive Security:** Archive files should be stored securely with restricted access.

4. **Database Permissions:** Ensure the SQLite database file has appropriate file system permissions.

5. **Anomaly Alerts:** Set up monitoring to alert on security anomalies detected by the system.

## Compliance

The audit trail system is designed to support compliance with:

- **SOC 2** - Comprehensive logging and monitoring
- **ISO 27001** - Security event tracking
- **GDPR** - User activity attribution (with user_id field)
- **HIPAA** - Access logs and audit trails

## Testing

Run the audit logger test suite:

```bash
npm run build
node --test dist/tests/audit-logger.test.js
```

The test suite covers:
- Event logging and retrieval
- Time range filtering
- Event type and severity filtering
- Success/failure filtering
- Text search
- CSV export
- Security anomaly detection
- Pagination

## Troubleshooting

### Database locked errors

If you encounter "database is locked" errors:
1. Ensure only one instance is accessing the database
2. Check file permissions on the database file
3. Consider using WAL mode for better concurrency

### Performance degradation

If queries become slow:
1. Check the number of events in the database
2. Verify indexes are created (run `initializeDatabase()`)
3. Consider lowering `MAX_EVENTS` for more frequent archival
4. Archive old events manually if needed

### Missing events

If events are not appearing:
1. Check that `auditLogger.log()` is being called
2. Verify the database file exists and is writable
3. Check application logs for errors
4. Ensure the database connection is open

## Future Enhancements

Planned improvements:
- Real-time event streaming via WebSocket
- Integration with external SIEM systems
- Machine learning-based anomaly detection
- Configurable retention policies per event type
- Multi-tenancy support with isolated audit logs
- Encryption at rest for sensitive audit data

## Support

For issues or questions:
- Check the test suite for usage examples
- Review the source code in `src/audit-logger.ts`
- Open an issue on the GitHub repository
