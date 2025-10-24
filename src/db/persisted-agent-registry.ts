/**
 * Persisted Agent Registry
 *
 * Extends the in-memory AgentRegistry to provide database persistence
 * using Prisma. This maintains the O(1) lookup performance while ensuring
 * agents survive server restarts.
 */

import { AgentRegistry, AgentDescriptor, AgentFilter } from '../agents.js';
import { prisma } from './prisma-client.js';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'persisted-agent-registry' } });

export class PersistedAgentRegistry extends AgentRegistry {
  private syncEnabled = true;

  constructor() {
    super();
    // Load agents from database on initialization
    this.loadFromDatabase().catch(error => {
      logger.error({ error }, 'Failed to load agents from database during initialization');
    });
  }

  /**
   * Load all agents from database into memory
   */
  private async loadFromDatabase(): Promise<void> {
    try {
      logger.info('Loading agents from database...');

      const dbAgents = await prisma.agent.findMany({
        orderBy: { deployedAt: 'desc' },
      });

      logger.info({ count: dbAgents.length }, 'Found agents in database');

      // Temporarily disable sync to avoid writing back to DB
      this.syncEnabled = false;

      for (const dbAgent of dbAgents) {
        const agent: AgentDescriptor = {
          id: dbAgent.id,
          name: dbAgent.name,
          version: dbAgent.version,
          category: dbAgent.category || undefined,
          tags: dbAgent.tags,
          enabled: dbAgent.enabled,
          deployedAt: dbAgent.deployedAt.getTime(),
          capabilities: dbAgent.capabilities as any,
          config: (dbAgent.config as any) || undefined,
        };

        // Use parent class method to populate in-memory structures
        super.deploy(agent);
      }

      // Re-enable sync
      this.syncEnabled = true;

      logger.info({ count: dbAgents.length }, 'Loaded agents into memory');
    } catch (error) {
      logger.error({ error }, 'Error loading agents from database');
      throw error;
    }
  }

  /**
   * Deploy agent with database persistence
   */
  override deploy(agent: AgentDescriptor): boolean {
    const result = super.deploy(agent);

    if (result && this.syncEnabled) {
      this.saveToDatabase(agent).catch(error => {
        logger.error({ error, agentId: agent.id }, 'Failed to save agent to database');
      });
    }

    return result;
  }

  /**
   * Deploy multiple agents with batch database insertion
   */
  override deployBatch(agentList: AgentDescriptor[]): { success: number; failed: number; errors: string[] } {
    const result = super.deployBatch(agentList);

    if (this.syncEnabled && result.success > 0) {
      // Get successfully deployed agents
      const deployed = agentList.slice(0, result.success);

      this.saveBatchToDatabase(deployed).catch(error => {
        logger.error({ error }, 'Failed to save agent batch to database');
      });
    }

    return result;
  }

  /**
   * Update agent with database persistence
   */
  override update(agentId: string, updates: Partial<AgentDescriptor>): boolean {
    const result = super.update(agentId, updates);

    if (result && this.syncEnabled) {
      const agent = this.get(agentId);
      if (agent) {
        this.saveToDatabase(agent).catch(error => {
          logger.error({ error, agentId }, 'Failed to update agent in database');
        });
      }
    }

    return result;
  }

  /**
   * Remove agent with database deletion
   */
  override remove(agentId: string): boolean {
    const result = super.remove(agentId);

    if (result && this.syncEnabled) {
      this.deleteFromDatabase(agentId).catch(error => {
        logger.error({ error, agentId }, 'Failed to delete agent from database');
      });
    }

    return result;
  }

  /**
   * Save single agent to database (upsert)
   */
  private async saveToDatabase(agent: AgentDescriptor): Promise<void> {
    try {
      await prisma.agent.upsert({
        where: { id: agent.id },
        create: {
          id: agent.id,
          name: agent.name,
          version: agent.version,
          category: agent.category || null,
          tags: agent.tags || [],
          enabled: agent.enabled ?? true,
          deployedAt: agent.deployedAt ? new Date(agent.deployedAt) : new Date(),
          capabilities: agent.capabilities as any,
          config: agent.config as any,
        },
        update: {
          name: agent.name,
          version: agent.version,
          category: agent.category || null,
          tags: agent.tags || [],
          enabled: agent.enabled ?? true,
          capabilities: agent.capabilities as any,
          config: agent.config as any,
        },
      });

      logger.debug({ agentId: agent.id }, 'Saved agent to database');
    } catch (error) {
      logger.error({ error, agentId: agent.id }, 'Error saving agent to database');
      throw error;
    }
  }

  /**
   * Save multiple agents to database (batch upsert)
   */
  private async saveBatchToDatabase(agents: AgentDescriptor[]): Promise<void> {
    try {
      // Prisma doesn't have a native upsert many, so we use transactions
      await prisma.$transaction(
        agents.map(agent =>
          prisma.agent.upsert({
            where: { id: agent.id },
            create: {
              id: agent.id,
              name: agent.name,
              version: agent.version,
              category: agent.category || null,
              tags: agent.tags || [],
              enabled: agent.enabled ?? true,
              deployedAt: agent.deployedAt ? new Date(agent.deployedAt) : new Date(),
              capabilities: agent.capabilities as any,
              config: agent.config as any,
            },
            update: {
              name: agent.name,
              version: agent.version,
              category: agent.category || null,
              tags: agent.tags || [],
              enabled: agent.enabled ?? true,
              capabilities: agent.capabilities as any,
              config: agent.config as any,
            },
          })
        )
      );

      logger.debug({ count: agents.length }, 'Saved agent batch to database');
    } catch (error) {
      logger.error({ error, count: agents.length }, 'Error saving agent batch to database');
      throw error;
    }
  }

  /**
   * Delete agent from database
   */
  private async deleteFromDatabase(agentId: string): Promise<void> {
    try {
      await prisma.agent.delete({
        where: { id: agentId },
      });

      logger.debug({ agentId }, 'Deleted agent from database');
    } catch (error) {
      logger.error({ error, agentId }, 'Error deleting agent from database');
      throw error;
    }
  }

  /**
   * Force sync all in-memory agents to database
   * Useful for manual backups or migrations
   */
  async syncToDatabase(): Promise<void> {
    try {
      const allAgents = this.list();
      await this.saveBatchToDatabase(allAgents);
      logger.info({ count: allAgents.length }, 'Synced all agents to database');
    } catch (error) {
      logger.error({ error }, 'Error syncing agents to database');
      throw error;
    }
  }

  /**
   * Reload all agents from database
   * Replaces in-memory state with database state
   */
  async reloadFromDatabase(): Promise<void> {
    // Clear in-memory state
    this.syncEnabled = false;

    // Clear the private agents map (hacky, but necessary)
    const allAgents = this.list();
    for (const agent of allAgents) {
      super.remove(agent.id);
    }

    // Reload from database
    await this.loadFromDatabase();

    logger.info('Reloaded agents from database');
  }
}

/**
 * Global persisted registry instance
 * Use this instead of the in-memory agentRegistry for production
 */
export const persistedAgentRegistry = new PersistedAgentRegistry();
