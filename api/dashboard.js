// A2A MCP Dashboard API Endpoint
// Real-time monitoring and analytics dashboard for A2A MCP Server

import { analyticsEngine } from '../dist/src/analytics-engine.js';
import { agents } from '../dist/agents.js';

// Dashboard data aggregation
async function getDashboardData(timeRange = '1h') {
  const now = Date.now();
  const timeRanges = {
    '5m': 5 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000
  };
  
  const duration = timeRanges[timeRange] || timeRanges['1h'];
  const start = now - duration;
  
  // Get real-time metrics
  const realTimeMetrics = analyticsEngine.getRealTimeMetrics();
  
  // Get usage analytics
  const usageAnalytics = analyticsEngine.getUsageAnalytics({ start, end: now });
  
  // Get insights
  const insights = analyticsEngine.generateInsights({ start, end: now });
  
  // Get agent status
  const agentStatus = Object.keys(agents).map(agentId => ({
    id: agentId,
    name: agents[agentId].name || agentId,
    status: 'active',
    capabilities: agents[agentId].capabilities || []
  }));
  
  // Get Prometheus metrics
  const prometheusMetrics = await analyticsEngine.getMetrics();
  
  return {
    timestamp: now,
    timeRange,
    realTime: realTimeMetrics,
    usage: usageAnalytics,
    insights: insights.slice(0, 10), // Top 10 insights
    agents: agentStatus,
    metrics: {
      prometheus: prometheusMetrics
    }
  };
}

// Export endpoint handler
export default async function handler(req, res) {
  const { pathname, query } = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Main dashboard data
    if (pathname === '/api/dashboard' || pathname === '/dashboard') {
      const timeRange = query.timeRange || '1h';
      const data = await getDashboardData(timeRange);
      return res.status(200).json({ ok: true, data });
    }
    
    // Real-time metrics endpoint
    if (pathname === '/api/dashboard/realtime') {
      const metrics = analyticsEngine.getRealTimeMetrics();
      return res.status(200).json({ ok: true, data: metrics });
    }
    
    // Analytics query endpoint
    if (pathname === '/api/dashboard/query' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      await new Promise(resolve => req.on('end', resolve));
      
      const queryParams = JSON.parse(body);
      const result = analyticsEngine.query(queryParams);
      return res.status(200).json({ ok: true, data: result });
    }
    
    // Insights endpoint
    if (pathname === '/api/dashboard/insights') {
      const timeRange = query.timeRange || '1h';
      const now = Date.now();
      const duration = { '1h': 3600000, '24h': 86400000, '7d': 604800000 }[timeRange] || 3600000;
      
      const insights = analyticsEngine.generateInsights({
        start: now - duration,
        end: now
      });
      
      return res.status(200).json({ ok: true, data: insights });
    }
    
    // Export data endpoint
    if (pathname === '/api/dashboard/export') {
      const format = query.format || 'json';
      const timeRange = query.timeRange || '24h';
      const now = Date.now();
      const duration = { '1h': 3600000, '24h': 86400000, '7d': 604800000 }[timeRange] || 86400000;
      
      const exportData = analyticsEngine.exportData(
        { start: now - duration, end: now },
        format
      );
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="a2a-analytics-${timeRange}.csv"`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="a2a-analytics-${timeRange}.json"`);
      }
      
      return res.status(200).send(exportData);
    }
    
    // Prometheus metrics endpoint
    if (pathname === '/api/dashboard/metrics') {
      const metrics = await analyticsEngine.getMetrics();
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(metrics);
    }
    
    // Agent stats endpoint
    if (pathname === '/api/dashboard/agents') {
      const agentStats = Object.keys(agents).map(agentId => {
        const agent = agents[agentId];
        return {
          id: agentId,
          name: agent.name || agentId,
          description: agent.description,
          capabilities: agent.capabilities || [],
          status: 'active'
        };
      });
      
      return res.status(200).json({ ok: true, data: agentStats });
    }
    
    // Default: Dashboard info
    return res.status(200).json({
      ok: true,
      message: 'A2A MCP Dashboard API',
      endpoints: {
        dashboard: '/api/dashboard?timeRange=1h',
        realtime: '/api/dashboard/realtime',
        query: 'POST /api/dashboard/query',
        insights: '/api/dashboard/insights?timeRange=24h',
        export: '/api/dashboard/export?format=json&timeRange=24h',
        metrics: '/api/dashboard/metrics',
        agents: '/api/dashboard/agents'
      },
      version: '1.0.0'
    });
    
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      ok: false,
      error: {
        message: 'Dashboard API error',
        details: error.message
      }
    });
  }
}
