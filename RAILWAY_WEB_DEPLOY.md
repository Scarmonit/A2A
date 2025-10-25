# Railway Web Dashboard Deployment Guide

Since Railway CLI installation is experiencing network issues, here's a complete guide to deploy A2A via the Railway web dashboard.

## Prerequisites

1. Railway account at https://railway.app
2. GitHub repository connected
3. This repository ready to deploy

## Quick Deploy: Two Services Setup

### Step 1: Create New Project

1. Go to https://railway.app/dashboard
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose the **Scarmonit/A2A** repository
5. Name the project: **a2a-mcp-server**

### Step 2: Create First Service - WebSocket (a2a-ws)

#### 2.1 Create Service

1. In your new project, Railway creates a default service
2. Click on the service name and rename it to: **a2a-ws**
3. Or click **"+ New"** → **"GitHub Repo"** → Select **Scarmonit/A2A** → Name: **a2a-ws**

#### 2.2 Configure Start Command

1. Click on the **a2a-ws** service
2. Go to **Settings** tab
3. Scroll to **Deploy** section
4. Under **Custom Start Command**, enter:
```bash
sh -c "STREAM_HOST=0.0.0.0 STREAM_PORT=$PORT METRICS_PORT=0 node dist/index.js"
```
5. Click **Save**

#### 2.3 Set Environment Variables

1. Click on the **a2a-ws** service
2. Go to **Variables** tab
3. Click **"+ New Variable"** for each of these:

```
NODE_ENV=production
LOG_LEVEL=info
ENABLE_STREAMING=true
STREAM_HOST=0.0.0.0
METRICS_PORT=0
STREAM_TOKEN=REPLACE_WITH_SECURE_TOKEN
LOCAL_LLM_URL=https://your-ollama-host.example.com
MAX_CONCURRENCY=100
MAX_QUEUE_SIZE=50000
MAX_SUBS_PER_REQUEST=16
REQUEST_TTL_MS=300000
IDEMP_TTL_MS=900000
```

**Important Notes:**
- Generate a secure token for `STREAM_TOKEN` using: `openssl rand -hex 32`
- Replace `LOCAL_LLM_URL` with your actual Ollama/LLM service URL
- `STREAM_PORT` will be automatically set by Railway as `$PORT`

#### 2.4 Deploy

The service will automatically deploy. You can also manually trigger with **"Deploy"** button.

### Step 3: Create Second Service - API (a2a-api)

#### 3.1 Create Service

1. In your project, click **"+ New"**
2. Select **"GitHub Repo"**
3. Choose **Scarmonit/A2A** repository
4. Name the service: **a2a-api**

#### 3.2 Configure Start Command

1. Click on the **a2a-api** service
2. Go to **Settings** tab
3. Under **Custom Start Command**, enter:
```bash
sh -c "METRICS_PORT=$PORT STREAM_HOST=0.0.0.0 STREAM_PORT=0 node dist/index.js"
```
4. Click **Save**

#### 3.3 Set Environment Variables

1. Click on the **a2a-api** service
2. Go to **Variables** tab
3. Add these variables:

```
NODE_ENV=production
LOG_LEVEL=info
ENABLE_STREAMING=false
STREAM_HOST=0.0.0.0
STREAM_PORT=0
STREAM_TOKEN=SAME_TOKEN_AS_WS_SERVICE
LOCAL_LLM_URL=https://your-ollama-host.example.com
MAX_CONCURRENCY=100
MAX_QUEUE_SIZE=50000
REQUEST_TTL_MS=300000
IDEMP_TTL_MS=900000
```

**Important:**
- Use the **SAME** `STREAM_TOKEN` as a2a-ws service
- Use the **SAME** `LOCAL_LLM_URL` as a2a-ws service
- `METRICS_PORT` will be automatically set by Railway as `$PORT`

#### 3.4 Deploy

The service will automatically deploy.

### Step 4: Get Service URLs

#### 4.1 Get WebSocket Service URL

1. Click on **a2a-ws** service
2. Go to **Settings** tab
3. Scroll to **Networking** section
4. Click **"Generate Domain"**
5. Copy the generated URL (e.g., `a2a-ws-production.up.railway.app`)

#### 4.2 Get API Service URL

1. Click on **a2a-api** service
2. Go to **Settings** tab
3. Scroll to **Networking** section
4. Click **"Generate Domain"**
5. Copy the generated URL (e.g., `a2a-api-production.up.railway.app`)

### Step 5: Test Deployment

#### 5.1 Test Health Endpoint

```bash
curl https://a2a-api-production.up.railway.app/healthz
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-25T..."
}
```

#### 5.2 Test Metrics Endpoint

```bash
curl https://a2a-api-production.up.railway.app/metrics
```

Expected: Prometheus metrics output

### Step 6: Set Up Custom Domains (Optional)

#### 6.1 Add Custom Domains in Railway

For **a2a-ws** service:
1. Go to service **Settings** → **Networking**
2. Under **Custom Domains**, click **"+ Custom Domain"**
3. Enter: `ws.a2a.yourdomain`
4. Railway will provide CNAME target

For **a2a-api** service:
1. Go to service **Settings** → **Networking**
2. Under **Custom Domains**, click **"+ Custom Domain"**
3. Enter: `api.a2a.yourdomain`
4. Railway will provide CNAME target

#### 6.2 Configure DNS (Cloudflare)

1. Log in to Cloudflare
2. Select your domain
3. Go to **DNS** → **Records**
4. Add CNAME records:

```
Type: CNAME
Name: ws.a2a
Target: a2a-ws-production.up.railway.app
Proxy: Enabled (orange cloud)
```

```
Type: CNAME
Name: api.a2a
Target: a2a-api-production.up.railway.app
Proxy: Enabled (orange cloud)
```

#### 6.3 Configure Cloudflare Cache Rules

1. Go to **Caching** → **Configuration**
2. Create a new **Cache Rule**:
   - Name: **Bypass A2A endpoints**
   - When incoming requests match:
     - URI Path starts with `/stream` OR
     - URI Path starts with `/metrics` OR
     - URI Path starts with `/healthz`
   - Then: **Bypass cache**

### Step 7: Monitor Deployments

#### View Logs

1. Click on each service
2. Go to **Deployments** tab
3. Click on the active deployment
4. View real-time logs

#### View Metrics

1. Click on each service
2. Go to **Metrics** tab
3. View CPU, Memory, Network usage

## Environment Variables Quick Copy

### For a2a-ws Service

Copy this entire block and paste into Railway Variables (one per line):

```env
NODE_ENV=production
LOG_LEVEL=info
ENABLE_STREAMING=true
STREAM_HOST=0.0.0.0
METRICS_PORT=0
STREAM_TOKEN=YOUR_GENERATED_SECURE_TOKEN_HERE
LOCAL_LLM_URL=https://your-ollama-host.example.com
MAX_CONCURRENCY=100
MAX_QUEUE_SIZE=50000
MAX_SUBS_PER_REQUEST=16
REQUEST_TTL_MS=300000
IDEMP_TTL_MS=900000
```

### For a2a-api Service

Copy this entire block:

```env
NODE_ENV=production
LOG_LEVEL=info
ENABLE_STREAMING=false
STREAM_HOST=0.0.0.0
STREAM_PORT=0
STREAM_TOKEN=SAME_AS_WS_SERVICE
LOCAL_LLM_URL=https://your-ollama-host.example.com
MAX_CONCURRENCY=100
MAX_QUEUE_SIZE=50000
REQUEST_TTL_MS=300000
IDEMP_TTL_MS=900000
```

## Generate Secure Token

Run this command to generate a secure STREAM_TOKEN:

```bash
openssl rand -hex 32
```

Or use Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Or use Python:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## Troubleshooting

### Build Fails

1. Check **Deployments** → **Build Logs**
2. Ensure Dockerfile is in repository root
3. Verify all dependencies in package.json

### Service Won't Start

1. Check **Deployments** → **Deploy Logs**
2. Verify environment variables are set correctly
3. Ensure `LOCAL_LLM_URL` is accessible
4. Check start command is correct

### Health Check Fails

1. Verify service is running (check logs)
2. Ensure `METRICS_PORT=$PORT` for a2a-api
3. Test with Railway-generated domain first
4. Check firewall/network settings

### WebSocket Connection Issues

1. Verify `STREAM_PORT=$PORT` for a2a-ws
2. Ensure Cloudflare WebSocket support is enabled
3. Check both services use same `STREAM_TOKEN`
4. Test with Railway domain before adding custom domain

## Quick Commands

```bash
# Test health
curl https://api.a2a.yourdomain/healthz

# Test metrics
curl https://api.a2a.yourdomain/metrics

# Generate token
openssl rand -hex 32

# View Railway logs (if CLI works later)
railway logs -s a2a-ws
railway logs -s a2a-api
```

## Next Steps

After successful deployment:

1. ✅ Test health and metrics endpoints
2. ✅ Set up monitoring/alerting
3. ✅ Configure Cloudflare WAF rules (optional)
4. ✅ Set up backup/disaster recovery
5. ✅ Document your deployment specifics
6. ✅ Test with actual agent invocations

## Support

- Railway Docs: https://docs.railway.app
- Cloudflare Docs: https://developers.cloudflare.com
- A2A Setup Guide: See RAILWAY_SETUP.md

---

**Deployment Date:** 2025-10-25
**Configuration Version:** 1.0
