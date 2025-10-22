/**
 * Example: Advanced Greenlet Features
 * 
 * This example demonstrates the enhanced features:
 * - Message queuing
 * - Retry logic
 * - Metrics collection
 * - Load balancing strategies
 * - Worker recycling
 */

import { GreenletProcessPool } from '../src/agents/greenlet-process-pool.js';
import { GreenletBridgeAdapter } from '../src/agents/greenlet-bridge-adapter.js';
import pino from 'pino';

const logger = pino({ level: 'info', base: { example: 'advanced-features' } });

async function demonstrateMetrics() {
  logger.info('=== Demonstrating Metrics Collection ===');
  
  const adapter = new GreenletBridgeAdapter({
    pythonPath: 'python3',
    scriptPath: 'src/agents/python/greenlet_a2a_agent.py'
  });
  
  await adapter.connect();
  
  // Send multiple messages
  for (let i = 0; i < 5; i++) {
    adapter.sendMessage({ type: 'agent.ping' });
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Get metrics
  const metrics = adapter.getMetrics();
  logger.info({ metrics }, 'Adapter metrics');
  
  await adapter.disconnect();
}

async function demonstrateRetryLogic() {
  logger.info('=== Demonstrating Retry Logic ===');
  
  const adapter = new GreenletBridgeAdapter({
    pythonPath: 'python3',
    scriptPath: 'src/agents/python/greenlet_a2a_agent.py',
    maxRetries: 3,
    retryDelay: 500
  });
  
  await adapter.connect();
  
  try {
    // Send message with response expectation
    const response = await adapter.sendMessageWithResponse(
      { type: 'agent.ping' },
      'agent.pong',
      2  // max retries
    );
    logger.info({ response }, 'Got response with retry logic');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed after retries');
  }
  
  await adapter.disconnect();
}

async function demonstrateLoadBalancing() {
  logger.info('=== Demonstrating Load Balancing Strategies ===');
  
  // Test least-busy strategy
  const pool = new GreenletProcessPool({
    minWorkers: 3,
    maxWorkers: 5,
    loadBalancingStrategy: 'least-busy',
    maxMessagesPerWorker: 10
  });
  
  await pool.start();
  logger.info({ stats: pool.getStats() }, 'Pool started with least-busy strategy');
  
  // Simulate workload
  for (let i = 0; i < 10; i++) {
    const worker = await pool.getWorker();
    worker.sendMessage({ type: 'agent.ping' });
    
    // Simulate some work time
    await new Promise(resolve => setTimeout(resolve, 50));
    
    pool.releaseWorker(worker);
  }
  
  // Get detailed stats
  const detailedStats = pool.getDetailedStats();
  logger.info({ detailedStats }, 'Detailed pool statistics');
  
  await pool.shutdown();
}

async function demonstrateWorkerRecycling() {
  logger.info('=== Demonstrating Worker Recycling ===');
  
  const pool = new GreenletProcessPool({
    minWorkers: 2,
    maxWorkers: 4,
    maxMessagesPerWorker: 5,  // Recycle after 5 messages
    workerRecycleInterval: 10000  // Also recycle after 10 seconds
  });
  
  await pool.start();
  
  // Process many messages to trigger recycling
  for (let i = 0; i < 15; i++) {
    try {
      const worker = await pool.getWorker();
      worker.sendMessage({ type: 'agent.ping' });
      pool.releaseWorker(worker);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Worker allocation failed');
    }
  }
  
  const stats = pool.getStats();
  logger.info({ stats }, 'Pool stats after recycling');
  
  await pool.shutdown();
}

async function demonstrateMessageQueue() {
  logger.info('=== Demonstrating Message Queuing ===');
  
  const adapter = new GreenletBridgeAdapter({
    pythonPath: 'python3',
    scriptPath: 'src/agents/python/greenlet_a2a_agent.py',
    messageQueueSize: 50
  });
  
  await adapter.connect();
  
  // Queue multiple messages
  for (let i = 0; i < 10; i++) {
    adapter.queueMessage({ type: 'agent.ping', sequence: i });
  }
  
  logger.info('Messages queued, processing...');
  
  // Process the queue
  await adapter.processQueue();
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const metrics = adapter.getMetrics();
  logger.info({ metrics }, 'Metrics after queue processing');
  
  await adapter.disconnect();
}

async function main() {
  try {
    await demonstrateMetrics();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demonstrateRetryLogic();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demonstrateMessageQueue();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demonstrateLoadBalancing();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await demonstrateWorkerRecycling();
    
    logger.info('=== All demonstrations complete ===');
  } catch (error) {
    logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Demo failed');
    process.exit(1);
  }
}

main();
