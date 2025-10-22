/**
 * Parallel Command Executor using Execa
 * Enables running multiple commands concurrently with Promise.all
 */

import { execa } from 'execa';

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
  
  console.log(`🚀 Starting ${commands.length} commands in parallel...`);
  
  // Create promises for all commands
  const promises = commands.map(async (config, index) => {
    const cmdStart = Date.now();
    
    try {
      console.log(`[${index}] Executing: ${config.command} ${config.args?.join(' ') || ''}`);
      
      const result = await execa(config.command, config.args || [], {
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
        stderr: error.message || 'Unknown error',
        exitCode: error.exitCode || 1,
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
