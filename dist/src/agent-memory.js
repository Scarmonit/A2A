import pino from 'pino';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
export class AgentMemorySystem {
    memories = new Map();
    conversations = new Map();
    personalities = new Map();
    memoryDir;
    maxMemoriesPerAgent = 10000;
    cleanupInterval = 24 * 60 * 60 * 1000; // 24 hours
    constructor(memoryDir = './data/agent-memory') {
        this.memoryDir = memoryDir;
        this.initialize();
    }
    async initialize() {
        try {
            await fs.mkdir(this.memoryDir, { recursive: true });
            await this.loadPersistedData();
            this.startCleanupJobs();
        }
        catch (error) {
            logger.error({ error }, 'Failed to initialize agent memory system');
        }
    }
    // Store a memory
    async storeMemory(memory) {
        const memoryId = uuidv4();
        const fullMemory = {
            ...memory,
            id: memoryId
        };
        if (!this.memories.has(memory.agentId)) {
            this.memories.set(memory.agentId, []);
        }
        const agentMemories = this.memories.get(memory.agentId);
        agentMemories.push(fullMemory);
        // Maintain memory limit per agent
        if (agentMemories.length > this.maxMemoriesPerAgent) {
            // Remove least important and oldest memories
            agentMemories.sort((a, b) => (b.metadata.importance * (Date.now() - b.metadata.lastAccessed)) -
                (a.metadata.importance * (Date.now() - a.metadata.lastAccessed)));
            agentMemories.splice(this.maxMemoriesPerAgent);
        }
        // Persist to disk periodically
        if (Math.random() < 0.1) { // 10% chance to trigger persistence
            this.persistMemories(memory.agentId);
        }
        logger.debug({
            agentId: memory.agentId,
            memoryType: memory.type,
            memoryId
        }, 'Memory stored');
        return memoryId;
    }
    // Retrieve memories with filtering and similarity search
    async retrieveMemories(params) {
        const agentMemories = this.memories.get(params.agentId) || [];
        let filtered = agentMemories.filter(memory => {
            // Type filter
            if (params.type && memory.type !== params.type)
                return false;
            // Session filter
            if (params.sessionId && memory.context.sessionId !== params.sessionId)
                return false;
            // User filter
            if (params.userId && memory.context.userId !== params.userId)
                return false;
            // Importance filter
            if (params.minImportance && memory.metadata.importance < params.minImportance)
                return false;
            // Age filter
            if (params.maxAge) {
                const age = Date.now() - memory.context.timestamp;
                if (age > params.maxAge)
                    return false;
            }
            // Tags filter
            if (params.tags && params.tags.length > 0) {
                const hasTag = params.tags.some(tag => memory.metadata.tags.includes(tag));
                if (!hasTag)
                    return false;
            }
            return true;
        });
        // Update access timestamps
        filtered.forEach(memory => {
            memory.metadata.lastAccessed = Date.now();
        });
        // Sort by importance and recency
        filtered.sort((a, b) => {
            const scoreA = a.metadata.importance * (1 - (Date.now() - a.context.timestamp) / (365 * 24 * 60 * 60 * 1000));
            const scoreB = b.metadata.importance * (1 - (Date.now() - b.context.timestamp) / (365 * 24 * 60 * 60 * 1000));
            return scoreB - scoreA;
        });
        // Apply limit
        if (params.limit) {
            filtered = filtered.slice(0, params.limit);
        }
        logger.debug({
            agentId: params.agentId,
            totalMemories: agentMemories.length,
            filteredCount: filtered.length
        }, 'Memories retrieved');
        return filtered;
    }
    // Learn from agent execution results
    async learn(event) {
        const agentId = event.agentId;
        // Store procedural memory about what works
        if (event.eventType === 'success') {
            await this.storeMemory({
                agentId,
                type: 'procedural',
                content: {
                    strategy: this.extractStrategy(event),
                    inputs: event.context.inputs,
                    outputs: event.context.outputs,
                    tools: event.context.toolsUsed,
                    executionTime: event.context.executionTime
                },
                context: {
                    timestamp: Date.now(),
                    capability: event.context.capability
                },
                metadata: {
                    importance: 0.7,
                    frequency: 1,
                    lastAccessed: Date.now(),
                    decayRate: 0.01,
                    tags: ['success', event.context.capability, ...event.context.toolsUsed]
                }
            });
        }
        // Learn from failures
        if (event.eventType === 'failure') {
            await this.storeMemory({
                agentId,
                type: 'episodic',
                content: {
                    error: event.data.error,
                    inputs: event.context.inputs,
                    attempted_tools: event.context.toolsUsed,
                    failure_reason: event.data.reason
                },
                context: {
                    timestamp: Date.now(),
                    capability: event.context.capability
                },
                metadata: {
                    importance: 0.8, // Failures are important to remember
                    frequency: 1,
                    lastAccessed: Date.now(),
                    decayRate: 0.005, // Decay slower than successes
                    tags: ['failure', event.context.capability, 'avoid']
                }
            });
            // Update personality to be more cautious
            this.adaptPersonality(agentId, { cautiousness: 0.05 });
        }
        // Learn from user feedback
        if (event.eventType === 'user_feedback' && event.feedback) {
            const importance = Math.abs(event.feedback.score) * 0.9; // High importance for feedback
            await this.storeMemory({
                agentId,
                type: 'preference',
                content: {
                    feedback_score: event.feedback.score,
                    comments: event.feedback.comments,
                    context: event.context,
                    user_preference: event.feedback.score > 0 ? 'liked' : 'disliked'
                },
                context: {
                    timestamp: Date.now(),
                    userId: event.feedback.userId,
                    capability: event.context.capability
                },
                metadata: {
                    importance,
                    frequency: 1,
                    lastAccessed: Date.now(),
                    decayRate: 0.002, // Very slow decay for user feedback
                    tags: ['user_feedback', event.feedback.score > 0 ? 'positive' : 'negative']
                }
            });
            // Adapt personality based on feedback
            if (event.feedback.score > 0.5) {
                this.adaptPersonality(agentId, {
                    creativity: 0.02,
                    user_focus: 0.03
                });
            }
            else if (event.feedback.score < -0.5) {
                this.adaptPersonality(agentId, {
                    cautiousness: 0.04,
                    technical_depth: 0.02
                });
            }
        }
        logger.info({
            agentId,
            eventType: event.eventType,
            capability: event.context.capability
        }, 'Learning event processed');
    }
    // Manage conversation context
    async updateConversationContext(params) {
        if (!this.conversations.has(params.sessionId)) {
            this.conversations.set(params.sessionId, {
                sessionId: params.sessionId,
                agentId: params.agentId,
                userId: params.userId,
                history: [],
                topics: [],
                sentiment: 'neutral',
                lastInteraction: Date.now()
            });
        }
        const context = this.conversations.get(params.sessionId);
        context.history.push({
            timestamp: Date.now(),
            role: params.message.role,
            content: params.message.content,
            metadata: params.message.metadata
        });
        context.lastInteraction = Date.now();
        // Maintain conversation history limit
        if (context.history.length > 100) {
            // Keep recent messages and create a summary
            const oldMessages = context.history.splice(0, context.history.length - 50);
            context.summary = this.summarizeConversation(oldMessages);
        }
        // Extract topics and update sentiment (simplified)
        if (params.message.role === 'user') {
            const topics = this.extractTopics(params.message.content);
            context.topics = [...new Set([...context.topics, ...topics])];
            context.sentiment = this.analyzeSentiment(params.message.content);
        }
        // Store conversation memory
        await this.storeMemory({
            agentId: params.agentId,
            type: 'conversation',
            content: {
                message: params.message,
                topics: this.extractTopics(params.message.content),
                sentiment: context.sentiment
            },
            context: {
                timestamp: Date.now(),
                sessionId: params.sessionId,
                userId: params.userId
            },
            metadata: {
                importance: params.message.role === 'user' ? 0.6 : 0.4,
                frequency: 1,
                lastAccessed: Date.now(),
                decayRate: 0.02,
                tags: ['conversation', params.message.role, ...context.topics.slice(-3)]
            }
        });
    }
    // Get conversation context
    getConversationContext(sessionId) {
        return this.conversations.get(sessionId);
    }
    // Get or initialize agent personality
    getAgentPersonality(agentId) {
        if (!this.personalities.has(agentId)) {
            // Initialize with default personality
            this.personalities.set(agentId, {
                traits: {
                    creativity: 0.5,
                    cautiousness: 0.5,
                    verbosity: 0.5,
                    technical_depth: 0.5,
                    user_focus: 0.5
                },
                preferences: {
                    tools: [],
                    patterns: [],
                    communication_style: 'conversational'
                },
                learned_behaviors: {
                    successful_strategies: [],
                    avoided_patterns: []
                },
                adaptation_rate: 0.1
            });
        }
        return this.personalities.get(agentId);
    }
    // Adapt agent personality based on experience
    adaptPersonality(agentId, changes) {
        const personality = this.getAgentPersonality(agentId);
        Object.entries(changes).forEach(([trait, delta]) => {
            const currentValue = personality.traits[trait] || 0.5;
            const newValue = Math.max(0, Math.min(1, currentValue + delta * personality.adaptation_rate));
            personality.traits[trait] = newValue;
        });
        logger.debug({ agentId, changes }, 'Personality adapted');
    }
    // Generate context-aware suggestions for agent behavior
    async getSuggestions(params) {
        // Get relevant memories
        const relevantMemories = await this.retrieveMemories({
            agentId: params.agentId,
            tags: [params.capability],
            limit: 20,
            minImportance: 0.3
        });
        const successfulMemories = relevantMemories.filter(m => m.metadata.tags.includes('success'));
        const failureMemories = relevantMemories.filter(m => m.metadata.tags.includes('failure'));
        // Analyze successful patterns
        const toolUsage = new Map();
        successfulMemories.forEach(memory => {
            if (memory.content.tools) {
                memory.content.tools.forEach((tool) => {
                    toolUsage.set(tool, (toolUsage.get(tool) || 0) + 1);
                });
            }
        });
        const recommendedTools = Array.from(toolUsage.entries())
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([tool]) => tool);
        // Analyze patterns to avoid
        const avoidedPatterns = failureMemories
            .map(memory => memory.content.error || memory.content.failure_reason)
            .filter(Boolean)
            .slice(0, 3);
        // Get personality
        const personality = this.getAgentPersonality(params.agentId);
        // Suggest personality adjustments based on context
        const personalityAdjustments = {};
        if (params.context?.userId) {
            // User-specific adaptations
            const userMemories = relevantMemories.filter(m => m.context.userId === params.context.userId);
            if (userMemories.length > 0) {
                const avgFeedback = userMemories
                    .filter(m => m.content.feedback_score !== undefined)
                    .reduce((sum, m) => sum + m.content.feedback_score, 0) / userMemories.length;
                if (avgFeedback < 0) {
                    personalityAdjustments.cautiousness = 0.1;
                    personalityAdjustments.technical_depth = 0.05;
                }
            }
        }
        const confidenceLevel = Math.min(1, relevantMemories.length / 10);
        return {
            recommendedTools,
            avoidedPatterns,
            personalityAdjustments,
            confidenceLevel
        };
    }
    extractStrategy(event) {
        // Simple strategy extraction - could be enhanced with NLP
        const tools = event.context.toolsUsed.join(' -> ');
        const capability = event.context.capability;
        return `${capability}: ${tools}`;
    }
    extractTopics(content) {
        // Simple topic extraction - could be enhanced with NLP
        const words = content.toLowerCase().split(/\s+/);
        const topics = words.filter(word => word.length > 4 &&
            !['the', 'and', 'but', 'with', 'from', 'they', 'have', 'this', 'that', 'will', 'your', 'can'].includes(word));
        return topics.slice(0, 5);
    }
    analyzeSentiment(content) {
        // Simple sentiment analysis - could be enhanced with ML
        const positiveWords = ['good', 'great', 'excellent', 'perfect', 'love', 'like', 'amazing', 'awesome'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'wrong', 'error', 'problem'];
        const words = content.toLowerCase().split(/\s+/);
        const positiveCount = words.filter(w => positiveWords.includes(w)).length;
        const negativeCount = words.filter(w => negativeWords.includes(w)).length;
        if (positiveCount > negativeCount)
            return 'positive';
        if (negativeCount > positiveCount)
            return 'negative';
        return 'neutral';
    }
    summarizeConversation(messages) {
        // Simple summarization - could be enhanced with AI
        const userMessages = messages.filter(m => m.role === 'user').slice(-5);
        const topics = userMessages.flatMap(m => this.extractTopics(m.content));
        const uniqueTopics = [...new Set(topics)].slice(0, 3);
        return `Discussed: ${uniqueTopics.join(', ')}`;
    }
    async persistMemories(agentId) {
        try {
            const memories = this.memories.get(agentId) || [];
            const filePath = path.join(this.memoryDir, `${agentId}-memories.json`);
            await fs.writeFile(filePath, JSON.stringify({
                memories,
                personality: this.personalities.get(agentId),
                lastUpdated: Date.now()
            }, null, 2));
            logger.debug({ agentId, memoryCount: memories.length }, 'Memories persisted to disk');
        }
        catch (error) {
            logger.error({ error, agentId }, 'Failed to persist memories');
        }
    }
    async loadPersistedData() {
        try {
            const files = await fs.readdir(this.memoryDir);
            const memoryFiles = files.filter(f => f.endsWith('-memories.json'));
            for (const file of memoryFiles) {
                const agentId = file.replace('-memories.json', '');
                const filePath = path.join(this.memoryDir, file);
                try {
                    const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
                    this.memories.set(agentId, data.memories || []);
                    if (data.personality) {
                        this.personalities.set(agentId, data.personality);
                    }
                }
                catch (error) {
                    logger.warn({ file, error }, 'Failed to load memory file');
                }
            }
            logger.info({
                agentCount: this.memories.size,
                totalMemories: Array.from(this.memories.values()).reduce((sum, memories) => sum + memories.length, 0)
            }, 'Persisted memories loaded');
        }
        catch (error) {
            logger.error({ error }, 'Failed to load persisted data');
        }
    }
    startCleanupJobs() {
        setInterval(() => {
            this.cleanupMemories();
        }, this.cleanupInterval);
        setInterval(() => {
            this.persistAllMemories();
        }, 30 * 60 * 1000); // Persist every 30 minutes
    }
    cleanupMemories() {
        const now = Date.now();
        let totalCleaned = 0;
        for (const [agentId, memories] of this.memories) {
            const initialCount = memories.length;
            // Remove expired memories based on decay rate
            this.memories.set(agentId, memories.filter(memory => {
                const age = now - memory.context.timestamp;
                const maxAge = (1 / memory.metadata.decayRate) * 24 * 60 * 60 * 1000; // Convert decay rate to max age
                return age < maxAge;
            }));
            totalCleaned += initialCount - this.memories.get(agentId).length;
        }
        // Cleanup old conversations (older than 7 days)
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const conversationsBefore = this.conversations.size;
        for (const [sessionId, context] of this.conversations) {
            if (context.lastInteraction < sevenDaysAgo) {
                this.conversations.delete(sessionId);
            }
        }
        const conversationsCleaned = conversationsBefore - this.conversations.size;
        logger.info({
            memoriesCleaned: totalCleaned,
            conversationsCleaned,
            activeAgents: this.memories.size,
            activeConversations: this.conversations.size
        }, 'Memory cleanup completed');
    }
    async persistAllMemories() {
        const agentIds = Array.from(this.memories.keys());
        for (const agentId of agentIds) {
            await this.persistMemories(agentId);
        }
        logger.info({ agentCount: agentIds.length }, 'All memories persisted');
    }
    // Get memory statistics
    getMemoryStats() {
        let totalMemories = 0;
        const memoriesByType = {
            conversation: 0,
            procedural: 0,
            episodic: 0,
            semantic: 0,
            tool_usage: 0,
            preference: 0
        };
        const memoriesByAgent = {};
        let totalImportance = 0;
        for (const [agentId, memories] of this.memories) {
            memoriesByAgent[agentId] = memories.length;
            totalMemories += memories.length;
            memories.forEach(memory => {
                memoriesByType[memory.type]++;
                totalImportance += memory.metadata.importance;
            });
        }
        return {
            totalMemories,
            memoriesByType,
            memoriesByAgent,
            averageImportance: totalMemories > 0 ? totalImportance / totalMemories : 0,
            activeConversations: this.conversations.size
        };
    }
}
export const agentMemorySystem = new AgentMemorySystem();
