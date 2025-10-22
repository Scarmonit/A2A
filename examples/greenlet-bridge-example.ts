/**
 * Example: Using Greenlet Bridge Adapter
 * 
 * This example shows how to directly connect to a single
 * Python greenlet agent using the bridge adapter.
 */

import { GreenletBridgeAdapter } from '../src/agents/greenlet-bridge-adapter.js';
import pino from 'pino';

const logger = pino({ level: 'info', base: { example: 'greenlet-bridge' } });

async function main() {
  logger.info('Starting greenlet bridge adapter example...');
  
  // Create a bridge adapter
  const adapter = new GreenletBridgeAdapter({
    pythonPath: 'python3',
    scriptPath: 'src/agents/python/greenlet_a2a_agent.py',
    agentId: 'example-agent',
    timeout: 10000
  });
  
  // Set up event listeners before connecting
  adapter.on('agent.register', (data: any) => {
    logger.info('Agent registered:', data);
  });
  
  adapter.on('agent.pong', (data: any) => {
    logger.info('Received pong:', data);
  });
  
  adapter.on('agent.echo_response', (data: any) => {
    logger.info('Received echo response:', data);
  });
  
  adapter.on('error', (error: Error) => {
    logger.error({ error: error.message }, 'Agent error');
  });
  
  adapter.on('exit', (code: number | null, signal: string | null) => {
    logger.info({ code, signal }, 'Agent exited');
  });
  
  // Connect to the agent
  logger.info('Connecting to agent...');
  await adapter.connect();
  logger.info('Connected! Agent is ready.');
  
  // Send some messages
  logger.info('Sending ping...');
  adapter.sendMessage({ type: 'agent.ping' });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  logger.info('Sending echo...');
  adapter.sendMessage({ 
    type: 'agent.echo', 
    data: { 
      message: 'Hello from the bridge!',
      timestamp: new Date().toISOString()
    } 
  });
  
  // Wait for responses
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Disconnect
  logger.info('Disconnecting from agent...');
  await adapter.disconnect();
  logger.info('Disconnected successfully');
}

main().catch((error) => {
  logger.error({ error: error.message }, 'Example failed');
  process.exit(1);
});
