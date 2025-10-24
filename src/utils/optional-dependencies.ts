import { createRequire } from 'module';
import pino from 'pino';

const require = createRequire(import.meta.url);

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'optional-dependencies' },
});

type DependencyRecord = {
  module: unknown | null;
  error: Error | null;
};

const dependencyCache = new Map<string, DependencyRecord>();

function toError(error: unknown, moduleName: string): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(`Unknown error when loading module "${moduleName}": ${String(error)}`);
}

export function loadOptionalDependency<T = unknown>(moduleName: string): T | null {
  const cached = dependencyCache.get(moduleName);
  if (cached) {
    return (cached.module as T) ?? null;
  }

  try {
    const loaded = require(moduleName) as T;
    dependencyCache.set(moduleName, { module: loaded, error: null });
    logger.debug({ moduleName }, 'Loaded optional dependency');
    return loaded;
  } catch (error) {
    const err = toError(error, moduleName);
    dependencyCache.set(moduleName, { module: null, error: err });
    logger.warn({ moduleName, error: err.message }, 'Optional dependency is not available');
    return null;
  }
}

export function isDependencyAvailable(moduleName: string): boolean {
  const cached = dependencyCache.get(moduleName);
  if (cached) {
    return cached.module != null;
  }

  // Trigger a load attempt so that subsequent calls are cached
  const loaded = loadOptionalDependency(moduleName);
  return loaded != null;
}

export function getMissingDependencyError(moduleName: string, message?: string): Error {
  const cached = dependencyCache.get(moduleName);
  const originalError = cached?.error ?? null;
  const baseMessage = message ?? `Optional dependency "${moduleName}" is required for this feature.`;

  if (originalError) {
    const error = new Error(`${baseMessage}\nOriginal error: ${originalError.message}`);
    (error as Error & { cause?: Error }).cause = originalError;
    return error;
  }

  return new Error(baseMessage);
}
