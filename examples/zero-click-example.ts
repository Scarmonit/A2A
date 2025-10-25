/**
 * Zero-Click Automation System Example
 *
 * This example demonstrates how to use the zero-click automation features:
 * 1. Event-driven automation with rules
 * 2. Proactive agent suggestions with monitoring
 * 3. Event triggers (webhooks, schedules, file watching)
 */

import {
  zeroClickEventBus,
  eventAutomationManager,
  proactiveAgentSystem,
  webhookServer,
  scheduleTrigger,
  fileWatcher,
  metricMonitor,
  EventType
} from '../src/zero-click/index.js';

async function main() {
  console.log('=== Zero-Click Automation Example ===\n');

  // ====================================
  // 1. EVENT-DRIVEN AUTOMATION
  // ====================================
  console.log('1. Setting up event-driven automation...\n');

  // Add a rule that triggers when a webhook is received
  const webhookRuleId = eventAutomationManager.addRule({
    name: 'Process webhook data',
    description: 'Process data received from webhooks',
    enabled: true,
    trigger: {
      eventType: EventType.WEBHOOK,
      filter: (event) => event.data.path === '/data',
      debounceMs: 2000 // Wait 2 seconds before processing
    },
    action: {
      agentId: 'data-processing-agent',
      capability: 'process_data',
      inputMapping: (event) => ({
        data: event.data.body,
        headers: event.data.headers,
        timestamp: event.timestamp
      })
    },
    approval: {
      required: true,
      autoApprove: (event) => {
        // Auto-approve if data size is small
        const dataSize = JSON.stringify(event.data.body).length;
        return dataSize < 1000;
      }
    }
  });

  console.log(`Created webhook rule: ${webhookRuleId}\n`);

  // Add a rule that triggers on file changes
  const fileWatchRuleId = eventAutomationManager.addRule({
    name: 'Backup on file change',
    description: 'Automatically backup when important files change',
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
        path: event.data.path
      })
    },
    approval: {
      required: false // Auto-execute backups
    }
  });

  console.log(`Created file watch rule: ${fileWatchRuleId}\n`);

  // Add a deployment rule
  const deploymentRuleId = eventAutomationManager.addRule({
    name: 'Deployment pipeline',
    description: 'Deploy application',
    enabled: true,
    trigger: {
      eventType: EventType.CUSTOM,
      filter: (event) => event.data.action === 'deploy'
    },
    action: {
      agentId: 'deployment-agent',
      capability: 'deploy',
      inputMapping: (event) => ({
        environment: event.data.environment,
        version: event.data.version
      })
    },
    approval: {
      required: true,
      autoApprove: (event) => event.data.environment === 'staging'
    }
  });

  console.log(`Created deployment rule: ${deploymentRuleId}\n`);

  // ====================================
  // 2. PROACTIVE AGENT SYSTEM
  // ====================================
  console.log('2. Setting up proactive monitoring...\n');

  // Add a monitor for memory usage
  const memoryMonitorId = proactiveAgentSystem.addMonitor({
    name: 'Memory usage monitor',
    description: 'Monitor memory usage and alert when high',
    enabled: true,
    checker: async () => {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024; // MB
    },
    interval: 30000, // Check every 30 seconds
    threshold: {
      type: 'above',
      value: 500 // 500 MB
    },
    actions: [{
      agentId: 'alert-agent',
      capability: 'send_alert',
      inputMapping: (memoryMB) => ({
        alert: 'High memory usage',
        value: memoryMB,
        unit: 'MB'
      }),
      autoExecute: false, // Create suggestion instead
      minConfidence: 0.8
    }]
  });

  console.log(`Created memory monitor: ${memoryMonitorId}\n`);

  // Add a monitor for CPU usage
  const cpuMonitorId = proactiveAgentSystem.addMonitor({
    name: 'CPU usage monitor',
    description: 'Monitor CPU and optimize when high',
    enabled: true,
    checker: async () => {
      // Simulate CPU check
      return Math.random() * 100;
    },
    interval: 60000, // Check every minute
    threshold: {
      type: 'above',
      value: 80 // 80%
    },
    actions: [{
      agentId: 'optimization-agent',
      capability: 'optimize_performance',
      inputMapping: (cpuPercent) => ({
        metric: 'cpu',
        value: cpuPercent
      }),
      autoExecute: true, // Auto-execute optimization
      minConfidence: 0.9
    }]
  });

  console.log(`Created CPU monitor: ${cpuMonitorId}\n`);

  // ====================================
  // 3. EVENT TRIGGERS
  // ====================================
  console.log('3. Setting up event triggers...\n');

  // Start webhook server
  webhookServer.start();
  console.log('Webhook server started (port 9090)\n');

  // Add a scheduled event (every 5 minutes)
  scheduleTrigger.addSchedule('health-check', {
    interval: 300000, // 5 minutes
    data: {
      type: 'scheduled_health_check'
    }
  });
  console.log('Added health check schedule (every 5 minutes)\n');

  // Watch a directory for changes
  fileWatcher.watch('config-watch', './config', {
    recursive: true,
    filter: (filename) => filename.endsWith('.json')
  });
  console.log('Started watching ./config directory\n');

  // Monitor a metric (memory)
  metricMonitor.monitor('memory-threshold', {
    metric: async () => {
      const usage = process.memoryUsage();
      return usage.heapUsed / 1024 / 1024;
    },
    threshold: 400,
    type: 'above',
    interval: 30000
  });
  console.log('Started monitoring memory threshold\n');

  // ====================================
  // 4. PUBLISHING EVENTS
  // ====================================
  console.log('4. Publishing test events...\n');

  // Publish a custom event
  await zeroClickEventBus.publish({
    type: EventType.CUSTOM,
    source: 'example',
    data: {
      action: 'deploy',
      environment: 'staging',
      version: '1.2.3'
    }
  });
  console.log('Published deployment event\n');

  // Simulate a webhook event
  await zeroClickEventBus.publish({
    type: EventType.WEBHOOK,
    source: 'webhook:/data',
    data: {
      path: '/data',
      headers: { 'content-type': 'application/json' },
      body: { items: [1, 2, 3] }
    }
  });
  console.log('Published webhook event\n');

  // ====================================
  // 5. QUERYING THE SYSTEM
  // ====================================
  console.log('5. System status...\n');

  // Get event statistics
  const eventStats = zeroClickEventBus.getStats();
  console.log('Event statistics:', JSON.stringify(eventStats, null, 2), '\n');

  // Get automation rules
  const rules = eventAutomationManager.getRules();
  console.log(`Active automation rules: ${rules.length}\n`);

  // Get pending executions
  const pending = eventAutomationManager.getPendingExecutions();
  console.log(`Pending executions: ${pending.length}\n`);

  // Get proactive suggestions
  const suggestions = proactiveAgentSystem.getSuggestions({ status: 'pending' });
  console.log(`Pending suggestions: ${suggestions.length}\n`);

  // Get learned patterns
  const patterns = proactiveAgentSystem.getPatterns();
  console.log(`Learned patterns: ${patterns.length}\n`);

  // Get proactive stats
  const proactiveStats = proactiveAgentSystem.getStats();
  console.log('Proactive system statistics:', JSON.stringify(proactiveStats, null, 2), '\n');

  // ====================================
  // 6. APPROVING PENDING EXECUTIONS
  // ====================================
  if (pending.length > 0) {
    console.log('6. Approving pending executions...\n');

    const firstPending = pending[0];
    console.log(`Approving: ${firstPending.id} (${firstPending.agentId}:${firstPending.capability})`);

    const approved = await eventAutomationManager.approvePendingExecution(firstPending.id);
    console.log(`Approved: ${approved}\n`);
  }

  // ====================================
  // 7. ACCEPTING SUGGESTIONS
  // ====================================
  if (suggestions.length > 0) {
    console.log('7. Accepting proactive suggestions...\n');

    const topSuggestion = suggestions[0];
    console.log(`Accepting: ${topSuggestion.id} (confidence: ${topSuggestion.confidence})`);
    console.log(`Reason: ${topSuggestion.reason}\n`);

    const accepted = await proactiveAgentSystem.acceptSuggestion(topSuggestion.id);
    console.log(`Accepted: ${accepted}\n`);
  }

  // ====================================
  // 8. SAVING CONFIGURATION
  // ====================================
  console.log('8. Saving configuration...\n');

  await eventAutomationManager.saveRulesToFile('./zero-click-rules.json');
  console.log('Rules saved to ./zero-click-rules.json\n');

  // ====================================
  // 9. CLEANUP
  // ====================================
  console.log('9. Cleaning up...\n');

  // This is just an example - in production, you'd keep these running
  // webhookServer.stop();
  // scheduleTrigger.clearAll();
  // fileWatcher.clearAll();
  // metricMonitor.clearAll();

  console.log('=== Example Complete ===\n');
  console.log('The zero-click system is now running!');
  console.log('- Webhook server: http://localhost:9090');
  console.log('- Automation rules: Active and monitoring events');
  console.log('- Proactive monitors: Watching system conditions');
  console.log('\nTry:');
  console.log('  curl -X POST http://localhost:9090/data -H "Content-Type: application/json" -d \'{"test": "data"}\'');
}

// Run the example
main().catch(console.error);
