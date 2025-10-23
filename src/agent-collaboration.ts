/**
 * Agent Collaboration System
 *
 * Enables agents to work together by:
 * - Sharing context and intermediate results
 * - Coordinating on complex multi-step tasks
 * - Distributing work intelligently
 * - Learning from each other's successes
 */

import { AgentDescriptor, agentRegistry } from './agents.js';
import { performanceMonitor } from './agent-performance.js';
import { v4 as uuidv4 } from 'uuid';

export interface CollaborationSession {
  id: string;
  name: string;
  participants: string[]; // Agent IDs
  sharedContext: Map<string, any>;
  messageHistory: CollaborationMessage[];
  startedAt: number;
  status: 'active' | 'completed' | 'failed';
}

export interface CollaborationMessage {
  id: string;
  from: string; // Agent ID
  to: string | 'all'; // Agent ID or broadcast
  type: 'request' | 'response' | 'broadcast' | 'handoff';
  payload: any;
  timestamp: number;
}

export interface TaskDistribution {
  taskId: string;
  totalWork: number;
  assignments: Map<string, number>; // Agent ID -> work percentage
  results: Map<string, any>;
  status: 'pending' | 'in_progress' | 'completed';
}

export class AgentCollaborationManager {
  private sessions = new Map<string, CollaborationSession>();
  private activeDistributions = new Map<string, TaskDistribution>();

  /**
   * Create a collaboration session
   */
  createSession(name: string, agentIds: string[]): CollaborationSession {
    const session: CollaborationSession = {
      id: uuidv4(),
      name,
      participants: agentIds,
      sharedContext: new Map(),
      messageHistory: [],
      startedAt: Date.now(),
      status: 'active'
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Send message between agents in a session
   */
  sendMessage(sessionId: string, message: Omit<CollaborationMessage, 'id' | 'timestamp'>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    const fullMessage: CollaborationMessage = {
      ...message,
      id: uuidv4(),
      timestamp: Date.now()
    };

    session.messageHistory.push(fullMessage);
    return true;
  }

  /**
   * Share data in session context
   */
  shareContext(sessionId: string, key: string, value: any, fromAgentId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    if (!session.participants.includes(fromAgentId)) {
      return false;
    }

    session.sharedContext.set(key, {
      value,
      sharedBy: fromAgentId,
      timestamp: Date.now()
    });

    // Broadcast to all participants
    this.sendMessage(sessionId, {
      from: fromAgentId,
      to: 'all',
      type: 'broadcast',
      payload: { contextUpdate: key }
    });

    return true;
  }

  /**
   * Get shared context
   */
  getContext(sessionId: string, key?: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    if (key) {
      return session.sharedContext.get(key);
    }

    // Return all context
    const context: Record<string, any> = {};
    session.sharedContext.forEach((value, key) => {
      context[key] = value;
    });
    return context;
  }

  /**
   * Handoff task from one agent to another
   */
  handoffTask(
    sessionId: string,
    fromAgentId: string,
    toAgentId: string,
    taskData: any,
    reason: string
  ): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'active') {
      return false;
    }

    if (!session.participants.includes(fromAgentId) || !session.participants.includes(toAgentId)) {
      return false;
    }

    this.sendMessage(sessionId, {
      from: fromAgentId,
      to: toAgentId,
      type: 'handoff',
      payload: {
        taskData,
        reason,
        handoffTime: Date.now()
      }
    });

    return true;
  }

  /**
   * Distribute work among multiple agents intelligently
   */
  distributeWork(
    taskId: string,
    totalWork: number,
    candidateAgents: string[]
  ): TaskDistribution {
    const distribution: TaskDistribution = {
      taskId,
      totalWork,
      assignments: new Map(),
      results: new Map(),
      status: 'pending'
    };

    // Get performance profiles for intelligent distribution
    const profiles = candidateAgents
      .map(id => ({
        agentId: id,
        profile: performanceMonitor.getAgentProfile(id)
      }))
      .filter(p => p.profile !== null);

    if (profiles.length === 0) {
      // Equal distribution if no performance data
      const workPerAgent = totalWork / candidateAgents.length;
      candidateAgents.forEach(agentId => {
        distribution.assignments.set(agentId, workPerAgent);
      });
    } else {
      // Distribute based on performance scores
      const totalScore = profiles.reduce((sum, p) => sum + (p.profile?.performanceScore || 0), 0);

      profiles.forEach(({ agentId, profile }) => {
        if (profile) {
          const workPercentage = (profile.performanceScore / totalScore) * 100;
          const assignedWork = (workPercentage / 100) * totalWork;
          distribution.assignments.set(agentId, assignedWork);
        }
      });
    }

    distribution.status = 'in_progress';
    this.activeDistributions.set(taskId, distribution);

    return distribution;
  }

  /**
   * Submit work result from an agent
   */
  submitWorkResult(taskId: string, agentId: string, result: any): boolean {
    const distribution = this.activeDistributions.get(taskId);
    if (!distribution) {
      return false;
    }

    distribution.results.set(agentId, result);

    // Check if all work is completed
    if (distribution.results.size === distribution.assignments.size) {
      distribution.status = 'completed';
    }

    return true;
  }

  /**
   * Get aggregated results from distributed work
   */
  getDistributionResults(taskId: string): any {
    const distribution = this.activeDistributions.get(taskId);
    if (!distribution) {
      return null;
    }

    const results: any[] = [];
    distribution.results.forEach((result, agentId) => {
      results.push({
        agentId,
        assignedWork: distribution.assignments.get(agentId),
        result
      });
    });

    return {
      taskId,
      totalWork: distribution.totalWork,
      status: distribution.status,
      participants: distribution.assignments.size,
      completed: distribution.results.size,
      results
    };
  }

  /**
   * Enable agent-to-agent learning
   */
  shareSuccessPattern(
    sourceAgentId: string,
    targetAgentIds: string[],
    pattern: {
      problemType: string;
      solution: string;
      context: any;
      successRate: number;
    }
  ): void {
    // Store pattern for other agents to learn from
    targetAgentIds.forEach(targetId => {
      const agent = agentRegistry.get(targetId);
      if (agent) {
        // In a real implementation, this would update agent behavior
        console.log(`Agent ${targetId} learned pattern from ${sourceAgentId}`);
      }
    });
  }

  /**
   * Get collaboration statistics
   */
  getCollaborationStats(sessionId: string): any {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const messagesByAgent = new Map<string, number>();
    session.messageHistory.forEach(msg => {
      messagesByAgent.set(msg.from, (messagesByAgent.get(msg.from) || 0) + 1);
    });

    const duration = Date.now() - session.startedAt;

    return {
      sessionId: session.id,
      name: session.name,
      participants: session.participants.length,
      totalMessages: session.messageHistory.length,
      sharedContextItems: session.sharedContext.size,
      duration: Math.round(duration / 1000) + 's',
      status: session.status,
      messagesByAgent: Object.fromEntries(messagesByAgent),
      mostActiveAgent: Array.from(messagesByAgent.entries())
        .sort((a, b) => b[1] - a[1])[0]?.[0]
    };
  }

  /**
   * Close a collaboration session
   */
  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.status = 'completed';
    return true;
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.status === 'active');
  }
}

// Global collaboration manager instance
export const collaborationManager = new AgentCollaborationManager();

// Helper: Create a collaborative task
export async function collaborativeTask(
  taskName: string,
  agentIds: string[],
  taskFn: (session: CollaborationSession) => Promise<any>
): Promise<any> {
  const session = collaborationManager.createSession(taskName, agentIds);

  try {
    const result = await taskFn(session);
    collaborationManager.closeSession(session.id);
    return result;
  } catch (error) {
    if (session) {
      const currentSession = collaborationManager['sessions'].get(session.id);
      if (currentSession) {
        currentSession.status = 'failed';
      }
    }
    throw error;
  }
}
