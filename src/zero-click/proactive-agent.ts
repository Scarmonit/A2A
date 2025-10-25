import { agentRegistry, AgentDescriptor } from '../agents.js';
import { agentExecutor } from '../agent-executor.js';
import { zeroClickEventBus, EventType } from './event-bus.js';
import { ToolExecutionContext } from '../tools.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'proactive-agent' } });

/**
 * Pattern learned from execution history
 */
export interface ExecutionPattern {
  id: string;
  agentId: string;
  capability: string;
  contextSignature: string; // Hash of context conditions
  frequency: number; // How often this pattern occurs
  successRate: number; // Percentage of successful executions
  lastOccurrence: number;
  conditions: Record<string, any>; // Conditions that trigger this pattern
}

/**
 * Proactive suggestion
 */
export interface ProactiveSuggestion {
  id: string;
  agentId: string;
  capability: string;
  input: any;
  reason: string;
  confidence: number; // 0-1
  pattern?: ExecutionPattern;
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'accepted' | 'rejected' | 'auto_executed' | 'expired';
}

/**
 * System condition to monitor
 */
export interface MonitorCondition {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  checker: () => Promise<any> | any;
  interval: number; // Check interval in ms
  threshold?: {
    type: 'above' | 'below' | 'equals' | 'changed';
    value: any;
  };
  actions: {
    agentId: string;
    capability: string;
    inputMapping: (value: any) => any;
    autoExecute: boolean;
    minConfidence?: number;
  }[];
  lastCheck?: number;
  lastValue?: any;
}

/**
 * Proactive agent configuration
 */
export interface ProactiveConfig {
  learningEnabled: boolean;
  minPatternOccurrences: number; // Minimum occurrences before suggesting
  minSuccessRate: number; // Minimum success rate (0-1)
  autoExecuteThreshold: number; // Confidence threshold for auto-execution (0-1)
  suggestionExpiryMs: number; // How long suggestions remain valid
  maxSuggestions: number; // Maximum active suggestions
}

/**
 * Proactive Agent System
 * Monitors conditions, learns patterns, and suggests/executes actions automatically
 */
export class ProactiveAgentSystem {
  private patterns = new Map<string, ExecutionPattern>();
  private suggestions = new Map<string, ProactiveSuggestion>();
  private monitors = new Map<string, MonitorCondition>();
  private monitorIntervals = new Map<string, NodeJS.Timeout>();
  private executionHistory: Array<{
    agentId: string;
    capability: string;
    input: any;
    context: any;
    success: boolean;
    timestamp: number;
  }> = [];

  private config: ProactiveConfig = {
    learningEnabled: true,
    minPatternOccurrences: 3,
    minSuccessRate: 0.7,
    autoExecuteThreshold: 0.9,
    suggestionExpiryMs: 3600000, // 1 hour
    maxSuggestions: 50
  };

  constructor(config?: Partial<ProactiveConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Listen to agent completion events for learning
    zeroClickEventBus.on(EventType.AGENT_COMPLETION, (event) => {
      if (this.config.learningEnabled) {
        this.recordExecution(event.data);
      }
    });

    // Clean up expired suggestions periodically
    setInterval(() => this.cleanupExpiredSuggestions(), 60000);
  }

  /**
   * Record an execution for pattern learning
   */
  recordExecution(data: {
    agentId: string;
    capability: string;
    result?: any;
    originalEvent?: any;
  }): void {
    const execution = {
      agentId: data.agentId,
      capability: data.capability,
      input: data.result,
      context: data.originalEvent?.data || {},
      success: !!data.result,
      timestamp: Date.now()
    };

    this.executionHistory.push(execution);

    // Keep history limited
    if (this.executionHistory.length > 10000) {
      this.executionHistory.shift();
    }

    // Update patterns
    this.updatePatterns();

    logger.debug({ agentId: execution.agentId, capability: execution.capability }, 'Execution recorded');
  }

  /**
   * Update patterns based on execution history
   */
  private updatePatterns(): void {
    // Group executions by agent/capability and context
    const grouped = new Map<string, typeof this.executionHistory>();

    for (const exec of this.executionHistory) {
      const contextSig = this.generateContextSignature(exec.context);
      const key = `${exec.agentId}:${exec.capability}:${contextSig}`;

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(exec);
    }

    // Create/update patterns
    for (const [key, executions] of grouped.entries()) {
      if (executions.length < this.config.minPatternOccurrences) continue;

      const [agentId, capability, contextSig] = key.split(':');
      const successCount = executions.filter(e => e.success).length;
      const successRate = successCount / executions.length;

      if (successRate < this.config.minSuccessRate) continue;

      const pattern: ExecutionPattern = {
        id: `pattern_${key}`,
        agentId,
        capability,
        contextSignature: contextSig,
        frequency: executions.length,
        successRate,
        lastOccurrence: Math.max(...executions.map(e => e.timestamp)),
        conditions: executions[0].context
      };

      this.patterns.set(pattern.id, pattern);
      logger.debug({ patternId: pattern.id, frequency: pattern.frequency }, 'Pattern updated');
    }
  }

  /**
   * Generate a signature for context conditions
   */
  private generateContextSignature(context: any): string {
    const sorted = Object.keys(context).sort();
    const sig = sorted.map(key => `${key}=${JSON.stringify(context[key])}`).join('|');
    return Buffer.from(sig).toString('base64').substring(0, 16);
  }

  /**
   * Add a monitor condition
   */
  addMonitor(monitor: Omit<MonitorCondition, 'id'>): string {
    const id = `mon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullMonitor: MonitorCondition = {
      id,
      ...monitor,
      enabled: monitor.enabled ?? true
    };

    this.monitors.set(id, fullMonitor);

    if (fullMonitor.enabled) {
      this.startMonitor(fullMonitor);
    }

    logger.info({ monitorId: id, monitorName: monitor.name }, 'Monitor added');

    return id;
  }

  /**
   * Remove a monitor
   */
  removeMonitor(monitorId: string): boolean {
    this.stopMonitor(monitorId);
    const result = this.monitors.delete(monitorId);

    if (result) {
      logger.info({ monitorId }, 'Monitor removed');
    }

    return result;
  }

  /**
   * Enable/disable a monitor
   */
  setMonitorEnabled(monitorId: string, enabled: boolean): boolean {
    const monitor = this.monitors.get(monitorId);
    if (!monitor) return false;

    monitor.enabled = enabled;

    if (enabled) {
      this.startMonitor(monitor);
    } else {
      this.stopMonitor(monitorId);
    }

    logger.info({ monitorId, enabled }, 'Monitor enabled state changed');

    return true;
  }

  /**
   * Start a monitor
   */
  private startMonitor(monitor: MonitorCondition): void {
    // Stop if already running
    this.stopMonitor(monitor.id);

    const checkMonitor = async () => {
      try {
        const value = await monitor.checker();
        const previousValue = monitor.lastValue;
        monitor.lastValue = value;
        monitor.lastCheck = Date.now();

        let triggered = false;

        if (monitor.threshold) {
          switch (monitor.threshold.type) {
            case 'above':
              triggered = value > monitor.threshold.value;
              break;
            case 'below':
              triggered = value < monitor.threshold.value;
              break;
            case 'equals':
              triggered = value === monitor.threshold.value;
              break;
            case 'changed':
              triggered = previousValue !== undefined && value !== previousValue;
              break;
          }
        } else {
          // No threshold means any value triggers
          triggered = !!value;
        }

        if (triggered) {
          logger.info({ monitorId: monitor.id, value }, 'Monitor triggered');

          // Execute actions
          for (const action of monitor.actions) {
            const input = action.inputMapping(value);

            if (action.autoExecute) {
              // Auto-execute
              await this.executeAgent(action.agentId, action.capability, input, {
                source: `monitor:${monitor.id}`,
                confidence: 1.0
              });
            } else {
              // Create suggestion
              this.createSuggestion({
                agentId: action.agentId,
                capability: action.capability,
                input,
                reason: `Monitor "${monitor.name}" detected: ${value}`,
                confidence: action.minConfidence || 0.8
              });
            }
          }
        }
      } catch (error) {
        logger.error({ error, monitorId: monitor.id }, 'Monitor check failed');
      }
    };

    // Initial check
    checkMonitor();

    // Set interval
    const interval = setInterval(checkMonitor, monitor.interval);
    this.monitorIntervals.set(monitor.id, interval);

    logger.debug({ monitorId: monitor.id, interval: monitor.interval }, 'Monitor started');
  }

  /**
   * Stop a monitor
   */
  private stopMonitor(monitorId: string): void {
    const interval = this.monitorIntervals.get(monitorId);
    if (interval) {
      clearInterval(interval);
      this.monitorIntervals.delete(monitorId);
      logger.debug({ monitorId }, 'Monitor stopped');
    }
  }

  /**
   * Create a proactive suggestion
   */
  createSuggestion(suggestion: Omit<ProactiveSuggestion, 'id' | 'createdAt' | 'expiresAt' | 'status'>): string {
    const id = `sug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullSuggestion: ProactiveSuggestion = {
      id,
      ...suggestion,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.suggestionExpiryMs,
      status: 'pending'
    };

    // Check if auto-execute threshold met
    if (fullSuggestion.confidence >= this.config.autoExecuteThreshold) {
      fullSuggestion.status = 'auto_executed';
      this.executeAgent(
        fullSuggestion.agentId,
        fullSuggestion.capability,
        fullSuggestion.input,
        {
          source: `suggestion:${id}`,
          confidence: fullSuggestion.confidence
        }
      );
    }

    this.suggestions.set(id, fullSuggestion);

    // Limit suggestions
    if (this.suggestions.size > this.config.maxSuggestions) {
      const oldest = Array.from(this.suggestions.values())
        .filter(s => s.status === 'pending')
        .sort((a, b) => a.createdAt - b.createdAt)[0];

      if (oldest) {
        oldest.status = 'expired';
        this.suggestions.delete(oldest.id);
      }
    }

    logger.info({
      suggestionId: id,
      agentId: suggestion.agentId,
      confidence: suggestion.confidence,
      status: fullSuggestion.status
    }, 'Suggestion created');

    // Publish event
    zeroClickEventBus.publish({
      type: EventType.CUSTOM,
      source: 'proactive-agent',
      data: {
        type: 'suggestion_created',
        suggestion: fullSuggestion
      }
    });

    return id;
  }

  /**
   * Accept a suggestion
   */
  async acceptSuggestion(suggestionId: string): Promise<boolean> {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') return false;

    suggestion.status = 'accepted';

    await this.executeAgent(
      suggestion.agentId,
      suggestion.capability,
      suggestion.input,
      {
        source: `suggestion:${suggestionId}`,
        confidence: suggestion.confidence
      }
    );

    logger.info({ suggestionId }, 'Suggestion accepted and executed');

    return true;
  }

  /**
   * Reject a suggestion
   */
  rejectSuggestion(suggestionId: string): boolean {
    const suggestion = this.suggestions.get(suggestionId);
    if (!suggestion || suggestion.status !== 'pending') return false;

    suggestion.status = 'rejected';
    logger.info({ suggestionId }, 'Suggestion rejected');

    return true;
  }

  /**
   * Execute an agent
   */
  private async executeAgent(
    agentId: string,
    capability: string,
    input: any,
    metadata: { source: string; confidence: number }
  ): Promise<void> {
    const requestId = `proactive_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const context: ToolExecutionContext = {
      agentId,
      requestId,
      permissions: ['*'],
      limits: {
        maxExecutionTime: 300000
      }
    };

    logger.info({
      agentId,
      capability,
      source: metadata.source,
      confidence: metadata.confidence
    }, 'Executing proactive agent action');

    try {
      const result = await agentExecutor.executeAgent(agentId, capability, input, context);

      logger.info({
        agentId,
        capability,
        success: result.success,
        source: metadata.source
      }, 'Proactive agent execution completed');

      // Publish completion event
      await zeroClickEventBus.publish({
        type: EventType.AGENT_COMPLETION,
        source: metadata.source,
        data: {
          agentId,
          capability,
          result: result.result,
          success: result.success,
          metadata
        }
      });

    } catch (error) {
      logger.error({
        error,
        agentId,
        capability,
        source: metadata.source
      }, 'Proactive agent execution failed');
    }
  }

  /**
   * Get suggestions
   */
  getSuggestions(filter?: { status?: ProactiveSuggestion['status']; agentId?: string }): ProactiveSuggestion[] {
    let suggestions = Array.from(this.suggestions.values());

    if (filter?.status) {
      suggestions = suggestions.filter(s => s.status === filter.status);
    }

    if (filter?.agentId) {
      suggestions = suggestions.filter(s => s.agentId === filter.agentId);
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get patterns
   */
  getPatterns(): ExecutionPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Get monitors
   */
  getMonitors(filter?: { enabled?: boolean }): MonitorCondition[] {
    let monitors = Array.from(this.monitors.values());

    if (filter?.enabled !== undefined) {
      monitors = monitors.filter(m => m.enabled === filter.enabled);
    }

    return monitors;
  }

  /**
   * Clean up expired suggestions
   */
  private cleanupExpiredSuggestions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, suggestion] of this.suggestions.entries()) {
      if (suggestion.status === 'pending' && suggestion.expiresAt < now) {
        suggestion.status = 'expired';
        expired.push(id);
      }
    }

    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Cleaned up expired suggestions');
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ProactiveConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info({ config: this.config }, 'Proactive agent configuration updated');
  }

  /**
   * Get configuration
   */
  getConfig(): ProactiveConfig {
    return { ...this.config };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      patterns: this.patterns.size,
      suggestions: {
        total: this.suggestions.size,
        pending: this.getSuggestions({ status: 'pending' }).length,
        accepted: this.getSuggestions({ status: 'accepted' }).length,
        rejected: this.getSuggestions({ status: 'rejected' }).length,
        autoExecuted: this.getSuggestions({ status: 'auto_executed' }).length,
        expired: this.getSuggestions({ status: 'expired' }).length
      },
      monitors: {
        total: this.monitors.size,
        enabled: this.getMonitors({ enabled: true }).length,
        disabled: this.getMonitors({ enabled: false }).length
      },
      executionHistory: this.executionHistory.length
    };
  }
}

// Global singleton instance
export const proactiveAgentSystem = new ProactiveAgentSystem();
