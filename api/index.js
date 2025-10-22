// Vercel API wrapper for A2A MCP Server
// This adapts the MCP server for Vercel's serverless environment

import { createServer } from 'http';
import { parse } from 'url';

// Import the main MCP server logic
// Note: This will need to be adjusted based on how you want to handle the stdio transport in serverless
let mcpServerHandler;

// Initialize the MCP server for HTTP requests instead of stdio
async function initMCPServer() {
  if (mcpServerHandler) return mcpServerHandler;
  
  // Import your main server logic here
  // For Vercel, we need to adapt from stdio to HTTP
  const { agents } = await import('../dist/agents.js');
  const { agentExecutor } = await import('../dist/agent-types.js');
  
  mcpServerHandler = {
    agents,
    agentExecutor,
    async handleRequest(method, params) {
      // Handle MCP requests over HTTP
      switch (method) {
        case 'health':
          return { status: 'ok', ts: Date.now(), platform: 'vercel' };
        case 'list_agents':
          return { ok: true, data: { agents: Object.keys(agents) } };
        case 'invoke_agent':
          // Simplified agent invocation for Vercel
          const { agentId, capability, input } = params;
          if (!agents[agentId]) {
            return { ok: false, error: { message: `Unknown agent: ${agentId}` } };
          }
          try {
            const result = await agentExecutor.executeAgent(agentId, capability, input, {
              agentId,
              requestId: `vercel-${Date.now()}`,
              workingDirectory: '/tmp',
              permissions: ['file:read'],
              limits: { maxExecutionTime: 30000, maxFileSize: 1024 * 1024 }
            });
            return { ok: true, data: result };
          } catch (error) {
            return { ok: false, error: { message: error.message } };
          }
        default:
          return { ok: false, error: { message: 'Method not supported in Vercel environment' } };
      }
    }
  };
  
  return mcpServerHandler;
}

export default async function handler(req, res) {
  const { pathname, query } = parse(req.url, true);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const server = await initMCPServer();
    
    // Health check endpoint
    if (pathname === '/healthz') {
      const health = await server.handleRequest('health', {});
      res.status(200).json(health);
      return;
    }
    
    // Metrics endpoint (simplified)
    if (pathname === '/metrics') {
      res.setHeader('Content-Type', 'text/plain');
      res.status(200).send('# Vercel deployment - limited metrics\na2a_vercel_requests_total 1\n');
      return;
    }
    
    // Demo endpoint
    if (pathname.startsWith('/demo')) {
      const msg = query.msg || 'Hello from Vercel';
      const agentId = query.agent || 'echo';
      const capability = query.capability || 'chat';
      const input = { messages: [{ role: 'user', content: msg }] };
      
      const result = await server.handleRequest('invoke_agent', { agentId, capability, input });
      res.status(200).json(result);
      return;
    }
    
    // Generic MCP endpoint for POST requests
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { method, params } = JSON.parse(body);
          const result = await server.handleRequest(method, params);
          res.status(200).json(result);
        } catch (error) {
          res.status(400).json({ ok: false, error: { message: 'Invalid JSON' } });
        }
      });
      return;
    }
    
    // Default response
    res.status(200).json({
      service: 'A2A MCP Server',
      platform: 'Vercel',
      endpoints: ['/healthz', '/metrics', '/demo'],
      note: 'Limited functionality in serverless environment'
    });
    
  } catch (error) {
    console.error('Vercel handler error:', error);
    res.status(500).json({
      ok: false,
      error: { message: 'Internal server error', details: error.message }
    });
  }
}