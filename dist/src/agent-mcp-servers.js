import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as net from 'net';
import * as fs from 'fs/promises';
import * as path from 'path';
export class AgentMCPServerManager extends EventEmitter {
    servers = new Map();
    portAllocator = new Set();
    nextPort = 8800; // Start from 8800 for agent servers
    sharingAgreements = new Map();
    toolRegistry = new Map();
    constructor() {
        super();
        this.setupCleanupInterval();
    }
    // Create MCP server for an agent
    async createAgentMCPServer(agentId, config = {}) {
        if (this.servers.has(agentId)) {
            return { success: false, error: 'Agent already has MCP server' };
        }
        const port = this.allocatePort();
        const serverConfig = {
            maxClients: config.maxClients || 10,
            allowedAgents: config.allowedAgents,
            requireAuth: config.requireAuth || false,
            rateLimits: config.rateLimits || {
                requestsPerMinute: 60,
                requestsPerHour: 1000
            },
            monetization: config.monetization
        };
        const agentServer = {
            agentId,
            port,
            tools: new Map(),
            clients: new Set(),
            status: 'starting',
            createdAt: Date.now(),
            lastActivity: Date.now(),
            config: serverConfig
        };
        try {
            // Create server process
            const serverProcess = await this.spawnAgentMCPProcess(agentId, port, serverConfig);
            agentServer.process = serverProcess;
            agentServer.status = 'running';
            this.servers.set(agentId, agentServer);
            this.emit('serverCreated', { agentId, port });
            return { success: true, port };
        }
        catch (error) {
            this.releasePort(port);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    // Add tool to agent's MCP server
    async addToolToAgent(agentId, tool) {
        const server = this.servers.get(agentId);
        if (!server) {
            return { success: false, error: 'Agent MCP server not found' };
        }
        // Validate tool
        if (!tool.name || !tool.handler) {
            return { success: false, error: 'Invalid tool definition' };
        }
        server.tools.set(tool.name, tool);
        server.lastActivity = Date.now();
        // Register in global tool registry if shareable
        if (tool.shareable) {
            this.toolRegistry.set(`${agentId}:${tool.name}`, { agentId, tool });
        }
        this.emit('toolAdded', { agentId, toolName: tool.name });
        return { success: true };
    }
    // Share tool with another agent
    async shareToolWithAgent(providerAgentId, consumerAgentId, toolName, options = {}) {
        const providerServer = this.servers.get(providerAgentId);
        if (!providerServer) {
            return { success: false, error: 'Provider agent MCP server not found' };
        }
        const tool = providerServer.tools.get(toolName);
        if (!tool) {
            return { success: false, error: 'Tool not found' };
        }
        if (!tool.shareable) {
            return { success: false, error: 'Tool is not shareable' };
        }
        const agreementId = `share-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const expiresAt = options.expiresIn ? Date.now() + options.expiresIn : undefined;
        const agreement = {
            id: agreementId,
            providerAgentId,
            consumerAgentId,
            toolName,
            permissions: options.permissions || [],
            costPerUse: options.costPerUse,
            expiresAt,
            createdAt: Date.now(),
            active: true
        };
        this.sharingAgreements.set(agreementId, agreement);
        this.emit('toolShared', agreement);
        return { success: true, agreementId };
    }
    // Connect agent to another agent's MCP server
    async connectToAgentMCP(clientAgentId, serverAgentId) {
        const server = this.servers.get(serverAgentId);
        if (!server) {
            return { success: false, error: 'Target agent MCP server not found' };
        }
        if (server.status !== 'running') {
            return { success: false, error: 'Target agent MCP server not running' };
        }
        // Check permissions
        if (server.config.allowedAgents && !server.config.allowedAgents.includes(clientAgentId)) {
            return { success: false, error: 'Client agent not authorized' };
        }
        if (server.clients.size >= server.config.maxClients) {
            return { success: false, error: 'Server at maximum capacity' };
        }
        try {
            // Create connection to agent's MCP server
            const connection = await this.createMCPConnection(clientAgentId, server.port);
            server.clients.add(clientAgentId);
            server.lastActivity = Date.now();
            this.emit('agentConnected', { clientAgentId, serverAgentId });
            return { success: true, connection };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    // Execute shared tool
    async executeSharedTool(consumerAgentId, providerAgentId, toolName, params) {
        // Find sharing agreement
        const agreement = Array.from(this.sharingAgreements.values()).find(a => a.providerAgentId === providerAgentId &&
            a.consumerAgentId === consumerAgentId &&
            a.toolName === toolName &&
            a.active &&
            (!a.expiresAt || Date.now() < a.expiresAt));
        if (!agreement) {
            return { success: false, error: 'No valid sharing agreement found' };
        }
        const providerServer = this.servers.get(providerAgentId);
        if (!providerServer) {
            return { success: false, error: 'Provider server not found' };
        }
        const tool = providerServer.tools.get(toolName);
        if (!tool) {
            return { success: false, error: 'Tool not found' };
        }
        try {
            // Execute tool with context
            const context = {
                consumerAgentId,
                providerAgentId,
                agreementId: agreement.id,
                permissions: agreement.permissions
            };
            const result = await tool.handler(params, context);
            providerServer.lastActivity = Date.now();
            this.emit('sharedToolExecuted', { agreement, params, result });
            return {
                success: true,
                result,
                cost: agreement.costPerUse
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    // Discover available tools across the network
    discoverTools(filters = {}) {
        const results = [];
        for (const [key, entry] of this.toolRegistry.entries()) {
            const { agentId, tool } = entry;
            // Apply filters
            if (filters.agentType && !agentId.includes(filters.agentType))
                continue;
            if (filters.maxCost !== undefined && (tool.cost || 0) > filters.maxCost)
                continue;
            // Check if any sharing agreement exists or tool is freely shareable
            const hasSharing = Array.from(this.sharingAgreements.values()).some(a => a.providerAgentId === agentId && a.toolName === tool.name && a.active);
            if (tool.shareable || hasSharing) {
                results.push({
                    agentId,
                    toolName: tool.name,
                    tool,
                    cost: tool.cost
                });
            }
        }
        return results;
    }
    // Get agent's MCP server info
    getAgentMCPServer(agentId) {
        return this.servers.get(agentId);
    }
    // Get all sharing agreements for an agent
    getSharingAgreements(agentId) {
        const providing = [];
        const consuming = [];
        for (const agreement of this.sharingAgreements.values()) {
            if (agreement.providerAgentId === agentId) {
                providing.push(agreement);
            }
            if (agreement.consumerAgentId === agentId) {
                consuming.push(agreement);
            }
        }
        return { providing, consuming };
    }
    // Stop agent's MCP server
    async stopAgentMCPServer(agentId) {
        const server = this.servers.get(agentId);
        if (!server) {
            return { success: false, error: 'Server not found' };
        }
        try {
            if (server.process) {
                server.process.kill('SIGTERM');
            }
            server.status = 'stopped';
            this.releasePort(server.port);
            this.servers.delete(agentId);
            // Clean up tool registry
            for (const [key, entry] of this.toolRegistry.entries()) {
                if (entry.agentId === agentId) {
                    this.toolRegistry.delete(key);
                }
            }
            this.emit('serverStopped', { agentId });
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    allocatePort() {
        while (this.portAllocator.has(this.nextPort)) {
            this.nextPort++;
        }
        this.portAllocator.add(this.nextPort);
        return this.nextPort++;
    }
    releasePort(port) {
        this.portAllocator.delete(port);
    }
    async spawnAgentMCPProcess(agentId, port, config) {
        // Create agent-specific MCP server script
        const serverScript = this.generateAgentMCPScript(agentId, port, config);
        const scriptPath = path.join(process.cwd(), `agent-mcp-${agentId}.js`);
        await fs.writeFile(scriptPath, serverScript);
        // Spawn the process
        const childProcess = spawn('node', [scriptPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: { ...process.env, AGENT_ID: agentId, MCP_PORT: port.toString() }
        });
        // Setup process monitoring
        childProcess.on('exit', (code) => {
            const server = this.servers.get(agentId);
            if (server) {
                server.status = code === 0 ? 'stopped' : 'error';
                this.emit('serverExited', { agentId, code });
            }
        });
        return childProcess;
    }
    generateAgentMCPScript(agentId, port, config) {
        return `
// Auto-generated MCP server for agent: ${agentId}
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as net from 'net';

const server = new Server(
  { name: 'agent-mcp-${agentId}', version: '1.0.0' },
  { 
    tools: {
      // Tools will be dynamically added here
    }
  }
);

// Create TCP server for inter-agent communication
const tcpServer = net.createServer((socket) => {
  console.log('Agent connected to ${agentId} MCP server');
  
  socket.on('data', async (data) => {
    try {
      const request = JSON.parse(data.toString());
      // Handle MCP requests
      const response = await handleMCPRequest(request);
      socket.write(JSON.stringify(response));
    } catch (error) {
      socket.write(JSON.stringify({ error: error.message }));
    }
  });
});

tcpServer.listen(${port}, () => {
  console.log('Agent ${agentId} MCP server listening on port ${port}');
});

async function handleMCPRequest(request) {
  // Implement MCP request handling
  return { success: true, result: 'Agent MCP server response' };
}

// Connect to stdio for main MCP communication
await server.connect(new StdioServerTransport());
`;
    }
    async createMCPConnection(clientAgentId, port) {
        return new Promise((resolve, reject) => {
            const client = net.createConnection({ port }, () => {
                resolve({
                    send: (data) => client.write(JSON.stringify(data)),
                    close: () => client.end()
                });
            });
            client.on('error', reject);
        });
    }
    setupCleanupInterval() {
        setInterval(() => {
            this.cleanupInactiveServers();
            this.cleanupExpiredAgreements();
        }, 300000); // Clean up every 5 minutes
    }
    cleanupInactiveServers() {
        const now = Date.now();
        const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
        for (const [agentId, server] of this.servers.entries()) {
            if (now - server.lastActivity > inactiveThreshold && server.clients.size === 0) {
                this.stopAgentMCPServer(agentId);
            }
        }
    }
    cleanupExpiredAgreements() {
        const now = Date.now();
        for (const [id, agreement] of this.sharingAgreements.entries()) {
            if (agreement.expiresAt && now > agreement.expiresAt) {
                agreement.active = false;
                this.emit('agreementExpired', { agreement });
            }
        }
    }
}
export const agentMCPManager = new AgentMCPServerManager();
