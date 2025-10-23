import { useEffect, useState, useRef, useCallback } from 'react';

export interface DashboardMetrics {
  timestamp: number;
  agents: {
    total: number;
    enabled: number;
    disabled: number;
    categories: number;
    tags: number;
    byCategory: Record<string, number>;
    byTag: Record<string, number>;
  };
  mcpServers?: {
    total: number;
    running: number;
    healthy: number;
    unhealthy: number;
    failed: number;
  };
  performance: {
    memoryUsageMB: number;
    memoryPercentage: number;
    cpuLoadAverage: number[];
    uptime: number;
  };
  connections: {
    websocketClients: number;
    activeStreams: number;
  };
}

export interface DashboardMessage {
  type: 'metrics:update' | 'subscribed' | 'agents:list';
  timestamp: number;
  data: DashboardMetrics | any;
}

export function useRealtimeDashboard(wsUrl: string) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);

        // Subscribe to updates
        ws.send(JSON.stringify({ type: 'subscribe' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: DashboardMessage = JSON.parse(event.data);
          
          if (message.type === 'metrics:update') {
            setMetrics(message.data);
          } else if (message.type === 'subscribed') {
            console.log('Subscribed to dashboard updates');
          }
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempts(prev => prev + 1);
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Failed to connect to WebSocket server');
        setIsConnected(false);
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
      setIsConnected(false);
    }
  }, [wsUrl, reconnectAttempts]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const requestMetrics = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'request_metrics' }));
    }
  }, []);

  return { 
    metrics, 
    isConnected, 
    error,
    reconnectAttempts,
    requestMetrics
  };
}
