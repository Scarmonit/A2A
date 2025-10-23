import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ name: 'telemetry' });

/**
 * OpenTelemetry Integration for A2A MCP Server
 *
 * Provides distributed tracing capabilities for monitoring agent-to-agent communication.
 * This is a mock implementation demonstrating the structure.
 * For production, use @opentelemetry/api and @opentelemetry/sdk-node.
 *
 * Features:
 * - Distributed tracing across agent calls
 * - Automatic span creation for operations
 * - Context propagation
 * - Custom attributes and events
 * - Integration with Jaeger/Zipkin
 */

export interface SpanOptions {
  name: string;
  kind?: 'client' | 'server' | 'internal' | 'producer' | 'consumer';
  attributes?: Record<string, string | number | boolean>;
  parent?: Span;
}

export interface Span {
  spanId: string;
  traceId: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[];
  status: 'ok' | 'error';
  end(): void;
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, any>): void;
  recordException(error: Error): void;
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, any>;
}

export interface Trace {
  traceId: string;
  spans: Span[];
  startTime: number;
  endTime?: number;
}

class SpanImpl implements Span {
  spanId: string;
  traceId: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, string | number | boolean>;
  events: SpanEvent[] = [];
  status: 'ok' | 'error' = 'ok';
  private telemetry: TelemetryProvider;

  constructor(
    traceId: string,
    name: string,
    attributes: Record<string, string | number | boolean>,
    telemetry: TelemetryProvider
  ) {
    this.spanId = this.generateId();
    this.traceId = traceId;
    this.name = name;
    this.startTime = Date.now();
    this.attributes = { ...attributes };
    this.telemetry = telemetry;

    logger.debug({ spanId: this.spanId, traceId: this.traceId, name }, 'Span started');
  }

  end(): void {
    this.endTime = Date.now();
    this.telemetry.finishSpan(this);
    logger.debug(
      {
        spanId: this.spanId,
        traceId: this.traceId,
        name: this.name,
        duration: this.endTime - this.startTime,
      },
      'Span ended'
    );
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.attributes[key] = value;
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  recordException(error: Error): void {
    this.status = 'error';
    this.addEvent('exception', {
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}

export class TelemetryProvider extends EventEmitter {
  private traces = new Map<string, Trace>();
  private activeSpans = new Map<string, Span>();
  private serviceName: string;
  private endpoint?: string;

  constructor(config?: { serviceName?: string; endpoint?: string }) {
    super();
    this.serviceName = config?.serviceName || 'a2a-mcp-server';
    this.endpoint = config?.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    logger.info(
      { serviceName: this.serviceName, endpoint: this.endpoint },
      'TelemetryProvider initialized'
    );
  }

  /**
   * Initialize OpenTelemetry SDK
   */
  async initialize(): Promise<void> {
    // In production, initialize OpenTelemetry SDK:
    // const { NodeSDK } = require('@opentelemetry/sdk-node');
    // const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    // const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    //
    // const sdk = new NodeSDK({
    //   serviceName: this.serviceName,
    //   traceExporter: new OTLPTraceExporter({ url: this.endpoint }),
    //   instrumentations: [getNodeAutoInstrumentations()],
    // });
    //
    // await sdk.start();

    logger.info('Telemetry initialized (mock mode)');
  }

  /**
   * Create a new trace
   */
  startTrace(name: string): string {
    const traceId = this.generateTraceId();
    const trace: Trace = {
      traceId,
      spans: [],
      startTime: Date.now(),
    };

    this.traces.set(traceId, trace);
    this.emit('trace:started', { traceId, name });

    logger.info({ traceId, name }, 'Trace started');
    return traceId;
  }

  /**
   * Start a new span
   */
  startSpan(options: SpanOptions): Span {
    const traceId = options.parent?.traceId || this.generateTraceId();
    const span = new SpanImpl(traceId, options.name, options.attributes || {}, this);

    this.activeSpans.set(span.spanId, span);

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }

    return span;
  }

  /**
   * Finish a span (called automatically by span.end())
   */
  finishSpan(span: Span): void {
    this.activeSpans.delete(span.spanId);
    this.emit('span:finished', span);

    // Check if trace is complete
    const trace = this.traces.get(span.traceId);
    if (trace && this.isTraceComplete(trace)) {
      trace.endTime = Date.now();
      this.emit('trace:finished', trace);
      logger.info({ traceId: trace.traceId, duration: trace.endTime - trace.startTime }, 'Trace completed');
    }
  }

  /**
   * Get active span for current context
   */
  getCurrentSpan(): Span | undefined {
    // In production, use context propagation:
    // const { trace } = require('@opentelemetry/api');
    // return trace.getActiveSpan();

    return Array.from(this.activeSpans.values())[0];
  }

  /**
   * Wrap a function with automatic span creation
   */
  trace<T>(
    name: string,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = this.startSpan({ name, attributes });

    return fn(span)
      .then((result) => {
        span.end();
        return result;
      })
      .catch((error) => {
        span.recordException(error);
        span.end();
        throw error;
      });
  }

  /**
   * Get trace by ID
   */
  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  /**
   * Get all traces
   */
  getAllTraces(): Trace[] {
    return Array.from(this.traces.values());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalTraces: number;
    activeTraces: number;
    totalSpans: number;
    activeSpans: number;
  } {
    const activeTraces = Array.from(this.traces.values()).filter((t) => !t.endTime).length;

    let totalSpans = 0;
    for (const trace of this.traces.values()) {
      totalSpans += trace.spans.length;
    }

    return {
      totalTraces: this.traces.size,
      activeTraces,
      totalSpans,
      activeSpans: this.activeSpans.size,
    };
  }

  /**
   * Clear old traces (cleanup)
   */
  cleanup(maxAge: number = 3600000): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [traceId, trace] of this.traces.entries()) {
      const endTime = trace.endTime || trace.startTime;
      if (now - endTime > maxAge) {
        this.traces.delete(traceId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info({ cleaned, remaining: this.traces.size }, 'Cleaned up old traces');
    }
  }

  /**
   * Shutdown telemetry
   */
  async shutdown(): Promise<void> {
    // await this.sdk?.shutdown();
    this.traces.clear();
    this.activeSpans.clear();
    logger.info('Telemetry shutdown complete');
  }

  private generateTraceId(): string {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }

  private isTraceComplete(trace: Trace): boolean {
    return trace.spans.every((s) => s.endTime !== undefined);
  }
}

// Global telemetry instance
export const telemetry = new TelemetryProvider({
  serviceName: 'a2a-mcp-server',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
});

/**
 * Decorator for automatic tracing
 */
export function Trace(spanName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const name = spanName || `${target.constructor.name}.${propertyKey}`;
      const span = telemetry.startSpan({
        name,
        attributes: {
          'code.function': propertyKey,
          'code.namespace': target.constructor.name,
        },
      });

      try {
        const result = await originalMethod.apply(this, args);
        span.end();
        return result;
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error);
        }
        span.end();
        throw error;
      }
    };

    return descriptor;
  };
}
