/**
 * Greenlet Bridge Adapter
 * 
 * TypeScript adapter for spawning and managing Python greenlet agents via child_process.
 * Communicates via stdio using JSON-RPC protocol.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { component: 'greenlet-bridge' } });

export interface GreenletBridgeConfig {
  pythonPath?: string;
  scriptPath?: string;
  agentId?: string;
  capabilities?: string[];
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  messageQueueSize?: number;
}

export interface MessageMetrics {
  messagesSent: number;
  messagesReceived: number;
  errors: number;
  averageResponseTime: number;
  lastMessageTime: number;
}

export class GreenletBridgeAdapter extends EventEmitter {
  private config: Required<GreenletBridgeConfig>;
  private process: ChildProcess | null = null;
  private connected: boolean = false;
  private messageBuffer: string = '';
  private messageQueue: Array<{ message: Record<string, any>; timestamp: number }> = [];
  private metrics: MessageMetrics = {
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    averageResponseTime: 0,
    lastMessageTime: 0
  };
  private pendingMessages: Map<string, { resolve: Function; reject: Function; timestamp: number }> = new Map();
  private messageIdCounter: number = 0;

  constructor(config: GreenletBridgeConfig = {}) {
    super();
    
    this.config = {
      pythonPath: config.pythonPath || 'python3',
      scriptPath: config.scriptPath || 'src/agents/python/greenlet_a2a_agent.py',
      agentId: config.agentId || 'greenlet-agent',
      capabilities: config.capabilities || [],
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      messageQueueSize: config.messageQueueSize ?? 100,
    };
  }
  
  /**
   * Connect to Python greenlet agent
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, this.config.timeout);
      
      try {
        this.process = spawn(this.config.pythonPath, [this.config.scriptPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PYTHONUNBUFFERED: '1'
          }
        });
        
        this.process.stdout?.on('data', (data: Buffer) => {
          this.handleStdout(data);
        });
        
        this.process.stderr?.on('data', (data: Buffer) => {
          logger.error({ error: data.toString() }, 'Greenlet agent stderr');
        });
        
        this.process.on('error', (error: Error) => {
          logger.error({ error: error.message }, 'Greenlet process error');
          this.emit('error', error);
        });
        
        this.process.on('exit', (code: number | null, signal: string | null) => {
          logger.info({ code, signal }, 'Greenlet process exited');
          this.connected = false;
          this.emit('exit', code, signal);
        });
        
        // Wait for registration message
        this.once('agent.register', (data: any) => {
          clearTimeout(timeout);
          this.connected = true;
          logger.info({ agentId: data.id }, 'Greenlet agent registered');
          resolve();
        });
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  /**
   * Send message to greenlet agent
   */
  sendMessage(message: Record<string, any>): void {
    if (!this.connected || !this.process) {
      throw new Error('Agent not connected');
    }
    
    try {
      const json = JSON.stringify(message) + '\n';
      this.process.stdin?.write(json);
      this.metrics.messagesSent++;
      this.metrics.lastMessageTime = Date.now();
    } catch (error) {
      this.metrics.errors++;
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to send message');
      throw error;
    }
  }

  /**
   * Send message with response expectation and retry logic
   */
  async sendMessageWithResponse(message: Record<string, any>, expectedResponseType: string, retries: number = this.config.maxRetries): Promise<any> {
    const messageId = `msg-${this.messageIdCounter++}`;
    const messageWithId = { ...message, messageId };
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            this.pendingMessages.delete(messageId);
            reject(new Error(`Message timeout after ${this.config.timeout}ms`));
          }, this.config.timeout);

          this.pendingMessages.set(messageId, { 
            resolve: (data: any) => {
              clearTimeout(timeout);
              resolve(data);
            }, 
            reject: (error: any) => {
              clearTimeout(timeout);
              reject(error);
            },
            timestamp: Date.now()
          });

          // Listen for expected response type
          const responseHandler = (data: any) => {
            const pending = this.pendingMessages.get(messageId);
            if (pending) {
              this.pendingMessages.delete(messageId);
              const responseTime = Date.now() - pending.timestamp;
              this.updateAverageResponseTime(responseTime);
              pending.resolve(data);
              this.removeListener(expectedResponseType, responseHandler);
            }
          };

          this.once(expectedResponseType, responseHandler);
          this.sendMessage(messageWithId);
        });

        return response;
      } catch (error) {
        if (attempt < retries) {
          logger.warn({ attempt, messageId, error: error instanceof Error ? error.message : String(error) }, 'Retrying message');
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * (attempt + 1)));
        } else {
          this.metrics.errors++;
          throw error;
        }
      }
    }
  }

  /**
   * Queue message for later processing
   */
  queueMessage(message: Record<string, any>): boolean {
    if (this.messageQueue.length >= this.config.messageQueueSize) {
      logger.warn('Message queue full, dropping oldest message');
      this.messageQueue.shift();
    }
    
    this.messageQueue.push({ message, timestamp: Date.now() });
    return true;
  }

  /**
   * Process queued messages
   */
  async processQueue(): Promise<void> {
    while (this.messageQueue.length > 0 && this.connected) {
      const item = this.messageQueue.shift();
      if (item) {
        try {
          this.sendMessage(item.message);
          await new Promise(resolve => setTimeout(resolve, 10)); // Small delay between messages
        } catch (error) {
          logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to process queued message');
          // Re-queue if still under limit
          if (this.messageQueue.length < this.config.messageQueueSize) {
            this.messageQueue.push(item);
          }
          break;
        }
      }
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): MessageMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      averageResponseTime: 0,
      lastMessageTime: 0
    };
  }

  /**
   * Update average response time
   */
  private updateAverageResponseTime(newResponseTime: number): void {
    const totalMessages = this.metrics.messagesSent;
    if (totalMessages === 0) {
      this.metrics.averageResponseTime = newResponseTime;
    } else {
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * (totalMessages - 1) + newResponseTime) / totalMessages;
    }
  }
  
  /**
   * Disconnect from agent
   */
  async disconnect(): Promise<void> {
    if (this.process) {
      this.sendMessage({ type: 'agent.stop' });
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5000);
        
        this.process?.once('exit', () => {
          clearTimeout(timeout);
          this.connected = false;
          resolve();
        });
      });
    }
  }
  
  /**
   * Check if adapter is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Handle stdout data from Python process
   */
  private handleStdout(data: Buffer): void {
    this.messageBuffer += data.toString();
    
    const lines = this.messageBuffer.split('\n');
    this.messageBuffer = lines.pop() || ''; // Keep incomplete line
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        logger.error({ line, error: error instanceof Error ? error.message : String(error) }, 'Invalid JSON from greenlet agent');
      }
    }
  }
  
  /**
   * Handle parsed message
   */
  private handleMessage(message: Record<string, any>): void {
    const { type, data } = message;
    
    this.metrics.messagesReceived++;
    logger.debug({ type, data }, 'Greenlet message received');
    this.emit(type, data);
    this.emit('message', message);
  }
}
