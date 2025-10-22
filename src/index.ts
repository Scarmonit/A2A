import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { agents, AgentDescriptor, agentRegistry, ensureRequestId } from './agents.js';
import { toolRegistry } from './tools.js';
import { practicalToolRegistry } from './practical-tools.js';
import { createEnhancedAgent, createAgentEcosystem, ENHANCED_AGENT_TYPES } from './enhanced-agents.js';
import { createAdvancedAgent, createAdvancedEcosystem, ADVANCED_AGENT_TYPES } from './advanced-agents.js';
import { agentExecutor } from './agent-executor.js';
import { advancedToolRegistry } from './advanced-tools.js';
import { permissionManager } from './permissions.js';
import { agentMCPManager } from './agent-mcp-servers.js';
import { StreamHub } from './streaming.js';
import { setTimeout as sleep } from 'timers/promises';
import pino from 'pino';
import * as http from 'http';
import client, { Counter, Gauge, Registry } from 'prom-client';

// In-memory requests state
// ... trimmed for brevity in this edit interface ...
// Assume the rest of the existing content remains unchanged up to the metrics server

// metrics/health server
if (parseInt(process.env.METRICS_PORT || '3000', 10) > 0) {
  const METRICS_PORT = parseInt(process.env.METRICS_PORT || '3000', 10);
  const srv = http.createServer(async (req, res) => {
    if (!req.url) { res.statusCode = 404; res.end(); return; }
    const u = new URL(req.url, 'http://localhost');

    if (u.pathname === '/metrics') {
      const registry: Registry = new client.Registry();
      client.collectDefaultMetrics({ register: registry });
      res.setHeader('Content-Type', registry.contentType);
      res.end(await registry.metrics());
      return;
    }

    if (u.pathname === '/healthz') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (u.pathname === '/api/agent') {
      res.setHeader('Content-Type', 'application/json');
      const action = u.searchParams.get('action');
      if (action === 'status') {
        const stats = agentRegistry.getStats();
        const data = {
          ok: true,
          service: 'a2a-mcp-server',
          version: '0.1.0',
          time: new Date().toISOString(),
          agents: stats,
        };
        res.end(JSON.stringify(data));
        return;
      }
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: { code: 'ERR_BAD_REQUEST', message: 'unsupported action' } }));
      return;
    }

    res.statusCode = 404; res.end('not found');
  });
  srv.listen(METRICS_PORT);
}
