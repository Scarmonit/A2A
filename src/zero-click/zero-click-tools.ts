import { ToolDescriptor, ToolParameter, ToolExecutionContext, ToolResult } from '../tools.js';
import { zeroClickEventBus, EventType } from './event-bus.js';
import { eventAutomationManager } from './event-automation.js';
import { proactiveAgentSystem } from './proactive-agent.js';
import { webhookServer, scheduleTrigger, fileWatcher, metricMonitor } from './event-triggers.js';

/**
 * Zero-click tool registry
 * MCP tools for managing zero-click automation
 */
export const zeroClickTools: ToolDescriptor[] = [
  // Event Bus Tools
  {
    name: 'zero_click_publish_event',
    description: 'Publish a custom event to the zero-click event bus',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'type', type: 'string', description: 'Event type (webhook, schedule, file_watch, metric_threshold, agent_completion, custom)', required: true },
      { name: 'source', type: 'string', description: 'Event source identifier', required: true },
      { name: 'data', type: 'object', description: 'Event data payload', required: true }
    ],
    handler: async (params) => {
      await zeroClickEventBus.publish({
        type: params.type as EventType,
        source: params.source,
        data: params.data
      });
      return { success: true, message: 'Event published' };
    }
  },

  {
    name: 'zero_click_get_event_history',
    description: 'Get event history from the event bus',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'type', type: 'string', description: 'Filter by event type (optional)' },
      { name: 'since', type: 'number', description: 'Filter events since timestamp (optional)' },
      { name: 'limit', type: 'number', description: 'Maximum number of events to return (optional)' }
    ],
    handler: async (params) => {
      const history = zeroClickEventBus.getHistory({
        type: params.type as EventType,
        since: params.since,
        limit: params.limit
      });
      return { success: true, events: history };
    }
  },

  {
    name: 'zero_click_get_event_stats',
    description: 'Get statistics about events',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [],
    handler: async () => {
      const stats = zeroClickEventBus.getStats();
      return { success: true, stats };
    }
  },

  // Automation Rules Tools
  {
    name: 'zero_click_add_automation_rule',
    description: 'Add an automation rule that triggers agents based on events',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'name', type: 'string', description: 'Rule name', required: true },
      { name: 'description', type: 'string', description: 'Rule description' },
      { name: 'eventType', type: 'string', description: 'Event type to trigger on', required: true },
      { name: 'agentId', type: 'string', description: 'Agent ID to execute', required: true },
      { name: 'capability', type: 'string', description: 'Agent capability to invoke', required: true },
      { name: 'inputMapping', type: 'string', description: 'JavaScript function to map event data to agent input', required: true },
      { name: 'debounceMs', type: 'number', description: 'Debounce time in milliseconds' },
      { name: 'requireApproval', type: 'boolean', description: 'Whether approval is required before execution' },
      { name: 'autoApprove', type: 'string', description: 'JavaScript function to auto-approve certain events' },
      { name: 'enabled', type: 'boolean', description: 'Whether the rule is enabled (default: true)' }
    ],
    handler: async (params) => {
      const inputMapping = eval(`(${params.inputMapping})`);
      const autoApprove = params.autoApprove ? eval(`(${params.autoApprove})`) : undefined;

      const ruleId = eventAutomationManager.addRule({
        name: params.name,
        description: params.description,
        enabled: params.enabled ?? true,
        trigger: {
          eventType: params.eventType as EventType,
          debounceMs: params.debounceMs
        },
        action: {
          agentId: params.agentId,
          capability: params.capability,
          inputMapping
        },
        approval: {
          required: params.requireApproval ?? false,
          autoApprove
        }
      });

      return { success: true, ruleId };
    }
  },

  {
    name: 'zero_click_remove_automation_rule',
    description: 'Remove an automation rule',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'ruleId', type: 'string', description: 'Rule ID', required: true }
    ],
    handler: async (params) => {
      const result = eventAutomationManager.removeRule(params.ruleId);
      return { success: result };
    }
  },

  {
    name: 'zero_click_list_automation_rules',
    description: 'List all automation rules',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'enabled', type: 'boolean', description: 'Filter by enabled state' },
      { name: 'eventType', type: 'string', description: 'Filter by event type' }
    ],
    handler: async (params) => {
      const rules = eventAutomationManager.getRules({
        enabled: params.enabled,
        eventType: params.eventType as EventType
      });
      return { success: true, rules };
    }
  },

  {
    name: 'zero_click_approve_pending_execution',
    description: 'Approve a pending agent execution',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'pendingId', type: 'string', description: 'Pending execution ID', required: true }
    ],
    handler: async (params) => {
      const result = await eventAutomationManager.approvePendingExecution(params.pendingId);
      return { success: result };
    }
  },

  {
    name: 'zero_click_reject_pending_execution',
    description: 'Reject a pending agent execution',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'pendingId', type: 'string', description: 'Pending execution ID', required: true }
    ],
    handler: async (params) => {
      const result = eventAutomationManager.rejectPendingExecution(params.pendingId);
      return { success: result };
    }
  },

  {
    name: 'zero_click_list_pending_executions',
    description: 'List all pending executions awaiting approval',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [],
    handler: async () => {
      const pending = eventAutomationManager.getPendingExecutions();
      return { success: true, pending };
    }
  },

  // Proactive Agent Tools
  {
    name: 'zero_click_add_monitor',
    description: 'Add a proactive monitor that watches system conditions',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'name', type: 'string', description: 'Monitor name', required: true },
      { name: 'description', type: 'string', description: 'Monitor description' },
      { name: 'checker', type: 'string', description: 'JavaScript function that returns the value to monitor', required: true },
      { name: 'interval', type: 'number', description: 'Check interval in milliseconds', required: true },
      { name: 'thresholdType', type: 'string', description: 'Threshold type: above, below, equals, changed' },
      { name: 'thresholdValue', type: 'string', description: 'Threshold value' },
      { name: 'agentId', type: 'string', description: 'Agent ID to execute when triggered', required: true },
      { name: 'capability', type: 'string', description: 'Agent capability to invoke', required: true },
      { name: 'inputMapping', type: 'string', description: 'JavaScript function to map monitored value to agent input', required: true },
      { name: 'autoExecute', type: 'boolean', description: 'Whether to auto-execute or create suggestion', required: true },
      { name: 'enabled', type: 'boolean', description: 'Whether the monitor is enabled (default: true)' }
    ],
    handler: async (params) => {
      const checker = eval(`(${params.checker})`);
      const inputMapping = eval(`(${params.inputMapping})`);

      const monitorId = proactiveAgentSystem.addMonitor({
        name: params.name,
        description: params.description,
        enabled: params.enabled ?? true,
        checker,
        interval: params.interval,
        threshold: params.thresholdType ? {
          type: params.thresholdType as 'above' | 'below' | 'equals' | 'changed',
          value: params.thresholdValue
        } : undefined,
        actions: [{
          agentId: params.agentId,
          capability: params.capability,
          inputMapping,
          autoExecute: params.autoExecute
        }]
      });

      return { success: true, monitorId };
    }
  },

  {
    name: 'zero_click_remove_monitor',
    description: 'Remove a proactive monitor',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'monitorId', type: 'string', description: 'Monitor ID', required: true }
    ],
    handler: async (params) => {
      const result = proactiveAgentSystem.removeMonitor(params.monitorId);
      return { success: result };
    }
  },

  {
    name: 'zero_click_list_monitors',
    description: 'List all proactive monitors',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'enabled', type: 'boolean', description: 'Filter by enabled state' }
    ],
    handler: async (params) => {
      const monitors = proactiveAgentSystem.getMonitors({ enabled: params.enabled });
      return { success: true, monitors };
    }
  },

  {
    name: 'zero_click_get_suggestions',
    description: 'Get proactive agent suggestions',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'status', type: 'string', description: 'Filter by status: pending, accepted, rejected, auto_executed, expired' },
      { name: 'agentId', type: 'string', description: 'Filter by agent ID' }
    ],
    handler: async (params) => {
      const suggestions = proactiveAgentSystem.getSuggestions({
        status: params.status as any,
        agentId: params.agentId
      });
      return { success: true, suggestions };
    }
  },

  {
    name: 'zero_click_accept_suggestion',
    description: 'Accept and execute a proactive suggestion',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'suggestionId', type: 'string', description: 'Suggestion ID', required: true }
    ],
    handler: async (params) => {
      const result = await proactiveAgentSystem.acceptSuggestion(params.suggestionId);
      return { success: result };
    }
  },

  {
    name: 'zero_click_reject_suggestion',
    description: 'Reject a proactive suggestion',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'suggestionId', type: 'string', description: 'Suggestion ID', required: true }
    ],
    handler: async (params) => {
      const result = proactiveAgentSystem.rejectSuggestion(params.suggestionId);
      return { success: result };
    }
  },

  {
    name: 'zero_click_get_patterns',
    description: 'Get learned execution patterns',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [],
    handler: async () => {
      const patterns = proactiveAgentSystem.getPatterns();
      return { success: true, patterns };
    }
  },

  {
    name: 'zero_click_get_proactive_stats',
    description: 'Get statistics about the proactive system',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [],
    handler: async () => {
      const stats = proactiveAgentSystem.getStats();
      return { success: true, stats };
    }
  },

  // Event Trigger Tools
  {
    name: 'zero_click_start_webhook_server',
    description: 'Start the webhook server to receive external events',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [],
    handler: async () => {
      webhookServer.start();
      return { success: true, message: 'Webhook server started' };
    }
  },

  {
    name: 'zero_click_stop_webhook_server',
    description: 'Stop the webhook server',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [],
    handler: async () => {
      webhookServer.stop();
      return { success: true, message: 'Webhook server stopped' };
    }
  },

  {
    name: 'zero_click_add_schedule',
    description: 'Add a scheduled event trigger',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'id', type: 'string', description: 'Schedule ID', required: true },
      { name: 'interval', type: 'number', description: 'Interval in milliseconds', required: true },
      { name: 'data', type: 'object', description: 'Data to include in events' }
    ],
    handler: async (params) => {
      scheduleTrigger.addSchedule(params.id, {
        interval: params.interval,
        data: params.data
      });
      return { success: true };
    }
  },

  {
    name: 'zero_click_remove_schedule',
    description: 'Remove a scheduled event trigger',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'id', type: 'string', description: 'Schedule ID', required: true }
    ],
    handler: async (params) => {
      const result = scheduleTrigger.removeSchedule(params.id);
      return { success: result };
    }
  },

  {
    name: 'zero_click_watch_file',
    description: 'Watch a file or directory for changes',
    category: 'zero-click',
    permissions: ['automation', 'filesystem:read'],
    parameters: [
      { name: 'id', type: 'string', description: 'Watcher ID', required: true },
      { name: 'path', type: 'string', description: 'File or directory path to watch', required: true },
      { name: 'recursive', type: 'boolean', description: 'Watch recursively (for directories)' }
    ],
    handler: async (params) => {
      fileWatcher.watch(params.id, params.path, {
        recursive: params.recursive
      });
      return { success: true };
    }
  },

  {
    name: 'zero_click_unwatch_file',
    description: 'Stop watching a file or directory',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'id', type: 'string', description: 'Watcher ID', required: true }
    ],
    handler: async (params) => {
      const result = fileWatcher.unwatch(params.id);
      return { success: result };
    }
  },

  {
    name: 'zero_click_monitor_metric',
    description: 'Monitor a system metric and trigger events when thresholds are crossed',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'id', type: 'string', description: 'Monitor ID', required: true },
      { name: 'metric', type: 'string', description: 'JavaScript function that returns the metric value', required: true },
      { name: 'threshold', type: 'number', description: 'Threshold value', required: true },
      { name: 'type', type: 'string', description: 'Threshold type: above or below', required: true },
      { name: 'interval', type: 'number', description: 'Check interval in milliseconds', required: true }
    ],
    handler: async (params) => {
      const metric = eval(`(${params.metric})`);
      metricMonitor.monitor(params.id, {
        metric,
        threshold: params.threshold,
        type: params.type as 'above' | 'below',
        interval: params.interval
      });
      return { success: true };
    }
  },

  {
    name: 'zero_click_stop_monitoring_metric',
    description: 'Stop monitoring a metric',
    category: 'zero-click',
    permissions: ['automation'],
    parameters: [
      { name: 'id', type: 'string', description: 'Monitor ID', required: true }
    ],
    handler: async (params) => {
      const result = metricMonitor.stopMonitoring(params.id);
      return { success: result };
    }
  },

  // Configuration Tools
  {
    name: 'zero_click_load_rules_from_file',
    description: 'Load automation rules from a configuration file',
    category: 'zero-click',
    permissions: ['automation', 'filesystem:read'],
    parameters: [
      { name: 'filePath', type: 'string', description: 'Path to configuration file', required: true }
    ],
    handler: async (params) => {
      const result = await eventAutomationManager.loadRulesFromFile(params.filePath);
      return { success: true, ...result };
    }
  },

  {
    name: 'zero_click_save_rules_to_file',
    description: 'Save automation rules to a configuration file',
    category: 'zero-click',
    permissions: ['automation', 'filesystem:write'],
    parameters: [
      { name: 'filePath', type: 'string', description: 'Path to save configuration file', required: true }
    ],
    handler: async (params) => {
      const result = await eventAutomationManager.saveRulesToFile(params.filePath);
      return { success: result };
    }
  }
];
