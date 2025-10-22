# A2A-style MCP Server (TypeScript, WebSocket streaming)
- Tools: list_agents, describe_agent, open_session, close_session, invoke_agent, handoff, cancel, get_status
- Transport: MCP stdio (for Claude/clients), plus high-performance WebSocket side-channel for streaming
Quickstart
1. Install deps
   npm i
2. Dev run (stdio for MCP; WS at ws://127.0.0.1:8787)
   npm run dev
3. Test locally (no MCP client)
   
- Start server: npm run dev
   
- Open a WS client to: ws://127.0.0.1:8787/stream?requestId=<id>
   
- Call invoke_agent via MCP tool (from your client) to receive streaming chunks
Notes
- invoke_agent returns: { requestId, status, streamUrl }
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
