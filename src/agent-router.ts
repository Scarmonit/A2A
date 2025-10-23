/**
 * Smart Agent Router
 *
 * Intelligently routes tasks to the most appropriate agents based on:
 * - Agent capabilities and specializations
 * - Performance history and success rates
 * - Current load and availability
 * - Task requirements and complexity
 */

import { agentRegistry, AgentDescriptor } from './agents.js';
import { performanceMonitor } from './agent-performance.js';

export interface TaskRequirements {
  category?: string;
  tags?: string[];
  requiredCapabilities?: string[];
  priority?: 'low' | 'medium' | 'high' | 'critical';
  maxExecutionTime?: number;
  preferredAgent?: string;
}

export interface RoutingDecision {
  selectedAgent: AgentDescriptor;
  confidence: number; // 0-100
  reason: string;
  alternatives: Array<{
    agent: AgentDescriptor;
    score: number;
    reason: string;
  }>;
}

export class SmartAgentRouter {
  /**
   * Route a task to the best available agent
   */
  routeTask(requirements: TaskRequirements): RoutingDecision | null {
    // Get candidate agents
    let candidates = this.findCandidateAgents(requirements);

    if (candidates.length === 0) {
      return null;
    }

    // Score and rank candidates
    const scoredCandidates = candidates.map(agent => ({
      agent,
      score: this.scoreAgent(agent, requirements),
      reason: this.getScoreReason(agent, requirements)
    })).sort((a, b) => b.score - a.score);

    const best = scoredCandidates[0];
    const alternatives = scoredCandidates.slice(1, 4); // Top 3 alternatives

    return {
      selectedAgent: best.agent,
      confidence: Math.round(best.score),
      reason: best.reason,
      alternatives
    };
  }

  /**
   * Find candidate agents based on requirements
   */
  private findCandidateAgents(requirements: TaskRequirements): AgentDescriptor[] {
    let candidates: AgentDescriptor[];

    // Start with all enabled agents
    candidates = agentRegistry.list({ enabled: true });

    // Filter by category
    if (requirements.category) {
      candidates = candidates.filter(a => a.category === requirements.category);
    }

    // Filter by tags
    if (requirements.tags && requirements.tags.length > 0) {
      candidates = candidates.filter(a =>
        requirements.tags!.some(tag => a.tags?.includes(tag))
      );
    }

    // Filter by required capabilities
    if (requirements.requiredCapabilities && requirements.requiredCapabilities.length > 0) {
      candidates = candidates.filter(a =>
        requirements.requiredCapabilities!.every(cap =>
          a.capabilities.some(c => c.name === cap)
        )
      );
    }

    // Prefer specific agent if requested
    if (requirements.preferredAgent) {
      const preferred = agentRegistry.get(requirements.preferredAgent);
      if (preferred && preferred.enabled) {
        // Move preferred to front
        candidates = [preferred, ...candidates.filter(a => a.id !== preferred.id)];
      }
    }

    return candidates;
  }

  /**
   * Score an agent based on multiple factors
   */
  private scoreAgent(agent: AgentDescriptor, requirements: TaskRequirements): number {
    let score = 50; // Base score

    // Performance history (40 points max)
    const profile = performanceMonitor.getAgentProfile(agent.id);
    if (profile) {
      score += (profile.performanceScore / 100) * 40;

      // Bonus for experience
      if (profile.totalExecutions > 100) {
        score += 5;
      }

      // Penalty for recent failures
      if (profile.successRate < 0.8) {
        score -= 10;
      }

      // Speed bonus
      if (requirements.maxExecutionTime && profile.avgExecutionTime < requirements.maxExecutionTime) {
        score += 10;
      }
    } else {
      // No history - neutral score
      score += 20;
    }

    // Capability match (20 points max)
    if (requirements.requiredCapabilities) {
      const matchedCaps = requirements.requiredCapabilities.filter(reqCap =>
        agent.capabilities.some(c => c.name === reqCap)
      ).length;
      const matchRatio = matchedCaps / requirements.requiredCapabilities.length;
      score += matchRatio * 20;
    } else {
      score += 10; // Default if no specific capabilities required
    }

    // Category bonus (10 points)
    if (requirements.category && agent.category === requirements.category) {
      score += 10;
    }

    // Tag match bonus (10 points max)
    if (requirements.tags && agent.tags) {
      const matchedTags = requirements.tags.filter(tag => agent.tags!.includes(tag)).length;
      const tagMatchRatio = matchedTags / requirements.tags.length;
      score += tagMatchRatio * 10;
    }

    // Priority adjustment
    if (requirements.priority === 'critical') {
      // Prefer most reliable agents for critical tasks
      if (profile && profile.successRate > 0.95) {
        score += 15;
      }
    }

    // Preferred agent bonus
    if (requirements.preferredAgent === agent.id) {
      score += 20;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Generate explanation for agent score
   */
  private getScoreReason(agent: AgentDescriptor, requirements: TaskRequirements): string {
    const reasons: string[] = [];
    const profile = performanceMonitor.getAgentProfile(agent.id);

    if (profile) {
      reasons.push(`${profile.successRate >= 0.9 ? 'High' : 'Good'} success rate (${(profile.successRate * 100).toFixed(1)}%)`);

      if (profile.totalExecutions > 100) {
        reasons.push('Extensive experience');
      }

      if (requirements.maxExecutionTime && profile.avgExecutionTime < requirements.maxExecutionTime) {
        reasons.push('Fast execution time');
      }
    }

    if (requirements.category && agent.category === requirements.category) {
      reasons.push('Category specialist');
    }

    if (requirements.tags && agent.tags) {
      const matchedTags = requirements.tags.filter(tag => agent.tags!.includes(tag));
      if (matchedTags.length > 0) {
        reasons.push(`Matches ${matchedTags.length} tag(s)`);
      }
    }

    if (requirements.preferredAgent === agent.id) {
      reasons.push('Preferred agent');
    }

    return reasons.join(', ') || 'Available agent';
  }

  /**
   * Route to multiple agents for load balancing
   */
  routeToMultipleAgents(
    count: number,
    requirements: TaskRequirements
  ): AgentDescriptor[] {
    const candidates = this.findCandidateAgents(requirements);

    // Score and sort
    const scored = candidates.map(agent => ({
      agent,
      score: this.scoreAgent(agent, requirements)
    })).sort((a, b) => b.score - a.score);

    return scored.slice(0, count).map(s => s.agent);
  }

  /**
   * Get routing recommendations for a task type
   */
  getRecommendations(category: string): Array<{
    agent: AgentDescriptor;
    reason: string;
    score: number;
  }> {
    const agents = agentRegistry.getByCategory(category);

    return agents.map(agent => {
      const profile = performanceMonitor.getAgentProfile(agent.id);
      const score = this.scoreAgent(agent, { category });

      return {
        agent,
        score,
        reason: profile
          ? `Success rate: ${(profile.successRate * 100).toFixed(1)}%, Avg time: ${profile.avgExecutionTime}ms`
          : 'No performance history'
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Check if agent can handle task
   */
  canHandleTask(agentId: string, requirements: TaskRequirements): {
    canHandle: boolean;
    confidence: number;
    reasons: string[];
  } {
    const agent = agentRegistry.get(agentId);
    if (!agent || !agent.enabled) {
      return {
        canHandle: false,
        confidence: 0,
        reasons: ['Agent not found or disabled']
      };
    }

    const score = this.scoreAgent(agent, requirements);
    const reasons: string[] = [];

    // Check category
    if (requirements.category && agent.category !== requirements.category) {
      reasons.push(`Category mismatch (expected: ${requirements.category}, agent: ${agent.category})`);
    } else if (requirements.category) {
      reasons.push('Category match');
    }

    // Check capabilities
    if (requirements.requiredCapabilities) {
      const missing = requirements.requiredCapabilities.filter(reqCap =>
        !agent.capabilities.some(c => c.name === reqCap)
      );

      if (missing.length > 0) {
        reasons.push(`Missing capabilities: ${missing.join(', ')}`);
      } else {
        reasons.push('Has all required capabilities');
      }
    }

    // Check performance history
    const profile = performanceMonitor.getAgentProfile(agentId);
    if (profile) {
      if (profile.successRate < 0.7) {
        reasons.push('Low historical success rate');
      }
      if (requirements.maxExecutionTime && profile.avgExecutionTime > requirements.maxExecutionTime) {
        reasons.push('Average execution time exceeds requirement');
      }
    }

    return {
      canHandle: score >= 50, // At least 50/100 score to be considered capable
      confidence: Math.round(score),
      reasons
    };
  }

  /**
   * Get load-balanced agent selection
   */
  getBalancedAgent(requirements: TaskRequirements): AgentDescriptor | null {
    const candidates = this.findCandidateAgents(requirements);

    if (candidates.length === 0) {
      return null;
    }

    // Get profiles to check recent usage
    const scoredWithLoad = candidates.map(agent => {
      const profile = performanceMonitor.getAgentProfile(agent.id);
      const baseScore = this.scoreAgent(agent, requirements);

      // Reduce score based on recent heavy usage
      let loadScore = baseScore;
      if (profile && profile.lastExecuted) {
        const timeSinceLastUse = Date.now() - profile.lastExecuted;
        if (timeSinceLastUse < 1000) {
          loadScore *= 0.8; // 20% penalty for very recent use
        } else if (timeSinceLastUse < 5000) {
          loadScore *= 0.9; // 10% penalty for recent use
        }
      }

      return { agent, score: loadScore };
    });

    // Return agent with best score considering load
    scoredWithLoad.sort((a, b) => b.score - a.score);
    return scoredWithLoad[0].agent;
  }
}

// Global router instance
export const smartRouter = new SmartAgentRouter();

// Helper function: Route and execute
export async function routeAndExecute<T>(
  requirements: TaskRequirements,
  executeFn: (agent: AgentDescriptor) => Promise<T>
): Promise<T> {
  const decision = smartRouter.routeTask(requirements);

  if (!decision) {
    throw new Error('No suitable agent found for task');
  }

  console.log(`Routing to: ${decision.selectedAgent.name} (confidence: ${decision.confidence}%)`);
  console.log(`Reason: ${decision.reason}`);

  return executeFn(decision.selectedAgent);
}
