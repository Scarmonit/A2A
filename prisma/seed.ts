/**
 * Database Seed Script
 *
 * This script populates the database with default agents and sample data.
 * Run with: npm run db:seed
 */

import { PrismaClient } from '@prisma/client';
import { agentRegistry } from '../src/agents.js';
import { ENHANCED_AGENT_TYPES, createEnhancedAgent, createAgentEcosystem } from '../src/enhanced-agents.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data (optional - comment out if you want to preserve data)
  console.log('🗑️  Clearing existing data...');
  await prisma.toolUsage.deleteMany();
  await prisma.agentCommunication.deleteMany();
  await prisma.mcpServer.deleteMany();
  await prisma.agentPersonality.deleteMany();
  await prisma.workflowStep.deleteMany();
  await prisma.workflow.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.agent.deleteMany();

  console.log('✅ Cleared existing data');

  // ============================================================================
  // Seed Agents
  // ============================================================================

  console.log('📦 Creating default agents...');

  // 1. Echo Agent (basic test agent)
  const echoAgent = {
    id: 'echo',
    name: 'Echo Agent',
    version: '1.0.0',
    category: 'utility',
    tags: ['echo', 'test', 'utility'],
    enabled: true,
    capabilities: [
      {
        name: 'chat',
        description: 'Echoes your input back, token-streamed.',
        inputSchema: {
          type: 'object',
          properties: {
            messages: {
              type: 'array',
              items: {
                type: 'object',
                required: ['role', 'content'],
                properties: {
                  role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                  content: { type: 'string' },
                },
              },
            },
          },
          required: ['messages'],
        },
        outputSchema: {
          type: 'object',
          properties: {
            requestId: { type: 'string' },
            streamUrl: { type: 'string' },
          },
          required: ['requestId', 'streamUrl'],
        },
      },
    ],
  };

  await prisma.agent.create({ data: echoAgent as any });
  console.log('  ✓ Created Echo Agent');

  // 2. Enhanced Agents - Create one of each type
  const enhancedAgentTypes = Object.values(ENHANCED_AGENT_TYPES);
  let createdCount = 0;

  for (const agentType of enhancedAgentTypes) {
    try {
      const agent = createEnhancedAgent(agentType, {
        enabled: true,
      });

      await prisma.agent.create({
        data: {
          id: agent.id,
          name: agent.name,
          version: agent.version,
          category: agent.category || null,
          tags: agent.tags || [],
          enabled: agent.enabled ?? true,
          capabilities: agent.capabilities as any,
          config: agent.config as any,
        },
      });

      createdCount++;
      console.log(`  ✓ Created ${agent.name} (${agentType})`);
    } catch (error) {
      console.error(`  ✗ Failed to create ${agentType}:`, error);
    }
  }

  console.log(`✅ Created ${createdCount + 1} agents (1 basic + ${createdCount} enhanced)`);

  // 3. Generate programmatic agents for scale testing (optional)
  if (process.env.SEED_SCALE_AGENTS === 'true') {
    console.log('📦 Generating scale test agents...');

    const scaleAgents = agentRegistry.generateAgents(100, {
      enabled: true,
      tags: ['scale-test', 'generated'],
    });

    await prisma.agent.createMany({
      data: scaleAgents.map(agent => ({
        id: agent.id,
        name: agent.name,
        version: agent.version,
        category: agent.category || null,
        tags: agent.tags || [],
        enabled: agent.enabled ?? true,
        capabilities: agent.capabilities as any,
        config: agent.config as any,
      })),
    });

    console.log(`✅ Created 100 scale test agents`);
  }

  // ============================================================================
  // Seed Sample Workflows
  // ============================================================================

  console.log('📋 Creating sample workflows...');

  // Get the first agent for workflow assignment
  const firstAgent = await prisma.agent.findFirst();

  if (firstAgent) {
    const sampleWorkflow = await prisma.workflow.create({
      data: {
        name: 'Sample Multi-Step Workflow',
        description: 'Demonstrates a multi-step workflow with dependencies',
        agentId: firstAgent.id,
        status: 'PENDING',
        priority: 1,
        context: {
          purpose: 'demonstration',
          createdBy: 'seed-script',
        },
        steps: {
          create: [
            {
              name: 'Initialize',
              order: 0,
              status: 'PENDING',
              input: { action: 'initialize', params: {} },
              dependsOn: [],
            },
            {
              name: 'Process Data',
              order: 1,
              status: 'PENDING',
              input: { action: 'process', source: 'data.json' },
              dependsOn: [],
            },
            {
              name: 'Generate Report',
              order: 2,
              status: 'PENDING',
              input: { action: 'report', format: 'html' },
              dependsOn: [],
            },
          ],
        },
      },
    });

    console.log(`  ✓ Created workflow: ${sampleWorkflow.name}`);
  }

  console.log('✅ Created sample workflows');

  // ============================================================================
  // Seed Sample Memories
  // ============================================================================

  console.log('🧠 Creating sample memories...');

  if (firstAgent) {
    const memories = [
      {
        agentId: firstAgent.id,
        type: 'CONVERSATION',
        content: 'User prefers concise responses with code examples',
        importance: 0.8,
        context: { source: 'user-interaction', timestamp: new Date().toISOString() },
      },
      {
        agentId: firstAgent.id,
        type: 'PROCEDURAL',
        content: 'Successfully deployed to production using Railway',
        importance: 0.7,
        context: { task: 'deployment', platform: 'railway' },
      },
      {
        agentId: firstAgent.id,
        type: 'TOOL_USAGE',
        content: 'http_request tool frequently used for API testing',
        importance: 0.6,
        context: { toolName: 'http_request', usageCount: 15 },
      },
    ];

    await prisma.memory.createMany({
      data: memories as any,
    });

    console.log(`  ✓ Created ${memories.length} sample memories`);
  }

  console.log('✅ Created sample memories');

  // ============================================================================
  // Seed Agent Personalities
  // ============================================================================

  console.log('🎭 Creating agent personalities...');

  const agents = await prisma.agent.findMany({ take: 5 });

  for (const agent of agents) {
    await prisma.agentPersonality.create({
      data: {
        id: `personality-${agent.id}`,
        agentId: agent.id,
        creativity: 0.5 + Math.random() * 0.3, // 0.5-0.8
        cautiousness: 0.4 + Math.random() * 0.4, // 0.4-0.8
        verbosity: 0.5,
        technicalDepth: 0.7,
        userFocus: 0.8,
        totalInteractions: Math.floor(Math.random() * 50),
        positiveCount: Math.floor(Math.random() * 30),
        negativeCount: Math.floor(Math.random() * 5),
      },
    });
  }

  console.log(`  ✓ Created ${agents.length} agent personalities`);
  console.log('✅ Created agent personalities');

  // ============================================================================
  // Database Statistics
  // ============================================================================

  const stats = {
    agents: await prisma.agent.count(),
    workflows: await prisma.workflow.count(),
    workflowSteps: await prisma.workflowStep.count(),
    memories: await prisma.memory.count(),
    personalities: await prisma.agentPersonality.count(),
  };

  console.log('\n📊 Database Statistics:');
  console.log(`   Agents: ${stats.agents}`);
  console.log(`   Workflows: ${stats.workflows}`);
  console.log(`   Workflow Steps: ${stats.workflowSteps}`);
  console.log(`   Memories: ${stats.memories}`);
  console.log(`   Personalities: ${stats.personalities}`);

  console.log('\n✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
