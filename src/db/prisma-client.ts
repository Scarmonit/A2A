/**
 * Prisma Client Singleton
 *
 * This module provides a singleton instance of PrismaClient to avoid
 * creating multiple instances during development with hot-reloading.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

import { PrismaClient } from '@prisma/client';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'prisma-client' } });

// Global declaration for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Create PrismaClient with logging configuration
 */
function createPrismaClient(): PrismaClient {
  const logLevel = process.env.LOG_LEVEL || 'info';

  const prismaLogLevels: any[] = [];

  if (logLevel === 'debug') {
    prismaLogLevels.push('query', 'info', 'warn', 'error');
  } else if (logLevel === 'info') {
    prismaLogLevels.push('info', 'warn', 'error');
  } else {
    prismaLogLevels.push('warn', 'error');
  }

  const client = new PrismaClient({
    log: prismaLogLevels.map(level => ({
      emit: 'event',
      level: level as any,
    })),
  });

  // Log events through pino for consistency
  client.$on('query' as never, (e: any) => {
    logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Prisma query executed');
  });

  client.$on('info' as never, (e: any) => {
    logger.info({ message: e.message }, 'Prisma info');
  });

  client.$on('warn' as never, (e: any) => {
    logger.warn({ message: e.message }, 'Prisma warning');
  });

  client.$on('error' as never, (e: any) => {
    logger.error({ message: e.message }, 'Prisma error');
  });

  return client;
}

/**
 * Singleton PrismaClient instance
 *
 * In development, this prevents creating multiple instances during hot-reloading.
 * In production, ensures only one connection pool is created.
 */
export const prisma = global.__prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

/**
 * Gracefully disconnect from database
 * Call this during application shutdown
 */
export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from database');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from database');
    throw error;
  }
}

/**
 * Test database connection
 * Useful for health checks
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection test failed');
    return false;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const [
      agentCount,
      memoryCount,
      workflowCount,
      toolUsageCount,
    ] = await Promise.all([
      prisma.agent.count(),
      prisma.memory.count(),
      prisma.workflow.count(),
      prisma.toolUsage.count(),
    ]);

    return {
      agents: agentCount,
      memories: memoryCount,
      workflows: workflowCount,
      toolUsages: toolUsageCount,
    };
  } catch (error) {
    logger.error({ error }, 'Error fetching database stats');
    throw error;
  }
}

export default prisma;
