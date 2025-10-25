# Railway Quick Start - A2A Deployment

## 🚀 Fastest Path to Deployment

### Option 1: Automated Script (When Network Available)

```bash
# Run the deployment script
./railway-deploy.sh

# Follow prompts for:
# - Railway login
# - Ollama URL
# - Domain configuration
```

### Option 2: Web Dashboard (Recommended if CLI has issues)

See **RAILWAY_WEB_DEPLOY.md** for complete step-by-step guide.

## 📋 Pre-Deployment Checklist

- [ ] Railway account created
- [ ] GitHub repository connected to Railway
- [ ] Ollama/LLM service URL ready
- [ ] Domain name ready (optional)
- [ ] Cloudflare account (for custom domains)

## 🔑 Generate Secure Token

Run ONE of these commands to generate your `STREAM_TOKEN`:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Save this token!** You'll need it for both services.

## 🎯 Two Services Configuration

### Service 1: a2a-ws (WebSocket)

**Purpose:** Handles WebSocket streaming connections

**Start Command:**
```bash
sh -c "STREAM_HOST=0.0.0.0 STREAM_PORT=$PORT METRICS_PORT=0 node dist/index.js"
```

**Environment Variables:** See `.env.railway-ws`

**Domain:** `ws.a2a.yourdomain`

### Service 2: a2a-api (API/Health)

**Purpose:** Handles HTTP endpoints (health, metrics)

**Start Command:**
```bash
sh -c "METRICS_PORT=$PORT STREAM_HOST=0.0.0.0 STREAM_PORT=0 node dist/index.js"
```

**Environment Variables:** See `.env.railway-api`

**Domain:** `api.a2a.yourdomain`

## ✅ Quick Test Commands

```bash
# Test health endpoint
curl https://api.a2a.yourdomain/healthz

# Expected: {"status":"ok","timestamp":"..."}

# Test metrics endpoint
curl https://api.a2a.yourdomain/metrics

# Expected: Prometheus metrics output
```

## 📁 Configuration Files Reference

| File | Purpose |
|------|---------|
| `railway-deploy.sh` | Automated deployment script |
| `railway-ws.json` | WebSocket service config |
| `railway-api.json` | API service config |
| `.env.railway-ws` | WS service environment variables |
| `.env.railway-api` | API service environment variables |
| `RAILWAY_SETUP.md` | Complete deployment guide (500+ lines) |
| `RAILWAY_WEB_DEPLOY.md` | Web dashboard deployment guide |

## 🌐 Cloudflare DNS Setup

Add these CNAME records in Cloudflare DNS:

```
ws.a2a  →  a2a-ws-production.up.railway.app  (Proxied ☁️)
api.a2a →  a2a-api-production.up.railway.app (Proxied ☁️)
```

**Cache Rules:** Bypass cache for `/stream*`, `/metrics*`, `/healthz*`

## 🔧 Environment Variables

### Required for Both Services

| Variable | Value | Note |
|----------|-------|------|
| `NODE_ENV` | `production` | Environment |
| `LOG_LEVEL` | `info` | Logging |
| `STREAM_TOKEN` | `<generated>` | Security token (same for both) |
| `LOCAL_LLM_URL` | `https://...` | Your Ollama URL |

### WebSocket Service Only

| Variable | Value |
|----------|-------|
| `ENABLE_STREAMING` | `true` |
| `STREAM_HOST` | `0.0.0.0` |
| `METRICS_PORT` | `0` |

### API Service Only

| Variable | Value |
|----------|-------|
| `ENABLE_STREAMING` | `false` |
| `STREAM_PORT` | `0` |

**Note:** `STREAM_PORT` and `METRICS_PORT` are auto-set to `$PORT` by Railway for their respective services.

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Railway Project: a2a            │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐    ┌─────────────┐   │
│  │   a2a-ws    │    │  a2a-api    │   │
│  │  (WebSocket)│    │  (API/HTTP) │   │
│  │             │    │             │   │
│  │ Port: $PORT │    │ Port: $PORT │   │
│  │ Domain: ws. │    │ Domain: api.│   │
│  └──────┬──────┘    └──────┬──────┘   │
│         │                  │           │
└─────────┼──────────────────┼───────────┘
          │                  │
          ↓                  ↓
   wss://ws.a2a.yourdomain/stream
                      https://api.a2a.yourdomain/healthz
                      https://api.a2a.yourdomain/metrics
```

## 🚨 Troubleshooting Quick Fixes

### Service Won't Start
1. Check Railway logs
2. Verify `LOCAL_LLM_URL` is accessible
3. Ensure all environment variables are set

### WebSocket Connection Fails
1. Verify `STREAM_TOKEN` matches on both services
2. Check Cloudflare WebSocket support enabled
3. Test with Railway domain first

### Health Check Fails
1. Ensure `METRICS_PORT=0` on ws service
2. Ensure `STREAM_PORT=0` on api service
3. Check service logs for errors

## 📚 Documentation

- **Complete Guide:** RAILWAY_SETUP.md
- **Web Deployment:** RAILWAY_WEB_DEPLOY.md
- **Environment Variables:** .env.example

## 🎯 Success Criteria

Your deployment is successful when:

- ✅ Health check returns `{"status":"ok"}`
- ✅ Metrics endpoint returns Prometheus data
- ✅ Agent invocation returns `streamUrl` pointing to ws domain
- ✅ WebSocket connections work on ws domain
- ✅ Both services show "Active" in Railway dashboard

## 📞 Support

- Railway: https://docs.railway.app
- A2A Issues: https://github.com/Scarmonit/A2A/issues

---

**Quick Deploy Checklist:**
1. [ ] Generate `STREAM_TOKEN`
2. [ ] Run `railway-deploy.sh` OR follow web guide
3. [ ] Test `/healthz` endpoint
4. [ ] Test `/metrics` endpoint
5. [ ] Configure custom domains (optional)
6. [ ] Set up Cloudflare DNS (optional)
7. [ ] Test agent invocation
