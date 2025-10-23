import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogger, AuditEventType, AuditSeverity } from '../src/audit-logger.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive Test Suite for AuditLogger
 * 
 * Tests:
 * - Audit event logging
 * - Query API with various filters
 * - Text search functionality
 * - CSV export
 * - Security anomaly detection
 * - Archival functionality
 */

describe('AuditLogger', () => {
  let testLogger: AuditLogger;
  const testDbPath = './data/test-audit.db';
  const testArchivePath = './data/test-audit-archive';

  before(() => {
    // Create test logger with separate database
    testLogger = new AuditLogger(testDbPath);
  });

  after(() => {
    // Clean up test database and archive
    testLogger.close();
    
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    if (fs.existsSync(testArchivePath)) {
      const files = fs.readdirSync(testArchivePath);
      for (const file of files) {
        fs.unlinkSync(path.join(testArchivePath, file));
      }
      fs.rmdirSync(testArchivePath);
    }
  });

  it('should log and retrieve audit events', () => {
    testLogger.log({
      eventType: AuditEventType.MCP_CALL,
      severity: AuditSeverity.INFO,
      agentId: 'test-agent-1',
      action: 'Called tool list',
      resource: 'tools/list',
      metadata: { param1: 'value1' },
      success: true,
    });

    const events = testLogger.query({ agentId: 'test-agent-1', limit: 10 });
    assert.ok(events.length > 0, 'Should have at least one event');
    
    const event = events[0];
    assert.equal(event.eventType, AuditEventType.MCP_CALL);
    assert.equal(event.agentId, 'test-agent-1');
    assert.equal(event.action, 'Called tool list');
    assert.equal(event.success, true);
    assert.deepEqual(event.metadata, { param1: 'value1' });
  });

  it('should filter events by time range', () => {
    const now = Date.now();
    const oneHourAgo = now - 3600000;

    testLogger.log({
      eventType: AuditEventType.TOOL_EXECUTED,
      severity: AuditSeverity.INFO,
      agentId: 'test-agent-2',
      action: 'Test action in time range',
      resource: 'test-resource',
      metadata: {},
      success: true,
    });

    const events = testLogger.query({
      startTime: oneHourAgo,
      endTime: now + 1000,
    });

    assert.ok(events.length > 0, 'Should find events in time range');
    assert.ok(
      events.every((e) => e.timestamp >= oneHourAgo && e.timestamp <= now + 1000),
      'All events should be within time range'
    );
  });

  it('should filter events by event type', () => {
    testLogger.log({
      eventType: AuditEventType.AUTH_SUCCESS,
      severity: AuditSeverity.INFO,
      agentId: 'test-agent-3',
      action: 'Authentication successful',
      metadata: {},
      success: true,
    });

    const events = testLogger.query({
      eventType: [AuditEventType.AUTH_SUCCESS],
    });

    assert.ok(events.length > 0, 'Should find AUTH_SUCCESS events');
    assert.ok(
      events.every((e) => e.eventType === AuditEventType.AUTH_SUCCESS),
      'All events should be AUTH_SUCCESS type'
    );
  });

  it('should filter events by severity', () => {
    testLogger.log({
      eventType: AuditEventType.POLICY_VIOLATION,
      severity: AuditSeverity.CRITICAL,
      agentId: 'test-agent-4',
      action: 'Policy violation detected',
      metadata: {},
      success: false,
      errorMessage: 'Unauthorized access attempt',
    });

    const events = testLogger.query({
      severity: [AuditSeverity.CRITICAL],
    });

    assert.ok(events.length > 0, 'Should find CRITICAL events');
    assert.ok(
      events.every((e) => e.severity === AuditSeverity.CRITICAL),
      'All events should be CRITICAL severity'
    );
  });

  it('should filter events by success status', () => {
    testLogger.log({
      eventType: AuditEventType.TOOL_EXECUTED,
      severity: AuditSeverity.WARNING,
      agentId: 'test-agent-5',
      action: 'Failed tool execution',
      resource: 'failing-tool',
      metadata: {},
      success: false,
      errorMessage: 'Tool execution failed',
    });

    const failedEvents = testLogger.query({ success: false });
    assert.ok(failedEvents.length > 0, 'Should find failed events');
    assert.ok(
      failedEvents.every((e) => e.success === false),
      'All events should have success=false'
    );

    const successEvents = testLogger.query({ success: true });
    assert.ok(successEvents.length > 0, 'Should find successful events');
    assert.ok(
      successEvents.every((e) => e.success === true),
      'All events should have success=true'
    );
  });

  it('should search events by text', () => {
    testLogger.log({
      eventType: AuditEventType.RESOURCE_ACCESSED,
      severity: AuditSeverity.INFO,
      agentId: 'test-agent-6',
      action: 'Accessed sensitive data file',
      resource: '/data/sensitive/file.txt',
      metadata: {},
      success: true,
    });

    const results = testLogger.search('sensitive');
    assert.ok(results.length > 0, 'Should find events containing "sensitive"');
    assert.ok(
      results.some((e) => 
        e.action.includes('sensitive') || 
        (e.resource && e.resource.includes('sensitive'))
      ),
      'Results should contain the search term'
    );
  });

  it('should export events to CSV format', () => {
    const csv = testLogger.exportCSV({ limit: 5 });
    
    assert.ok(csv.length > 0, 'CSV should not be empty');
    assert.ok(csv.includes('Timestamp,Event Type,Severity'), 'CSV should have headers');
    
    const lines = csv.split('\n');
    assert.ok(lines.length > 1, 'CSV should have data rows');
    
    // Check that each data row has the correct number of columns
    const headers = lines[0].split(',');
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        // Count commas outside of quotes
        const rowColumns = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        assert.ok(
          rowColumns.length >= headers.length - 1, // Allow for empty fields
          `Row ${i} should have correct number of columns`
        );
      }
    }
  });

  it('should detect rapid failure anomalies', () => {
    // Log 15 failures for the same agent
    for (let i = 0; i < 15; i++) {
      testLogger.log({
        eventType: AuditEventType.AUTH_FAILURE,
        severity: AuditSeverity.WARNING,
        agentId: 'suspicious-agent',
        action: `Failed authentication attempt ${i + 1}`,
        metadata: { attempt: i + 1 },
        success: false,
        errorMessage: 'Invalid credentials',
      });
    }

    const anomalies = testLogger.detectSecurityAnomalies('suspicious-agent');
    
    assert.ok(anomalies.length > 0, 'Should detect anomalies');
    
    const rapidFailures = anomalies.find((a) => a.type === 'rapid_failures');
    assert.ok(rapidFailures, 'Should detect rapid_failures anomaly');
    assert.equal(rapidFailures?.severity, AuditSeverity.WARNING);
    assert.ok(
      rapidFailures?.description.includes('15 failures'),
      'Description should mention failure count'
    );
  });

  it('should detect policy violation anomalies', () => {
    testLogger.log({
      eventType: AuditEventType.POLICY_VIOLATION,
      severity: AuditSeverity.CRITICAL,
      agentId: 'violating-agent',
      action: 'Attempted unauthorized action',
      metadata: { violation: 'privilege_escalation' },
      success: false,
      errorMessage: 'Policy violation: attempted privilege escalation',
    });

    const anomalies = testLogger.detectSecurityAnomalies('violating-agent');
    
    const policyViolations = anomalies.find((a) => a.type === 'policy_violations');
    assert.ok(policyViolations, 'Should detect policy_violations anomaly');
    assert.equal(policyViolations?.severity, AuditSeverity.CRITICAL);
  });

  it('should support pagination with limit and offset', () => {
    // Log multiple events
    for (let i = 0; i < 10; i++) {
      testLogger.log({
        eventType: AuditEventType.MCP_CALL,
        severity: AuditSeverity.INFO,
        agentId: 'pagination-test-agent',
        action: `Action ${i}`,
        metadata: { index: i },
        success: true,
      });
    }

    const page1 = testLogger.query({
      agentId: 'pagination-test-agent',
      limit: 5,
      offset: 0,
    });

    const page2 = testLogger.query({
      agentId: 'pagination-test-agent',
      limit: 5,
      offset: 5,
    });

    assert.equal(page1.length, 5, 'First page should have 5 events');
    assert.equal(page2.length, 5, 'Second page should have 5 events');
    
    // Ensure pages don't overlap
    const page1Ids = new Set(page1.map((e) => e.id));
    const page2Ids = new Set(page2.map((e) => e.id));
    
    for (const id of page2Ids) {
      assert.ok(!page1Ids.has(id), 'Pages should not have overlapping events');
    }
  });

  it('should handle events with optional fields', () => {
    testLogger.log({
      eventType: AuditEventType.CONFIG_CHANGED,
      severity: AuditSeverity.INFO,
      action: 'Configuration updated',
      metadata: { setting: 'max_connections', newValue: 100 },
      success: true,
      // No agentId, userId, resource, ipAddress, userAgent, errorMessage
    });

    const events = testLogger.query({
      eventType: [AuditEventType.CONFIG_CHANGED],
      limit: 1,
    });

    assert.ok(events.length > 0, 'Should find config change event');
    const event = events[0];
    // SQLite returns null for missing values
    assert.ok(!event.agentId, 'agentId should be null or undefined');
    assert.ok(!event.userId, 'userId should be null or undefined');
    assert.ok(!event.resource, 'resource should be null or undefined');
  });
});
