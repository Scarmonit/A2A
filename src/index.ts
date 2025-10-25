import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { agents, AgentDescriptor, agentRegistry, ensureRequestId } from './agents.js';
import { toolRegistry } from './tools.js';
import { practicalToolRegistry } from './practical-tools.js';
import { createEnhancedAgent, createAgentEcosystem, ENHANCED_AGENT_TYPES } from './enhanced-agents.js';
import { createAdvancedAgent, createAdvancedEcosystem, ADVANCED_AGENT_TYPES } from './advanced-agents.js';
import { agentExecutor } from './agent-executor.js';
import { advancedToolRegistry } from './advanced-tools.js';
import { permissionManager } from './permissions.js';
import { agentMCPManager } from './agent-mcp-servers.js';
import { StreamHub } from './streaming.js';
import { setTimeout as sleep } from 'timers/promises';
import pino from 'pino';
import * as http from 'http';
import client, { Counter, Gauge, Registry } from 'prom-client';
// Zero-Click Automation System
import { initializeZeroClick } from './zero-click-integration.js';
// Import and initialize enhanced memory integration (Claude Memory Tool)
import { createClaudeMemoryTool } from './memory/claude-memory.js';

export { agentRegistry } from './agents.js';

// In-memory requests state
type RequestStatus = 'queued' | 'running' | 'done' | 'error' | 'canceled';
type RequestRecord = { id: string; agentId: string; capability: string; status: RequestStatus; createdAt: number; updatedAt: number; error?: string; result?: unknown; idempotencyKey?: string; sessionId?: string; };
type IdempotencyEntry = { requestId: string; expiresAt: number };
type QueueItem = { requestId: string; input: any };
const requests = new Map<string, RequestRecord>();
const idempotency = new Map<string, IdempotencyEntry>(); // idempotencyKey -> entry
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
const streamHub = ENABLE_STREAMING ? new StreamHub(STREAM_PORT, STREAM_HOST, { token: STREAM_TOKEN, maxSubsPerRequest: MAX_SUBS_PER_REQUEST }) : null;
function ok<T>(data: T) { return { ok: true, data }; }
function fail(message: string, code: string = 'ERR_BAD_REQUEST') { return { ok: false, error: { code, message } }; }

// Metrics
const registry: Registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });
const reqCreated = new Counter({ name: 'a2a_requests_created_total', help: 'Requests created', registers: [registry] });
const reqCompleted = new Counter({ name: 'a2a_requests_completed_total', help: 'Requests completed', labelNames: ['status'] as const, registers: [registry] });
const runningGauge = new Gauge({ name: 'a2a_running_jobs', help: 'Currently running jobs', registers: [registry] });
const queueGauge = new Gauge({ name: 'a2a_queue_size', help: 'Queue length', registers: [registry] });
const wsClients = new Gauge({ name: 'a2a_ws_clients', help: 'WebSocket client count', registers: [registry] });
const wsChannels = new Gauge({ name: 'a2a_ws_channels', help: 'WebSocket channel count', registers: [registry] });
const broadcasts = new Counter({ name: 'a2a_stream_broadcasts_total', help: 'Stream broadcasts', registers: [registry] });
const agentOps = new Counter({ name: 'a2a_agent_operations_total', help: 'Agent operations', labelNames: ['operation'] as const, registers: [registry] });
const totalAgents = new Gauge({ name: 'a2a_total_agents', help: 'Total deployed agents', registers: [registry] });
const enabledAgents = new Gauge({ name: 'a2a_enabled_agents', help: 'Enabled agents', registers: [registry] });

// Concurrency-limited queue
const queue: QueueItem[] = [];
let running = 0;
function maybeStartNext() {
  while (running < MAX_CONCURRENCY && queue.length > 0) {
    const item = queue.shift()!;
    const r = requests.get(item.requestId);
    if (!r || r.status === 'canceled') continue;
    startJob(item.requestId, item.input);
  }
  queueGauge.set(queue.length);
  runningGauge.set(running);
}
async function startJob(requestId: string, input: any) {
  running++;
  runningGauge.set(running);
  try { await runAgentJob(requestId, input); } catch (err: any) {
    const r = requests.get(requestId);
    if (r) {
      r.status = 'error'; r.error = String(err?.message || err); r.updatedAt = Date.now();
      streamHub?.broadcast(requestId, { type: 'error', requestId, ts: Date.now(), message: r.error! });
    }
  } finally { running = Math.max(0, running - 1); runningGauge.set(running); maybeStartNext(); }
}

// TTL cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of idempotency) { if (entry.expiresAt <= now || !requests.has(entry.requestId)) { idempotency.delete(key); } }
  for (const [id, rec] of requests) { if ((rec.status === 'done' || rec.status === 'error' || rec.status === 'canceled') && now - rec.updatedAt > REQUEST_TTL_MS) { requests.delete(id); } }
}, Math.min(REQUEST_TTL_MS, 60_000));

// periodically sample ws counts and agent stats
setInterval(() => {
  try {
    if (streamHub) { wsClients.set(streamHub.clientCount()); wsChannels.set(streamHub.channelCount()); }
    queueGauge.set(queue.length); runningGauge.set(running);
    const stats = agentRegistry.getStats(); totalAgents.set(stats.total); enabledAgents.set(stats.enabled);
  } catch {}
}, 5000);

async function invokeAgentInternal({ agentId, capability, input, idempotencyKey, sessionId, }: { agentId: string; capability: string; input: any; idempotencyKey?: string; sessionId?: string; }) {
  const a = agents[agentId]; if (!a) return fail(`Unknown agent: ${agentId}`, 'ERR_NOT_FOUND');
  const cap = a.capabilities.find((c) => c.name === capability); if (!cap) return fail(`Agent ${agentId} missing capability '${capability}'`, 'ERR_NOT_FOUND');
  if (idempotencyKey && idempotency.has(idempotencyKey)) {
    const entry = idempotency.get(idempotencyKey)!; const rec = requests.get(entry.requestId);
    if (rec && entry.expiresAt > Date.now()) { return ok({ requestId: entry.requestId, status: rec.status, streamUrl: streamHub ? streamHub.channelUrl(entry.requestId) : 'streaming disabled', }); }
    idempotency.delete(idempotencyKey);
  }
  const requestId = ensureRequestId();
  const rec: RequestRecord = { id: requestId, agentId, capability, status: 'queued', createdAt: Date.now(), updatedAt: Date.now(), sessionId };
  requests.set(requestId, rec);
  if (idempotencyKey) idempotency.set(idempotencyKey, { requestId, expiresAt: Date.now() + IDEMP_TTL_MS });
  if (queue.length >= MAX_QUEUE_SIZE && running >= MAX_CONCURRENCY) { rec.status = 'error'; rec.error = 'queue full'; rec.updatedAt = Date.now(); return fail('Queue is full', 'ERR_QUEUE_FULL'); }
  queue.push({ requestId, input }); queueGauge.set(queue.length); reqCreated.inc(); logger.info({ requestId, agentId, capability }, 'request enqueued'); maybeStartNext();
  const streamUrl = streamHub ? streamHub.channelUrl(requestId, STREAM_TOKEN) : 'streaming disabled';
  return ok({ requestId, status: rec.status, streamUrl });
}

// Define Claude Memory MCP tool with beta header for context management
const claude_memory_tool = createClaudeMemoryTool({ headers: { 'anthropic-beta': 'context-management-2025-06-27' } });

const server = new Server(
  { name: 'a2a-mcp-server', version: '0.1.0' },
  { tools: {
      agent_control: {
        description: 'Unified agent control: list agents, invoke capabilities, manage sessions, cancel requests, handoff between agents, get status, deploy agents, and manage agent lifecycle',
        inputSchema: { type: 'object', additionalProperties: false, properties: { action: { type: 'string', enum: ['list_agents','describe_agent','open_session','close_session','invoke_agent','cancel','get_status','handoff','deploy_agent','deploy_batch','update_agent','enable_agent','disable_agent','remove_agent','get_stats','generate_agents','filter_agents','create_enhanced_agent','create_agent_ecosystem','list_enhanced_types','create_advanced_agent','create_advanced_ecosystem','list_advanced_types','execute_practical_tool','execute_advanced_tool','list_practical_tools','list_advanced_tools','grant_permission','request_permission','approve_permission','revoke_permission','get_permissions','create_mcp_server','add_tool_to_agent','share_tool','connect_to_agent_mcp','execute_shared_tool','discover_tools','get_sharing_agreements'] }, id: { type: 'string' }, sessionId: { type: 'string' }, agentId: { type: 'string' }, capability: { type: 'string' }, input: { type: 'object' }, idempotencyKey: { type: 'string' }, requestId: { type: 'string' }, fromRequestId: { type: 'string' }, toAgentId: { type: 'string' }, payload: { type: 'object' }, agent: { type: 'object' }, agents: { type: 'array' }, updates: { type: 'object' }, enabled: { type: 'boolean' }, count: { type: 'number' }, template: { type: 'object' }, filter: { type: 'object' }, tags: { type: 'array' }, category: { type: 'string' }, search: { type: 'string' }, targetAgentId: { type: 'string' }, permission: { type: 'string' }, delegable: { type: 'boolean' }, expiresIn: { type: 'number' }, reason: { type: 'string' }, grantId: { type: 'string' }, agentType: { type: 'string' }, useCase: { type: 'string' }, agentConfig: { type: 'object' }, toolName: { type: 'string' }, toolCategory: { type: 'string' }, toolParams: { type: 'object' }, executionContext: { type: 'object' }, mcpConfig: { type: 'object' }, tool: { type: 'object' }, providerAgentId: { type: 'string' }, consumerAgentId: { type: 'string' }, shareOptions: { type: 'object' }, discoveryFilters: { type: 'object' } }, required: ['action'] },
        outputSchema: { type: 'object' },
        async handler(params: any) {
          const { action } = params;
          switch (action) {
            case 'list_agents': { const { filter } = params; const list = agentRegistry.list(filter); return ok({ agents: list }); }
            case 'describe_agent': { const { id } = params; if (!id) return fail('id is required for describe_agent', 'ERR_BAD_REQUEST'); const a = agents[id]; if (!a) return fail(`Unknown agent: ${id}`, 'ERR_NOT_FOUND'); return ok(a); }
            case 'open_session': { const { sessionId } = params; const sid = ensureRequestId(sessionId); return ok({ sessionId: sid }); }
            case 'close_session': { return ok({ closed: true }); }
            case 'invoke_agent': { const { agentId, capability, input, idempotencyKey, sessionId } = params; if (!agentId || !capability || !input) { return fail('agentId, capability, and input are required for invoke_agent', 'ERR_BAD_REQUEST'); } return invokeAgentInternal({ agentId, capability, input, idempotencyKey, sessionId }); }
            case 'cancel': { const { requestId } = params; if (!requestId) return fail('requestId is required for cancel', 'ERR_BAD_REQUEST'); const r = requests.get(requestId); if (!r) return fail(`Unknown requestId ${requestId}`, 'ERR_NOT_FOUND'); if (r.status === 'done' || r.status === 'error') return ok({ canceled: false }); r.status = 'canceled'; r.updatedAt = Date.now(); streamHub?.broadcast(requestId, { type: 'error', requestId, ts: Date.now(), message: 'canceled', }); reqCompleted.inc({ status: 'canceled' }); logger.warn({ requestId }, 'request canceled'); return ok({ canceled: true }); }
            case 'get_status': { const { requestId } = params; if (!requestId) return fail('requestId is required for get_status', 'ERR_BAD_REQUEST'); const r = requests.get(requestId); if (!r) return fail(`Unknown requestId ${requestId}`, 'ERR_NOT_FOUND'); return ok(r); }
            case 'handoff': { const { fromRequestId, toAgentId, capability, payload } = params; if (!fromRequestId || !toAgentId || !capability || !payload) { return fail('fromRequestId, toAgentId, capability, and payload are required for handoff', 'ERR_BAD_REQUEST'); } const parent = requests.get(fromRequestId); if (!parent) return fail(`Unknown fromRequestId ${fromRequestId}`, 'ERR_NOT_FOUND'); return invokeAgentInternal({ agentId: toAgentId, capability, input: payload, sessionId: parent.sessionId, }); }
            case 'deploy_agent': { const { agent } = params; if (!agent) return fail('agent is required for deploy_agent', 'ERR_BAD_REQUEST'); const success = agentRegistry.deploy(agent); return ok({ deployed: success, agentId: agent.id }); }
            case 'deploy_batch': { const { agents: agentList } = params; if (!agentList || !Array.isArray(agentList)) { return fail('agents array is required for deploy_batch', 'ERR_BAD_REQUEST'); } const result = agentRegistry.deployBatch(agentList); return ok(result); }
            case 'update_agent': { const { id, updates } = params; if (!id || !updates) { return fail('id and updates are required for update_agent', 'ERR_BAD_REQUEST'); } const success = agentRegistry.update(id, updates); return ok({ updated: success, agentId: id }); }
            case 'enable_agent': { const { id } = params; if (!id) return fail('id is required for enable_agent', 'ERR_BAD_REQUEST'); const success = agentRegistry.setEnabled(id, true); return ok({ enabled: success, agentId: id }); }
            case 'disable_agent': { const { id } = params; if (!id) return fail('id is required for disable_agent', 'ERR_BAD_REQUEST'); const success = agentRegistry.setEnabled(id, false); return ok({ disabled: success, agentId: id }); }
            case 'remove_agent': { const { id } = params; if (!id) return fail('id is required for remove_agent', 'ERR_BAD_REQUEST'); const success = agentRegistry.remove(id); return ok({ removed: success, agentId: id }); }
            case 'get_stats': { const stats = agentRegistry.getStats(); return ok(stats); }
            case 'generate_agents': { const { count, template } = params; if (!count || count <= 0) { return fail('count > 0 is required for generate_agents', 'ERR_BAD_REQUEST'); } const generated = agentRegistry.generateAgents(count, template); const result = agentRegistry.deployBatch(generated); return ok({ ...result, generated: generated.length }); }
            case 'filter_agents': { const
