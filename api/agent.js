/**
 * Vercel Serverless Function: /api/agent
 * Handles agent status queries and proxies to Railway backend if needed
 */

const RAILWAY_BACKEND = process.env.BACKEND_BASE_URL || 'https://ac532d3b-0a00-4589-b880-cb0c4cf971a4.up.railway.app';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    if (action === 'status') {
      // Return local Vercel edge status
      return res.status(200).json({
        status: 'ok',
        service: 'vercel-edge',
        timestamp: new Date().toISOString(),
        endpoints: {
          healthz: '/healthz',
          demo: '/demo',
          dashboard: '/api/dashboard',
          agent: '/api/agent?action=status'
        },
        backend: RAILWAY_BACKEND
      });
    } else if (action === 'proxy') {
      // Proxy request to Railway backend
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${RAILWAY_BACKEND}/healthz`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      return res.status(response.status).json({
        proxied: true,
        backend: RAILWAY_BACKEND,
        data
      });
    } else {
      // Unknown action
      return res.status(400).json({
        error: 'Invalid action',
        validActions: ['status', 'proxy'],
        usage: '/api/agent?action=status'
      });
    }
  } catch (error) {
    console.error('Agent endpoint error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
};
