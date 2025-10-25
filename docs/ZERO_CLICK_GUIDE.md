# Zero-Click Automation Guide

## Overview

The Zero-Click Automation System enables automatic, event-driven agent execution and proactive agent suggestions in your A2A MCP server. It consists of two main components:

1. **Event-Driven Automation**: Automatically trigger agents based on events
2. **Proactive Agent System**: Monitor conditions and suggest or auto-execute actions

## Table of Contents

- [Quick Start](#quick-start)
- [Event-Driven Automation](#event-driven-automation)
- [Proactive Agent System](#proactive-agent-system)
- [Event Triggers](#event-triggers)
- [MCP Tools](#mcp-tools)
- [Configuration](#configuration)
- [Examples](#examples)
- [Best Practices](#best-practices)

---

## Quick Start

### Enable Zero-Click in Your Server

```typescript
import { zeroClickTools } from './src/zero-click/index.js';
import { toolRegistry } from './src/tools.js';

// Register zero-click tools
zeroClickTools.forEach(tool => toolRegistry.register(tool));

// The system is now ready to use!
```

### Create Your First Automation Rule

```typescript
import { eventAutomationManager, EventType } from './src/zero-click/index.js';

eventAutomationManager.addRule({
  name: 'Auto-backup on file change',
  description: 'Backup database when files change',
  enabled: true,
  trigger: {
    eventType: EventType.FILE_WATCH,
    filter: (event) => event.data.filename.endsWith('.db')
  },
  action: {
    agentId: 'backup-agent',
    capability: 'create_backup',
    inputMapping: (event) => ({
      filename: event.data.filename,
      timestamp: event.timestamp
    })
  },
  approval: {
    required: false
  }
});
```

---

## Event-Driven Automation

Event-driven automation allows you to create rules that automatically trigger agents when specific events occur.

### Architecture

```
Event Source → Event Bus → Automation Rules → Agent Execution
                ↓
         Event History
         Subscriptions
```

### Event Types

| Event Type | Description | Use Case |
|------------|-------------|----------|
| `WEBHOOK` | HTTP webhook received | External integrations, CI/CD triggers |
| `SCHEDULE` | Time-based trigger | Periodic tasks, cron jobs |
| `FILE_WATCH` | File system changes | Config reloads, auto-compilation |
| `METRIC_THRESHOLD` | Metric crosses threshold | Alerts, auto-scaling |
| `AGENT_COMPLETION` | Agent finishes execution | Chaining workflows |
| `CUSTOM` | Custom events | Application-specific triggers |

### Creating Automation Rules

```typescript
const ruleId = eventAutomationManager.addRule({
  name: 'Deploy on webhook',
  description: 'Auto-deploy when webhook received',
  enabled: true,

  // Trigger configuration
  trigger: {
    eventType: EventType.WEBHOOK,
    filter: (event) => event.data.path === '/deploy',
    debounceMs: 5000 // Wait 5s before executing
  },

  // Action to perform
  action: {
    agentId: 'deployment-agent',
    capability: 'deploy_application',
    inputMapping: (event) => ({
      environment: event.data.body.environment,
      branch: event.data.body.branch
    }),
    timeout: 600000 // 10 minutes
  },

  // Approval settings
  approval: {
    required: true,
    autoApprove: (event) => {
      // Auto-approve staging deployments
      return event.data.body.environment === 'staging';
    }
  },

  // Optional chaining
  chain: {
    onSuccess: [
      // Rules to execute on success
    ],
    onFailure: [
      // Rules to execute on failure
    ]
  }
});
```

### Managing Rules

```typescript
// List all rules
const rules = eventAutomationManager.getRules();

// Filter rules
const enabledRules = eventAutomationManager.getRules({ enabled: true });
const webhookRules = eventAutomationManager.getRules({ eventType: EventType.WEBHOOK });

// Enable/disable a rule
eventAutomationManager.setRuleEnabled(ruleId, false);

// Remove a rule
eventAutomationManager.removeRule(ruleId);
```

### Approval Workflow

When a rule requires approval, it creates a pending execution:

```typescript
// Get pending executions
const pending = eventAutomationManager.getPendingExecutions();

// Approve an execution
await eventAutomationManager.approvePendingExecution(pendingId);

// Reject an execution
eventAutomationManager.rejectPendingExecution(pendingId);
```

### Agent Chaining

Chain multiple agents together for complex workflows:

```typescript
eventAutomationManager.addRule({
  name: 'Main workflow',
  // ... main rule config ...
  chain: {
    onSuccess: [
      {
        name: 'Cleanup',
        trigger: { eventType: EventType.AGENT_COMPLETION },
        action: {
          agentId: 'cleanup-agent',
          capability: 'cleanup',
          inputMapping: (event) => ({ data: event.data.result })
        },
        approval: { required: false },
        chain: {
          onSuccess: [
            // Further chaining...
          ]
        }
      }
    ],
    onFailure: [
      {
        name: 'Send alert',
        trigger: { eventType: EventType.AGENT_COMPLETION },
        action: {
          agentId: 'alert-agent',
          capability: 'send_alert',
          inputMapping: (event) => ({ error: event.data.error })
        },
        approval: { required: false }
      }
    ]
  }
});
```

---

## Proactive Agent System

The proactive agent system monitors conditions, learns patterns, and suggests or auto-executes actions.

### Features

- **Pattern Learning**: Learns from execution history
- **Confidence Scoring**: Scores suggestions based on success rate
- **Auto-Execution**: Executes high-confidence suggestions automatically
- **Condition Monitoring**: Watches system conditions continuously

### Creating Monitors

```typescript
import { proactiveAgentSystem } from './src/zero-click/index.js';

const monitorId = proactiveAgentSystem.addMonitor({
  name: 'Memory usage monitor',
  description: 'Alert when memory is high',
  enabled: true,

  // Function to check the condition
  checker: async () => {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024; // MB
  },

  // Check interval
  interval: 30000, // 30 seconds

  // Threshold configuration
  threshold: {
    type: 'above', // 'above' | 'below' | 'equals' | 'changed'
    value: 500 // 500 MB
  },

  // Actions to take when triggered
  actions: [{
    agentId: 'optimization-agent',
    capability: 'optimize_memory',
    inputMapping: (memoryMB) => ({ currentMemory: memoryMB }),
    autoExecute: false, // Create suggestion
    minConfidence: 0.8
  }]
});
```

### Handling Suggestions

```typescript
// Get pending suggestions
const suggestions = proactiveAgentSystem.getSuggestions({ status: 'pending' });

for (const suggestion of suggestions) {
  console.log(`Suggestion: ${suggestion.reason}`);
  console.log(`Confidence: ${suggestion.confidence}`);
  console.log(`Agent: ${suggestion.agentId}:${suggestion.capability}`);

  if (suggestion.confidence > 0.9) {
    // High confidence - accept it
    await proactiveAgentSystem.acceptSuggestion(suggestion.id);
  } else {
    // Low confidence - review or reject
    proactiveAgentSystem.rejectSuggestion(suggestion.id);
  }
}
```

### Pattern Learning

The system learns patterns from execution history:

```typescript
// Get learned patterns
const patterns = proactiveAgentSystem.getPatterns();

for (const pattern of patterns) {
  console.log(`Pattern: ${pattern.agentId}:${pattern.capability}`);
  console.log(`Frequency: ${pattern.frequency}`);
  console.log(`Success rate: ${pattern.successRate * 100}%`);
}
```

### Configuration

```typescript
proactiveAgentSystem.updateConfig({
  learningEnabled: true,
  minPatternOccurrences: 3, // Need 3 occurrences to learn
  minSuccessRate: 0.7, // Need 70% success rate
  autoExecuteThreshold: 0.9, // Auto-execute at 90% confidence
  suggestionExpiryMs: 3600000, // 1 hour
  maxSuggestions: 50
});
```

---

## Event Triggers

Event triggers generate events from external sources.

### Webhook Server

Receive events via HTTP webhooks:

```typescript
import { webhookServer } from './src/zero-click/index.js';

// Start the server
webhookServer.start(); // Default port: 9090

// Send webhook
// curl -X POST http://localhost:9090/deploy \
//   -H "Content-Type: application/json" \
//   -d '{"environment": "production", "version": "1.0.0"}'

// Register custom handler
webhookServer.registerHandler('/custom', async (data) => {
  console.log('Custom webhook received:', data);
});

// Stop the server
webhookServer.stop();
```

### Schedule Trigger

Create time-based events:

```typescript
import { scheduleTrigger } from './src/zero-click/index.js';

// Run every 5 minutes
scheduleTrigger.addSchedule('health-check', {
  interval: 300000, // 5 minutes in ms
  data: { type: 'health_check' }
});

// Run every hour
scheduleTrigger.addSchedule('cleanup', {
  interval: 3600000, // 1 hour
  data: { type: 'cleanup' }
});

// Remove schedule
scheduleTrigger.removeSchedule('health-check');
```

### File Watcher

Monitor file system changes:

```typescript
import { fileWatcher } from './src/zero-click/index.js';

// Watch a directory
fileWatcher.watch('config-watch', './config', {
  recursive: true,
  filter: (filename) => filename.endsWith('.json')
});

// Watch a specific file
fileWatcher.watch('env-watch', './.env');

// Stop watching
fileWatcher.unwatch('config-watch');
```

### Metric Monitor

Monitor system metrics:

```typescript
import { metricMonitor } from './src/zero-click/index.js';

// Monitor memory
metricMonitor.monitor('memory-check', {
  metric: async () => {
    const usage = process.memoryUsage();
    return usage.heapUsed / 1024 / 1024;
  },
  threshold: 500,
  type: 'above',
  interval: 30000
});

// Monitor CPU (example)
metricMonitor.monitor('cpu-check', {
  metric: async () => {
    // Your CPU check logic
    return getCpuUsage();
  },
  threshold: 80,
  type: 'above',
  interval: 60000
});

// Stop monitoring
metricMonitor.stopMonitoring('memory-check');
```

---

## MCP Tools

The zero-click system provides MCP tools for integration with Claude and other clients.

### Event Bus Tools

- `zero_click_publish_event` - Publish custom events
- `zero_click_get_event_history` - Get event history
- `zero_click_get_event_stats` - Get event statistics

### Automation Tools

- `zero_click_add_automation_rule` - Add automation rule
- `zero_click_remove_automation_rule` - Remove automation rule
- `zero_click_list_automation_rules` - List all rules
- `zero_click_approve_pending_execution` - Approve pending execution
- `zero_click_reject_pending_execution` - Reject pending execution
- `zero_click_list_pending_executions` - List pending executions

### Proactive Tools

- `zero_click_add_monitor` - Add proactive monitor
- `zero_click_remove_monitor` - Remove monitor
- `zero_click_list_monitors` - List all monitors
- `zero_click_get_suggestions` - Get proactive suggestions
- `zero_click_accept_suggestion` - Accept a suggestion
- `zero_click_reject_suggestion` - Reject a suggestion
- `zero_click_get_patterns` - Get learned patterns
- `zero_click_get_proactive_stats` - Get proactive statistics

### Trigger Tools

- `zero_click_start_webhook_server` - Start webhook server
- `zero_click_stop_webhook_server` - Stop webhook server
- `zero_click_add_schedule` - Add scheduled trigger
- `zero_click_remove_schedule` - Remove schedule
- `zero_click_watch_file` - Watch file/directory
- `zero_click_unwatch_file` - Stop watching file
- `zero_click_monitor_metric` - Monitor metric
- `zero_click_stop_monitoring_metric` - Stop monitoring metric

### Configuration Tools

- `zero_click_load_rules_from_file` - Load rules from JSON
- `zero_click_save_rules_to_file` - Save rules to JSON

---

## Configuration

### Configuration File Format

```json
{
  "rules": [
    {
      "name": "Rule name",
      "description": "Description",
      "enabled": true,
      "trigger": {
        "eventType": "webhook",
        "filter": "(event) => event.data.path === '/deploy'",
        "debounceMs": 5000
      },
      "action": {
        "agentId": "agent-id",
        "capability": "capability-name",
        "inputMapping": "(event) => ({ data: event.data })"
      },
      "approval": {
        "required": false
      }
    }
  ]
}
```

### Loading Configuration

```typescript
// Load from file
const result = await eventAutomationManager.loadRulesFromFile('./config.json');
console.log(`Loaded ${result.loaded} rules`);
console.log(`Errors: ${result.errors.join(', ')}`);

// Save to file
await eventAutomationManager.saveRulesToFile('./config.json');
```

---

## Examples

### Example 1: CI/CD Pipeline

```typescript
// Trigger deployment on webhook
eventAutomationManager.addRule({
  name: 'Deploy on webhook',
  trigger: {
    eventType: EventType.WEBHOOK,
    filter: (e) => e.data.path === '/deploy'
  },
  action: {
    agentId: 'deployment-agent',
    capability: 'deploy',
    inputMapping: (e) => ({
      env: e.data.body.environment,
      version: e.data.body.version
    })
  },
  approval: {
    required: true,
    autoApprove: (e) => e.data.body.environment !== 'production'
  },
  chain: {
    onSuccess: [{
      name: 'Run tests',
      trigger: { eventType: EventType.AGENT_COMPLETION },
      action: {
        agentId: 'test-agent',
        capability: 'run_tests',
        inputMapping: (e) => ({ env: e.data.result.environment })
      },
      approval: { required: false }
    }]
  }
});
```

### Example 2: Auto-Scaling

```typescript
// Monitor CPU and auto-scale
proactiveAgentSystem.addMonitor({
  name: 'CPU auto-scaler',
  checker: async () => getCpuUsage(),
  interval: 60000,
  threshold: { type: 'above', value: 80 },
  actions: [{
    agentId: 'scaling-agent',
    capability: 'scale_up',
    inputMapping: (cpu) => ({ currentCpu: cpu }),
    autoExecute: true
  }]
});
```

### Example 3: Config Reloader

```typescript
// Watch config files and reload
fileWatcher.watch('config', './config', { recursive: true });

eventAutomationManager.addRule({
  name: 'Reload config',
  trigger: {
    eventType: EventType.FILE_WATCH,
    filter: (e) => e.data.filename.endsWith('.json')
  },
  action: {
    agentId: 'config-agent',
    capability: 'reload_config',
    inputMapping: (e) => ({ file: e.data.filename })
  },
  approval: { required: false }
});
```

---

## Best Practices

### Security

1. **Validate Event Data**: Always validate and sanitize event data
2. **Use Approval Workflows**: Require approval for sensitive operations
3. **Limit Permissions**: Only grant necessary permissions to automation rules
4. **Filter Events**: Use filter functions to process only relevant events

### Performance

1. **Use Debouncing**: Prevent rapid-fire executions with debounceMs
2. **Set Timeouts**: Configure appropriate execution timeouts
3. **Limit History**: Event history is limited to prevent memory issues
4. **Monitor Resources**: Watch system resources with proactive monitors

### Reliability

1. **Handle Errors**: Implement error handling in input mappings
2. **Use Chaining**: Chain cleanup/rollback operations
3. **Test Rules**: Test automation rules before enabling in production
4. **Monitor Execution**: Track execution statistics and patterns

### Maintainability

1. **Document Rules**: Add clear descriptions to all rules
2. **Use Configuration Files**: Store rules in version-controlled files
3. **Name Conventions**: Use consistent naming for rules and monitors
4. **Regular Cleanup**: Remove unused rules and monitors

---

## Troubleshooting

### Events Not Triggering

- Check if the rule is enabled
- Verify the event type matches
- Test the filter function
- Check event history to see if events are being published

### Suggestions Not Appearing

- Ensure learning is enabled
- Check if patterns meet minimum occurrences
- Verify success rate meets threshold
- Review proactive system configuration

### High Memory Usage

- Reduce event history size
- Limit number of active suggestions
- Clear old patterns periodically
- Monitor execution history size

---

## API Reference

For complete API documentation, see:

- [Event Bus API](../src/zero-click/event-bus.ts)
- [Event Automation API](../src/zero-click/event-automation.ts)
- [Proactive Agent API](../src/zero-click/proactive-agent.ts)
- [Event Triggers API](../src/zero-click/event-triggers.ts)

---

## Support

For issues, questions, or contributions:

- **Issues**: [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Scarmonit/A2A/discussions)
- **Documentation**: [A2A Documentation](../README.md)
