/**
 * Zero-Click Integration
 *
 * Integrates zero-click automation tools into the A2A MCP server
 */

import { toolRegistry } from './tools.js';
import { zeroClickTools } from './zero-click/zero-click-tools.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'zero-click-integration' } });

/**
 * Initialize zero-click automation system
 */
export function initializeZeroClick() {
  logger.info('Initializing zero-click automation system...');

  // Register all zero-click tools
  let registered = 0;
  for (const tool of zeroClickTools) {
    try {
      toolRegistry.register(tool);
      registered++;
    } catch (error) {
      logger.error({ error, toolName: tool.name }, 'Failed to register zero-click tool');
    }
  }

  logger.info({ count: registered, total: zeroClickTools.length }, 'Zero-click tools registered');

  // Start webhook server if enabled
  if (process.env.ENABLE_WEBHOOKS === 'true') {
    const { webhookServer } = require('./zero-click/event-triggers.js');
    webhookServer.start();
    logger.info('Webhook server started');
  }

  // Load automation rules from config if specified
  if (process.env.ZERO_CLICK_CONFIG) {
    const { eventAutomationManager } = require('./zero-click/event-automation.js');
    eventAutomationManager.loadRulesFromFile(process.env.ZERO_CLICK_CONFIG)
      .then((result: any) => {
        logger.info({
          loaded: result.loaded,
          errors: result.errors.length
        }, 'Zero-click configuration loaded');
      })
      .catch((error: any) => {
        logger.error({ error }, 'Failed to load zero-click configuration');
      });
  }

  logger.info('Zero-click automation system initialized');
}

// Export zero-click system components for external use
export * from './zero-click/index.js';
