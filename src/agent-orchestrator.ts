/**
 * Agent Orchestrator - Advanced Agent Workflow Management
 *
 * This module enables complex multi-agent workflows with:
 * - Sequential and parallel agent execution
 * - Conditional branching based on results
 * - Error handling and retry logic
 * - Result aggregation and transformation
 * - Performance tracking and optimization
 */

import { agentRegistry, AgentDescriptor } from './agents.js';
import { executeParallel } from './parallel-executor.js';
import { v4 as uuidv4 } from 'uuid';

export interface AgentTask {
  agentId: string;
  input: any;
  timeout?: number;
  retries?: number;
  onError?: 'fail' | 'continue' | 'retry';
}

export interface WorkflowStep {
  id: string;
  type: 'agent' | 'parallel' | 'conditional' | 'transform';
  tasks?: AgentTask[];
  condition?: (results: any) => boolean;
  transform?: (results: any) => any;
  next?: string | string[];
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  startStep: string;
}

export interface WorkflowResult {
  workflowId: string;
  success: boolean;
  duration: number;
  steps: StepResult[];
  finalResult?: any;
  error?: string;
}

export interface StepResult {
  stepId: string;
  success: boolean;
  duration: number;
  results: any[];
  error?: string;
}

export class AgentOrchestrator {
  private workflows = new Map<string, Workflow>();
  private executionHistory: WorkflowResult[] = [];

  /**
   * Register a new workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
  }

  /**
   * Execute a workflow with intelligent orchestration
   */
  async executeWorkflow(workflowId: string, initialInput: any = {}): Promise<WorkflowResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    const startTime = Date.now();
    const result: WorkflowResult = {
      workflowId,
      success: false,
      duration: 0,
      steps: []
    };

    try {
      let currentStep = workflow.steps.find(s => s.id === workflow.startStep);
      let context = initialInput;

      while (currentStep) {
        const stepResult = await this.executeStep(currentStep, context);
        result.steps.push(stepResult);

        if (!stepResult.success && currentStep.next) {
          break;
        }

        // Update context with step results
        context = { ...context, [currentStep.id]: stepResult.results };

        // Determine next step
        if (currentStep.type === 'conditional' && currentStep.condition) {
          const nextId = currentStep.condition(stepResult.results)
            ? (Array.isArray(currentStep.next) ? currentStep.next[0] : currentStep.next)
            : (Array.isArray(currentStep.next) ? currentStep.next[1] : undefined);
          currentStep = nextId ? workflow.steps.find(s => s.id === nextId) : undefined;
        } else if (currentStep.next) {
          const nextId = Array.isArray(currentStep.next) ? currentStep.next[0] : currentStep.next;
          currentStep = workflow.steps.find(s => s.id === nextId);
        } else {
          currentStep = undefined;
        }
      }

      result.success = result.steps.every(s => s.success);
      result.finalResult = context;

    } catch (error: any) {
      result.error = error.message;
    }

    result.duration = Date.now() - startTime;
    this.executionHistory.push(result);

    return result;
  }

  /**
   * Execute a single workflow step
   */
  private async executeStep(step: WorkflowStep, context: any): Promise<StepResult> {
    const startTime = Date.now();
    const stepResult: StepResult = {
      stepId: step.id,
      success: false,
      duration: 0,
      results: []
    };

    try {
      switch (step.type) {
        case 'agent':
          stepResult.results = await this.executeAgentTasks(step.tasks || [], context);
          stepResult.success = stepResult.results.every((r: any) => r.success);
          break;

        case 'parallel':
          stepResult.results = await this.executeParallelTasks(step.tasks || [], context);
          stepResult.success = stepResult.results.every((r: any) => r.success);
          break;

        case 'transform':
          if (step.transform) {
            stepResult.results = [step.transform(context)];
            stepResult.success = true;
          }
          break;

        case 'conditional':
          if (step.condition) {
            stepResult.results = [step.condition(context)];
            stepResult.success = true;
          }
          break;
      }
    } catch (error: any) {
      stepResult.error = error.message;
    }

    stepResult.duration = Date.now() - startTime;
    return stepResult;
  }

  /**
   * Execute agent tasks sequentially
   */
  private async executeAgentTasks(tasks: AgentTask[], context: any): Promise<any[]> {
    const results = [];

    for (const task of tasks) {
      const agent = agentRegistry.get(task.agentId);
      if (!agent) {
        results.push({ success: false, error: `Agent ${task.agentId} not found` });
        continue;
      }

      // Simulate agent execution
      try {
        const result = await this.executeAgent(agent, task.input || context, task);
        results.push({ success: true, agentId: task.agentId, result });
      } catch (error: any) {
        if (task.onError === 'continue') {
          results.push({ success: false, agentId: task.agentId, error: error.message });
        } else if (task.onError === 'retry' && task.retries && task.retries > 0) {
          // Implement retry logic
          let lastError;
          for (let i = 0; i < task.retries; i++) {
            try {
              const result = await this.executeAgent(agent, task.input || context, task);
              results.push({ success: true, agentId: task.agentId, result });
              break;
            } catch (e: any) {
              lastError = e;
            }
          }
          if (lastError) {
            results.push({ success: false, agentId: task.agentId, error: lastError.message });
          }
        } else {
          throw error;
        }
      }
    }

    return results;
  }

  /**
   * Execute agent tasks in parallel
   */
  private async executeParallelTasks(tasks: AgentTask[], context: any): Promise<any[]> {
    const promises = tasks.map(async task => {
      const agent = agentRegistry.get(task.agentId);
      if (!agent) {
        return { success: false, error: `Agent ${task.agentId} not found` };
      }

      try {
        const result = await this.executeAgent(agent, task.input || context, task);
        return { success: true, agentId: task.agentId, result };
      } catch (error: any) {
        return { success: false, agentId: task.agentId, error: error.message };
      }
    });

    return Promise.all(promises);
  }

  /**
   * Execute a single agent (mock implementation)
   */
  private async executeAgent(agent: AgentDescriptor, input: any, task: AgentTask): Promise<any> {
    // Simulate agent execution time
    await new Promise(resolve => setTimeout(resolve, 50));

    return {
      agentName: agent.name,
      agentId: agent.id,
      input,
      output: `Processed by ${agent.name}`,
      timestamp: Date.now()
    };
  }

  /**
   * Get execution statistics
   */
  getExecutionStats(): any {
    const total = this.executionHistory.length;
    const successful = this.executionHistory.filter(r => r.success).length;
    const failed = total - successful;
    const avgDuration = this.executionHistory.reduce((sum, r) => sum + r.duration, 0) / total || 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(2) + '%' : '0%',
      avgDuration: Math.round(avgDuration) + 'ms'
    };
  }

  /**
   * Get workflow performance metrics
   */
  getWorkflowMetrics(workflowId: string): any {
    const executions = this.executionHistory.filter(r => r.workflowId === workflowId);
    if (executions.length === 0) {
      return { executions: 0 };
    }

    const successful = executions.filter(r => r.success).length;
    const avgDuration = executions.reduce((sum, r) => sum + r.duration, 0) / executions.length;
    const minDuration = Math.min(...executions.map(r => r.duration));
    const maxDuration = Math.max(...executions.map(r => r.duration));

    return {
      executions: executions.length,
      successful,
      failed: executions.length - successful,
      successRate: (successful / executions.length * 100).toFixed(2) + '%',
      avgDuration: Math.round(avgDuration) + 'ms',
      minDuration: minDuration + 'ms',
      maxDuration: maxDuration + 'ms'
    };
  }
}

// Global orchestrator instance
export const agentOrchestrator = new AgentOrchestrator();

// Example workflow templates
export const createAnalysisWorkflow = (): Workflow => ({
  id: 'code-analysis-workflow',
  name: 'Code Analysis and Review',
  description: 'Comprehensive code analysis using multiple agents',
  startStep: 'analyze',
  steps: [
    {
      id: 'analyze',
      type: 'parallel',
      tasks: [
        { agentId: 'security-scanner', input: { target: 'src' } },
        { agentId: 'code-reviewer', input: { target: 'src' } },
        { agentId: 'data-analyst', input: { target: 'package.json' } }
      ],
      next: 'aggregate'
    },
    {
      id: 'aggregate',
      type: 'transform',
      transform: (results: any) => ({
        security: results.analyze[0],
        codeQuality: results.analyze[1],
        dependencies: results.analyze[2],
        timestamp: Date.now()
      }),
      next: 'report'
    },
    {
      id: 'report',
      type: 'agent',
      tasks: [
        { agentId: 'content-writer', input: {} }
      ]
    }
  ]
});

export const createDeploymentWorkflow = (): Workflow => ({
  id: 'deployment-workflow',
  name: 'Automated Deployment Pipeline',
  description: 'Test, build, and deploy with validation',
  startStep: 'test',
  steps: [
    {
      id: 'test',
      type: 'agent',
      tasks: [
        { agentId: 'api-tester', input: {}, retries: 2, onError: 'retry' }
      ],
      next: 'build'
    },
    {
      id: 'build',
      type: 'agent',
      tasks: [
        { agentId: 'deploy-manager', input: { action: 'build' } }
      ],
      next: 'validate'
    },
    {
      id: 'validate',
      type: 'conditional',
      condition: (results: any) => results.build?.[0]?.success === true,
      next: ['deploy', 'rollback']
    },
    {
      id: 'deploy',
      type: 'agent',
      tasks: [
        { agentId: 'deploy-manager', input: { action: 'deploy' } }
      ]
    },
    {
      id: 'rollback',
      type: 'agent',
      tasks: [
        { agentId: 'deploy-manager', input: { action: 'rollback' } }
      ]
    }
  ]
});
