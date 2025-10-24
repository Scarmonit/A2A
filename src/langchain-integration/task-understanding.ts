/**
 * Task Understanding Module
 *
 * Uses LangChain and local LLM (Ollama) to analyze natural language tasks
 * and determine which agents should be deployed to handle them.
 *
 * This module provides TRUE autonomous agent deployment based on task analysis.
 */

import { PromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import pino from 'pino';
import { AgentDescriptor, AgentFilter } from '../agents.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'task-understanding' } });

// ============================================================================
// Task Analysis Schema
// ============================================================================

/**
 * Schema for parsed task requirements
 */
export const TaskRequirementsSchema = z.object({
  description: z.string().describe('Original task description'),
  domain: z.enum([
    'web_automation',
    'data_processing',
    'content_creation',
    'api_testing',
    'security',
    'deployment',
    'monitoring',
    'general'
  ]).describe('Primary domain of the task'),
  actions: z.array(z.string()).describe('List of actions needed (e.g., scrape, analyze, deploy)'),
  requiredCapabilities: z.array(z.string()).describe('Required agent capabilities'),
  complexity: z.enum(['simple', 'moderate', 'complex']).describe('Task complexity level'),
  estimatedSteps: z.number().describe('Estimated number of steps'),
  dependencies: z.array(z.string()).optional().describe('Task dependencies'),
  constraints: z.object({
    timeout: z.number().optional(),
    maxRetries: z.number().optional(),
    requiresHumanApproval: z.boolean().optional(),
  }).optional(),
});

export type TaskRequirements = z.infer<typeof TaskRequirementsSchema>;

/**
 * Schema for agent recommendations
 */
export const AgentRecommendationSchema = z.object({
  agentId: z.string(),
  agentName: z.string(),
  score: z.number().min(0).max(1).describe('Suitability score (0-1)'),
  reasoning: z.string().describe('Why this agent was selected'),
  capabilities: z.array(z.string()).describe('Matching capabilities'),
  role: z.enum(['primary', 'secondary', 'optional']).describe('Agent role in task execution'),
});

export type AgentRecommendation = z.infer<typeof AgentRecommendationSchema>;

/**
 * Schema for execution plan
 */
export const ExecutionPlanSchema = z.object({
  taskId: z.string(),
  requirements: TaskRequirementsSchema,
  recommendedAgents: z.array(AgentRecommendationSchema),
  executionSteps: z.array(z.object({
    step: z.number(),
    description: z.string(),
    agentId: z.string().optional(),
    capability: z.string().optional(),
    dependsOn: z.array(z.number()).optional(),
  })),
  estimatedDuration: z.number().describe('Estimated duration in milliseconds'),
  confidence: z.number().min(0).max(1).describe('Confidence in this plan'),
});

export type ExecutionPlan = z.infer<typeof ExecutionPlanSchema>;

// ============================================================================
// Task Understanding Prompts
// ============================================================================

const TASK_ANALYSIS_PROMPT = PromptTemplate.fromTemplate(`
You are an expert AI task analyst. Analyze the following task description and extract structured information.

Task: {task}

Available Agent Categories:
- web_automation: Web scraping, browser automation, form filling
- data_processing: Data analysis, transformation, validation
- content_creation: Writing, summarization, content generation
- api_testing: API integration, testing, monitoring
- security: Security scanning, vulnerability detection
- deployment: Deployment management, CI/CD
- monitoring: System monitoring, health checks
- general: General-purpose utilities

Analyze this task and respond with a JSON object containing:
1. domain: The primary domain (one of the categories above)
2. actions: Array of specific actions needed (e.g., ["scrape", "analyze", "report"])
3. requiredCapabilities: Array of capabilities needed (e.g., ["http_request", "data_transform"])
4. complexity: Task complexity ("simple", "moderate", or "complex")
5. estimatedSteps: Number of steps (integer)

Respond ONLY with valid JSON, no other text.
`);

const AGENT_SELECTION_PROMPT = PromptTemplate.fromTemplate(`
You are an agent selection expert. Given a task and available agents, determine the best agents for the job.

Task Domain: {domain}
Task Actions: {actions}
Required Capabilities: {capabilities}

Available Agents:
{agents}

For each relevant agent, provide:
1. score: Suitability score 0.0-1.0 (higher is better)
2. reasoning: Brief explanation of why this agent is suitable
3. role: "primary" (essential), "secondary" (helpful), or "optional" (nice to have)

Return a JSON array of agent recommendations, sorted by score (highest first).
Include only agents with score >= 0.3.
Respond ONLY with valid JSON array, no other text.
`);

// ============================================================================
// Task Understanding Service
// ============================================================================

export class TaskUnderstandingService {
  private ollamaUrl: string;
  private defaultModel: string;

  constructor(
    ollamaUrl = process.env.LOCAL_LLM_URL || 'http://localhost:11434',
    defaultModel = process.env.DEFAULT_CHAT_MODEL || 'llama2:7b-chat'
  ) {
    this.ollamaUrl = ollamaUrl;
    this.defaultModel = defaultModel;
  }

  /**
   * Analyze a natural language task description
   */
  async analyzeTask(taskDescription: string): Promise<TaskRequirements> {
    try {
      logger.info({ task: taskDescription }, 'Analyzing task');

      // Format prompt
      const prompt = await TASK_ANALYSIS_PROMPT.format({ task: taskDescription });

      // Call Ollama for analysis
      const response = await this.callOllama(prompt);

      // Parse JSON response
      const parsed = this.extractJSON(response);

      // Validate against schema
      const requirements = TaskRequirementsSchema.parse({
        description: taskDescription,
        ...parsed,
      });

      logger.info({ requirements }, 'Task analysis complete');

      return requirements;
    } catch (error) {
      logger.error({ error, task: taskDescription }, 'Task analysis failed');

      // Fallback: Rule-based analysis
      return this.fallbackTaskAnalysis(taskDescription);
    }
  }

  /**
   * Select agents based on task requirements
   */
  async selectAgents(
    requirements: TaskRequirements,
    availableAgents: AgentDescriptor[]
  ): Promise<AgentRecommendation[]> {
    try {
      logger.info({ requirements }, 'Selecting agents for task');

      // Format agent information
      const agentInfo = availableAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        category: agent.category,
        tags: agent.tags,
        capabilities: agent.capabilities.map(c => c.name),
      }));

      // Format prompt
      const prompt = await AGENT_SELECTION_PROMPT.format({
        domain: requirements.domain,
        actions: requirements.actions.join(', '),
        capabilities: requirements.requiredCapabilities.join(', '),
        agents: JSON.stringify(agentInfo, null, 2),
      });

      // Call Ollama for agent selection
      const response = await this.callOllama(prompt);

      // Parse JSON response
      const parsed = this.extractJSON(response);

      // Validate against schema
      const recommendations = z.array(AgentRecommendationSchema).parse(parsed);

      logger.info({ count: recommendations.length }, 'Agent selection complete');

      return recommendations.sort((a, b) => b.score - a.score);
    } catch (error) {
      logger.error({ error }, 'Agent selection failed');

      // Fallback: Rule-based selection
      return this.fallbackAgentSelection(requirements, availableAgents);
    }
  }

  /**
   * Generate a complete execution plan
   */
  async createExecutionPlan(
    taskDescription: string,
    availableAgents: AgentDescriptor[]
  ): Promise<ExecutionPlan> {
    try {
      // Step 1: Analyze task
      const requirements = await this.analyzeTask(taskDescription);

      // Step 2: Select agents
      const recommendations = await this.selectAgents(requirements, availableAgents);

      // Step 3: Generate execution steps
      const executionSteps = this.generateExecutionSteps(requirements, recommendations);

      // Step 4: Estimate duration
      const estimatedDuration = this.estimateDuration(requirements, recommendations);

      // Step 5: Calculate confidence
      const confidence = this.calculateConfidence(requirements, recommendations);

      const plan: ExecutionPlan = {
        taskId: `task-${Date.now()}`,
        requirements,
        recommendedAgents: recommendations,
        executionSteps,
        estimatedDuration,
        confidence,
      };

      logger.info({ plan }, 'Execution plan created');

      return plan;
    } catch (error) {
      logger.error({ error, task: taskDescription }, 'Execution plan creation failed');
      throw error;
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Call Ollama API for LLM inference
   */
  private async callOllama(prompt: string, model?: string): Promise<string> {
    const url = `${this.ollamaUrl}/api/generate`;
    const requestModel = model || this.defaultModel;

    logger.debug({ url, model: requestModel }, 'Calling Ollama');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: requestModel,
        prompt: prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || '';
  }

  /**
   * Extract JSON from LLM response (handles markdown code blocks)
   */
  private extractJSON(text: string): any {
    // Try to find JSON in markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\}|\[[\s\S]*?\])\s*```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }

    // Try to find raw JSON
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }

    throw new Error('No valid JSON found in response');
  }

  /**
   * Fallback rule-based task analysis when LLM fails
   */
  private fallbackTaskAnalysis(taskDescription: string): TaskRequirements {
    logger.warn('Using fallback rule-based task analysis');

    const lowerTask = taskDescription.toLowerCase();

    // Determine domain based on keywords
    let domain: TaskRequirements['domain'] = 'general';
    if (lowerTask.includes('scrape') || lowerTask.includes('web')) domain = 'web_automation';
    else if (lowerTask.includes('data') || lowerTask.includes('analyze')) domain = 'data_processing';
    else if (lowerTask.includes('write') || lowerTask.includes('content')) domain = 'content_creation';
    else if (lowerTask.includes('api') || lowerTask.includes('test')) domain = 'api_testing';
    else if (lowerTask.includes('security') || lowerTask.includes('scan')) domain = 'security';
    else if (lowerTask.includes('deploy')) domain = 'deployment';
    else if (lowerTask.includes('monitor')) domain = 'monitoring';

    // Extract actions (simple keyword matching)
    const actions: string[] = [];
    if (lowerTask.includes('scrape')) actions.push('scrape');
    if (lowerTask.includes('analyze')) actions.push('analyze');
    if (lowerTask.includes('test')) actions.push('test');
    if (lowerTask.includes('deploy')) actions.push('deploy');
    if (lowerTask.includes('monitor')) actions.push('monitor');
    if (lowerTask.includes('write')) actions.push('write');

    // Determine complexity
    let complexity: TaskRequirements['complexity'] = 'simple';
    if (lowerTask.split(' ').length > 20 || actions.length > 3) complexity = 'complex';
    else if (lowerTask.split(' ').length > 10 || actions.length > 1) complexity = 'moderate';

    return {
      description: taskDescription,
      domain,
      actions: actions.length > 0 ? actions : ['execute'],
      requiredCapabilities: actions.length > 0 ? actions : ['chat'],
      complexity,
      estimatedSteps: actions.length || 1,
    };
  }

  /**
   * Fallback rule-based agent selection when LLM fails
   */
  private fallbackAgentSelection(
    requirements: TaskRequirements,
    availableAgents: AgentDescriptor[]
  ): AgentRecommendation[] {
    logger.warn('Using fallback rule-based agent selection');

    const recommendations: AgentRecommendation[] = [];

    for (const agent of availableAgents) {
      if (!agent.enabled) continue;

      let score = 0.0;
      const matchingCapabilities: string[] = [];

      // Score based on category match
      if (agent.category === requirements.domain) {
        score += 0.5;
      }

      // Score based on capability matches
      for (const requiredCap of requirements.requiredCapabilities) {
        for (const agentCap of agent.capabilities) {
          if (agentCap.name.toLowerCase().includes(requiredCap.toLowerCase()) ||
              requiredCap.toLowerCase().includes(agentCap.name.toLowerCase())) {
            score += 0.3;
            matchingCapabilities.push(agentCap.name);
          }
        }
      }

      // Score based on tag matches
      for (const action of requirements.actions) {
        if (agent.tags?.some(tag => tag.toLowerCase().includes(action.toLowerCase()))) {
          score += 0.1;
        }
      }

      // Normalize score to 0-1
      score = Math.min(score, 1.0);

      if (score >= 0.3) {
        recommendations.push({
          agentId: agent.id,
          agentName: agent.name,
          score,
          reasoning: `Category: ${agent.category}, Matching capabilities: ${matchingCapabilities.join(', ') || 'general'}`,
          capabilities: matchingCapabilities,
          role: score >= 0.7 ? 'primary' : score >= 0.5 ? 'secondary' : 'optional',
        });
      }
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * Generate execution steps from requirements and agents
   */
  private generateExecutionSteps(
    requirements: TaskRequirements,
    recommendations: AgentRecommendation[]
  ): ExecutionPlan['executionSteps'] {
    const steps: ExecutionPlan['executionSteps'] = [];

    // Primary agents execute first
    const primaryAgents = recommendations.filter(r => r.role === 'primary');
    const secondaryAgents = recommendations.filter(r => r.role === 'secondary');

    let stepNumber = 1;

    // Add steps for each action
    for (const action of requirements.actions) {
      const agent = primaryAgents[0] || secondaryAgents[0];

      if (agent) {
        steps.push({
          step: stepNumber++,
          description: `${action} using ${agent.agentName}`,
          agentId: agent.agentId,
          capability: agent.capabilities[0],
          dependsOn: stepNumber > 2 ? [stepNumber - 2] : undefined,
        });
      } else {
        steps.push({
          step: stepNumber++,
          description: action,
          dependsOn: stepNumber > 2 ? [stepNumber - 2] : undefined,
        });
      }
    }

    return steps;
  }

  /**
   * Estimate task duration
   */
  private estimateDuration(
    requirements: TaskRequirements,
    recommendations: AgentRecommendation[]
  ): number {
    const baseTime = 5000; // 5 seconds base
    const perStepTime = 3000; // 3 seconds per step
    const complexityMultiplier = {
      simple: 1.0,
      moderate: 1.5,
      complex: 2.5,
    };

    return baseTime +
           (requirements.estimatedSteps * perStepTime) *
           complexityMultiplier[requirements.complexity];
  }

  /**
   * Calculate confidence in the execution plan
   */
  private calculateConfidence(
    requirements: TaskRequirements,
    recommendations: AgentRecommendation[]
  ): number {
    if (recommendations.length === 0) return 0.0;

    const primaryAgents = recommendations.filter(r => r.role === 'primary');

    // High confidence if we have primary agents with good scores
    if (primaryAgents.length > 0 && primaryAgents[0].score >= 0.8) {
      return 0.9;
    }

    // Medium confidence if we have agents but lower scores
    if (recommendations.length > 0 && recommendations[0].score >= 0.5) {
      return 0.7;
    }

    // Low confidence otherwise
    return 0.5;
  }
}

/**
 * Global task understanding service instance
 */
export const taskUnderstandingService = new TaskUnderstandingService();
