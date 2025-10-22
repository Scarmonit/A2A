import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { agents, agentRegistry, ensureRequestId } from './agents.js';
import { practicalToolRegistry } from './practical-tools.js';
import { createEnhancedAgent, createAgentEcosystem, ENHANCED_AGENT_TYPES } from './enhanced-agents.js';
import { agentExecutor } from './agent-executor.js';
import { permissionManager } from './permissions.js';
import { agentMCPManager } from './agent-mcp-servers.js';
import { StreamHub } from './streaming.js';
import pino from 'pino';
import * as http from 'http';
import client, { Counter, Gauge } from 'prom-client';
const requests = new Map();
const idempotency = new Map(); // idempotencyKey -> entry
const ENABLE_STREAMING = process.env.ENABLE_STREAMING !== 'false';
const STREAM_PORT = parseInt(process.env.STREAM_PORT || '8787', 10);
const STREAM_HOST = process.env.STREAM_HOST || '127.0.0.1';
const STREAM_TOKEN = process.env.STREAM_TOKEN;
const MAX_SUBS_PER_REQUEST = parseInt(process.env.MAX_SUBS_PER_REQUEST || '16', 10);
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || '50', 10);
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '10000', 10);
const REQUEST_TTL_MS = parseInt(process.env.REQUEST_TTL_MS || String(5 * 60 * 1000), 10);
const IDEMP_TTL_MS = parseInt(process.env.IDEMP_TTL_MS || String(15 * 60 * 1000), 10);
const METRICS_PORT = parseInt(process.env.METRICS_PORT || '0', 10);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const logger = pino({ level: LOG_LEVEL, base: { service: 'a2a-mcp-server' } });
const streamHub = ENABLE_STREAMING
    ? new StreamHub(STREAM_PORT, STREAM_HOST, { token: STREAM_TOKEN, maxSubsPerRequest: MAX_SUBS_PER_REQUEST })
    : null;
function ok(data) {
    return { ok: true, data };
}
function fail(message, code = 'ERR_BAD_REQUEST') {
    return { ok: false, error: { code, message } };
}
// Metrics
const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });
const reqCreated = new Counter({ name: 'a2a_requests_created_total', help: 'Requests created', registers: [registry] });
const reqCompleted = new Counter({ name: 'a2a_requests_completed_total', help: 'Requests completed', labelNames: ['status'], registers: [registry] });
const runningGauge = new Gauge({ name: 'a2a_running_jobs', help: 'Currently running jobs', registers: [registry] });
const queueGauge = new Gauge({ name: 'a2a_queue_size', help: 'Queue length', registers: [registry] });
const wsClients = new Gauge({ name: 'a2a_ws_clients', help: 'WebSocket client count', registers: [registry] });
const wsChannels = new Gauge({ name: 'a2a_ws_channels', help: 'WebSocket channel count', registers: [registry] });
const broadcasts = new Counter({ name: 'a2a_stream_broadcasts_total', help: 'Stream broadcasts', registers: [registry] });
const agentOps = new Counter({ name: 'a2a_agent_operations_total', help: 'Agent operations', labelNames: ['operation'], registers: [registry] });
const totalAgents = new Gauge({ name: 'a2a_total_agents', help: 'Total deployed agents', registers: [registry] });
const enabledAgents = new Gauge({ name: 'a2a_enabled_agents', help: 'Enabled agents', registers: [registry] });
// Concurrency-limited queue
const queue = [];
let running = 0;
function maybeStartNext() {
    while (running < MAX_CONCURRENCY && queue.length > 0) {
        const item = queue.shift();
        const r = requests.get(item.requestId);
        if (!r || r.status === 'canceled')
            continue;
        startJob(item.requestId, item.input);
    }
    queueGauge.set(queue.length);
    runningGauge.set(running);
}
async function startJob(requestId, input) {
    running++;
    runningGauge.set(running);
    try {
        await runAgentJob(requestId, input);
    }
    catch (err) {
        const r = requests.get(requestId);
        if (r) {
            r.status = 'error';
            r.error = String(err?.message || err);
            r.updatedAt = Date.now();
            streamHub?.broadcast(requestId, {
                type: 'error',
                requestId,
                ts: Date.now(),
                message: r.error,
            });
        }
    }
    finally {
        running = Math.max(0, running - 1);
        runningGauge.set(running);
        maybeStartNext();
    }
}
// TTL cleanup
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of idempotency) {
        if (entry.expiresAt <= now || !requests.has(entry.requestId)) {
            idempotency.delete(key);
        }
    }
    for (const [id, rec] of requests) {
        if ((rec.status === 'done' || rec.status === 'error' || rec.status === 'canceled') && now - rec.updatedAt > REQUEST_TTL_MS) {
            requests.delete(id);
        }
    }
}, Math.min(REQUEST_TTL_MS, 60_000));
// periodically sample ws counts and agent stats
setInterval(() => {
    try {
        if (streamHub) {
            wsClients.set(streamHub.clientCount());
            wsChannels.set(streamHub.channelCount());
        }
        queueGauge.set(queue.length);
        runningGauge.set(running);
        // Update agent metrics
        const stats = agentRegistry.getStats();
        totalAgents.set(stats.total);
        enabledAgents.set(stats.enabled);
    }
    catch { }
}, 5000);
async function invokeAgentInternal({ agentId, capability, input, idempotencyKey, sessionId, }) {
    const a = agents[agentId];
    if (!a)
        return fail(`Unknown agent: ${agentId}`, 'ERR_NOT_FOUND');
    const cap = a.capabilities.find((c) => c.name === capability);
    if (!cap)
        return fail(`Agent ${agentId} missing capability '${capability}'`, 'ERR_NOT_FOUND');
    if (idempotencyKey && idempotency.has(idempotencyKey)) {
        const entry = idempotency.get(idempotencyKey);
        const rec = requests.get(entry.requestId);
        if (rec && entry.expiresAt > Date.now()) {
            return ok({
                requestId: entry.requestId,
                status: rec.status,
                streamUrl: streamHub ? streamHub.channelUrl(entry.requestId) : 'streaming disabled',
            });
        }
        // stale
        idempotency.delete(idempotencyKey);
    }
    const requestId = ensureRequestId();
    const rec = {
        id: requestId,
        agentId,
        capability,
        status: 'queued',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        sessionId,
    };
    requests.set(requestId, rec);
    if (idempotencyKey)
        idempotency.set(idempotencyKey, { requestId, expiresAt: Date.now() + IDEMP_TTL_MS });
    if (queue.length >= MAX_QUEUE_SIZE && running >= MAX_CONCURRENCY) {
        rec.status = 'error';
        rec.error = 'queue full';
        rec.updatedAt = Date.now();
        return fail('Queue is full', 'ERR_QUEUE_FULL');
    }
    queue.push({ requestId, input });
    queueGauge.set(queue.length);
    reqCreated.inc();
    logger.info({ requestId, agentId, capability }, 'request enqueued');
    maybeStartNext();
    const streamUrl = streamHub ? streamHub.channelUrl(requestId, STREAM_TOKEN) : 'streaming disabled';
    return ok({ requestId, status: rec.status, streamUrl });
}
const server = new Server({
    name: 'a2a-mcp-server',
    version: '0.1.0',
}, {
    tools: {
        agent_control: {
            description: 'Unified agent control: list agents, invoke capabilities, manage sessions, cancel requests, handoff between agents, get status, deploy agents, and manage agent lifecycle',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    action: {
                        type: 'string',
                        enum: ['list_agents', 'describe_agent', 'open_session', 'close_session', 'invoke_agent', 'cancel', 'get_status', 'handoff', 'deploy_agent', 'deploy_batch', 'update_agent', 'enable_agent', 'disable_agent', 'remove_agent', 'get_stats', 'generate_agents', 'filter_agents', 'create_enhanced_agent', 'create_agent_ecosystem', 'list_enhanced_types', 'execute_practical_tool', 'list_practical_tools', 'grant_permission', 'request_permission', 'approve_permission', 'revoke_permission', 'get_permissions', 'create_mcp_server', 'add_tool_to_agent', 'share_tool', 'connect_to_agent_mcp', 'execute_shared_tool', 'discover_tools', 'get_sharing_agreements']
                    },
                    // For describe_agent
                    id: { type: 'string' },
                    // For session management
                    sessionId: { type: 'string' },
                    // For invoke_agent
                    agentId: { type: 'string' },
                    capability: { type: 'string' },
                    input: { type: 'object' },
                    idempotencyKey: { type: 'string' },
                    // For cancel/get_status
                    requestId: { type: 'string' },
                    // For handoff
                    fromRequestId: { type: 'string' },
                    toAgentId: { type: 'string' },
                    payload: { type: 'object' },
                    // For agent deployment
                    agent: { type: 'object' },
                    agents: { type: 'array' },
                    updates: { type: 'object' },
                    enabled: { type: 'boolean' },
                    count: { type: 'number' },
                    template: { type: 'object' },
                    // For filtering
                    filter: { type: 'object' },
                    tags: { type: 'array' },
                    category: { type: 'string' },
                    search: { type: 'string' },
                    // For permissions
                    targetAgentId: { type: 'string' },
                    permission: { type: 'string' },
                    delegable: { type: 'boolean' },
                    expiresIn: { type: 'number' },
                    reason: { type: 'string' },
                    grantId: { type: 'string' },
                    // For enhanced agents
                    agentType: { type: 'string' },
                    useCase: { type: 'string' },
                    agentConfig: { type: 'object' },
                    // For practical tools
                    toolName: { type: 'string' },
                    toolCategory: { type: 'string' },
                    toolParams: { type: 'object' },
                    executionContext: { type: 'object' },
                    // For MCP servers and tools
                    mcpConfig: { type: 'object' },
                    tool: { type: 'object' },
                    providerAgentId: { type: 'string' },
                    consumerAgentId: { type: 'string' },
                    shareOptions: { type: 'object' },
                    discoveryFilters: { type: 'object' }
                },
                required: ['action']
            },
            outputSchema: { type: 'object' },
            async handler(params) {
                const { action } = params;
                switch (action) {
                    case 'list_agents': {
                        const { filter } = params;
                        const list = agentRegistry.list(filter);
                        return ok({ agents: list });
                    }
                    case 'describe_agent': {
                        const { id } = params;
                        if (!id)
                            return fail('id is required for describe_agent', 'ERR_BAD_REQUEST');
                        const a = agents[id];
                        if (!a)
                            return fail(`Unknown agent: ${id}`, 'ERR_NOT_FOUND');
                        return ok(a);
                    }
                    case 'open_session': {
                        const { sessionId } = params;
                        const sid = ensureRequestId(sessionId);
                        return ok({ sessionId: sid });
                    }
                    case 'close_session': {
                        return ok({ closed: true });
                    }
                    case 'invoke_agent': {
                        const { agentId, capability, input, idempotencyKey, sessionId } = params;
                        if (!agentId || !capability || !input) {
                            return fail('agentId, capability, and input are required for invoke_agent', 'ERR_BAD_REQUEST');
                        }
                        return invokeAgentInternal({ agentId, capability, input, idempotencyKey, sessionId });
                    }
                    case 'cancel': {
                        const { requestId } = params;
                        if (!requestId)
                            return fail('requestId is required for cancel', 'ERR_BAD_REQUEST');
                        const r = requests.get(requestId);
                        if (!r)
                            return fail(`Unknown requestId ${requestId}`, 'ERR_NOT_FOUND');
                        if (r.status === 'done' || r.status === 'error')
                            return ok({ canceled: false });
                        r.status = 'canceled';
                        r.updatedAt = Date.now();
                        streamHub?.broadcast(requestId, {
                            type: 'error',
                            requestId,
                            ts: Date.now(),
                            message: 'canceled',
                        });
                        reqCompleted.inc({ status: 'canceled' });
                        logger.warn({ requestId }, 'request canceled');
                        return ok({ canceled: true });
                    }
                    case 'get_status': {
                        const { requestId } = params;
                        if (!requestId)
                            return fail('requestId is required for get_status', 'ERR_BAD_REQUEST');
                        const r = requests.get(requestId);
                        if (!r)
                            return fail(`Unknown requestId ${requestId}`, 'ERR_NOT_FOUND');
                        return ok(r);
                    }
                    case 'handoff': {
                        const { fromRequestId, toAgentId, capability, payload } = params;
                        if (!fromRequestId || !toAgentId || !capability || !payload) {
                            return fail('fromRequestId, toAgentId, capability, and payload are required for handoff', 'ERR_BAD_REQUEST');
                        }
                        const parent = requests.get(fromRequestId);
                        if (!parent)
                            return fail(`Unknown fromRequestId ${fromRequestId}`, 'ERR_NOT_FOUND');
                        return invokeAgentInternal({
                            agentId: toAgentId,
                            capability,
                            input: payload,
                            sessionId: parent.sessionId,
                        });
                    }
                    case 'deploy_agent': {
                        const { agent } = params;
                        if (!agent)
                            return fail('agent is required for deploy_agent', 'ERR_BAD_REQUEST');
                        const success = agentRegistry.deploy(agent);
                        return ok({ deployed: success, agentId: agent.id });
                    }
                    case 'deploy_batch': {
                        const { agents: agentList } = params;
                        if (!agentList || !Array.isArray(agentList)) {
                            return fail('agents array is required for deploy_batch', 'ERR_BAD_REQUEST');
                        }
                        const result = agentRegistry.deployBatch(agentList);
                        return ok(result);
                    }
                    case 'update_agent': {
                        const { id, updates } = params;
                        if (!id || !updates) {
                            return fail('id and updates are required for update_agent', 'ERR_BAD_REQUEST');
                        }
                        const success = agentRegistry.update(id, updates);
                        return ok({ updated: success, agentId: id });
                    }
                    case 'enable_agent': {
                        const { id } = params;
                        if (!id)
                            return fail('id is required for enable_agent', 'ERR_BAD_REQUEST');
                        const success = agentRegistry.setEnabled(id, true);
                        return ok({ enabled: success, agentId: id });
                    }
                    case 'disable_agent': {
                        const { id } = params;
                        if (!id)
                            return fail('id is required for disable_agent', 'ERR_BAD_REQUEST');
                        const success = agentRegistry.setEnabled(id, false);
                        return ok({ disabled: success, agentId: id });
                    }
                    case 'remove_agent': {
                        const { id } = params;
                        if (!id)
                            return fail('id is required for remove_agent', 'ERR_BAD_REQUEST');
                        const success = agentRegistry.remove(id);
                        return ok({ removed: success, agentId: id });
                    }
                    case 'get_stats': {
                        const stats = agentRegistry.getStats();
                        return ok(stats);
                    }
                    case 'generate_agents': {
                        const { count, template } = params;
                        if (!count || count <= 0) {
                            return fail('count > 0 is required for generate_agents', 'ERR_BAD_REQUEST');
                        }
                        const generated = agentRegistry.generateAgents(count, template);
                        const result = agentRegistry.deployBatch(generated);
                        return ok({ ...result, generated: generated.length });
                    }
                    case 'filter_agents': {
                        const { tags, category, enabled, search } = params;
                        const filter = { tags, category, enabled, search };
                        const filtered = agentRegistry.list(filter);
                        return ok({ agents: filtered, count: filtered.length });
                    }
                    case 'create_enhanced_agent': {
                        const { agentType, agentConfig = {} } = params;
                        if (!agentType) {
                            return fail('agentType is required for create_enhanced_agent', 'ERR_BAD_REQUEST');
                        }
                        try {
                            const agent = createEnhancedAgent(agentType, agentConfig);
                            const success = agentRegistry.deploy(agent);
                            agentOps.inc({ operation: 'create_enhanced' });
                            return ok({ deployed: success, agent, agentId: agent.id });
                        }
                        catch (error) {
                            return fail(`Failed to create enhanced agent: ${error instanceof Error ? error.message : String(error)}`, 'ERR_INTERNAL');
                        }
                    }
                    case 'create_agent_ecosystem': {
                        const { useCase } = params;
                        if (!useCase) {
                            return fail('useCase is required for create_agent_ecosystem', 'ERR_BAD_REQUEST');
                        }
                        try {
                            const agents = createAgentEcosystem(useCase);
                            const result = agentRegistry.deployBatch(agents);
                            agentOps.inc({ operation: 'create_ecosystem' });
                            return ok({ ...result, agents, useCase });
                        }
                        catch (error) {
                            return fail(`Failed to create agent ecosystem: ${error instanceof Error ? error.message : String(error)}`, 'ERR_INTERNAL');
                        }
                    }
                    case 'list_enhanced_types': {
                        return ok({
                            agentTypes: Object.values(ENHANCED_AGENT_TYPES),
                            useCases: ['web-development', 'data-analysis', 'content-marketing', 'devops'],
                            capabilities: {
                                [ENHANCED_AGENT_TYPES.WEB_SCRAPER]: ['Advanced web scraping with pagination', 'Data extraction', 'Export to multiple formats'],
                                [ENHANCED_AGENT_TYPES.CONTENT_WRITER]: ['SEO-optimized content generation', 'Multiple content types', 'Tone customization'],
                                [ENHANCED_AGENT_TYPES.DATA_ANALYST]: ['Comprehensive data analysis', 'Statistical insights', 'Visualization generation'],
                                [ENHANCED_AGENT_TYPES.API_TESTER]: ['API testing automation', 'Performance testing', 'Report generation'],
                                [ENHANCED_AGENT_TYPES.DEPLOY_MANAGER]: ['Multi-platform deployment', 'CI/CD automation', 'Health monitoring'],
                                [ENHANCED_AGENT_TYPES.SECURITY_SCANNER]: ['Vulnerability scanning', 'Compliance checking', 'Automated remediation']
                            }
                        });
                    }
                    case 'execute_practical_tool': {
                        const { toolName, toolParams = {}, executionContext = {} } = params;
                        if (!toolName) {
                            return fail('toolName is required for execute_practical_tool', 'ERR_BAD_REQUEST');
                        }
                        try {
                            const context = {
                                agentId: 'system',
                                requestId: ensureRequestId(),
                                workingDirectory: process.cwd(),
                                permissions: ['*'], // Full permissions for practical tools
                                limits: {
                                    maxExecutionTime: 300000, // 5 minutes
                                    maxFileSize: 50 * 1024 * 1024 // 50MB
                                },
                                ...executionContext
                            };
                            const result = await practicalToolRegistry.execute(toolName, toolParams, context);
                            agentOps.inc({ operation: 'execute_tool' });
                            return ok(result);
                        }
                        catch (error) {
                            return fail(`Failed to execute practical tool: ${error instanceof Error ? error.message : String(error)}`, 'ERR_INTERNAL');
                        }
                    }
                    case 'list_practical_tools': {
                        const { toolCategory } = params;
                        const tools = practicalToolRegistry.list(toolCategory);
                        const categories = practicalToolRegistry.getCategories();
                        return ok({ tools, categories, count: tools.length });
                    }
                    // Permission Management
                    case 'grant_permission': {
                        const { id, targetAgentId, permission, delegable, expiresIn, reason } = params;
                        if (!id || !targetAgentId || !permission) {
                            return fail('id, targetAgentId, and permission are required', 'ERR_BAD_REQUEST');
                        }
                        const result = await permissionManager.grantPermission(id, targetAgentId, permission, {
                            delegable, expiresIn, reason
                        });
                        return ok(result);
                    }
                    case 'request_permission': {
                        const { id, targetAgentId, permission, reason, expiresIn } = params;
                        if (!id || !targetAgentId || !permission || !reason) {
                            return fail('id, targetAgentId, permission, and reason are required', 'ERR_BAD_REQUEST');
                        }
                        const result = await permissionManager.requestPermission(id, targetAgentId, permission, reason, expiresIn);
                        return ok(result);
                    }
                    case 'approve_permission': {
                        const { id, requestId, reason } = params;
                        if (!id || !requestId) {
                            return fail('id and requestId are required', 'ERR_BAD_REQUEST');
                        }
                        const result = await permissionManager.approvePermissionRequest(id, requestId, reason);
                        return ok(result);
                    }
                    case 'revoke_permission': {
                        const { id, grantId, reason } = params;
                        if (!id || !grantId) {
                            return fail('id and grantId are required', 'ERR_BAD_REQUEST');
                        }
                        const result = permissionManager.revokePermission(id, grantId, reason);
                        return ok(result);
                    }
                    case 'get_permissions': {
                        const { id } = params;
                        if (!id)
                            return fail('id is required', 'ERR_BAD_REQUEST');
                        const permissions = permissionManager.getAgentPermissions(id);
                        const pendingRequests = permissionManager.getPendingRequests(id);
                        return ok({ permissions, pendingRequests });
                    }
                    // MCP Server Management
                    case 'create_mcp_server': {
                        const { id, mcpConfig } = params;
                        if (!id)
                            return fail('id is required', 'ERR_BAD_REQUEST');
                        const result = await agentMCPManager.createAgentMCPServer(id, mcpConfig || {});
                        return ok(result);
                    }
                    case 'add_tool_to_agent': {
                        const { id, tool } = params;
                        if (!id || !tool) {
                            return fail('id and tool are required', 'ERR_BAD_REQUEST');
                        }
                        const result = await agentMCPManager.addToolToAgent(id, tool);
                        return ok(result);
                    }
                    case 'share_tool': {
                        const { providerAgentId, consumerAgentId, toolName, shareOptions } = params;
                        if (!providerAgentId || !consumerAgentId || !toolName) {
                            return fail('providerAgentId, consumerAgentId, and toolName are required', 'ERR_BAD_REQUEST');
                        }
                        const result = await agentMCPManager.shareToolWithAgent(providerAgentId, consumerAgentId, toolName, shareOptions || {});
                        return ok(result);
                    }
                    case 'connect_to_agent_mcp': {
                        const { id, targetAgentId } = params;
                        if (!id || !targetAgentId) {
                            return fail('id and targetAgentId are required', 'ERR_BAD_REQUEST');
                        }
                        const result = await agentMCPManager.connectToAgentMCP(id, targetAgentId);
                        return ok(result);
                    }
                    case 'execute_shared_tool': {
                        const { consumerAgentId, providerAgentId, toolName, toolParams } = params;
                        if (!consumerAgentId || !providerAgentId || !toolName) {
                            return fail('consumerAgentId, providerAgentId, and toolName are required', 'ERR_BAD_REQUEST');
                        }
                        const result = await agentMCPManager.executeSharedTool(consumerAgentId, providerAgentId, toolName, toolParams || {});
                        return ok(result);
                    }
                    case 'discover_tools': {
                        const { discoveryFilters } = params;
                        const tools = agentMCPManager.discoverTools(discoveryFilters || {});
                        return ok({ tools, count: tools.length });
                    }
                    case 'get_sharing_agreements': {
                        const { id } = params;
                        if (!id)
                            return fail('id is required', 'ERR_BAD_REQUEST');
                        const agreements = agentMCPManager.getSharingAgreements(id);
                        return ok(agreements);
                    }
                    default:
                        return fail(`Unknown action: ${action}`, 'ERR_BAD_REQUEST');
                }
            },
        },
    },
});
// Helper function to get permissions for an agent
function getAgentPermissions(agentId) {
    const agent = agentRegistry.get(agentId);
    if (!agent)
        return ['file:read']; // Default minimal permissions
    // Grant permissions based on agent category
    switch (agent.category) {
        case 'web_automation':
            return ['network:http', 'file:write', 'file:read'];
        case 'content_creation':
            return ['file:write', 'file:read'];
        case 'data_processing':
            return ['file:read', 'file:write', 'data:process'];
        case 'testing':
            return ['network:http', 'file:write', 'file:read', 'system:read'];
        case 'devops':
            return ['*']; // DevOps agents need full permissions
        case 'security':
            return ['file:read', 'network:http', 'system:read'];
        case 'system':
            return ['system:read', 'system:execute', 'file:read'];
        case 'file_operations':
            return ['file:read', 'file:write', 'file:delete'];
        default:
            return ['file:read', 'file:write', 'network:http'];
    }
}
async function runAgentJob(requestId, input) {
    const r = requests.get(requestId);
    r.status = 'running';
    r.updatedAt = Date.now();
    streamHub?.broadcast(requestId, { type: 'start', requestId, ts: Date.now() });
    logger.info({ requestId, agentId: r.agentId, capability: r.capability }, 'agent job started');
    try {
        // Create execution context with permissions based on agent type
        const context = {
            agentId: r.agentId,
            requestId,
            workingDirectory: process.cwd(),
            permissions: getAgentPermissions(r.agentId),
            limits: {
                maxExecutionTime: 60000, // 1 minute
                maxFileSize: 10 * 1024 * 1024 // 10MB
            }
        };
        // Stream progress updates
        streamHub?.broadcast(requestId, {
            type: 'chunk',
            requestId,
            ts: Date.now(),
            content: `Executing ${r.agentId} with capability ${r.capability}...\n`
        });
        // Execute the agent
        const result = await agentExecutor.executeAgent(r.agentId, r.capability, input, context);
        if (result.success) {
            // Stream tools used information
            if (result.toolsUsed.length > 0) {
                streamHub?.broadcast(requestId, {
                    type: 'chunk',
                    requestId,
                    ts: Date.now(),
                    content: `Tools used: ${result.toolsUsed.join(', ')}\n`
                });
            }
            // Stream changes made
            if (result.changes.filesCreated?.length) {
                streamHub?.broadcast(requestId, {
                    type: 'chunk',
                    requestId,
                    ts: Date.now(),
                    content: `Files created: ${result.changes.filesCreated.join(', ')}\n`
                });
            }
            r.status = 'done';
            r.result = {
                agentResult: result.result,
                toolsUsed: result.toolsUsed,
                executionTime: result.executionTime,
                changes: result.changes
            };
            streamHub?.broadcast(requestId, {
                type: 'final',
                requestId,
                ts: Date.now(),
                result: r.result
            });
            reqCompleted.inc({ status: 'done' });
            logger.info({ requestId, toolsUsed: result.toolsUsed.length, executionTime: result.executionTime }, 'agent job completed');
        }
        else {
            r.status = 'error';
            r.error = result.error;
            streamHub?.broadcast(requestId, {
                type: 'error',
                requestId,
                ts: Date.now(),
                message: result.error || 'Agent execution failed'
            });
            reqCompleted.inc({ status: 'error' });
            logger.error({ requestId, error: result.error }, 'agent job failed');
        }
    }
    catch (error) {
        r.status = 'error';
        r.error = error instanceof Error ? error.message : String(error);
        streamHub?.broadcast(requestId, {
            type: 'error',
            requestId,
            ts: Date.now(),
            message: r.error
        });
        reqCompleted.inc({ status: 'error' });
        logger.error({ requestId, error: r.error }, 'agent job crashed');
    }
    r.updatedAt = Date.now();
}
// metrics/health server
if (METRICS_PORT > 0) {
    const srv = http.createServer(async (req, res) => {
        if (!req.url) {
            res.statusCode = 404;
            res.end();
            return;
        }
        const u = new URL(req.url, 'http://localhost');
        logger.debug({ url: req.url, path: u.pathname }, 'metrics request');
        if (u.pathname === '/metrics') {
            res.setHeader('Content-Type', registry.contentType);
            res.end(await registry.metrics());
            return;
        }
        if (u.pathname === '/healthz') {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, queue: queue.length, running }));
            return;
        }
        if (u.pathname === '/demo' || u.pathname.startsWith('/demo/')) {
            try {
                const msg = u.searchParams.get('msg') ?? 'Hello from demo';
                const agentId = u.searchParams.get('agent') ?? 'echo';
                const capability = u.searchParams.get('capability') ?? 'chat';
                const input = { messages: [{ role: 'user', content: msg }] };
                const r = await invokeAgentInternal({ agentId, capability, input });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(r));
            }
            catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ ok: false, error: { message: String(e?.message || e) } }));
            }
            return;
        }
        res.statusCode = 404;
        res.end('not found');
    });
    srv.listen(METRICS_PORT, () => logger.info({ port: METRICS_PORT }, 'metrics server listening'));
}
// Expose over stdio for MCP clients; streaming is available via WebSocket side-channel
await server.connect(new StdioServerTransport());
process.on('SIGINT', () => { try {
    streamHub?.close();
}
catch { } process.exit(0); });
process.on('SIGTERM', () => { try {
    streamHub?.close();
}
catch { } process.exit(0); });
logger.info({ url: streamHub?.urlBase || 'stdio-only', maxConcurrency: MAX_CONCURRENCY }, 'A2A MCP server ready');
