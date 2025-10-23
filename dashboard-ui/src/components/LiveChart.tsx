import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { DashboardMetrics } from '../hooks/useRealtimeDashboard';

interface LiveChartProps {
  metrics: DashboardMetrics | null;
}

interface ChartDataPoint {
  time: string;
  totalAgents: number;
  enabledAgents: number;
  memoryMB: number;
}

export const LiveChart: React.FC<LiveChartProps> = ({ metrics }) => {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    if (metrics) {
      const timeStr = new Date(metrics.timestamp).toLocaleTimeString();
      
      setChartData((prevData) => {
        const newData = [
          ...prevData,
          {
            time: timeStr,
            totalAgents: metrics.agents.total,
            enabledAgents: metrics.agents.enabled,
            memoryMB: metrics.performance.memoryUsageMB,
          },
        ];
        
        // Keep only last 20 data points
        return newData.slice(-20);
      });
    }
  }, [metrics]);

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-white">Live Metrics Chart</h3>
        <p className="text-gray-400">Waiting for data...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
      <h3 className="text-xl font-bold mb-4 text-white">Live Metrics Chart</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="time" 
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#9CA3AF"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1F2937', 
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend 
            wrapperStyle={{ color: '#9CA3AF' }}
          />
          <Line 
            type="monotone" 
            dataKey="totalAgents" 
            stroke="#3B82F6" 
            strokeWidth={2}
            name="Total Agents"
            dot={{ fill: '#3B82F6' }}
          />
          <Line 
            type="monotone" 
            dataKey="enabledAgents" 
            stroke="#10B981" 
            strokeWidth={2}
            name="Enabled Agents"
            dot={{ fill: '#10B981' }}
          />
          <Line 
            type="monotone" 
            dataKey="memoryMB" 
            stroke="#F59E0B" 
            strokeWidth={2}
            name="Memory (MB)"
            dot={{ fill: '#F59E0B' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
