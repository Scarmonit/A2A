/**
 * LangChain Integration Module
 *
 * This module provides autonomous task understanding and agent deployment
 * capabilities using LangChain and local LLM (Ollama).
 *
 * Features:
 * - Natural language task analysis
 * - Automatic agent selection based on capabilities
 * - Autonomous agent deployment
 * - Execution plan generation
 * - Task orchestration
 *
 * @example
 * ```typescript
 * import { createAutonomousOrchestrator } from './langchain-integration/index.js';
 * import { agentRegistry } from './agents.js';
 *
 * const orchestrator = createAutonomousOrchestrator(agentRegistry);
 *
 * const execution = await orchestrator.executeTask(
 *   "Scrape the latest news from example.com and analyze sentiment"
 * );
 *
 * console.log(execution.status); // 'completed'
 * console.log(execution.executionResults);
 * ```
 */

export {
  // Task Understanding
  TaskUnderstandingService,
  taskUnderstandingService,
  TaskRequirements,
  TaskRequirementsSchema,
  AgentRecommendation,
  AgentRecommendationSchema,
  ExecutionPlan,
  ExecutionPlanSchema,
} from './task-understanding.js';

export {
  // Autonomous Orchestration
  AutonomousOrchestrator,
  createAutonomousOrchestrator,
  AutonomousTaskExecution,
  AutonomousTaskStatus,
  AutonomousTaskStatusSchema,
  AutoDeployOptions,
} from './autonomous-orchestrator.js';
