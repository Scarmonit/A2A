import React from 'react';
import { DashboardMetrics } from '../hooks/useRealtimeDashboard';

interface PerformanceMonitorProps {
  metrics: DashboardMetrics | null;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-white">⚡ Performance Monitor</h3>
        <p className="text-gray-400">No performance data available</p>
      </div>
    );
  }

  const { performance } = metrics;
  
  // Warning thresholds
  const memoryWarning = performance.memoryPercentage > 80;
  const memoryDanger = performance.memoryPercentage > 90;
  const cpuHigh = performance.cpuLoadAverage[0] > 2;

  const getMemoryColor = () => {
    if (memoryDanger) return 'text-red-500';
    if (memoryWarning) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getCpuColor = () => {
    return cpuHigh ? 'text-yellow-500' : 'text-green-500';
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-white">⚡ Performance Monitor</h3>
      
      <div className="space-y-4">
        {/* Memory Usage */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">Memory Usage</span>
            <span className={`font-semibold ${getMemoryColor()}`}>
              {performance.memoryUsageMB} MB ({performance.memoryPercentage}%)
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full transition-all ${
                memoryDanger ? 'bg-red-500' : memoryWarning ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(performance.memoryPercentage, 100)}%` }}
            />
          </div>
          {memoryDanger && (
            <p className="text-red-500 text-xs mt-1">⚠️ Memory usage critical!</p>
          )}
          {memoryWarning && !memoryDanger && (
            <p className="text-yellow-500 text-xs mt-1">⚠️ Memory usage high</p>
          )}
        </div>

        {/* CPU Load Average */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400">CPU Load Average</span>
            <div className="flex gap-2">
              <span className={`font-semibold ${getCpuColor()}`}>
                1m: {performance.cpuLoadAverage[0].toFixed(2)}
              </span>
              <span className="text-gray-500">
                5m: {performance.cpuLoadAverage[1].toFixed(2)}
              </span>
              <span className="text-gray-500">
                15m: {performance.cpuLoadAverage[2].toFixed(2)}
              </span>
            </div>
          </div>
          {cpuHigh && (
            <p className="text-yellow-500 text-xs">⚠️ CPU load is high</p>
          )}
        </div>

        {/* System Uptime */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">System Uptime</span>
          <span className="text-white font-semibold">
            {formatUptime(performance.uptime)}
          </span>
        </div>

        {/* Connection Stats */}
        <div className="pt-4 border-t border-gray-700">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Connections</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">WebSocket Clients</span>
              <span className="text-blue-400 font-semibold">
                {metrics.connections.websocketClients}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Active Streams</span>
              <span className="text-purple-400 font-semibold">
                {metrics.connections.activeStreams}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
