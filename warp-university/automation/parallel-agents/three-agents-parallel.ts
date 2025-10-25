/**
 * Warp University - Parallel Agent Execution Framework
 * 
 * This module implements a robust pattern for running 3 agents in parallel,
 * demonstrating advanced concurrent execution strategies optimized for
 * autonomous agent orchestration.
 * 
 * Key Concepts:
 * - Parallel execution with Promise.all for maximum throughput
 * - Error isolation to prevent cascade failures
 * - Result aggregation with typed interfaces
 * - Integration with existing A2A agent infrastructure
 */

import { Agent } from '../../src/agents';
import { ParallelExecutionConfig } from './parallel-execution-config.json';
import { AgentOrchestrator } from './agent-orchestration';

/**
 * Result interface for individual agent execution
 */
interface AgentResult {
  agentId: string;
  success: boolean;
  data?: any;
  error?: Error;
  executionTime: number;
  timestamp: Date;
}

/**
 * Aggregated results from parallel execution
 */
interface ParallelExecutionResult {
  totalAgents: number;
  successCount: number;
  failureCount: number;
  results: AgentResult[];
  totalExecutionTime: number;
  startTime: Date;
  endTime: Date;
}

/**
 * Configuration for three-agent parallel execution
 */
interface ThreeAgentConfig {
  agent1: AgentConfig;
  agent2: AgentConfig;
  agent3: AgentConfig;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

interface AgentConfig {
  id: string;
  type: string;
  params: Record<string, any>;
  priority?: number;
}

interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  exponentialBackoff?: boolean;
}

/**
 * ThreeAgentsParallel: Core class for executing three agents concurrently
 * 
 * Warp University Pattern:
 * This implementation showcases the "fan-out, fan-in" pattern where:
 * 1. Three agents are dispatched simultaneously (fan-out)
 * 2. Results are collected and aggregated (fan-in)
 * 3. Error handling ensures one agent's failure doesn't block others
 */
export class ThreeAgentsParallel {
  private orchestrator: AgentOrchestrator;
  private config: ThreeAgentConfig;

  constructor(config: ThreeAgentConfig) {
    this.config = config;
    this.orchestrator = new AgentOrchestrator();
  }

  /**
   * Execute three agents in parallel with comprehensive error handling
   * 
   * Pattern: Promise.all with individual error boundaries
   * Benefits:
   * - Maximum parallelism (all agents start simultaneously)
   * - No blocking between agents
   * - Individual error tracking
   * - Aggregated result collection
   */
  async executeParallel(): Promise<ParallelExecutionResult> {
    const startTime = new Date();
    
    console.log('[Warp University] Starting parallel execution of 3 agents');
    console.log(`[Config] Agent 1: ${this.config.agent1.type}`);
    console.log(`[Config] Agent 2: ${this.config.agent2.type}`);
    console.log(`[Config] Agent 3: ${this.config.agent3.type}`);

    // Create execution promises with error boundaries
    const agent1Promise = this.executeAgentWithErrorBoundary(
      this.config.agent1,
      'agent-1'
    );
    const agent2Promise = this.executeAgentWithErrorBoundary(
      this.config.agent2,
      'agent-2'
    );
    const agent3Promise = this.executeAgentWithErrorBoundary(
      this.config.agent3,
      'agent-3'
    );

    // Execute all agents in parallel
    // Promise.all ensures we wait for all to complete
    const results = await Promise.all([
      agent1Promise,
      agent2Promise,
      agent3Promise,
    ]);

    const endTime = new Date();
    const totalExecutionTime = endTime.getTime() - startTime.getTime();

    // Aggregate results
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    const aggregatedResult: ParallelExecutionResult = {
      totalAgents: 3,
      successCount,
      failureCount,
      results,
      totalExecutionTime,
      startTime,
      endTime,
    };

    console.log('[Warp University] Parallel execution completed');
    console.log(`[Results] Success: ${successCount}, Failures: ${failureCount}`);
    console.log(`[Performance] Total time: ${totalExecutionTime}ms`);

    return aggregatedResult;
  }

  /**
   * Execute a single agent with comprehensive error handling
   * 
   * Error Boundary Pattern:
   * - Catches all errors from agent execution
   * - Returns structured result regardless of success/failure
   * - Prevents error propagation to parallel execution context
   */
  private async executeAgentWithErrorBoundary(
    agentConfig: AgentConfig,
    agentId: string
  ): Promise<AgentResult> {
    const startTime = performance.now();
    
    try {
      console.log(`[${agentId}] Starting execution: ${agentConfig.type}`);
      
      // Execute agent through orchestrator
      const data = await this.orchestrator.executeAgent(
        agentConfig.type,
        agentConfig.params
      );
      
      const executionTime = performance.now() - startTime;
      
      console.log(`[${agentId}] Completed successfully in ${executionTime.toFixed(2)}ms`);
      
      return {
        agentId,
        success: true,
        data,
        executionTime,
        timestamp: new Date(),
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      
      console.error(`[${agentId}] Failed after ${executionTime.toFixed(2)}ms:`, error);
      
      return {
        agentId,
        success: false,
        error: error as Error,
        executionTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Execute with retry logic for failed agents
   * 
   * Advanced Pattern: Selective retry of failed agents
   * - First attempt: All agents in parallel
   * - Retry phase: Only failed agents (optimized resource usage)
   */
  async executeWithRetry(): Promise<ParallelExecutionResult> {
    let result = await this.executeParallel();
    
    const retryPolicy = this.config.retryPolicy || {
      maxRetries: 2,
      backoffMs: 1000,
      exponentialBackoff: true,
    };

    let retryCount = 0;
    
    while (result.failureCount > 0 && retryCount < retryPolicy.maxRetries) {
      retryCount++;
      
      console.log(`[Warp University] Retry attempt ${retryCount}/${retryPolicy.maxRetries}`);
      console.log(`[Retry] ${result.failureCount} agents failed, retrying...`);
      
      // Calculate backoff delay
      const delay = retryPolicy.exponentialBackoff
        ? retryPolicy.backoffMs * Math.pow(2, retryCount - 1)
        : retryPolicy.backoffMs;
      
      await this.sleep(delay);
      
      // Retry only failed agents
      const failedResults = result.results.filter(r => !r.success);
      result = await this.retryFailedAgents(failedResults);
    }

    return result;
  }

  /**
   * Retry execution for specific failed agents
   */
  private async retryFailedAgents(
    failedResults: AgentResult[]
  ): Promise<ParallelExecutionResult> {
    const startTime = new Date();
    const retryPromises: Promise<AgentResult>[] = [];

    for (const failedResult of failedResults) {
      const agentConfig = this.getAgentConfigById(failedResult.agentId);
      if (agentConfig) {
        retryPromises.push(
          this.executeAgentWithErrorBoundary(agentConfig, failedResult.agentId)
        );
      }
    }

    const retryResults = await Promise.all(retryPromises);
    const endTime = new Date();

    return {
      totalAgents: retryResults.length,
      successCount: retryResults.filter(r => r.success).length,
      failureCount: retryResults.filter(r => !r.success).length,
      results: retryResults,
      totalExecutionTime: endTime.getTime() - startTime.getTime(),
      startTime,
      endTime,
    };
  }

  /**
   * Helper: Get agent configuration by ID
   */
  private getAgentConfigById(agentId: string): AgentConfig | null {
    switch (agentId) {
      case 'agent-1':
        return this.config.agent1;
      case 'agent-2':
        return this.config.agent2;
      case 'agent-3':
        return this.config.agent3;
      default:
        return null;
    }
  }

  /**
   * Helper: Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function for creating parallel agent executors
 */
export function createThreeAgentExecutor(
  config: ThreeAgentConfig
): ThreeAgentsParallel {
  return new ThreeAgentsParallel(config);
}

/**
 * Example usage demonstrating Warp University patterns
 */
export async function exampleUsage() {
  const config: ThreeAgentConfig = {
    agent1: {
      id: 'data-processor',
      type: 'DataProcessingAgent',
      params: { source: 'api', format: 'json' },
      priority: 1,
    },
    agent2: {
      id: 'analyzer',
      type: 'AnalysisAgent',
      params: { algorithm: 'ml-based', depth: 'deep' },
      priority: 2,
    },
    agent3: {
      id: 'reporter',
      type: 'ReportGeneratorAgent',
      params: { format: 'pdf', template: 'executive-summary' },
      priority: 3,
    },
    timeout: 30000,
    retryPolicy: {
      maxRetries: 2,
      backoffMs: 1000,
      exponentialBackoff: true,
    },
  };

  const executor = createThreeAgentExecutor(config);
  
  // Execute with automatic retry on failures
  const result = await executor.executeWithRetry();
  
  console.log('Execution Summary:', result);
  
  return result;
}
