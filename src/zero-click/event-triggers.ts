import { zeroClickEventBus, EventType } from './event-bus.js';
import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import pino from 'pino';
import { parse as parseUrl } from 'url';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'event-triggers' } });

/**
 * Webhook server for receiving external events
 */
export class WebhookServer {
  private server?: http.Server;
  private port: number;
  private webhookHandlers = new Map<string, (data: any) => Promise<void>>();

  constructor(port: number = 9090) {
    this.port = port;
  }

  /**
   * Start the webhook server
   */
  start(): void {
    if (this.server) {
      logger.warn('Webhook server already running');
      return;
    }

    this.server = http.createServer(async (req, res) => {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      const urlParts = parseUrl(req.url || '', true);
      const path = urlParts.pathname || '/';

      // Read body
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          const data = JSON.parse(body);

          // Publish webhook event
          await zeroClickEventBus.publish({
            type: EventType.WEBHOOK,
            source: `webhook:${path}`,
            data: {
              path,
              headers: req.headers,
              body: data
            }
          });

          // Call specific handlers
          const handler = this.webhookHandlers.get(path);
          if (handler) {
            await handler(data);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Webhook received' }));

          logger.info({ path, dataSize: body.length }, 'Webhook received');

        } catch (error) {
          logger.error({ error, path }, 'Webhook processing failed');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    });

    this.server.listen(this.port, () => {
      logger.info({ port: this.port }, 'Webhook server started');
    });
  }

  /**
   * Stop the webhook server
   */
  stop(): void {
    if (this.server) {
      this.server.close(() => {
        logger.info('Webhook server stopped');
      });
      this.server = undefined;
    }
  }

  /**
   * Register a webhook handler
   */
  registerHandler(path: string, handler: (data: any) => Promise<void>): void {
    this.webhookHandlers.set(path, handler);
    logger.info({ path }, 'Webhook handler registered');
  }

  /**
   * Unregister a webhook handler
   */
  unregisterHandler(path: string): void {
    this.webhookHandlers.delete(path);
    logger.info({ path }, 'Webhook handler unregistered');
  }
}

/**
 * Schedule-based event trigger (cron-like)
 */
export class ScheduleTrigger {
  private timers = new Map<string, NodeJS.Timeout>();

  /**
   * Add a scheduled event
   */
  addSchedule(id: string, config: {
    interval: number; // Interval in milliseconds
    data?: any;
  }): void {
    // Remove existing schedule if any
    this.removeSchedule(id);

    const trigger = async () => {
      await zeroClickEventBus.publish({
        type: EventType.SCHEDULE,
        source: `schedule:${id}`,
        data: config.data || {}
      });

      logger.debug({ scheduleId: id }, 'Scheduled event triggered');
    };

    // Initial trigger
    trigger();

    // Set interval
    const timer = setInterval(trigger, config.interval);
    this.timers.set(id, timer);

    logger.info({ scheduleId: id, interval: config.interval }, 'Schedule added');
  }

  /**
   * Remove a scheduled event
   */
  removeSchedule(id: string): boolean {
    const timer = this.timers.get(id);
    if (!timer) return false;

    clearInterval(timer);
    this.timers.delete(id);

    logger.info({ scheduleId: id }, 'Schedule removed');

    return true;
  }

  /**
   * Get all schedules
   */
  getSchedules(): string[] {
    return Array.from(this.timers.keys());
  }

  /**
   * Clear all schedules
   */
  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    logger.info('All schedules cleared');
  }
}

/**
 * File system watcher for file change events
 */
export class FileWatcher {
  private watchers = new Map<string, fs.FSWatcher>();

  /**
   * Watch a file or directory
   */
  watch(id: string, path: string, options?: {
    recursive?: boolean;
    filter?: (filename: string) => boolean;
  }): void {
    // Remove existing watcher if any
    this.unwatch(id);

    try {
      const watcher = fs.watch(path, { recursive: options?.recursive }, async (eventType, filename) => {
        if (!filename) return;

        // Apply filter if provided
        if (options?.filter && !options.filter(filename)) {
          return;
        }

        await zeroClickEventBus.publish({
          type: EventType.FILE_WATCH,
          source: `file-watch:${id}`,
          data: {
            path,
            filename,
            eventType,
            timestamp: Date.now()
          }
        });

        logger.debug({ watchId: id, filename, eventType }, 'File change detected');
      });

      this.watchers.set(id, watcher);

      logger.info({ watchId: id, path, recursive: options?.recursive }, 'File watcher started');

    } catch (error) {
      logger.error({ error, watchId: id, path }, 'Failed to start file watcher');
    }
  }

  /**
   * Stop watching a file or directory
   */
  unwatch(id: string): boolean {
    const watcher = this.watchers.get(id);
    if (!watcher) return false;

    watcher.close();
    this.watchers.delete(id);

    logger.info({ watchId: id }, 'File watcher stopped');

    return true;
  }

  /**
   * Get all watchers
   */
  getWatchers(): string[] {
    return Array.from(this.watchers.keys());
  }

  /**
   * Clear all watchers
   */
  clearAll(): void {
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();
    logger.info('All file watchers cleared');
  }
}

/**
 * Metric threshold monitor
 */
export class MetricMonitor {
  private monitors = new Map<string, NodeJS.Timeout>();

  /**
   * Monitor a metric
   */
  monitor(id: string, config: {
    metric: () => Promise<number> | number;
    threshold: number;
    type: 'above' | 'below';
    interval: number;
  }): void {
    // Remove existing monitor if any
    this.stopMonitoring(id);

    let previousValue: number | undefined;

    const check = async () => {
      try {
        const value = await config.metric();

        const triggered = (
          (config.type === 'above' && value > config.threshold) ||
          (config.type === 'below' && value < config.threshold)
        );

        // Only trigger if state changed
        if (triggered && previousValue !== undefined) {
          const wasTriggered = (
            (config.type === 'above' && previousValue > config.threshold) ||
            (config.type === 'below' && previousValue < config.threshold)
          );

          if (!wasTriggered) {
            await zeroClickEventBus.publish({
              type: EventType.METRIC_THRESHOLD,
              source: `metric:${id}`,
              data: {
                metric: id,
                value,
                threshold: config.threshold,
                type: config.type
              }
            });

            logger.info({ metricId: id, value, threshold: config.threshold }, 'Metric threshold triggered');
          }
        }

        previousValue = value;

      } catch (error) {
        logger.error({ error, metricId: id }, 'Metric check failed');
      }
    };

    // Initial check
    check();

    // Set interval
    const timer = setInterval(check, config.interval);
    this.monitors.set(id, timer);

    logger.info({ metricId: id, interval: config.interval }, 'Metric monitor started');
  }

  /**
   * Stop monitoring a metric
   */
  stopMonitoring(id: string): boolean {
    const timer = this.monitors.get(id);
    if (!timer) return false;

    clearInterval(timer);
    this.monitors.delete(id);

    logger.info({ metricId: id }, 'Metric monitor stopped');

    return true;
  }

  /**
   * Get all monitors
   */
  getMonitors(): string[] {
    return Array.from(this.monitors.keys());
  }

  /**
   * Clear all monitors
   */
  clearAll(): void {
    for (const timer of this.monitors.values()) {
      clearInterval(timer);
    }
    this.monitors.clear();
    logger.info('All metric monitors cleared');
  }
}

// Global singleton instances
export const webhookServer = new WebhookServer(parseInt(process.env.WEBHOOK_PORT || '9090', 10));
export const scheduleTrigger = new ScheduleTrigger();
export const fileWatcher = new FileWatcher();
export const metricMonitor = new MetricMonitor();
