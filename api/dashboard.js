// A2A MCP OPTIMIZED DASHBOARD - FULL AUTONOMOUS EXECUTION
// Real-time monitoring, browser integration, parallel execution
// Optimized for scarmonit/A2A MCP Repository

import { analyticsEngine } from '../dist/src/analytics-engine.js';
import { agents } from '../dist/agents.js';
import { autonomousToolRegistry } from '../dist/src/autonomous-tools.js';

// Enhanced Dashboard with Real-Time Capabilities
class DashboardManager {
  constructor() {
    this.activeConnections = new Map();
    this.monitoringTasks = new Map();
    this.executionQueue = [];
  }

  // Get comprehensive dashboard data with autonomous features
  async getDashboardData(timeRange = '1h', includeAutonomous = true) {
    const now = Date.now();
    const timeRanges = {
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const duration = timeRanges[timeRange] || timeRanges['1h'];
    const start = now - duration;
    
    // Parallel data collection for maximum efficiency
    const [
      realTimeMetrics,
      usageAnalytics,
      insights,
      agentStatus,
      prometheusMetrics,
      autonomousStatus
    ] = await Promise.all([
      analyticsEngine.getRealTimeMetrics(),
      analyticsEngine.getUsageAnalytics({ start, end: now }),
      analyticsEngine.generateInsights({ start, end: now }),
      this.getAgentStatus(),
      analyticsEngine.getMetrics(),
      includeAutonomous ? this.getAutonomousStatus() : null
    ]);
    
    return {
      timestamp: now,
      timeRange,
      realTime: {
        ...realTimeMetrics,
        activeConnections: this.activeConnections.size,
        monitoringTasks: this.monitoringTasks.size,
        queuedExecutions: this.executionQueue.length
      },
      usage: usageAnalytics,
      insights: insights.slice(0, 10),
      agents: agentStatus,
      autonomous: autonomousStatus,
      metrics: {
        prometheus: prometheusMetrics,
        system: this.getSystemMetrics()
      }
    };
  }

  getAgentStatus() {
    return Object.keys(agents).map(agentId => ({
      id: agentId,
      name: agents[agentId].name || agentId,
      status: 'active',
      capabilities: agents[agentId].capabilities || [],
      lastExecution: agents[agentId].lastExecution || null
    }));
  }

  async getAutonomousStatus() {
    return {
      toolsAvailable: autonomousToolRegistry.list().length,
      categories: autonomousToolRegistry.getCategories(),
      activeMonitors: this.monitoringTasks.size,
      recentExecutions: this.executionQueue.slice(-10)
    };
  }

  getSystemMetrics() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  // Execute autonomous tool with real-time tracking
  async executeAutonomousTool(toolName, params, context) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const execution = {
      id: executionId,
      tool: toolName,
      params,
      status: 'running',
      startTime: Date.now(),
      endTime: null,
      result: null,
      error: null
    };
    
    this.executionQueue.push(execution);
    
    try {
      const result = await autonomousToolRegistry.execute(toolName, params, context);
      execution.status = 'completed';
      execution.result = result;
      execution.endTime = Date.now();
      return { success: true, executionId, result };
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.endTime = Date.now();
      return { success: false, executionId, error: error.message };
    }
  }

  // Add monitoring task
  addMonitoringTask(taskId, config) {
    this.monitoringTasks.set(taskId, {
      id: taskId,
      config,
      startTime: Date.now(),
      status: 'active'
    });
  }

  // Remove monitoring task
  removeMonitoringTask(taskId) {
    this.monitoringTasks.delete(taskId);
  }
}

const dashboardManager = new DashboardManager();

// Export enhanced endpoint handler
export default async function handler(req, res) {
  const { pathname, query } = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Main dashboard data with autonomous features
    if (pathname === '/api/dashboard' || pathname === '/dashboard') {
      const timeRange = query.timeRange || '1h';
      const includeAutonomous = query.autonomous !== 'false';
      const data = await dashboardManager.getDashboardData(timeRange, includeAutonomous);
      return res.status(200).json({ ok: true, data });
    }
    
    // Real-time metrics endpoint with WebSocket info
    if (pathname === '/api/dashboard/realtime') {
      const metrics = analyticsEngine.getRealTimeMetrics();
      const enhanced = {
        ...metrics,
        dashboard: {
          activeConnections: dashboardManager.activeConnections.size,
          monitoringTasks: dashboardManager.monitoringTasks.size,
          queuedExecutions: dashboardManager.executionQueue.length
        },
        timestamp: Date.now()
      };
      return res.status(200).json({ ok: true, data: enhanced });
    }
    
    // Execute autonomous tool endpoint
    if (pathname === '/api/dashboard/execute' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      
      const { tool, params, context } = JSON.parse(body);
      const result = await dashboardManager.executeAutonomousTool(tool, params, context);
      return res.status(200).json({ ok: true, data: result });
    }
    
    // Get available autonomous tools
    if (pathname === '/api/dashboard/tools') {
      const tools = autonomousToolRegistry.list();
      const categories = autonomousToolRegistry.getCategories();
      return res.status(200).json({
        ok: true,
        data: {
          tools,
          categories,
          total: tools.length
        }
      });
    }
    
    // Analytics query endpoint
    if (pathname === '/api/dashboard/query' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) {
        body += chunk;
      }
      
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
        res.setHeader('Content-Disposition', `attachment; filename=\"a2a-analytics-${timeRange}.csv\"`);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=\"a2a-analytics-${timeRange}.json\"`);
      }
      
      return res.status(200).send(exportData);
    }
    
    // Prometheus metrics endpoint
    if (pathname === '/api/dashboard/metrics') {
      const metrics = await analyticsEngine.getMetrics();
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(metrics);
    }
    
    // Agent stats endpoint with enhanced info
    if (pathname === '/api/dashboard/agents') {
      const agentStats = dashboardManager.getAgentStatus();
      return res.status(200).json({ ok: true, data: agentStats });
    }
    
    // Execution history endpoint
    if (pathname === '/api/dashboard/executions') {
      const limit = parseInt(query.limit || '50');
      const executions = dashboardManager.executionQueue.slice(-limit);
      return res.status(200).json({ ok: true, data: executions });
    }
    
    // Monitoring tasks endpoint
    if (pathname === '/api/dashboard/monitoring') {
      const tasks = Array.from(dashboardManager.monitoringTasks.values());
      return res.status(200).json({ ok: true, data: tasks });
    }
    
    // System health check
    if (pathname === '/api/dashboard/health') {
      const health = {
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        activeServices: {
          dashboard: true,
          analytics: true,
          autonomous: true,
          monitoring: dashboardManager.monitoringTasks.size > 0
        }
      };
      return res.status(200).json({ ok: true, data: health });
    }
    
    // Default: Dashboard API info with all endpoints
    return res.status(200).json({
      ok: true,
      message: 'A2A MCP Optimized Dashboard API - Full Autonomous Execution',
      version: '2.0.0',
      features: [
        'Real-time monitoring',
        'Autonomous tool execution',
        'Parallel task processing',
        'Browser integration support',
        'WebSocket ready',
        'Comprehensive analytics'
      ],
      endpoints: {
        dashboard: '/api/dashboard?timeRange=1h&autonomous=true',
        realtime: '/api/dashboard/realtime',
        execute: 'POST /api/dashboard/execute',
        tools: '/api/dashboard/tools',
        query: 'POST /api/dashboard/query',
        insights: '/api/dashboard/insights?timeRange=24h',
        export: '/api/dashboard/export?format=json&timeRange=24h',
        metrics: '/api/dashboard/metrics',
        agents: '/api/dashboard/agents',
        executions: '/api/dashboard/executions?limit=50',
        monitoring: '/api/dashboard/monitoring',
        health: '/api/dashboard/health'
      }
    });
    
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({
      ok: false,
      error: {
        message: 'Dashboard API error',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
}
