/**
 * Parallel Command Executor using Execa
 * Enables running multiple commands concurrently with Promise.all
 */

import type { ExecaOptions, ExecaReturnValue } from 'execa';
import { spawn } from 'child_process';
import pino from 'pino';
import { loadOptionalDependency } from './utils/optional-dependencies.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'parallel-executor' } });

type ExecaRunner = (
  file: string,
  args?: readonly string[],
  options?: ExecaOptions
) => Promise<ExecaReturnValue>;

let cachedRunner: ExecaRunner | null = null;
let runnerInitialized = false;

function createSpawnFallback(): ExecaRunner {
  logger.warn(
    'execa module not available; falling back to child_process.spawn. Install "execa" for enhanced process management.'
  );

  return (file: string, args: readonly string[] = [], options: ExecaOptions = {}) => {
    return new Promise<ExecaReturnValue>((resolve, reject) => {
      try {
        const child = spawn(file, args as string[], {
          cwd: options.cwd,
          env: options.env,
          shell: options.shell,
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', chunk => {
          stdout += chunk.toString();
        });

        child.stderr?.on('data', chunk => {
          stderr += chunk.toString();
        });

        child.on('error', error => {
          if (options.reject === false) {
            resolve({ stdout, stderr: error.message, exitCode: 1 });
          } else {
            reject(error);
          }
        });

        child.on('close', code => {
          const exitCode = typeof code === 'number' ? code : 1;
          if (exitCode !== 0 && options.reject !== false) {
            reject(Object.assign(new Error(stderr || `Command failed with exit code ${exitCode}`), { exitCode }));
            return;
          }

          resolve({ stdout, stderr, exitCode });
        });
      } catch (error) {
        if (options.reject === false) {
          resolve({ stdout: '', stderr: error instanceof Error ? error.message : String(error), exitCode: 1 });
        } else {
          reject(error);
        }
      }
    });
  };
}

function getRunner(): ExecaRunner {
  if (!runnerInitialized) {
    runnerInitialized = true;
    const execaModule = loadOptionalDependency<{ execa: ExecaRunner }>('execa');
    if (execaModule?.execa) {
      cachedRunner = execaModule.execa;
    } else {
      cachedRunner = createSpawnFallback();
    }
  }

  return cachedRunner!;
}

export interface CommandConfig {
  command: string;
  args?: string[];
  options?: {
    cwd?: string;
    env?: Record<string, string>;
    shell?: boolean;
  };
}

export interface CommandResult {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
  success: boolean;
}

/**
 * Execute multiple commands in parallel using Promise.all
 * @param commands - Array of command configurations
 * @returns Array of command results
 */
export async function executeParallel(
  commands: CommandConfig[]
): Promise<CommandResult[]> {
  const startTime = Date.now();
  const runner = getRunner();

  console.log(`🚀 Starting ${commands.length} commands in parallel...`);

  // Create promises for all commands
  const promises = commands.map(async (config, index) => {
    const cmdStart = Date.now();

    try {
      console.log(`[${index}] Executing: ${config.command} ${config.args?.join(' ') || ''}`);

      const result = await runner(config.command, config.args || [], {
        ...config.options,
        reject: false, // Don't reject on non-zero exit codes
      });

      const duration = Date.now() - cmdStart;

      return {
        command: `${config.command} ${config.args?.join(' ') || ''}`,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode || 0,
        duration,
        success: result.exitCode === 0,
      };
    } catch (error: any) {
      const duration = Date.now() - cmdStart;

      return {
        command: `${config.command} ${config.args?.join(' ') || ''}`,
        stdout: '',
        stderr: error?.message || 'Unknown error',
        exitCode: typeof error?.exitCode === 'number' ? error.exitCode : 1,
        duration,
        success: false,
      };
    }
  });

  // Wait for all commands to complete
  const results = await Promise.all(promises);

  const totalDuration = Date.now() - startTime;
  const successCount = results.filter(r => r.success).length;

  console.log(`\n✅ Completed ${successCount}/${commands.length} commands successfully in ${totalDuration}ms`);

  return results;
}

/**
 * Execute commands in parallel with a script-like interface
 * @param scripts - Object mapping script names to commands
 * @returns Object mapping script names to results
 */
export async function executeScripts(
  scripts: Record<string, string>
): Promise<Record<string, CommandResult>> {
  const scriptEntries = Object.entries(scripts);

  const commands: CommandConfig[] = scriptEntries.map(([name, script]) => ({
    command: script.split(' ')[0],
    args: script.split(' ').slice(1),
    options: { shell: true },
  }));

  const results = await executeParallel(commands);

  const namedResults: Record<string, CommandResult> = {};
  scriptEntries.forEach(([name], index) => {
    namedResults[name] = results[index];
  });

  return namedResults;
}

/**
 * Execute multiple npm scripts in parallel
 * @param scriptNames - Array of npm script names
 * @returns Array of command results
 */
export async function executeNpmScripts(
  scriptNames: string[]
): Promise<CommandResult[]> {
  const commands: CommandConfig[] = scriptNames.map(name => ({
    command: 'npm',
    args: ['run', name],
  }));

  return executeParallel(commands);
}

/**
 * Example usage - can be called from other modules
 */
export async function runParallelExample() {
  // Example 1: Run multiple shell commands in parallel
  const commands: CommandConfig[] = [
    { command: 'echo', args: ['Hello from command 1'] },
    { command: 'echo', args: ['Hello from command 2'] },
    { command: 'echo', args: ['Hello from command 3'] },
  ];

  await executeParallel(commands);

  // Example 2: Run npm scripts in parallel
  // await executeNpmScripts(['build', 'test', 'lint']);

  // Example 3: Run custom scripts in parallel
  // await executeScripts({
  //   'build': 'npm run build',
  //   'test': 'npm run test',
  //   'lint': 'npm run lint'
  // });
}
