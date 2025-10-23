import { mcpMonitor } from '../dist/src/mcp-monitor.js';

/**
 * REST API endpoint for MCP server metrics
 * 
 * Query parameters:
 * - serverId: Required. The ID of the MCP server to get metrics for
 * - timeRange: Optional. One of '5m', '1h', '24h'. Default is '1h'
 * 
 * Returns:
 * - serverId: The server ID
 * - timeRange: The time range used
 * - metrics: Performance metrics (calls, success rate, latency stats)
 * - anomalies: Detected anomalies (high error rates, latency spikes, etc.)
 */
export default async function handler(req, res) {
  try {
    const { serverId, timeRange = '1h' } = req.query;

    if (!serverId) {
      return res.status(400).json({ 
        error: 'serverId query parameter required',
        example: '/api/mcp-metrics?serverId=my-server&timeRange=1h'
      });
    }

    // Validate timeRange
    const validTimeRanges = ['5m', '1h', '24h'];
    if (!validTimeRanges.includes(timeRange)) {
      return res.status(400).json({
        error: `Invalid timeRange. Must be one of: ${validTimeRanges.join(', ')}`,
      });
    }

    const metrics = await mcpMonitor.getServerMetrics(serverId, timeRange);
    const anomalies = await mcpMonitor.detectAnomalies(serverId);

    res.status(200).json({
      serverId,
      timeRange,
      metrics,
      anomalies,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
}
