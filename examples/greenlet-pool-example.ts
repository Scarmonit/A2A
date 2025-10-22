/**
 * Example: Using Greenlet Process Pool
 * 
 * This example demonstrates how to use the greenlet process pool
 * to manage Python agents from TypeScript.
 */

import { GreenletProcessPool } from '../src/agents/greenlet-process-pool.js';
import pino from 'pino';

const logger = pino({ level: 'info', base: { example: 'greenlet-pool' } });

async function main() {
  logger.info('Starting greenlet process pool example...');
  
  // Create a pool with 2 minimum workers and 5 maximum workers
  const pool = new GreenletProcessPool({
    minWorkers: 2,
    maxWorkers: 5,
    pythonPath: 'python3',
    scriptPath: 'src/agents/python/greenlet_a2a_agent.py'
  });
  
  // Start the pool
  await pool.start();
  const startStats = pool.getStats();
  logger.info({ stats: startStats }, 'Pool started');
  
  // Get a worker from the pool
  const worker = await pool.getWorker();
  logger.info('Got worker from pool');
  
  // Set up event listeners
  worker.on('agent.pong', (data: any) => {
    logger.info('Received pong:', data);
  });
  
  worker.on('agent.echo_response', (data: any) => {
    logger.info('Received echo response:', data);
  });
  
  // Send a ping message
  logger.info('Sending ping...');
  worker.sendMessage({ type: 'agent.ping' });
  
  // Wait a bit for the response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Send an echo message
  logger.info('Sending echo...');
  worker.sendMessage({ 
    type: 'agent.echo', 
    data: { message: 'Hello from TypeScript!' } 
  });
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Release the worker back to the pool
  pool.releaseWorker(worker);
  const finalStats = pool.getStats();
  logger.info({ stats: finalStats }, 'Worker released');
  
  // Shutdown the pool
  await pool.shutdown();
  logger.info('Pool shutdown complete');
}

main().catch((error) => {
  logger.error({ error: error.message }, 'Example failed');
  process.exit(1);
});
