import React from 'react';
import { useRealtimeDashboard } from './hooks/useRealtimeDashboard';
import { MetricsCard } from './components/MetricsCard';
import { LiveChart } from './components/LiveChart';
import { AgentCategoryBreakdown } from './components/AgentCategoryBreakdown';
import { PerformanceMonitor } from './components/PerformanceMonitor';

function App() {
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3000';
  const { metrics, isConnected, error, reconnectAttempts, requestMetrics } = useRealtimeDashboard(wsUrl);

  if (error && !isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-8">
        <div className="bg-red-900 border-2 border-red-700 rounded-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4 text-white">⚠️ Connection Error</h2>
          <p className="text-red-200 mb-4">{error}</p>
          <p className="text-red-300 text-sm mb-4">
            Make sure the WebSocket server is running on port 3000
          </p>
          <p className="text-red-400 text-xs">
            Reconnect attempts: {reconnectAttempts}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-700 hover:bg-red-600 px-6 py-2 rounded-lg font-medium transition"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto mb-4"></div>
          <p className="text-xl text-white">Connecting to dashboard...</p>
          <p className="text-gray-400 mt-2 text-sm">WebSocket URL: {wsUrl}</p>
          {reconnectAttempts > 0 && (
            <p className="text-yellow-400 mt-2 text-xs">
              Reconnecting... (attempt {reconnectAttempts})
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                🤖 A2A MCP Dashboard
              </h1>
              <p className="text-gray-400 text-sm mt-1">Real-time Agent Monitoring System</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span className="text-sm text-gray-300">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <button 
                onClick={requestMetrics}
                className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg font-medium transition"
                disabled={!isConnected}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Last Updated */}
        {metrics && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">Last updated:</span>
              <span className="text-white font-medium">
                {new Date(metrics.timestamp).toLocaleString()}
              </span>
            </div>
          </div>
        )}

        {/* Metrics Grid - Top Row KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricsCard 
            title="Total Agents"
            value={metrics?.agents.total || 0}
            icon="🤖"
            color="border-blue-500"
            subtitle={`${metrics?.agents.enabled || 0} enabled, ${metrics?.agents.disabled || 0} disabled`}
          />
          <MetricsCard 
            title="Enabled Agents"
            value={metrics?.agents.enabled || 0}
            icon="✅"
            color="border-green-500"
            subtitle={`${metrics?.agents.categories || 0} categories`}
          />
          <MetricsCard 
            title="Memory Usage"
            value={`${metrics?.performance.memoryUsageMB || 0} MB`}
            icon="💾"
            color="border-yellow-500"
            subtitle={`${metrics?.performance.memoryPercentage || 0}% used`}
          />
          <MetricsCard 
            title="CPU Load (1m)"
            value={metrics?.performance.cpuLoadAverage[0]?.toFixed(2) || '0.00'}
            icon="⚡"
            color="border-purple-500"
            subtitle={`5m: ${metrics?.performance.cpuLoadAverage[1]?.toFixed(2) || '0.00'}`}
          />
        </div>

        {/* Live Chart */}
        <div className="mb-8">
          <LiveChart metrics={metrics} />
        </div>

        {/* Bottom Row - Detailed Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AgentCategoryBreakdown metrics={metrics} />
          <PerformanceMonitor metrics={metrics} />
        </div>

        {/* MCP Servers Section (if available) */}
        {metrics?.mcpServers && (
          <div className="mt-8 bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold mb-4 text-white">MCP Servers</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm">Total</p>
                <p className="text-2xl font-bold text-white">{metrics.mcpServers.total}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Running</p>
                <p className="text-2xl font-bold text-blue-400">{metrics.mcpServers.running}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Healthy</p>
                <p className="text-2xl font-bold text-green-400">{metrics.mcpServers.healthy}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Unhealthy</p>
                <p className="text-2xl font-bold text-yellow-400">{metrics.mcpServers.unhealthy}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-400 text-sm">Failed</p>
                <p className="text-2xl font-bold text-red-400">{metrics.mcpServers.failed}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-12 py-6">
        <div className="container mx-auto px-6 text-center text-gray-400">
          <p>A2A MCP Dashboard © 2025 | Real-time WebSocket Integration</p>
          <p className="text-xs mt-2">Updates every 5 seconds</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
