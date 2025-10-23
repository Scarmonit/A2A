/**
 * AUTONOMOUS SERVICE - Self-Improving MCP Daemon
 * 
 * This service runs continuously, using the MCP's own tools to:
 * 1. Analyze its own codebase
 * 2. Detect and fix issues
 * 3. Improve performance
 * 4. Manage GitHub PRs and reviews
 * 
 * The MCP does all the work itself using the agent-to-agent architecture.
 */

import { workflowOrchestrator } from './workflow-orchestrator.js';
import { AgentExecutor } from './agent-executor.js';
import { ToolExecutionContext } from './tools.js';
import { analyticsEngine } from './analytics-engine.js';
import { mcpMonitor } from './mcp-monitor.js';
import { aggregationCache } from './aggregation-cache.js';
import pino from 'pino';
import { v4 as uuidv4 } from 'uuid';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'autonomous-mcp' } });

export interface AutonomousConfig {
  enabled: boolean;
  selfImprovementInterval: number; // milliseconds between cycles
  autoFix: boolean;
  autoCommit: boolean;
  autoMerge: boolean;
  analysisDepth: 'quick' | 'standard' | 'deep';
  focusAreas: string[];
}

export class AutonomousService {
  private config: AutonomousConfig;
  private isRunning: boolean = false;
  private agentExecutor: AgentExecutor;
  private cycleCount: number = 0;
  private improvementHistory: any[] = [];

  constructor(config?: Partial<AutonomousConfig>) {
    this.config = {
      enabled: process.env.SELF_IMPROVEMENT_ENABLED === 'true' || true,
      selfImprovementInterval: parseInt(process.env.SELF_IMPROVEMENT_INTERVAL || '21600000'), // 6 hours default
      autoFix: process.env.AUTO_FIX_ENABLED === 'true' || true,
      autoCommit: process.env.AUTO_COMMIT_ENABLED === 'true' || false,
      autoMerge: process.env.AUTO_MERGE_ENABLED === 'true' || false,
      analysisDepth: (process.env.ANALYSIS_DEPTH as any) || 'standard',
      focusAreas: (process.env.FOCUS_AREAS || 'performance,security,maintainability').split(','),
      ...config
    };

    this.agentExecutor = new AgentExecutor();
    logger.info({ config: this.config }, 'Autonomous Service initialized');
  }

  /**
   * Start the autonomous self-improvement loop
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Autonomous Service already running');
      return;
    }

    this.isRunning = true;
    logger.info('🤖 Starting Autonomous MCP Service');

    // Register self-improvement workflow template
    this.registerSelfImprovementWorkflow();

    // Run initial cycle immediately
    await this.runImprovementCycle();

    // Schedule recurring cycles
    this.scheduleRecurringCycles();
  }

  /**
   * Stop the autonomous service
   */
  async stop(): Promise<void> {
    this.isRunning = false;
    logger.info('🛑 Stopping Autonomous MCP Service');
  }

  /**
   * Register the self-improvement workflow template
   */
  private registerSelfImprovementWorkflow(): void {
    workflowOrchestrator.registerTemplate({
      name: 'self-improvement-cycle',
      description: 'Autonomous self-improvement cycle for MCP',
      steps: [
        {
          name: 'self-analyze',
          agentId: 'self-improvement-agent',
          capability: 'mcp_self_analyze',
          input: {
            timeWindow: 3600000, // Last hour
            includeRecommendations: true
          }
        },
        {
          name: 'analyze-code-quality',
          agentId: 'self-improvement-agent',
          capability: 'mcp_analyze_code_quality',
          input: {
            filePath: 'src/',
            checkTypes: ['complexity', 'security', 'performance']
          },
          dependencies: ['self-analyze']
        },
        {
          name: 'generate-suggestions',
          agentId: 'self-improvement-agent',
          capability: 'mcp_suggest_enhancements',
          input: {
            focusAreas: this.config.focusAreas
          },
          dependencies: ['analyze-code-quality']
        },
        {
          name: 'auto-fix',
          agentId: 'self-improvement-agent',
          capability: 'mcp_auto_fix',
          input: {
            issueTypes: ['formatting', 'imports', 'types'],
            dryRun: !this.config.autoFix
          },
          dependencies: ['generate-suggestions'],
          conditions: {
            runIf: 'context.autoFixEnabled === true'
          }
        }
      ],
      defaultContext: {
        autoFixEnabled: this.config.autoFix,
        cycleId: '',
        startTime: Date.now()
      }
    });

    logger.info('Self-improvement workflow template registered');
  }

  /**
   * Schedule recurring self-improvement cycles
   */
  private scheduleRecurringCycles(): void {
    if (!this.config.enabled) {
      logger.info('Self-improvement cycles disabled by configuration');
      return;
    }

    setInterval(async () => {
      if (this.isRunning) {
        await this.runImprovementCycle();
      }
    }, this.config.selfImprovementInterval);

    logger.info(
      { interval: this.config.selfImprovementInterval },
      'Recurring self-improvement cycles scheduled'
    );
  }

  /**
   * Run a single self-improvement cycle
   */
  private async runImprovementCycle(): Promise<void> {
    const cycleId = uuidv4();
    this.cycleCount++;

    logger.info({ cycleId, cycleNumber: this.cycleCount }, '🔄 Starting self-improvement cycle');

    try {
      // Create workflow from template
      const workflow = workflowOrchestrator.createFromTemplate('self-improvement-cycle', {
        name: `Self-Improvement Cycle #${this.cycleCount}`,
        context: {
          cycleId,
          cycleNumber: this.cycleCount,
          autoFixEnabled: this.config.autoFix,
          startTime: Date.now()
        }
      });

      // Execute workflow
      logger.info({ workflowId: workflow.id }, 'Executing self-improvement workflow');
      await workflowOrchestrator.executeWorkflow(workflow.id);

      // Get results
      const completedWorkflow = workflowOrchestrator.getWorkflow(workflow.id);
      const results = this.extractWorkflowResults(completedWorkflow);

      // Store in history
      this.improvementHistory.push({
        cycleId,
        cycleNumber: this.cycleCount,
        timestamp: Date.now(),
        results,
        status: completedWorkflow?.status
      });

      // Log summary
      logger.info(
        {
          cycleId,
          status: completedWorkflow?.status,
          stepsCompleted: completedWorkflow?.steps.filter(s => s.status === 'completed').length,
          stepsFailed: completedWorkflow?.steps.filter(s => s.status === 'failed').length
        },
        '✅ Self-improvement cycle completed'
      );

      // Decide on next actions based on results
      await this.processImprovementResults(results);

    } catch (error) {
      logger.error({ error, cycleId }, '❌ Self-improvement cycle failed');
    }
  }

  /**
   * Extract meaningful results from completed workflow
   */
  private extractWorkflowResults(workflow: any): any {
    if (!workflow) return {};

    const results: any = {
      selfAnalysis: null,
      codeQuality: null,
      suggestions: null,
      fixes: null
    };

    for (const step of workflow.steps) {
      if (step.status === 'completed' && step.result) {
        switch (step.name) {
          case 'self-analyze':
            results.selfAnalysis = step.result;
            break;
          case 'analyze-code-quality':
            results.codeQuality = step.result;
            break;
          case 'generate-suggestions':
            results.suggestions = step.result;
            break;
          case 'auto-fix':
            results.fixes = step.result;
            break;
        }
      }
    }

    return results;
  }

  /**
   * Process improvement results and take actions
   */
  private async processImprovementResults(results: any): Promise<void> {
    try {
      // Check if there are critical issues that need immediate attention
      const criticalIssues = results.codeQuality?.issues?.filter((i: any) => i.severity === 'critical') || [];
      
      if (criticalIssues.length > 0) {
        logger.warn({ count: criticalIssues.length }, '⚠️  Critical issues detected');
        
        // Create a high-priority workflow for critical issues
        if (this.config.autoFix) {
          await this.createCriticalFixWorkflow(criticalIssues);
        }
      }

      // Check if suggestions warrant a PR
      const highPrioritySuggestions = results.suggestions?.filter((s: any) => s.priority === 'high') || [];
      
      if (highPrioritySuggestions.length >= 3 && this.config.autoCommit) {
        logger.info({ count: highPrioritySuggestions.length }, '📝 Creating improvement PR');
        // Note: Actual GitHub PR creation would happen here via GitHub MCP server
        // This requires the GitHub MCP server tools to be available
      }

      // Update cache with new metrics
      this.updatePerformanceCache(results);

    } catch (error) {
      logger.error({ error }, 'Failed to process improvement results');
    }
  }

  /**
   * Create a workflow specifically for critical issues
   */
  private async createCriticalFixWorkflow(issues: any[]): Promise<void> {
    logger.info({ issueCount: issues.length }, 'Creating critical fix workflow');

    // This would create a high-priority workflow to address critical issues
    // Using the agent executor and workflow orchestrator
    
    const context: ToolExecutionContext = {
      requestId: uuidv4(),
      agentId: 'autonomous-service',
      workingDirectory: process.cwd(),
      permissions: ['*'],
      limits: {
        maxExecutionTime: 300000,
        maxFileSize: 100 * 1024 * 1024
      }
    };

    try {
      const result = await this.agentExecutor.executeAgent(
        'self-improvement-agent',
        'mcp_auto_fix',
        {
          issueTypes: ['security', 'critical'],
          issues,
          dryRun: false
        },
        context
      );

      logger.info({ result }, 'Critical fixes applied');
    } catch (error) {
      logger.error({ error }, 'Failed to apply critical fixes');
    }
  }

  /**
   * Update performance cache with new metrics
   */
  private updatePerformanceCache(results: any): void {
    const cacheKey = 'self-improvement-metrics';
    aggregationCache.set(cacheKey, {
      lastRun: Date.now(),
      cycleCount: this.cycleCount,
      results,
      performanceMetrics: {
        cacheHitRate: aggregationCache.getStats().hitRate,
        analyticsEvents: analyticsEngine.getRealTimeMetrics(),
        mcpCalls: mcpMonitor.getStats(3600000)
      }
    }, 3600000); // Cache for 1 hour
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      isRunning: this.isRunning,
      config: this.config,
      cycleCount: this.cycleCount,
      lastCycle: this.improvementHistory[this.improvementHistory.length - 1],
      uptime: process.uptime(),
      nextCycle: this.config.selfImprovementInterval
    };
  }

  /**
   * Get improvement history
   */
  getHistory(limit: number = 10): any[] {
    return this.improvementHistory.slice(-limit);
  }
}

// Export singleton instance
export const autonomousService = new AutonomousService();

// Auto-start if enabled
if (process.env.AUTO_START_AUTONOMOUS_SERVICE === 'true') {
  autonomousService.start().catch(error => {
    logger.error({ error }, 'Failed to auto-start autonomous service');
  });
}
