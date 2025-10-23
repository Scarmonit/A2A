import { auditLogger, AuditEventType, AuditSeverity } from '../src/audit-logger.js';
import type { IncomingMessage, ServerResponse } from 'http';

interface QueryParams {
  eventType?: AuditEventType;
  severity?: AuditSeverity;
  agentId?: string;
  userId?: string;
  startTime?: string;
  endTime?: string;
  limit?: string;
  offset?: string;
  action?: string;
  success?: string;
  query?: string;
}

/**
 * Parse URL search params from the request URL
 */
function parseQueryParams(url: string): QueryParams {
  const urlObj = new URL(url, 'http://localhost');
  const params: QueryParams = {};
  
  for (const [key, value] of urlObj.searchParams.entries()) {
    (params as any)[key] = value;
  }
  
  return params;
}

/**
 * Audit log query and export API endpoint
 */
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const { method, url } = req;

  if (!url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid request' }));
    return;
  }

  // Parse query parameters
  const params = parseQueryParams(url);
  const action = params.action;

  if (method === 'GET') {
    try {
      // Handle search action
      if (action === 'search' && params.query) {
        const searchResults = auditLogger.search(
          params.query,
          params.limit ? parseInt(params.limit) : 100
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          events: searchResults,
          count: searchResults.length 
        }));
        return;
      }

      // Handle anomaly detection action
      if (action === 'anomalies' && params.agentId) {
        const timeWindow = params.startTime 
          ? Date.now() - parseInt(params.startTime)
          : 3600000; // Default 1 hour
        
        const anomalies = auditLogger.detectSecurityAnomalies(
          params.agentId,
          timeWindow
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ anomalies }));
        return;
      }

      // Query audit logs with filters
      const events = auditLogger.query({
        eventType: params.eventType ? [params.eventType] : undefined,
        severity: params.severity ? [params.severity] : undefined,
        agentId: params.agentId,
        userId: params.userId,
        startTime: params.startTime ? parseInt(params.startTime) : undefined,
        endTime: params.endTime ? parseInt(params.endTime) : undefined,
        success: params.success ? params.success === 'true' : undefined,
        limit: params.limit ? parseInt(params.limit) : 100,
        offset: params.offset ? parseInt(params.offset) : undefined,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        events,
        count: events.length 
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: errorMessage }));
    }
    return;
  }

  if (method === 'POST' && action === 'export') {
    try {
      // Read request body for filters
      let body = '';
      
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => resolve());
        req.on('error', (err) => reject(err));
      });

      const filters = body ? JSON.parse(body).filters || {} : {};

      // Export to CSV
      const csv = auditLogger.exportCSV(filters);
      
      res.writeHead(200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=audit-log-${Date.now()}.csv`,
      });
      res.end(csv);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: errorMessage }));
    }
    return;
  }

  res.writeHead(405, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Method not allowed' }));
}
