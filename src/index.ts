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
const MAX_QUEUE_SIZE = parseInt(process.env.MAX_QUEUE_SIZE || '500', 10);
const REQUEST_TTL_MS = parseInt(process.env.REQUEST_TTL_MS || '3600000', 10); // 1h
const IDEMP_TTL_MS = parseInt(process.env.IDEMP_TTL_MS || '86400000', 10); // 24h

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

// Prometheus metrics
const register = new Registry();
const reqCreated = new Counter({ name: 'a2a_requests_created', help: 'Total requests created', registers: [register] });
const reqCompleted = new Counter({ name: 'a2a_requests_completed', help: 'Requests completed', labelNames: ['status'], registers: [register] });
const queueGauge = new Gauge({ name: 'a2a_queue_length', help: 'Current queue length', registers: [register] });
const runningGauge = new Gauge({ name: 'a2a_running', help: 'Currently running requests', registers: [register] });
const wsClients = new Gauge({ name: 'a2a_ws_clients', help: 'WebSocket clients count', registers: [register] });
const wsChannels = new Gauge({ name: 'a2a_ws_channels', help: 'WebSocket channels count', registers: [register] });
const totalAgents = new Gauge({ name: 'a2a_total_agents', help: 'Total agents deployed', registers: [register] });
const enabledAgents = new Gauge({ name: 'a2a_enabled_agents', help: 'Enabled agents count', registers: [register] });

const queue: QueueItem[] = [];
let running = 0;
let streamHub: StreamHub | undefined;

function ok(data: unknown) { return { ok: true, data }; }
function fail(message: string, code?: string) { return { ok: false, error: { message, code } }; }

async function maybeStartNext() {
  while (running < MAX_CONCURRENCY && queue.length > 0) {
    const item = queue.shift()!;
    runRequest(item.requestId, item.input);
  }
}

async function runRequest(requestId: string, input: any) {
  const r = requests.get(requestId);
  if (!r || r.status !== 'queued') return;
  r.status = 'running'; r.updatedAt = Date.now(); running++; runningGauge.set(running);
  streamHub?.broadcast(requestId, { type: 'started', requestId, ts: Date.now() });
  logger.info({ requestId, agentId: r.agentId, capability: r.capability }, 'request started');
  try {
    const result = await agentExecutor.execute(r.agentId, r.capability, input, { requestId, sessionId: r.sessionId });
    r.result = result; r.status = 'done'; r.updatedAt = Date.now();
    streamHub?.broadcast(requestId, { type: 'done', requestId, ts: Date.now(), result });
    reqCompleted.inc({ status: 'done' });
    logger.info({ requestId }, 'request done');
  } catch (err: any) {
    r.status = 'error'; r.error = String(err?.message || err); r.updatedAt = Date.now();
    streamHub?.broadcast(requestId, { type: 'error', requestId, ts: Date.now(), message: r.error! });
    reqCompleted.inc({ status: 'error' });
    logger.error({ requestId, error: r.error }, 'request error');
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
  {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  }
);

server.setRequestHandler('tools/list', async () => ({
  tools: [
    { name: 'agent_control', description: 'Unified agent control', inputSchema: { type: 'object' } },
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: params } = request.params as any;
  if (name !== 'agent_control') return fail('Unknown tool', 'ERR_NOT_FOUND');
  const { action } = params;
  switch (action) {
    case 'list_agents': return ok({ agents: agentRegistry.list(params.filter) });
    case 'describe_agent': { const a = agents[params.id]; return a ? ok(a) : fail('Agent not found', 'ERR_NOT_FOUND'); }
    default: return fail('Unknown action', 'ERR_BAD_REQUEST');
  }
});

async function main() {
  if (ENABLE_STREAMING) { streamHub = new StreamHub(STREAM_HOST, STREAM_PORT, STREAM_TOKEN, MAX_SUBS_PER_REQUEST); await streamHub.start(); logger.info({ host: STREAM_HOST, port: STREAM_PORT }, 'StreamHub started'); }
  const metricsServer = http.createServer(async (req, res) => { if (req.url === '/metrics') { res.setHeader('Content-Type', register.contentType); res.end(await register.metrics()); } else { res.statusCode = 404; res.end(); } });
  metricsServer.listen(9090, () => { logger.info('Metrics server listening on :9090'); });
  await initializeZeroClick(server, agentRegistry);
  const transport = new StdioServerTransport(); await server.connect(transport); logger.info('A2A MCP server started');
}

main().catch((err) => { logger.fatal(err, 'Fatal error'); process.exit(1); });
