import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'event-bus' } });

/**
 * Event types supported by the zero-click system
 */
export enum EventType {
  WEBHOOK = 'webhook',
  SCHEDULE = 'schedule',
  FILE_WATCH = 'file_watch',
  METRIC_THRESHOLD = 'metric_threshold',
  AGENT_COMPLETION = 'agent_completion',
  CUSTOM = 'custom'
}

/**
 * Base event structure
 */
export interface ZeroClickEvent {
  id: string;
  type: EventType;
  timestamp: number;
  source: string;
  data: any;
  metadata?: Record<string, any>;
}

/**
 * Event handler function type
 */
export type EventHandler = (event: ZeroClickEvent) => Promise<void> | void;

/**
 * Event subscription
 */
export interface EventSubscription {
  id: string;
  eventType: EventType;
  filter?: (event: ZeroClickEvent) => boolean;
  handler: EventHandler;
  priority?: number;
  enabled: boolean;
}

/**
 * Event statistics
 */
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<EventType, number>;
  totalSubscriptions: number;
  subscriptionsByType: Record<EventType, number>;
  lastEventTimestamp?: number;
}

/**
 * Central event bus for zero-click automation
 * Manages event publishing, subscription, and delivery
 */
export class ZeroClickEventBus extends EventEmitter {
  private subscriptions = new Map<string, EventSubscription>();
  private eventHistory: ZeroClickEvent[] = [];
  private stats: EventStats = {
    totalEvents: 0,
    eventsByType: {} as Record<EventType, number>,
    totalSubscriptions: 0,
    subscriptionsByType: {} as Record<EventType, number>
  };
  private maxHistorySize: number;

  constructor(options?: { maxHistorySize?: number }) {
    super();
    this.maxHistorySize = options?.maxHistorySize || 1000;

    // Initialize stats for all event types
    Object.values(EventType).forEach(type => {
      this.stats.eventsByType[type] = 0;
      this.stats.subscriptionsByType[type] = 0;
    });
  }

  /**
   * Subscribe to events
   */
  subscribe(subscription: Omit<EventSubscription, 'id'>): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullSubscription: EventSubscription = {
      id,
      ...subscription,
      enabled: subscription.enabled ?? true,
      priority: subscription.priority ?? 0
    };

    this.subscriptions.set(id, fullSubscription);
    this.stats.totalSubscriptions++;
    this.stats.subscriptionsByType[subscription.eventType]++;

    logger.info({ subscriptionId: id, eventType: subscription.eventType }, 'Event subscription created');

    return id;
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    this.subscriptions.delete(subscriptionId);
    this.stats.totalSubscriptions--;
    this.stats.subscriptionsByType[subscription.eventType]--;

    logger.info({ subscriptionId }, 'Event subscription removed');

    return true;
  }

  /**
   * Enable/disable a subscription
   */
  setSubscriptionEnabled(subscriptionId: string, enabled: boolean): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return false;

    subscription.enabled = enabled;
    logger.info({ subscriptionId, enabled }, 'Subscription enabled state changed');

    return true;
  }

  /**
   * Publish an event
   */
  async publish(event: Omit<ZeroClickEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: ZeroClickEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...event
    };

    // Update stats
    this.stats.totalEvents++;
    this.stats.eventsByType[event.type]++;
    this.stats.lastEventTimestamp = fullEvent.timestamp;

    // Add to history
    this.eventHistory.push(fullEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    logger.info({ eventId: fullEvent.id, eventType: fullEvent.type }, 'Event published');

    // Emit to EventEmitter listeners
    this.emit('event', fullEvent);
    this.emit(event.type, fullEvent);

    // Find matching subscriptions
    const matchingSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.enabled && sub.eventType === event.type)
      .filter(sub => !sub.filter || sub.filter(fullEvent))
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));

    logger.debug({ eventId: fullEvent.id, matchingCount: matchingSubscriptions.length }, 'Matched subscriptions');

    // Execute handlers
    const handlerPromises = matchingSubscriptions.map(async (sub) => {
      try {
        await sub.handler(fullEvent);
        logger.debug({ subscriptionId: sub.id, eventId: fullEvent.id }, 'Handler executed successfully');
      } catch (error) {
        logger.error({
          error,
          subscriptionId: sub.id,
          eventId: fullEvent.id
        }, 'Handler execution failed');
        this.emit('handler:error', { subscription: sub, event: fullEvent, error });
      }
    });

    await Promise.all(handlerPromises);
  }

  /**
   * Get event history
   */
  getHistory(filter?: { type?: EventType; since?: number; limit?: number }): ZeroClickEvent[] {
    let events = [...this.eventHistory];

    if (filter?.type) {
      events = events.filter(e => e.type === filter.type);
    }

    if (filter?.since !== undefined) {
      events = events.filter(e => e.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  /**
   * Get statistics
   */
  getStats(): EventStats {
    return { ...this.stats };
  }

  /**
   * Get all subscriptions
   */
  getSubscriptions(filter?: { eventType?: EventType; enabled?: boolean }): EventSubscription[] {
    let subs = Array.from(this.subscriptions.values());

    if (filter?.eventType) {
      subs = subs.filter(s => s.eventType === filter.eventType);
    }

    if (filter?.enabled !== undefined) {
      subs = subs.filter(s => s.enabled === filter.enabled);
    }

    return subs;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory = [];
    logger.info('Event history cleared');
  }

  /**
   * Clear all subscriptions
   */
  clearSubscriptions(): void {
    this.subscriptions.clear();
    this.stats.totalSubscriptions = 0;
    Object.keys(this.stats.subscriptionsByType).forEach(type => {
      this.stats.subscriptionsByType[type as EventType] = 0;
    });
    logger.info('All subscriptions cleared');
  }
}

// Global singleton instance
export const zeroClickEventBus = new ZeroClickEventBus();
