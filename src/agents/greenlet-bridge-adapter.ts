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
}

export class GreenletBridgeAdapter extends EventEmitter {
  private config: Required<GreenletBridgeConfig>;
  private process: ChildProcess | null = null;
  private connected: boolean = false;
  private messageBuffer: string = '';

  constructor(config: GreenletBridgeConfig = {}) {
    super();
    
    this.config = {
      pythonPath: config.pythonPath || 'python3',
      scriptPath: config.scriptPath || 'src/agents/python/greenlet_a2a_agent.py',
      agentId: config.agentId || 'greenlet-agent',
      capabilities: config.capabilities || [],
      timeout: config.timeout || 30000,
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
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to send message');
      throw error;
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
    
    logger.debug({ type, data }, 'Greenlet message received');
    this.emit(type, data);
    this.emit('message', message);
  }
}
