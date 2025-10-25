import { agentRegistry } from '../agents.js';
import { agentExecutor } from '../agent-executor.js';
import { zeroClickEventBus, EventType, ZeroClickEvent } from './event-bus.js';
import { ToolExecutionContext } from '../tools.js';
import pino from 'pino';
import * as fs from 'fs/promises';
import * as path from 'path';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'event-automation' } });

/**
 * Automation rule that maps events to agent execution
 */
export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;

  // Event trigger configuration
  trigger: {
    eventType: EventType;
    filter?: (event: ZeroClickEvent) => boolean;
    debounceMs?: number; // Prevent rapid-fire triggers
  };

  // Agent execution configuration
  action: {
    agentId: string;
    capability: string;
    inputMapping: (event: ZeroClickEvent) => any; // Map event data to agent input
    timeout?: number;
  };

  // Chain configuration (optional)
  chain?: {
    onSuccess?: AutomationRule[];
    onFailure?: AutomationRule[];
  };

  // Approval settings
  approval: {
    required: boolean;
    autoApprove?: (event: ZeroClickEvent) => boolean;
  };

  // Execution tracking
  stats: {
    totalTriggers: number;
    successfulExecutions: number;
    failedExecutions: number;
    lastTrigger?: number;
    lastExecution?: number;
  };
}

/**
 * Execution request pending approval
 */
export interface PendingExecution {
  id: string;
  ruleId: string;
  event: ZeroClickEvent;
  agentId: string;
  capability: string;
  input: any;
  createdAt: number;
  expiresAt: number;
}

/**
 * Event-driven automation manager
 * Automatically triggers agents based on events
 */
export class EventAutomationManager {
  private rules = new Map<string, AutomationRule>();
  private pendingExecutions = new Map<string, PendingExecution>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private subscriptionIds = new Map<string, string>(); // ruleId -> subscriptionId

  constructor() {
    // Clean up expired pending executions periodically
    setInterval(() => this.cleanupExpiredExecutions(), 60000);
  }

  /**
   * Add an automation rule
   */
  addRule(rule: Omit<AutomationRule, 'id' | 'stats'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullRule: AutomationRule = {
      id,
      ...rule,
      enabled: rule.enabled ?? true,
      stats: {
        totalTriggers: 0,
        successfulExecutions: 0,
        failedExecutions: 0
      }
    };

    this.rules.set(id, fullRule);

    // Subscribe to events if rule is enabled
    if (fullRule.enabled) {
      this.subscribeRule(fullRule);
    }

    logger.info({ ruleId: id, ruleName: rule.name }, 'Automation rule added');

    return id;
  }

  /**
   * Remove an automation rule
   */
  removeRule(ruleId: string): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    // Unsubscribe from events
    this.unsubscribeRule(ruleId);

    // Remove rule
    this.rules.delete(ruleId);

    logger.info({ ruleId }, 'Automation rule removed');

    return true;
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.get(ruleId);
    if (!rule) return false;

    rule.enabled = enabled;

    if (enabled) {
      this.subscribeRule(rule);
    } else {
      this.unsubscribeRule(ruleId);
    }

    logger.info({ ruleId, enabled }, 'Rule enabled state changed');

    return true;
  }

  /**
   * Subscribe a rule to the event bus
   */
  private subscribeRule(rule: AutomationRule): void {
    // Unsubscribe if already subscribed
    this.unsubscribeRule(rule.id);

    const subscriptionId = zeroClickEventBus.subscribe({
      eventType: rule.trigger.eventType,
      filter: rule.trigger.filter,
      handler: async (event) => {
        await this.handleEvent(rule, event);
      },
      enabled: true
    });

    this.subscriptionIds.set(rule.id, subscriptionId);
    logger.debug({ ruleId: rule.id, subscriptionId }, 'Rule subscribed to events');
  }

  /**
   * Unsubscribe a rule from the event bus
   */
  private unsubscribeRule(ruleId: string): void {
    const subscriptionId = this.subscriptionIds.get(ruleId);
    if (subscriptionId) {
      zeroClickEventBus.unsubscribe(subscriptionId);
      this.subscriptionIds.delete(ruleId);
      logger.debug({ ruleId, subscriptionId }, 'Rule unsubscribed from events');
    }
  }

  /**
   * Handle an event for a rule
   */
  private async handleEvent(rule: AutomationRule, event: ZeroClickEvent): Promise<void> {
    logger.info({ ruleId: rule.id, eventId: event.id }, 'Rule triggered by event');

    // Update stats
    rule.stats.totalTriggers++;
    rule.stats.lastTrigger = Date.now();

    // Handle debouncing
    if (rule.trigger.debounceMs) {
      const existingTimer = this.debounceTimers.get(rule.id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(async () => {
        this.debounceTimers.delete(rule.id);
        await this.executeRule(rule, event);
      }, rule.trigger.debounceMs);

      this.debounceTimers.set(rule.id, timer);
      return;
    }

    // Execute immediately
    await this.executeRule(rule, event);
  }

  /**
   * Execute a rule
   */
  private async executeRule(rule: AutomationRule, event: ZeroClickEvent): Promise<void> {
    try {
      // Map event data to agent input
      const input = rule.action.inputMapping(event);

      // Check if approval is required
      if (rule.approval.required) {
        const autoApprove = rule.approval.autoApprove?.(event) ?? false;

        if (!autoApprove) {
          // Create pending execution
          const pendingId = this.createPendingExecution(rule, event, input);
          logger.info({ ruleId: rule.id, pendingId }, 'Execution pending approval');
          return;
        }
      }

      // Execute agent
      await this.executeAgent(rule, event, input);

    } catch (error) {
      logger.error({ error, ruleId: rule.id, eventId: event.id }, 'Rule execution failed');
      rule.stats.failedExecutions++;
    }
  }

  /**
   * Execute the agent
   */
  private async executeAgent(rule: AutomationRule, event: ZeroClickEvent, input: any): Promise<void> {
    const context: ToolExecutionContext = {
      agentId: rule.action.agentId,
      requestId: event.id,
      permissions: ['*'], // Full permissions for automated execution
      limits: {
        maxExecutionTime: rule.action.timeout || 300000 // 5 minutes default
      }
    };

    logger.info({
      ruleId: rule.id,
      agentId: rule.action.agentId,
      capability: rule.action.capability
    }, 'Executing agent');

    try {
      const result = await agentExecutor.executeAgent(
        rule.action.agentId,
        rule.action.capability,
        input,
        context
      );

      rule.stats.lastExecution = Date.now();

      if (result.success) {
        rule.stats.successfulExecutions++;
        logger.info({ ruleId: rule.id, result }, 'Agent execution successful');

        // Publish completion event for chaining
        await zeroClickEventBus.publish({
          type: EventType.AGENT_COMPLETION,
          source: `rule:${rule.id}`,
          data: {
            ruleId: rule.id,
            agentId: rule.action.agentId,
            capability: rule.action.capability,
            result: result.result,
            originalEvent: event
          }
        });

        // Execute success chain
        if (rule.chain?.onSuccess) {
          for (const chainedRule of rule.chain.onSuccess) {
            await this.executeRule(chainedRule, event);
          }
        }
      } else {
        rule.stats.failedExecutions++;
        logger.error({ ruleId: rule.id, error: result.error }, 'Agent execution failed');

        // Execute failure chain
        if (rule.chain?.onFailure) {
          for (const chainedRule of rule.chain.onFailure) {
            await this.executeRule(chainedRule, event);
          }
        }
      }
    } catch (error) {
      rule.stats.failedExecutions++;
      logger.error({ error, ruleId: rule.id }, 'Agent execution threw error');
    }
  }

  /**
   * Create a pending execution
   */
  private createPendingExecution(rule: AutomationRule, event: ZeroClickEvent, input: any): string {
    const id = `pend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pending: PendingExecution = {
      id,
      ruleId: rule.id,
      event,
      agentId: rule.action.agentId,
      capability: rule.action.capability,
      input,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000 // 1 hour
    };

    this.pendingExecutions.set(id, pending);
    return id;
  }

  /**
   * Approve a pending execution
   */
  async approvePendingExecution(pendingId: string): Promise<boolean> {
    const pending = this.pendingExecutions.get(pendingId);
    if (!pending) return false;

    const rule = this.rules.get(pending.ruleId);
    if (!rule) return false;

    // Remove from pending
    this.pendingExecutions.delete(pendingId);

    // Execute
    await this.executeAgent(rule, pending.event, pending.input);

    return true;
  }

  /**
   * Reject a pending execution
   */
  rejectPendingExecution(pendingId: string): boolean {
    return this.pendingExecutions.delete(pendingId);
  }

  /**
   * Get pending executions
   */
  getPendingExecutions(): PendingExecution[] {
    return Array.from(this.pendingExecutions.values());
  }

  /**
   * Clean up expired pending executions
   */
  private cleanupExpiredExecutions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, pending] of this.pendingExecutions.entries()) {
      if (pending.expiresAt < now) {
        expired.push(id);
      }
    }

    expired.forEach(id => this.pendingExecutions.delete(id));

    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Cleaned up expired pending executions');
    }
  }

  /**
   * Get all rules
   */
  getRules(filter?: { enabled?: boolean; eventType?: EventType }): AutomationRule[] {
    let rules = Array.from(this.rules.values());

    if (filter?.enabled !== undefined) {
      rules = rules.filter(r => r.enabled === filter.enabled);
    }

    if (filter?.eventType) {
      rules = rules.filter(r => r.trigger.eventType === filter.eventType);
    }

    return rules;
  }

  /**
   * Get a rule by ID
   */
  getRule(ruleId: string): AutomationRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Load rules from a configuration file
   */
  async loadRulesFromFile(filePath: string): Promise<{ loaded: number; errors: string[] }> {
    const result = { loaded: 0, errors: [] as string[] };

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);

      if (!Array.isArray(config.rules)) {
        result.errors.push('Configuration file must contain a "rules" array');
        return result;
      }

      for (const ruleConfig of config.rules) {
        try {
          // Convert serialized functions
          if (typeof ruleConfig.trigger.filter === 'string') {
            ruleConfig.trigger.filter = eval(`(${ruleConfig.trigger.filter})`);
          }
          if (typeof ruleConfig.action.inputMapping === 'string') {
            ruleConfig.action.inputMapping = eval(`(${ruleConfig.action.inputMapping})`);
          }
          if (typeof ruleConfig.approval.autoApprove === 'string') {
            ruleConfig.approval.autoApprove = eval(`(${ruleConfig.approval.autoApprove})`);
          }

          this.addRule(ruleConfig);
          result.loaded++;
        } catch (error) {
          result.errors.push(`Failed to load rule ${ruleConfig.name}: ${error}`);
        }
      }

      logger.info({ filePath, loaded: result.loaded, errors: result.errors.length }, 'Rules loaded from file');

    } catch (error) {
      result.errors.push(`Failed to read configuration file: ${error}`);
    }

    return result;
  }

  /**
   * Save rules to a configuration file
   */
  async saveRulesToFile(filePath: string): Promise<boolean> {
    try {
      const rules = Array.from(this.rules.values()).map(rule => ({
        ...rule,
        trigger: {
          ...rule.trigger,
          filter: rule.trigger.filter?.toString()
        },
        action: {
          ...rule.action,
          inputMapping: rule.action.inputMapping.toString()
        },
        approval: {
          ...rule.approval,
          autoApprove: rule.approval.autoApprove?.toString()
        }
      }));

      const config = { rules };
      await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8');

      logger.info({ filePath, ruleCount: rules.length }, 'Rules saved to file');
      return true;
    } catch (error) {
      logger.error({ error, filePath }, 'Failed to save rules to file');
      return false;
    }
  }
}

// Global singleton instance
export const eventAutomationManager = new EventAutomationManager();
