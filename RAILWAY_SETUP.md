# Railway Deployment Guide - A2A MCP Server

This guide provides step-by-step instructions for deploying A2A to Railway with a two-service architecture optimized for WebSocket streaming and API/health endpoints.

## Architecture Overview

The deployment uses **two separate Railway services** from the same repository:

1. **a2a-ws** - WebSocket streaming service
   - Handles real-time WebSocket connections (`/stream`)
   - Domain: `ws.a2a.yourdomain`

2. **a2a-api** - API and health/metrics service
   - Handles HTTP endpoints (`/healthz`, `/metrics`)
   - Domain: `api.a2a.yourdomain`

This separation provides:
- Better resource isolation
- Independent scaling
- Optimized performance for different workload types

## Prerequisites

- Railway account (https://railway.app)
- GitHub repository containing this codebase
- Domain name (for custom domains)
- Cloudflare account (recommended for DNS and proxy)
- Ollama or compatible LLM service URL

## Step 1: Create Railway Project

1. Go to https://railway.app
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your A2A repository

## Step 2: Deploy Service 1 - WebSocket Stream (a2a-ws)

### 2.1 Create the Service

1. In your Railway project, click **"New Service"**
2. Select **"GitHub Repo"**
3. Choose your A2A repository
4. Name the service: `a2a-ws`

### 2.2 Configure Build Settings

Railway will automatically detect the Dockerfile. No additional build configuration needed.

### 2.3 Configure Environment Variables

In the Railway dashboard for `a2a-ws`, add these environment variables:

```bash
# Core Configuration
NODE_ENV=production
LOG_LEVEL=info

# Streaming Configuration (WebSocket Service)
ENABLE_STREAMING=true
STREAM_HOST=0.0.0.0
STREAM_PORT=$PORT
METRICS_PORT=0

# Security
STREAM_TOKEN=<generate-a-secure-random-token>

# LLM Backend
LOCAL_LLM_URL=https://your-ollama-host.example.com

# Performance
MAX_CONCURRENCY=100
MAX_QUEUE_SIZE=50000
MAX_SUBS_PER_REQUEST=16

# Optional: Additional Settings
REQUEST_TTL_MS=300000
IDEMP_TTL_MS=900000
```

**Important:**
- `$PORT` is automatically set by Railway
- `METRICS_PORT=0` disables the metrics server on this service
- Generate a strong random token for `STREAM_TOKEN` (e.g., using `openssl rand -hex 32`)

### 2.4 Configure Start Command

Railway will use the Dockerfile's CMD by default. To override with the custom command:

1. Go to **Settings** → **Deploy**
2. Set **Start Command**:
```bash
sh -c "STREAM_HOST=0.0.0.0 STREAM_PORT=$PORT METRICS_PORT=0 node dist/index.js"
```

Or use the `railway-ws.json` configuration file (recommended).

### 2.5 Deploy

Click **"Deploy"** to start the service.

## Step 3: Deploy Service 2 - API/Health (a2a-api)

### 3.1 Create the Service

1. In your Railway project, click **"New Service"** again
2. Select **"GitHub Repo"**
3. Choose the **same** A2A repository
4. Name the service: `a2a-api`

### 3.2 Configure Environment Variables

In the Railway dashboard for `a2a-api`, add these environment variables:

```bash
# Core Configuration
NODE_ENV=production
LOG_LEVEL=info

# API/Metrics Configuration
ENABLE_STREAMING=false
STREAM_HOST=0.0.0.0
STREAM_PORT=0
METRICS_PORT=$PORT

# Security (use same token as ws service)
STREAM_TOKEN=<same-token-as-a2a-ws>

# LLM Backend (same as ws service)
LOCAL_LLM_URL=https://your-ollama-host.example.com

# Performance
MAX_CONCURRENCY=100
MAX_QUEUE_SIZE=50000

# Optional: Additional Settings
REQUEST_TTL_MS=300000
IDEMP_TTL_MS=900000
```

**Important:**
- `STREAM_PORT=0` disables the WebSocket server on this service
- `METRICS_PORT=$PORT` enables the HTTP server for health/metrics
- Use the **same** `STREAM_TOKEN` as the ws service

### 3.3 Configure Start Command

1. Go to **Settings** → **Deploy**
2. Set **Start Command**:
```bash
sh -c "METRICS_PORT=$PORT STREAM_HOST=0.0.0.0 STREAM_PORT=0 node dist/index.js"
```

Or use the `railway-api.json` configuration file (recommended).

### 3.4 Deploy

Click **"Deploy"** to start the service.

## Step 4: Configure Custom Domains

### 4.1 Railway Domain Setup

For each service in Railway:

#### a2a-ws Service:
1. Go to service settings
2. Click **"Settings"** → **"Networking"**
3. Click **"Generate Domain"** (Railway provides a default domain)
4. Note the generated domain (e.g., `a2a-ws.up.railway.app`)

#### a2a-api Service:
1. Go to service settings
2. Click **"Settings"** → **"Networking"**
3. Click **"Generate Domain"**
4. Note the generated domain (e.g., `a2a-api.up.railway.app`)

### 4.2 Custom Domain Setup

For each service:

#### a2a-ws Service:
1. In Railway, go to **"Settings"** → **"Networking"**
2. Click **"Add Custom Domain"**
3. Enter: `ws.a2a.yourdomain`
4. Railway will provide CNAME records to add to your DNS

#### a2a-api Service:
1. In Railway, go to **"Settings"** → **"Networking"**
2. Click **"Add Custom Domain"**
3. Enter: `api.a2a.yourdomain`
4. Railway will provide CNAME records

## Step 5: Configure Cloudflare DNS

### 5.1 Add DNS Records

In your Cloudflare dashboard:

1. Go to **DNS** → **Records**
2. Add two CNAME records:

```
Type: CNAME
Name: ws.a2a
Target: <your-a2a-ws-railway-domain>
Proxy status: Proxied (orange cloud)
```

```
Type: CNAME
Name: api.a2a
Target: <your-a2a-api-railway-domain>
Proxy status: Proxied (orange cloud)
```

### 5.2 Configure Cloudflare Cache Rules

To ensure WebSocket and metrics endpoints work correctly:

1. Go to **Caching** → **Cache Rules**
2. Create a new rule:
   - **Name:** Bypass A2A Stream and Metrics
   - **When incoming requests match:**
     - Hostname equals `ws.a2a.yourdomain` OR
     - Hostname equals `api.a2a.yourdomain`
   - **Then:**
     - **Cache eligibility:** Bypass cache

Or create specific rules:
- Bypass cache for: `/stream*`
- Bypass cache for: `/metrics*`
- Bypass cache for: `/healthz*`

### 5.3 Configure WebSocket Support

Ensure WebSocket support is enabled:

1. Go to **Network**
2. Enable **WebSockets** if not already enabled

## Step 6: Verification and Testing

### 6.1 Test Health Endpoint

```bash
curl https://api.a2a.yourdomain/healthz
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 6.2 Test Metrics Endpoint

```bash
curl https://api.a2a.yourdomain/metrics
```

Expected response: Prometheus metrics output

### 6.3 Test Agent Invocation

Use the MCP client to invoke an agent:

```javascript
const response = await mcpClient.invoke({
  agentId: "code-agent",
  capability: "analyze",
  input: { code: "console.log('hello')" }
});

console.log('Request ID:', response.requestId);
console.log('Stream URL:', response.streamUrl);
// Stream URL should point to: wss://ws.a2a.yourdomain/stream?...
```

### 6.4 Test WebSocket Stream

Connect to the WebSocket stream URL returned from the invoke call:

```javascript
const WebSocket = require('ws');
const ws = new WebSocket(streamUrl);

ws.on('message', (data) => {
  console.log('Stream event:', JSON.parse(data));
});
```

## Step 7: Monitoring and Logs

### Railway Dashboard

Monitor your services:
1. Go to Railway project
2. View each service's **"Deployments"** tab
3. Check **"Logs"** for real-time output
4. View **"Metrics"** for CPU/Memory usage

### Prometheus Metrics

Access metrics at:
```
https://api.a2a.yourdomain/metrics
```

Key metrics to monitor:
- `a2a_requests_created_total` - Total requests created
- `a2a_requests_completed_total` - Completed requests
- `a2a_running_jobs` - Currently running jobs
- `a2a_queue_size` - Queue length
- `a2a_ws_clients` - Connected WebSocket clients
- `a2a_ws_channels` - Active WebSocket channels

## Environment Variables Reference

### Common Variables (Both Services)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `production` |
| `LOG_LEVEL` | Logging level | `info` |
| `STREAM_TOKEN` | Auth token for streams | `abc123...` |
| `LOCAL_LLM_URL` | LLM backend URL | `https://ollama.example.com` |
| `MAX_CONCURRENCY` | Max concurrent jobs | `100` |
| `MAX_QUEUE_SIZE` | Max queue size | `50000` |

### WebSocket Service (a2a-ws)

| Variable | Value | Description |
|----------|-------|-------------|
| `STREAM_HOST` | `0.0.0.0` | Listen on all interfaces |
| `STREAM_PORT` | `$PORT` | Railway auto-assigned port |
| `METRICS_PORT` | `0` | Disable metrics server |
| `ENABLE_STREAMING` | `true` | Enable WebSocket streaming |

### API Service (a2a-api)

| Variable | Value | Description |
|----------|-------|-------------|
| `STREAM_HOST` | `0.0.0.0` | Listen on all interfaces |
| `STREAM_PORT` | `0` | Disable WebSocket server |
| `METRICS_PORT` | `$PORT` | Railway auto-assigned port |
| `ENABLE_STREAMING` | `false` | Disable streaming |

## Troubleshooting

### Service Won't Start

1. Check Railway logs for errors
2. Verify all required environment variables are set
3. Ensure `LOCAL_LLM_URL` is accessible
4. Check that Dockerfile builds successfully

### WebSocket Connection Fails

1. Verify `ws.a2a.yourdomain` resolves correctly
2. Check Cloudflare WebSocket support is enabled
3. Ensure `STREAM_TOKEN` is set correctly on both services
4. Check Railway logs for WebSocket errors

### Health Check Fails

1. Verify `api.a2a.yourdomain` resolves correctly
2. Check that `METRICS_PORT=$PORT` is set
3. Ensure service is running (check Railway logs)
4. Test with Railway's default domain first

### Performance Issues

1. Increase `MAX_CONCURRENCY` if jobs are queuing
2. Monitor Railway metrics for CPU/memory limits
3. Consider upgrading Railway plan for more resources
4. Check `LOCAL_LLM_URL` response times

## Scaling Considerations

### Horizontal Scaling

To handle more load:
1. Increase Railway instances for each service
2. Use a load balancer for multiple instances
3. Consider sticky sessions for WebSocket connections

### Vertical Scaling

1. Upgrade Railway plan for more CPU/memory
2. Adjust `MAX_CONCURRENCY` based on resources
3. Monitor metrics to identify bottlenecks

## Security Best Practices

1. **Use Strong Tokens:** Generate cryptographically secure `STREAM_TOKEN`
2. **Enable HTTPS:** Always use HTTPS/WSS in production
3. **Rate Limiting:** Consider adding rate limiting at Cloudflare
4. **Access Control:** Restrict access to sensitive endpoints
5. **Environment Variables:** Never commit tokens to version control
6. **Regular Updates:** Keep dependencies updated

## Cost Optimization

1. **Right-size Resources:** Monitor actual usage and adjust Railway plan
2. **Auto-scaling:** Use Railway's auto-scaling features
3. **Cloudflare:** Use free tier for DNS and caching
4. **Monitoring:** Set up alerts for unusual traffic patterns

## Support

- Railway Documentation: https://docs.railway.app
- Cloudflare Documentation: https://developers.cloudflare.com
- A2A GitHub Issues: https://github.com/yourusername/a2a/issues

## Quick Reference Commands

```bash
# Generate secure token
openssl rand -hex 32

# Test health endpoint
curl https://api.a2a.yourdomain/healthz

# Test metrics endpoint
curl https://api.a2a.yourdomain/metrics

# View Railway logs
railway logs -s a2a-ws
railway logs -s a2a-api

# Deploy updates
git push origin main  # Railway auto-deploys on push
```

---

**Last Updated:** 2025-10-25
**Version:** 1.0
