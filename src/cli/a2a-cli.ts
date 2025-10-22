#!/usr/bin/env node
/**
 * A2A CLI - Command-line interface for greenlet agent management
 */

import { GreenletProcessPool } from '../agents/greenlet-process-pool.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { component: 'a2a-cli' } });

interface CliArgs {
  command?: string;
  workers?: string;
  max?: string;
}

function parseArgs(): CliArgs {
  const args: CliArgs = {};
  const argv = process.argv.slice(2);
  
  args.command = argv[0];
  
  for (let i = 1; i < argv.length; i += 2) {
    const key = argv[i].replace(/^--/, '');
    const value = argv[i + 1];
    args[key as keyof CliArgs] = value;
  }
  
  return args;
}

async function start(workers: number, max: number): Promise<void> {
  const pool = new GreenletProcessPool({
    minWorkers: workers,
    maxWorkers: max
  });
  
  await pool.start();
  console.log('Process pool started:', pool.getStats());
  
  // Keep process running
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await pool.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await pool.shutdown();
    process.exit(0);
  });
}

function showUsage(): void {
  console.log(`
A2A CLI - Greenlet Agent Management

Usage:
  a2a start [options]    Start the greenlet process pool
  a2a stats              Show process pool statistics (not yet implemented)
  a2a shutdown           Shutdown the process pool (not yet implemented)
  a2a help               Show this help message

Options:
  --workers <number>     Number of initial workers (default: 2)
  --max <number>         Maximum workers (default: 10)

Examples:
  a2a start --workers 4 --max 10
  a2a stats
  `);
}

async function main(): Promise<void> {
  const args = parseArgs();
  
  switch (args.command) {
    case 'start': {
      const workers = parseInt(args.workers || '2', 10);
      const max = parseInt(args.max || '10', 10);
      await start(workers, max);
      break;
    }
    
    case 'stats':
      console.log('Stats command not yet implemented');
      break;
    
    case 'shutdown':
      console.log('Shutdown command not yet implemented');
      break;
    
    case 'help':
    case undefined:
      showUsage();
      break;
    
    default:
      console.error(`Unknown command: ${args.command}`);
      showUsage();
      process.exit(1);
  }
}

main().catch((error) => {
  logger.error({ error: error.message }, 'CLI error');
  console.error('Error:', error.message);
  process.exit(1);
});
