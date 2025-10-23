import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { EnhancedMCPManager, MCPServerConfig } from '../src/enhanced-mcp-manager.js';
import { RealtimeDashboardHandler } from '../src/realtime-dashboard-handler.js';
import { agentRegistry } from '../src/agents.js';
import { WebSocket } from 'ws';

/**
 * Comprehensive Test Suite for Enhanced A2A MCP Features
 * 
 * Tests:
 * - EnhancedMCPManager auto-recovery
 * - Health monitoring
 * - RealtimeDashboardHandler real-time metrics
 * - Integration scenarios
 */

describe('EnhancedMCPManager', () => {
  let manager: EnhancedMCPManager;

  before(() => {
    manager = new EnhancedMCPManager();
  });

  after(async () => {
    await manager.shutdown();
  });

  it('should register and start a server', async () => {
    const config: MCPServerConfig = {
      id: 'test-server-1',
      type: 'test',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'], // Keep alive
      healthCheck: async () => true,
    };

    manager.registerServer(config);
    
    const state = manager.getServerState('test-server-1');
    assert.ok(state, 'Server should be registered');
    assert.equal(state.status, 'stopped', 'Initial status should be stopped');

    await manager.startServer('test-server-1');
    
    const runningState = manager.getServerState('test-server-1');
    assert.equal(runningState?.status, 'running', 'Server should be running');
  });

  it('should perform health checks', async () => {
    let healthCheckCalled = false;

    const config: MCPServerConfig = {
      id: 'test-server-health',
      type: 'test',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
      healthCheck: async () => {
        healthCheckCalled = true;
        return true;
      },
    };

    manager.registerServer(config);
    await manager.startServer('test-server-health');

    // Start health monitoring with short interval for testing
    manager.startHealthMonitoring(1000);

    // Wait for health check
    await new Promise((resolve) => setTimeout(resolve, 1500));

    assert.ok(healthCheckCalled, 'Health check should have been called');

    manager.stopHealthMonitoring();
    await manager.stopServer('test-server-health');
  });

  it('should report health status', async () => {
    const status = manager.getHealthStatus();
    
    assert.ok(typeof status.total === 'number', 'Total should be a number');
    assert.ok(typeof status.running === 'number', 'Running should be a number');
    assert.ok(typeof status.healthy === 'number', 'Healthy should be a number');
    assert.ok(typeof status.unhealthy === 'number', 'Unhealthy should be a number');
    assert.ok(typeof status.failed === 'number', 'Failed should be a number');
  });

  it('should emit events on server lifecycle', async () => {
    const events: string[] = [];

    manager.on('server:registered', () => events.push('registered'));
    manager.on('server:starting', () => events.push('starting'));
    manager.on('server:started', () => events.push('started'));

    const config: MCPServerConfig = {
      id: 'test-server-events',
      type: 'test',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
    };

    manager.registerServer(config);
    await manager.startServer('test-server-events');

    assert.ok(events.includes('registered'), 'Should emit registered event');
    assert.ok(events.includes('starting'), 'Should emit starting event');
    assert.ok(events.includes('started'), 'Should emit started event');

    await manager.stopServer('test-server-events');
  });

  it('should handle auto-recovery on crash', async () => {
    const events: Array<{ type: string; data: any }> = [];

    manager.on('server:stopped', (data) => events.push({ type: 'stopped', data }));
    manager.on('server:restarting', (data) => events.push({ type: 'restarting', data }));
    manager.on('server:recovered', (data) => events.push({ type: 'recovered', data }));

    const config: MCPServerConfig = {
      id: 'test-server-crash',
      type: 'test',
      command: 'node',
      args: ['-e', 'setTimeout(() => process.exit(1), 500)'], // Exit after 500ms
      autoRestart: true,
      maxRestarts: 2,
    };

    manager.registerServer(config);
    await manager.startServer('test-server-crash');

    // Wait for crash and recovery attempts
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const stoppedEvents = events.filter((e) => e.type === 'stopped');
    const restartingEvents = events.filter((e) => e.type === 'restarting');

    assert.ok(stoppedEvents.length > 0, 'Should have stopped events');
    assert.ok(restartingEvents.length > 0, 'Should have restarting events');
  });
});

describe('RealtimeDashboardHandler', () => {
  let dashboard: RealtimeDashboardHandler;
  const testPort = 9999;

  before(() => {
    dashboard = new RealtimeDashboardHandler({ port: testPort });
  });

  after(async () => {
    await dashboard.shutdown();
  });

  it('should start WebSocket server', () => {
    assert.ok(dashboard, 'Dashboard should be initialized');
  });

  it('should collect metrics', () => {
    const metrics = dashboard.collectMetrics();

    assert.ok(metrics.timestamp, 'Should have timestamp');
    assert.ok(metrics.agents, 'Should have agents metrics');
    assert.ok(metrics.performance, 'Should have performance metrics');
    assert.ok(metrics.connections, 'Should have connections metrics');

    assert.ok(typeof metrics.agents.total === 'number', 'Agents total should be a number');
    assert.ok(typeof metrics.performance.memoryUsageMB === 'number', 'Memory usage should be a number');
  });

  it('should broadcast metrics to connected clients', async () => {
    let metricsReceived = false;
    let receivedData: any;

    // Connect a test client
    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);

    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        dashboard.broadcastMetrics();
        resolve();
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'metrics:update') {
          metricsReceived = true;
          receivedData = message.data;
        }
      });

      client.on('error', reject);

      setTimeout(() => reject(new Error('Connection timeout')), 5000);
    });

    // Wait for broadcast
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(metricsReceived, 'Client should receive metrics');
    assert.ok(receivedData, 'Should have received data');
    assert.ok(receivedData.agents, 'Data should include agents metrics');

    client.close();
  });

  it('should handle client subscriptions', async () => {
    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);

    const response = await new Promise<any>((resolve, reject) => {
      client.on('open', () => {
        client.send(JSON.stringify({ type: 'subscribe' }));
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'subscribed') {
          resolve(message);
        }
      });

      client.on('error', reject);
      setTimeout(() => reject(new Error('Subscription timeout')), 5000);
    });

    assert.ok(response, 'Should receive subscription confirmation');
    assert.equal(response.type, 'subscribed', 'Response type should be subscribed');

    client.close();
  });

  it('should track connected clients', async () => {
    const initialCount = dashboard.getClientCount();

    const client1 = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise((resolve) => client1.on('open', resolve));

    const client2 = new WebSocket(`ws://127.0.0.1:${testPort}`);
    await new Promise((resolve) => client2.on('open', resolve));

    // Wait for connections to register
    await new Promise((resolve) => setTimeout(resolve, 100));

    const newCount = dashboard.getClientCount();
    assert.ok(newCount >= initialCount + 2, 'Should track connected clients');

    client1.close();
    client2.close();
  });

  it('should broadcast events', async () => {
    let eventReceived = false;
    let receivedEvent: any;

    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);

    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'agent:deployed') {
        eventReceived = true;
        receivedEvent = message;
      }
    });

    // Deploy a test agent
    agentRegistry.deploy({
      id: 'test-broadcast-agent',
      name: 'Test Broadcast Agent',
      version: '1.0.0',
      capabilities: [],
    });

    dashboard.notifyAgentDeployed('test-broadcast-agent');

    // Wait for broadcast
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(eventReceived, 'Should receive agent deployed event');
    assert.equal(receivedEvent.type, 'agent:deployed', 'Event type should match');

    client.close();
    agentRegistry.remove('test-broadcast-agent');
  });

  it('should start and stop metrics broadcast', async () => {
    let metricsCount = 0;

    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);

    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'metrics:update') {
        metricsCount++;
      }
    });

    // Start broadcasting every 500ms
    dashboard.startMetricsBroadcast();

    // Wait for a few broadcasts
    await new Promise((resolve) => setTimeout(resolve, 2000));

    dashboard.stopMetricsBroadcast();

    assert.ok(metricsCount > 0, 'Should receive periodic metrics updates');

    client.close();
  });
});

describe('Integration Tests', () => {
  let manager: EnhancedMCPManager;
  let dashboard: RealtimeDashboardHandler;
  const testPort = 9998;

  before(() => {
    manager = new EnhancedMCPManager();
    dashboard = new RealtimeDashboardHandler({ 
      port: testPort,
      mcpManager: manager 
    });
  });

  after(async () => {
    await dashboard.shutdown();
    await manager.shutdown();
  });

  it('should integrate MCP manager with dashboard', () => {
    const metrics = dashboard.collectMetrics();
    
    assert.ok(metrics.mcpServers, 'Should include MCP server metrics');
    assert.ok(typeof metrics.mcpServers.total === 'number', 'Should have total count');
  });

  it('should show MCP server health in dashboard metrics', async () => {
    const config: MCPServerConfig = {
      id: 'test-integration-server',
      type: 'test',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
      healthCheck: async () => true,
    };

    manager.registerServer(config);
    await manager.startServer('test-integration-server');

    const metrics = dashboard.collectMetrics();
    
    assert.ok(metrics.mcpServers, 'Should have MCP server metrics');
    assert.ok(metrics.mcpServers.running > 0, 'Should show running servers');

    await manager.stopServer('test-integration-server');
  });

  it('should broadcast server status changes', async () => {
    let statusChangeReceived = false;

    const client = new WebSocket(`ws://127.0.0.1:${testPort}`);

    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });

    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === 'server:status') {
        statusChangeReceived = true;
      }
    });

    dashboard.notifyServerStatus('test-server', 'running');

    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(statusChangeReceived, 'Should broadcast server status changes');

    client.close();
  });
});

describe('Agent Registry Integration', () => {
  it('should register MCP servers as agents', async () => {
    const manager = new EnhancedMCPManager();

    const config: MCPServerConfig = {
      id: 'test-registry-server',
      type: 'test',
      command: 'node',
      args: ['-e', 'setInterval(() => {}, 1000)'],
    };

    manager.registerServer(config);
    await manager.startServer('test-registry-server');

    // Wait for registration
    await new Promise((resolve) => setTimeout(resolve, 500));

    const agent = agentRegistry.get('test-registry-server');
    assert.ok(agent, 'MCP server should be registered as agent');
    assert.ok(agent.tags?.includes('mcp'), 'Agent should have mcp tag');

    await manager.stopServer('test-registry-server');
    await manager.shutdown();
  });
});
