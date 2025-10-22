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
  const { agentExecutor } = await import('../dist/src/agent-types.js');
  
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
    
    if (pathname === '/health') {
      const result = await server.handleRequest('health', {});
      return res.status(200).json(result);
    }
    
    if (pathname === '/agents') {
      const result = await server.handleRequest('list_agents', {});
      return res.status(200).json(result);
    }
    
    // Add dedicated /invoke endpoint for agent invocation
    if (pathname === '/invoke' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
      
      const params = JSON.parse(body);
      const result = await server.handleRequest('invoke_agent', params);
      return res.status(200).json(result);
    }
    
    // Parse JSON body for POST requests
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
      
      const data = JSON.parse(body);
      const result = await server.handleRequest(data.method, data.params || {});
      return res.status(200).json(result);
    }
    
    // Default response
    return res.status(200).json({
      ok: true,
      message: 'A2A MCP Server on Vercel',
      endpoints: {
        health: '/health',
        agents: '/agents',
        invoke: 'POST /invoke with {agentId, capability, input}',
        generic: 'POST with {method, params}'
      }
    });
    
  } catch (error) {
    console.error('Error handling request:', error);
    return res.status(500).json({
      ok: false,
      error: {
        message: 'Internal server error',
        details: error.message
      }
    });
  }
}
