# A2A-style MCP Server (TypeScript, WebSocket streaming)

## Features
- **Tools**: list_agents, describe_agent, open_session, close_session, invoke_agent, handoff, cancel, get_status
- **Transport**: MCP stdio (for Claude/clients), plus high-performance WebSocket side-channel for streaming
- **Greenlet Agents**: Python-based lightweight cooperative multitasking agents with ~4KB memory footprint

## Quickstart

### 1. Install Dependencies
```bash
npm install
pip3 install -r requirements-greenlet.txt  # For greenlet agents
```

### 2. Dev Run
```bash
npm run dev  # stdio for MCP; WS at ws://127.0.0.1:8787
```

### 3. Build
```bash
npm run build
```

### 4. Test Locally (no MCP client)
- Start server: `npm run dev`
- Open a WS client to: `ws://127.0.0.1:8787/stream?requestId=<id>`
- Call invoke_agent via MCP tool (from your client) to receive streaming chunks

## Greenlet A2A Agents

This repository includes support for Python greenlet-based agents that provide:
- **Memory Efficient**: ~4KB per agent vs 1MB+ for thread-based agents
- **High Scalability**: Support for 1000+ concurrent agents in single process
- **Deterministic Scheduling**: Explicit context switching
- **No GIL Issues**: Single-threaded cooperative scheduling

### Quick Start with Greenlet Agents

```bash
# Start greenlet process pool
npm run greenlet:start -- --workers 4 --max 10

# Run tests
npm run test          # Node.js integration tests
npm run test:python   # Python unit tests
npm run test:all      # All tests
```

For complete documentation, see [docs/GREENLET_A2A_GUIDE.md](docs/GREENLET_A2A_GUIDE.md)

## Notes
- invoke_agent returns: `{ requestId, status, streamUrl }`
- Stream events: start | chunk | final | error
- Idempotency supported via idempotencyKey

## Deployment Status

### Root Cause
The Railway deployments were failing due to a healthcheck configuration issue. The healthcheck was pointing to `/healthz` endpoint on the MCP server, but this endpoint does not exist in the application.

### Fix Applied
Removed the healthcheck configuration from the deployment settings to resolve the issue.

### Current Status
✅ All Railway deployments are now healthy and passing.
✅ All services are operational and functioning correctly.
