# Railway Deployment Summary - A2A MCP Server

## 🎯 What Has Been Set Up

All Railway deployment configurations and automation tools have been created and committed to your repository on branch `claude/railway-deployment-setup-011CUTZaM3T8wreECeRtBTnX`.

### Files Created

| File | Purpose |
|------|---------|
| **railway-ws.json** | WebSocket service configuration |
| **railway-api.json** | API/health service configuration |
| **railway.json** | Base Railway configuration |
| **railway.toml** | Railway TOML configuration |
| **railway-deploy.sh** | Automated deployment script (executable) |
| **RAILWAY_SETUP.md** | Complete deployment guide (500+ lines) |
| **RAILWAY_WEB_DEPLOY.md** | Web dashboard step-by-step guide |
| **RAILWAY_QUICK_START.md** | Quick reference and checklist |
| **.env.railway-ws** | WebSocket service env template |
| **.env.railway-api** | API service env template |
| **.env.example** | Updated with Railway config |

## 🚀 Ready to Deploy

### Method 1: Automated Script (Recommended when CLI works)

```bash
# Navigate to repository
cd /home/user/A2A

# Make sure script is executable
chmod +x railway-deploy.sh

# Run deployment
./railway-deploy.sh
```

The script will:
1. Install Railway CLI (if needed)
2. Authenticate with Railway
3. Create project and services
4. Configure environment variables
5. Deploy both services
6. Generate domain URLs
7. Provide testing commands

### Method 2: Web Dashboard (Works Now)

Go to **https://railway.app/new** and follow the guide in **RAILWAY_WEB_DEPLOY.md**

Quick steps:
1. Create new project from GitHub repo
2. Create two services (a2a-ws and a2a-api)
3. Copy env vars from `.env.railway-ws` and `.env.railway-api`
4. Set custom start commands
5. Deploy

### Method 3: Railway CLI Manual

```bash
# After installing Railway CLI
railway login
railway init --name a2a-mcp-server

# Deploy WebSocket service
railway service create a2a-ws
railway up --service a2a-ws

# Deploy API service
railway service create a2a-api
railway up --service a2a-api
```

## 🔧 Before Deploying

### 1. Generate Secure Token

Choose ONE method:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Save this token!** You'll use it as `STREAM_TOKEN` for both services.

### 2. Get Your Ollama URL

You need the URL to your Ollama or LLM service. Examples:
- `http://localhost:11434` (local development)
- `https://ollama.yourdomain.com` (production)
- `https://your-ollama-railway-app.up.railway.app` (Railway-hosted Ollama)

### 3. Prepare Domain (Optional)

If using custom domains:
- Decide on subdomain structure (e.g., `ws.a2a.yourdomain` and `api.a2a.yourdomain`)
- Have Cloudflare account ready for DNS management

## 📋 Environment Variables Checklist

### Both Services Need:
- ✅ `NODE_ENV=production`
- ✅ `LOG_LEVEL=info`
- ✅ `STREAM_TOKEN=<your-generated-token>` (SAME for both)
- ✅ `LOCAL_LLM_URL=<your-ollama-url>` (SAME for both)
- ✅ `MAX_CONCURRENCY=100`
- ✅ `MAX_QUEUE_SIZE=50000`

### a2a-ws Service (WebSocket) ONLY:
- ✅ `ENABLE_STREAMING=true`
- ✅ `STREAM_HOST=0.0.0.0`
- ✅ `METRICS_PORT=0`
- ✅ Start Command: `sh -c "STREAM_HOST=0.0.0.0 STREAM_PORT=$PORT METRICS_PORT=0 node dist/index.js"`

### a2a-api Service (API) ONLY:
- ✅ `ENABLE_STREAMING=false`
- ✅ `STREAM_HOST=0.0.0.0`
- ✅ `STREAM_PORT=0`
- ✅ Start Command: `sh -c "METRICS_PORT=$PORT STREAM_HOST=0.0.0.0 STREAM_PORT=0 node dist/index.js"`

## 🧪 Testing After Deployment

### 1. Test Health Endpoint

```bash
# Using Railway domain
curl https://a2a-api-production.up.railway.app/healthz

# Using custom domain
curl https://api.a2a.yourdomain/healthz

# Expected response:
# {"status":"ok","timestamp":"2025-10-25T..."}
```

### 2. Test Metrics Endpoint

```bash
curl https://api.a2a.yourdomain/metrics

# Expected: Prometheus metrics output with:
# - a2a_requests_created_total
# - a2a_running_jobs
# - a2a_queue_size
# - etc.
```

### 3. Test Agent Invocation

Create a test file `test-railway-deployment.js`:

```javascript
// Test Railway Deployment
const https = require('https');

const data = JSON.stringify({
  action: 'invoke_agent',
  agentId: 'code-agent',
  capability: 'analyze',
  input: { code: 'console.log("Railway deployment test")' }
});

const options = {
  hostname: 'api.a2a.yourdomain',
  port: 443,
  path: '/agent_control',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    const response = JSON.parse(body);
    console.log('Request ID:', response.requestId);
    console.log('Stream URL:', response.streamUrl);
    console.log('\n✅ Deployment successful if streamUrl points to ws.a2a.yourdomain');
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(data);
req.end();
```

Run: `node test-railway-deployment.js`

## 🌐 Custom Domain Setup

After Railway services are deployed:

### 1. In Railway Dashboard

For **a2a-ws** service:
- Go to Settings → Networking → Custom Domain
- Add: `ws.a2a.yourdomain`
- Note the CNAME target (e.g., `a2a-ws-production.up.railway.app`)

For **a2a-api** service:
- Go to Settings → Networking → Custom Domain
- Add: `api.a2a.yourdomain`
- Note the CNAME target (e.g., `a2a-api-production.up.railway.app`)

### 2. In Cloudflare Dashboard

Add DNS records:

```
Type: CNAME
Name: ws.a2a
Target: a2a-ws-production.up.railway.app
Proxy: ☁️ Enabled (orange cloud)
```

```
Type: CNAME
Name: api.a2a
Target: a2a-api-production.up.railway.app
Proxy: ☁️ Enabled (orange cloud)
```

### 3. Configure Cloudflare Cache Rules

Create a cache rule to bypass caching:
- **Match:** URI path starts with `/stream` OR `/metrics` OR `/healthz`
- **Action:** Bypass cache

## 🎯 Expected Architecture

After deployment, you'll have:

```
┌─────────────────────────────────────────────┐
│    Railway Project: a2a-mcp-server          │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐       ┌──────────────┐  │
│  │   a2a-ws     │       │   a2a-api    │  │
│  │ (WebSocket)  │       │ (API/Health) │  │
│  ├──────────────┤       ├──────────────┤  │
│  │ STREAM: $PORT│       │ METRICS: $PORT│ │
│  │ METRICS: 0   │       │ STREAM: 0    │  │
│  └──────┬───────┘       └──────┬───────┘  │
│         │                      │           │
└─────────┼──────────────────────┼───────────┘
          │                      │
          ↓                      ↓
   wss://ws.a2a.yourdomain/stream
                    https://api.a2a.yourdomain/healthz
                    https://api.a2a.yourdomain/metrics
```

## 📊 Monitoring

### Railway Dashboard
- View deployments: Railway → Project → Service → Deployments
- View logs: Railway → Service → Deployments → Click deployment
- View metrics: Railway → Service → Metrics (CPU, Memory, Network)

### Prometheus Metrics
Access at: `https://api.a2a.yourdomain/metrics`

Key metrics:
- `a2a_requests_created_total` - Total requests
- `a2a_running_jobs` - Current jobs
- `a2a_queue_size` - Queue length
- `a2a_ws_clients` - WebSocket connections
- `a2a_ws_channels` - Active channels

## 🔒 Security Checklist

- ✅ Generated strong `STREAM_TOKEN` (32+ random bytes)
- ✅ Using HTTPS/WSS in production
- ✅ Environment variables set in Railway (not in code)
- ✅ Cloudflare proxy enabled for DDoS protection
- ✅ Regular dependency updates scheduled

## 💰 Cost Estimates

**Railway Pricing (as of 2025):**
- Free tier: $5/month credit
- Hobby plan: $5/month per user
- Two services: ~$10-20/month (depending on usage)

**Cloudflare:**
- DNS: Free
- Proxy: Free
- Cache: Free (with limits)

## 🆘 Troubleshooting

### Railway CLI Won't Install
→ Use **RAILWAY_WEB_DEPLOY.md** for manual web deployment

### Build Fails
→ Check Railway logs for errors
→ Verify Dockerfile exists in repo root
→ Ensure all dependencies in package.json

### Service Won't Start
→ Check `LOCAL_LLM_URL` is accessible
→ Verify all required env vars are set
→ Review deploy logs in Railway dashboard

### Health Check Fails
→ Ensure `METRICS_PORT=$PORT` for a2a-api
→ Ensure `STREAM_PORT=0` for a2a-api
→ Check service is running (view logs)

### WebSocket Fails
→ Verify `STREAM_TOKEN` matches both services
→ Check Cloudflare has WebSocket support enabled
→ Ensure `STREAM_PORT=$PORT` for a2a-ws

## 📚 Documentation Reference

| Document | When to Use |
|----------|-------------|
| **RAILWAY_QUICK_START.md** | First-time deployment, quick reference |
| **RAILWAY_WEB_DEPLOY.md** | Manual web deployment, step-by-step |
| **RAILWAY_SETUP.md** | Complete guide, troubleshooting, advanced config |
| **.env.railway-ws** | WebSocket service environment variables |
| **.env.railway-api** | API service environment variables |
| **railway-deploy.sh** | Automated CLI deployment |

## ✅ Success Criteria

Your deployment is successful when ALL of these work:

1. ✅ `curl https://api.a2a.yourdomain/healthz` returns `{"status":"ok"}`
2. ✅ `curl https://api.a2a.yourdomain/metrics` returns Prometheus metrics
3. ✅ Agent invocation returns `streamUrl` pointing to `wss://ws.a2a.yourdomain`
4. ✅ WebSocket connection to stream URL succeeds
5. ✅ Both services show "Active" status in Railway dashboard
6. ✅ Railway logs show no errors

## 🎬 Next Steps

### Immediate (Required)
1. [ ] Generate `STREAM_TOKEN` using one of the provided methods
2. [ ] Prepare `LOCAL_LLM_URL` (your Ollama service)
3. [ ] Choose deployment method (script or web)
4. [ ] Deploy both services to Railway
5. [ ] Test health and metrics endpoints

### Short-term (Recommended)
6. [ ] Set up custom domains in Railway
7. [ ] Configure Cloudflare DNS
8. [ ] Set up monitoring/alerting
9. [ ] Test full agent invocation flow
10. [ ] Document your specific deployment details

### Long-term (Optional)
11. [ ] Set up CI/CD for auto-deployment
12. [ ] Configure Railway auto-scaling
13. [ ] Set up backup/disaster recovery
14. [ ] Implement rate limiting at Cloudflare
15. [ ] Monitor costs and optimize resources

## 📞 Support Resources

- **Railway Docs:** https://docs.railway.app
- **Railway CLI:** https://docs.railway.app/guides/cli
- **Cloudflare Docs:** https://developers.cloudflare.com
- **A2A Repository:** https://github.com/Scarmonit/A2A

## 🎉 You're All Set!

All configuration files are ready in your repository. Choose your deployment method and follow the corresponding guide:

- **Quick & Automated:** Run `./railway-deploy.sh`
- **Manual & Controlled:** Follow `RAILWAY_WEB_DEPLOY.md`
- **Reference:** Use `RAILWAY_QUICK_START.md`

---

**Configuration Created:** 2025-10-25
**Branch:** claude/railway-deployment-setup-011CUTZaM3T8wreECeRtBTnX
**Status:** ✅ Ready to deploy
**Next Action:** Choose deployment method and execute
