/**
 * Zero-Click Automation System
 *
 * Provides event-driven automation and proactive agent suggestions
 * for the A2A MCP server.
 *
 * Features:
 * - Event bus for pub/sub messaging
 * - Event-driven automation rules
 * - Proactive agent suggestions with pattern learning
 * - Multiple event triggers (webhooks, schedules, file watching, metrics)
 * - Approval workflows for sensitive operations
 * - Agent chaining and handoffs
 */

// Core event system
export {
  zeroClickEventBus,
  EventType,
  ZeroClickEvent,
  EventHandler,
  EventSubscription,
  EventStats
} from './event-bus.js';

// Event-driven automation
export {
  eventAutomationManager,
  AutomationRule,
  PendingExecution
} from './event-automation.js';

// Proactive agents
export {
  proactiveAgentSystem,
  ExecutionPattern,
  ProactiveSuggestion,
  MonitorCondition,
  ProactiveConfig
} from './proactive-agent.js';

// Event triggers
export {
  webhookServer,
  scheduleTrigger,
  fileWatcher,
  metricMonitor,
  WebhookServer,
  ScheduleTrigger,
  FileWatcher,
  MetricMonitor
} from './event-triggers.js';

// MCP tools
export { zeroClickTools } from './zero-click-tools.js';
