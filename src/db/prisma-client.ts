/**
 * Prisma Client Singleton
 *
 * This module provides a singleton instance of PrismaClient to avoid
 * creating multiple instances during development with hot-reloading.
 *
 * @see https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */

import pino from 'pino';
import {
  getMissingDependencyError,
  loadOptionalDependency,
  isDependencyAvailable,
} from '../utils/optional-dependencies.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'prisma-client' } });

// Global declaration for TypeScript
declare global {
  // eslint-disable-next-line no-var
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  var __prisma: PrismaClientLike | undefined;
}

interface PrismaModelDelegateLike {
  findMany(args?: any): Promise<any[]>;
  upsert(args: any): Promise<any>;
  delete(args: any): Promise<any>;
  count(args?: any): Promise<number>;
}

interface PrismaClientLike {
  $disconnect(): Promise<void>;
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: any[]): Promise<T>;
  $transaction<T = unknown>(operations: any): Promise<T>;
  $on(event: string, handler: (...args: any[]) => void): void;
  agent: PrismaModelDelegateLike;
  memory: PrismaModelDelegateLike;
  workflow: PrismaModelDelegateLike;
  toolUsage: PrismaModelDelegateLike;
}

type PrismaClientConstructor = new (options?: any) => PrismaClientLike;

const prismaModule = loadOptionalDependency<{ PrismaClient: PrismaClientConstructor }>('@prisma/client');
const PrismaClient = prismaModule?.PrismaClient ?? null;
export const prismaAvailable = isDependencyAvailable('@prisma/client') && PrismaClient !== null;

function createUnavailableModel(modelName: string): PrismaModelDelegateLike {
  const createError = () =>
    getMissingDependencyError(
      '@prisma/client',
      `Database model "${modelName}" requires the "@prisma/client" package. Install it and run \`npx prisma generate\`.`
    );

  return {
    async findMany() {
      throw createError();
    },
    async upsert() {
      throw createError();
    },
    async delete() {
      throw createError();
    },
    async count() {
      throw createError();
    },
  };
}

function createUnavailableClient(): PrismaClientLike {
  const createError = () =>
    getMissingDependencyError(
      '@prisma/client',
      'Database operations require the "@prisma/client" package. Install it with `npm install @prisma/client`.'
    );

  logger.warn(
    'Prisma Client is not available. Database features will throw informative errors until the dependency is installed.'
  );

  return {
    async $disconnect() {
      throw createError();
    },
    async $queryRaw() {
      throw createError();
    },
    async $transaction() {
      throw createError();
    },
    $on() {
      logger.warn('Prisma Client event listeners are unavailable because @prisma/client is not installed.');
    },
    agent: createUnavailableModel('agent'),
    memory: createUnavailableModel('memory'),
    workflow: createUnavailableModel('workflow'),
    toolUsage: createUnavailableModel('toolUsage'),
  };
}

/**
 * Create PrismaClient with logging configuration
 */
function createPrismaClient(): PrismaClientLike {
  if (!PrismaClient) {
    return createUnavailableClient();
  }

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
  if (!prismaAvailable) {
    logger.warn('Prisma Client is not available. Skipping database disconnect.');
    return;
  }

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
  if (!prismaAvailable) {
    logger.warn('Prisma Client is not available. Skipping database connection test.');
    return false;
  }

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
  if (!prismaAvailable) {
    throw getMissingDependencyError(
      '@prisma/client',
      'Cannot fetch database stats because Prisma Client is not installed. Install it and run `npx prisma generate`.'
    );
  }

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
