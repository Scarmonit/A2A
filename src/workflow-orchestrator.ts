import { v4 as uuidv4 } from 'uuid';
import pino from 'pino';
import { agentRegistry } from './agents.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type WorkflowStep = {
  id: string;
  name: string;
  agentId: string;
  capability: string;
  input: any;
  dependencies?: string[]; // Step IDs this step depends on
  conditions?: {
    runIf?: string; // JavaScript expression to evaluate
    skipIf?: string; // JavaScript expression to evaluate
  };
  retries?: {
    maxAttempts: number;
    backoffMs: number;
  };
  timeout?: number; // Max execution time in ms
  status: WorkflowStepStatus;
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  attempt: number;
};

export type Workflow = {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  createdBy?: string;
  metadata?: Record<string, any>;
  globalContext?: Record<string, any>; // Shared data across steps
};

export type WorkflowTemplate = {
  name: string;
  description?: string;
  steps: Omit<WorkflowStep, 'id' | 'status' | 'attempt'>[];
  defaultContext?: Record<string, any>;
};

export class WorkflowOrchestrator {
  private workflows = new Map<string, Workflow>();
  private runningWorkflows = new Set<string>();
  private templates = new Map<string, WorkflowTemplate>();
  
  constructor() {
    this.loadDefaultTemplates();
  }
  
  // Create workflow from template
  createFromTemplate(templateName: string, params: {
    name?: string;
    context?: Record<string, any>;
    stepOverrides?: Record<string, Partial<WorkflowStep>>;
  }): Workflow {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Workflow template '${templateName}' not found`);
    }
    
    const workflowId = uuidv4();
    const steps: WorkflowStep[] = template.steps.map(stepTemplate => {
      const stepId = uuidv4();
      const overrides = params.stepOverrides?.[stepTemplate.name] || {};
      
      return {
        ...stepTemplate,
        ...overrides,
        id: stepId,
        status: 'pending' as WorkflowStepStatus,
        attempt: 0
      };
    });
    
    const workflow: Workflow = {
      id: workflowId,
      name: params.name || `${template.name}-${Date.now()}`,
      description: template.description,
      steps,
      status: 'pending',
      createdAt: Date.now(),
      globalContext: { ...template.defaultContext, ...params.context }
    };
    
    this.workflows.set(workflowId, workflow);
    
    logger.info({ workflowId, templateName, stepCount: steps.length }, 'Workflow created from template');
    
    return workflow;
  }
  
  // Create custom workflow
  createWorkflow(definition: {
    name: string;
    description?: string;
    steps: Omit<WorkflowStep, 'id' | 'status' | 'attempt'>[];
    context?: Record<string, any>;
  }): Workflow {
    const workflowId = uuidv4();
    const steps: WorkflowStep[] = definition.steps.map(stepDef => ({
      ...stepDef,
      id: uuidv4(),
      status: 'pending' as WorkflowStepStatus,
      attempt: 0
    }));
    
    const workflow: Workflow = {
      id: workflowId,
      name: definition.name,
      description: definition.description,
      steps,
      status: 'pending',
      createdAt: Date.now(),
      globalContext: definition.context || {}
    };
    
    this.workflows.set(workflowId, workflow);
    
    logger.info({ workflowId, stepCount: steps.length }, 'Custom workflow created');
    
    return workflow;
  }
  
  // Execute workflow
  async executeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`);
    }
    
    if (this.runningWorkflows.has(workflowId)) {
      throw new Error(`Workflow '${workflowId}' is already running`);
    }
    
    this.runningWorkflows.add(workflowId);
    workflow.status = 'running';
    workflow.startedAt = Date.now();
    
    logger.info({ workflowId, name: workflow.name }, 'Starting workflow execution');
    
    try {
      await this.executeSteps(workflow);
      
      workflow.status = 'completed';
      workflow.completedAt = Date.now();
      
      logger.info({ 
        workflowId, 
        name: workflow.name, 
        executionTime: workflow.completedAt - workflow.startedAt! 
      }, 'Workflow completed successfully');
      
    } catch (error) {
      workflow.status = 'failed';
      workflow.completedAt = Date.now();
      
      logger.error({ 
        workflowId, 
        error: error instanceof Error ? error.message : error 
      }, 'Workflow execution failed');
      
      throw error;
    } finally {
      this.runningWorkflows.delete(workflowId);
    }
  }
  
  private async executeSteps(workflow: Workflow): Promise<void> {
    const maxConcurrency = 5; // Configurable
    const runningSteps = new Set<string>();
    
    while (true) {
      // Find steps ready to run
      const readySteps = workflow.steps.filter(step => 
        step.status === 'pending' && 
        this.areDependenciesMet(step, workflow) &&
        this.shouldRunStep(step, workflow)
      );
      
      // Check if we're done
      const pendingSteps = workflow.steps.filter(s => s.status === 'pending');
      if (pendingSteps.length === 0 || (readySteps.length === 0 && runningSteps.size === 0)) {
        break;
      }
      
      // Start new steps up to concurrency limit
      const availableSlots = Math.max(0, maxConcurrency - runningSteps.size);
      const stepsToStart = readySteps.slice(0, availableSlots);
      
      for (const step of stepsToStart) {
        runningSteps.add(step.id);
        this.executeStep(step, workflow).finally(() => {
          runningSteps.delete(step.id);
        });
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Wait for all running steps to complete
    while (runningSteps.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check if workflow failed
    const failedSteps = workflow.steps.filter(s => s.status === 'failed');
    if (failedSteps.length > 0) {
      throw new Error(`Workflow failed: ${failedSteps.length} steps failed`);
    }
  }
  
  private async executeStep(step: WorkflowStep, workflow: Workflow): Promise<void> {
    step.status = 'running';
    step.startedAt = Date.now();
    step.attempt++;
    
    logger.info({ 
      workflowId: workflow.id, 
      stepId: step.id, 
      stepName: step.name, 
      agentId: step.agentId,
      attempt: step.attempt
    }, 'Starting step execution');
    
    try {
      // Prepare input with context
      const enhancedInput = this.enrichStepInput(step.input, workflow);
      
      // Execute the step (this would integrate with your agent execution system)
      const result = await this.executeAgentCapability(
        step.agentId, 
        step.capability, 
        enhancedInput,
        step.timeout || 60000
      );
      
      step.result = result;
      step.status = 'completed';
      step.completedAt = Date.now();
      
      // Update global context with step results
      if (result && typeof result === 'object') {
        workflow.globalContext = { 
          ...workflow.globalContext, 
          [`${step.name}_result`]: result 
        };
      }
      
      logger.info({ 
        workflowId: workflow.id, 
        stepId: step.id, 
        stepName: step.name,
        executionTime: step.completedAt - step.startedAt!
      }, 'Step completed successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      step.error = errorMessage;
      
      // Retry logic
      const maxAttempts = step.retries?.maxAttempts || 1;
      if (step.attempt < maxAttempts) {
        logger.warn({ 
          workflowId: workflow.id, 
          stepId: step.id, 
          attempt: step.attempt,
          maxAttempts,
          error: errorMessage
        }, 'Step failed, retrying');
        
        // Wait before retry
        const backoffMs = step.retries?.backoffMs || 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs * step.attempt));
        
        step.status = 'pending';
        return this.executeStep(step, workflow);
      }
      
      step.status = 'failed';
      step.completedAt = Date.now();
      
      logger.error({ 
        workflowId: workflow.id, 
        stepId: step.id, 
        stepName: step.name,
        error: errorMessage,
        attempts: step.attempt
      }, 'Step failed permanently');
      
      throw error;
    }
  }
  
  private areDependenciesMet(step: WorkflowStep, workflow: Workflow): boolean {
    if (!step.dependencies || step.dependencies.length === 0) {
      return true;
    }
    
    return step.dependencies.every(depId => {
      const depStep = workflow.steps.find(s => s.id === depId);
      return depStep?.status === 'completed';
    });
  }
  
  private shouldRunStep(step: WorkflowStep, workflow: Workflow): boolean {
    const context = { ...workflow.globalContext };
    
    // Check skip condition
    if (step.conditions?.skipIf) {
      try {
        const shouldSkip = this.evaluateExpression(step.conditions.skipIf, context);
        if (shouldSkip) {
          step.status = 'skipped';
          return false;
        }
      } catch (error) {
        logger.warn({ stepId: step.id, expression: step.conditions.skipIf }, 'Skip condition evaluation failed');
      }
    }
    
    // Check run condition
    if (step.conditions?.runIf) {
      try {
        return this.evaluateExpression(step.conditions.runIf, context);
      } catch (error) {
        logger.warn({ stepId: step.id, expression: step.conditions.runIf }, 'Run condition evaluation failed');
        return false;
      }
    }
    
    return true;
  }
  
  private enrichStepInput(input: any, workflow: Workflow): any {
    if (typeof input !== 'object' || input === null) {
      return input;
    }
    
    // Replace template variables in input with context values
    const enriched = JSON.parse(JSON.stringify(input));
    const context = workflow.globalContext || {};
    
    this.replaceTemplateVariables(enriched, context);
    
    return enriched;
  }
  
  private replaceTemplateVariables(obj: any, context: Record<string, any>): any {
    if (typeof obj === 'string') {
      // Replace {{variable}} patterns
      return obj.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return context[varName] !== undefined ? String(context[varName]) : match;
      });
    } else if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        obj[index] = this.replaceTemplateVariables(item, context);
      });
    } else if (typeof obj === 'object' && obj !== null) {
      Object.keys(obj).forEach(key => {
        obj[key] = this.replaceTemplateVariables(obj[key], context);
      });
    }
    return obj;
  }
  
  private evaluateExpression(expression: string, context: Record<string, any>): boolean {
    try {
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return Boolean(func(...Object.values(context)));
    } catch {
      return false;
    }
  }
  
  private async executeAgentCapability(
    agentId: string, 
    capability: string, 
    input: any,
    timeout: number
  ): Promise<any> {
    // This would integrate with your existing agent execution system
    // For now, simulate the call
    const agent = agentRegistry.get(agentId);
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`);
    }
    
    const cap = agent.capabilities.find(c => c.name === capability);
    if (!cap) {
      throw new Error(`Capability '${capability}' not found for agent '${agentId}'`);
    }
    
    // Simulate execution with timeout
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step timed out after ${timeout}ms`));
      }, timeout);
      
      // Simulate async work
      setTimeout(() => {
        clearTimeout(timer);
        resolve({
          success: true,
          message: `Executed ${agentId}.${capability}`,
          input,
          timestamp: Date.now()
        });
      }, Math.random() * 2000); // Simulate 0-2s execution
    });
  }
  
  // Get workflow status
  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }
  
  // List workflows
  listWorkflows(filter?: { status?: string; createdBy?: string }): Workflow[] {
    let workflows = Array.from(this.workflows.values());
    
    if (filter?.status) {
      workflows = workflows.filter(w => w.status === filter.status);
    }
    
    if (filter?.createdBy) {
      workflows = workflows.filter(w => w.createdBy === filter.createdBy);
    }
    
    return workflows.sort((a, b) => b.createdAt - a.createdAt);
  }
  
  // Cancel workflow
  cancelWorkflow(workflowId: string): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow || workflow.status !== 'running') {
      return false;
    }
    
    workflow.status = 'cancelled';
    workflow.completedAt = Date.now();
    this.runningWorkflows.delete(workflowId);
    
    logger.info({ workflowId }, 'Workflow cancelled');
    
    return true;
  }
  
  // Register a workflow template
  registerTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.name, template);
    logger.info({ templateName: template.name, stepCount: template.steps.length }, 'Workflow template registered');
  }
  
  private loadDefaultTemplates(): void {
    // Code Generation Workflow
    this.templates.set('code-generation-pipeline', {
      name: 'Code Generation Pipeline',
      description: 'Generate, test, and document code',
      steps: [
        {
          name: 'analyze_requirements',
          agentId: 'data-processor-000',
          capability: 'process_data',
          input: {
            data: '{{requirements}}',
            operations: [{ type: 'map', expression: 'item.priority > 3' }]
          }
        },
        {
          name: 'generate_code',
          agentId: 'code-gen-000',
          capability: 'generate_code',
          input: {
            task: '{{task}}',
            language: '{{language}}',
            requirements: '{{analyze_requirements_result.data}}'
          },
          dependencies: ['analyze_requirements']
        },
        {
          name: 'create_tests',
          agentId: 'code-gen-001',
          capability: 'generate_code',
          input: {
            task: 'Generate unit tests',
            language: '{{language}}',
            code: '{{generate_code_result.code}}'
          },
          dependencies: ['generate_code']
        },
        {
          name: 'create_documentation',
          agentId: 'file-ops-000',
          capability: 'file_operations',
          input: {
            operation: 'create',
            path: '{{output_dir}}/README.md',
            content: 'Documentation for {{task}}'
          },
          dependencies: ['generate_code'],
          conditions: {
            runIf: 'generate_code_result.success === true'
          }
        }
      ],
      defaultContext: {
        output_dir: './output',
        language: 'javascript'
      }
    });
    
    // Data Processing Pipeline
    this.templates.set('data-pipeline', {
      name: 'Data Processing Pipeline',
      description: 'Extract, transform, and analyze data',
      steps: [
        {
          name: 'fetch_data',
          agentId: 'web-scraper-000',
          capability: 'scrape_web',
          input: {
            urls: '{{data_sources}}',
            format: 'json'
          }
        },
        {
          name: 'clean_data',
          agentId: 'data-processor-000',
          capability: 'process_data',
          input: {
            data: '{{fetch_data_result.result}}',
            operations: [
              { type: 'filter', expression: 'item !== null && item !== undefined' },
              { type: 'map', expression: 'item.trim()' }
            ]
          },
          dependencies: ['fetch_data']
        },
        {
          name: 'analyze_data',
          agentId: 'data-processor-001',
          capability: 'process_data',
          input: {
            data: '{{clean_data_result.result}}',
            operations: [
              { type: 'group', expression: 'item.category' },
              { type: 'sort', expression: 'b.count - a.count' }
            ]
          },
          dependencies: ['clean_data']
        },
        {
          name: 'generate_report',
          agentId: 'file-ops-000',
          capability: 'file_operations',
          input: {
            operation: 'create',
            path: '{{output_file}}',
            content: '{{analyze_data_result.result}}'
          },
          dependencies: ['analyze_data']
        }
      ],
      defaultContext: {
        output_file: './data-report.json'
      }
    });
    
    logger.info({ templateCount: this.templates.size }, 'Workflow templates loaded');
  }
}

export const workflowOrchestrator = new WorkflowOrchestrator();