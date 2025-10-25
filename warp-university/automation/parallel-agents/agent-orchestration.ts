/**
 * Warp University - Agent Orchestration Module
 * 
 * This module provides sophisticated coordination logic for managing
 * multiple autonomous agents in parallel execution scenarios.
 * 
 * Core Responsibilities:
 * - Agent lifecycle management (initialization, execution, cleanup)
 * - Resource allocation and scheduling
 * - Inter-agent communication and data sharing
 * - Load balancing across parallel execution streams
 * - Monitoring and health checks
 */

import { Agent } from '../../../src/agents';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Agent status enumeration
 */
export enum AgentStatus {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Agent execution context with metadata
 */
export interface AgentContext {
  agentId: string;
  agentType: string;
  status: AgentStatus;
  startTime?: Date;
  endTime?: Date;
  memoryUsageMB?: number;
  cpuUsagePercent?: number;
  errorCount: number;
  retryCount: number;
  metadata: Record<string, any>;
}

/**
 * Message interface for inter-agent communication
 */
export interface AgentMessage {
  from: string;
  to: string;
  type: 'data' | 'command' | 'status' | 'error';
  payload: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Orchestration configuration
 */
export interface OrchestrationConfig {
  maxConcurrentAgents?: number;
  enableInterAgentComm?: boolean;
  enableResourceMonitoring?: boolean;
  defaultTimeout?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * AgentOrchestrator: Central coordination class for parallel agent execution
 * 
 * Warp University Design Patterns:
 * 1. Centralized Coordination: Single source of truth for agent state
 * 2. Message Passing: Decoupled inter-agent communication
 * 3. Resource Management: Fair allocation across agents
 * 4. Observability: Comprehensive logging and monitoring
 */
export class AgentOrchestrator {
  private agents: Map<string, AgentContext>;
  private messageQueue: AgentMessage[];
  private config: OrchestrationConfig;
  private activeExecutions: number;

  constructor(config: OrchestrationConfig = {}) {
    this.agents = new Map();
    this.messageQueue = [];
    this.activeExecutions = 0;
    
    // Set default configuration
    this.config = {
      maxConcurrentAgents: 10,
      enableInterAgentComm: true,
      enableResourceMonitoring: true,
      defaultTimeout: 30000,
      logLevel: 'info',
      ...config,
    };

    this.log('info', 'AgentOrchestrator initialized', { config: this.config });
  }

  /**
   * Register a new agent with the orchestrator
   * 
   * Pattern: Agent Registry
   * - Maintains catalog of all agents
   * - Tracks agent metadata and status
   * - Enables centralized monitoring
   */
  registerAgent(
    agentId: string,
    agentType: string,
    metadata: Record<string, any> = {}
  ): void {
    if (this.agents.has(agentId)) {
      this.log('warn', `Agent ${agentId} already registered, updating metadata`);
    }

    const context: AgentContext = {
      agentId,
      agentType,
      status: AgentStatus.IDLE,
      errorCount: 0,
      retryCount: 0,
      metadata,
    };

    this.agents.set(agentId, context);
    this.log('info', `Agent registered: ${agentId} (${agentType})`);
  }

  /**
   * Execute an agent with orchestration management
   * 
   * Pattern: Managed Execution
   * - Pre-execution checks (resource availability, concurrency limits)
   * - Status tracking throughout lifecycle
   * - Post-execution cleanup and logging
   */
  async executeAgent(
    agentType: string,
    params: Record<string, any>,
    agentId?: string
  ): Promise<any> {
    const id = agentId || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Register if not already registered
    if (!this.agents.has(id)) {
      this.registerAgent(id, agentType, { params });
    }

    const context = this.agents.get(id)!;

    // Check concurrency limits
    if (this.activeExecutions >= this.config.maxConcurrentAgents!) {
      this.log('warn', `Concurrency limit reached, queueing agent ${id}`);
      await this.waitForSlot();
    }

    try {
      // Update status to initializing
      this.updateAgentStatus(id, AgentStatus.INITIALIZING);
      context.startTime = new Date();
      this.activeExecutions++;

      // Execute agent (integrate with actual A2A agent system)
      this.updateAgentStatus(id, AgentStatus.RUNNING);
      const result = await this.executeAgentLogic(agentType, params);

      // Mark as completed
      this.updateAgentStatus(id, AgentStatus.COMPLETED);
      context.endTime = new Date();

      this.log('info', `Agent ${id} completed successfully`, {
        executionTime: context.endTime.getTime() - context.startTime!.getTime(),
      });

      return result;
    } catch (error) {
      // Handle failure
      this.updateAgentStatus(id, AgentStatus.FAILED);
      context.errorCount++;
      context.endTime = new Date();

      this.log('error', `Agent ${id} failed`, { error });
      throw error;
    } finally {
      this.activeExecutions--;
    }
  }

  /**
   * Execute agent logic - integrates with A2A agent system
   * 
   * Integration Point:
   * This method should be customized to work with the actual
   * agent implementations in src/agents/
   */
  private async executeAgentLogic(
    agentType: string,
    params: Record<string, any>
  ): Promise<any> {
    // TODO: Integrate with actual A2A agent system
    // For now, simulate agent execution
    
    this.log('debug', `Executing agent logic for ${agentType}`, params);

    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

    // Return mock result
    return {
      agentType,
      status: 'success',
      data: {
        processed: true,
        params,
        timestamp: new Date(),
      },
    };
  }

  /**
   * Send a message between agents
   * 
   * Pattern: Message Passing
   * - Decouples agent implementations
   * - Enables asynchronous communication
   * - Supports priority-based delivery
   */
  sendMessage(
    from: string,
    to: string,
    type: AgentMessage['type'],
    payload: any,
    priority: AgentMessage['priority'] = 'medium'
  ): void {
    if (!this.config.enableInterAgentComm) {
      this.log('warn', 'Inter-agent communication is disabled');
      return;
    }

    const message: AgentMessage = {
      from,
      to,
      type,
      payload,
      timestamp: new Date(),
      priority,
    };

    this.messageQueue.push(message);
    this.log('debug', `Message queued: ${from} -> ${to}`, { type, priority });

    // Sort by priority
    this.messageQueue.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Get pending messages for an agent
   */
  getMessages(agentId: string): AgentMessage[] {
    const messages = this.messageQueue.filter(m => m.to === agentId);
    
    // Remove retrieved messages from queue
    this.messageQueue = this.messageQueue.filter(m => m.to !== agentId);
    
    return messages;
  }

  /**
   * Update agent status
   */
  private updateAgentStatus(agentId: string, status: AgentStatus): void {
    const context = this.agents.get(agentId);
    if (context) {
      context.status = status;
      this.log('debug', `Agent ${agentId} status: ${status}`);
    }
  }

  /**
   * Get agent context and status
   */
  getAgentContext(agentId: string): AgentContext | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get all agent contexts
   */
  getAllAgentContexts(): AgentContext[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get execution statistics
   */
  getStats(): {
    totalAgents: number;
    activeAgents: number;
    completedAgents: number;
    failedAgents: number;
    queuedMessages: number;
  } {
    const contexts = this.getAllAgentContexts();
    
    return {
      totalAgents: contexts.length,
      activeAgents: contexts.filter(c => 
        c.status === AgentStatus.RUNNING || c.status === AgentStatus.INITIALIZING
      ).length,
      completedAgents: contexts.filter(c => c.status === AgentStatus.COMPLETED).length,
      failedAgents: contexts.filter(c => c.status === AgentStatus.FAILED).length,
      queuedMessages: this.messageQueue.length,
    };
  }

  /**
   * Wait for an execution slot to become available
   */
  private async waitForSlot(): Promise<void> {
    while (this.activeExecutions >= this.config.maxConcurrentAgents!) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Logging utility with configurable levels
   */
  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    data?: any
  ): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel || 'info'];
    const messageLevel = levels[level];

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${level.toUpperCase()}] [Orchestrator] ${message}`;
      
      if (data) {
        console[level === 'error' ? 'error' : 'log'](logMessage, data);
      } else {
        console[level === 'error' ? 'error' : 'log'](logMessage);
      }
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.log('info', 'Shutting down orchestrator...');
    
    // Wait for active executions to complete
    while (this.activeExecutions > 0) {
      this.log('info', `Waiting for ${this.activeExecutions} active executions to complete`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Clear message queue
    this.messageQueue = [];
    
    // Clear agent registry
    this.agents.clear();
    
    this.log('info', 'Orchestrator shutdown complete');
  }
}

/**
 * Factory function for creating orchestrator instances
 */
export function createOrchestrator(config?: OrchestrationConfig): AgentOrchestrator {
  return new AgentOrchestrator(config);
}

/**
 * Singleton instance for global orchestration
 */
let globalOrchestrator: AgentOrchestrator | null = null;

export function getGlobalOrchestrator(config?: OrchestrationConfig): AgentOrchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new AgentOrchestrator(config);
  }
  return globalOrchestrator;
}
