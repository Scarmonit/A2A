# A2A MCP Server - Production Quick Start Guide

Get your A2A MCP Server production-ready in 15 minutes!

---

## Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher
- Docker (optional, for containerized deployment)
- PostgreSQL 14+ (optional, for persistence)
- Redis 6+ (optional, for caching)

---

## Step 1: Clone and Install (2 minutes)

```bash
# Clone the repository
git clone https://github.com/Scarmonit/A2A.git
cd A2A

# Install dependencies
npm install

# Build the project
npm run build
```

---

## Step 2: Configure Environment (3 minutes)

```bash
# Copy environment template
cp .env.example .env

# Edit configuration
nano .env  # or use your preferred editor
```

**Minimal Configuration for Development:**
```env
NODE_ENV=development
LOG_LEVEL=info
METRICS_PORT=3000
STREAM_PORT=8787
DASHBOARD_PORT=9000
```

**Production Configuration (with infrastructure):**
```env
NODE_ENV=production
LOG_LEVEL=info

# Server Ports
METRICS_PORT=3000
STREAM_PORT=8787
DASHBOARD_PORT=9000

# Redis (optional but recommended)
REDIS_HOST=localhost
REDIS_PORT=6379

# PostgreSQL (optional but recommended)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=a2a_mcp
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your-password

# OpenTelemetry (optional)
OTEL_ENABLED=false
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

---

## Step 3: Choose Your Deployment Mode (1 minute)

### Option A: Basic Mode (No External Dependencies)

Start the server with mock infrastructure:

```bash
npm start
```

**What you get:**
- ✅ Full MCP protocol support
- ✅ WebSocket streaming
- ✅ Agent management
- ✅ In-memory caching
- ✅ Basic monitoring
- ⚠️ No persistence (data lost on restart)
- ⚠️ Single instance only

### Option B: Production Mode (With Infrastructure)

Start external services and then the server:

```bash
# Start Redis (if using Docker)
docker run -d --name a2a-redis -p 6379:6379 redis:7-alpine

# Start PostgreSQL (if using Docker)
docker run -d --name a2a-postgres \
  -e POSTGRES_DB=a2a_mcp \
  -e POSTGRES_PASSWORD=your-password \
  -p 5432:5432 \
  postgres:15-alpine

# Start the server
npm start
```

**What you get:**
- ✅ All basic mode features
- ✅ Persistent storage
- ✅ Redis caching
- ✅ Session management
- ✅ Distributed tracing ready
- ✅ Multi-instance support
- ✅ Production-grade reliability

### Option C: Kubernetes Deployment (Production)

```bash
# Build Docker image
docker build -t your-registry/a2a-mcp:latest .

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml

# Verify deployment
kubectl get pods -n a2a-mcp
kubectl get svc -n a2a-mcp
```

**What you get:**
- ✅ All production mode features
- ✅ Auto-scaling (2-10 replicas)
- ✅ Load balancing
- ✅ Health monitoring
- ✅ Rolling updates
- ✅ Persistent volumes
- ✅ Prometheus metrics

---

## Step 4: Verify Installation (2 minutes)

### Check Server Health

```bash
# Health check
curl http://localhost:3000/healthz
# Expected: {"ok":true}

# Agent status
curl http://localhost:3000/api/agent?action=status
# Expected: JSON with agent statistics

# Prometheus metrics
curl http://localhost:3000/metrics
# Expected: Prometheus format metrics
```

### Test WebSocket Connection

```bash
# Install wscat if not already installed
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:8787

# Test message (paste in wscat prompt)
{"jsonrpc":"2.0","method":"list_agents","params":{},"id":1}

# Expected: JSON response with agent list
```

### View Dashboard Metrics

```bash
# Install websocat or use browser dev tools
websocat ws://localhost:9000

# You should receive metrics updates every 5 seconds
```

---

## Step 5: Run Production Integration Example (2 minutes)

```bash
# Build first
npm run build

# Run the production example
node dist/examples/production-integration-example.js
```

**What it does:**
- Initializes all production infrastructure
- Executes a CI/CD workflow
- Creates a user session
- Invokes an agent with tracking
- Performs health checks
- Displays statistics

**Expected Output:**
```
[INFO] Initializing production infrastructure...
[INFO] Redis connected successfully
[INFO] PostgreSQL connected and schema initialized
[INFO] Telemetry initialized
[INFO] Workflow templates loaded
[INFO] Health monitoring started
[INFO] Real-time dashboard started
[INFO] Production infrastructure initialized successfully
[INFO] Example 1: Executing CI/CD workflow...
[INFO] Example 2: Creating user session...
[INFO] Example 3: Invoking agent with tracking...
[INFO] Example 4: Performing health check...
[INFO] Example 5: Getting statistics...
```

---

## Step 6: Integration with Claude Desktop (Optional, 3 minutes)

### For macOS:

```bash
# Edit Claude Desktop config
nano ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### For Windows:

```
# Edit: %APPDATA%\Claude\claude_desktop_config.json
```

### Add A2A Server:

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["/absolute/path/to/A2A/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "METRICS_PORT": "3000",
        "STREAM_PORT": "8787"
      }
    }
  }
}
```

### Restart Claude Desktop

---

## Step 7: Set Up Monitoring (Optional, 5 minutes)

### Import Grafana Dashboard

```bash
# If you have Grafana running
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_GRAFANA_TOKEN" \
  -d @monitoring/grafana-dashboard.json
```

### Start Prometheus

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'a2a-mcp'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

```bash
# Start Prometheus
docker run -d --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

---

## Common Operations

### View Logs

```bash
# Real-time logs
npm start | pino-pretty

# Or using built-in formatting
npm start 2>&1 | grep -E "INFO|ERROR|WARN"
```

### Scale Deployment

```bash
# Kubernetes
kubectl scale deployment/a2a-mcp-server --replicas=5 -n a2a-mcp

# Docker Compose
docker-compose up --scale a2a-mcp=5
```

### Backup Database

```bash
# PostgreSQL
pg_dump -h localhost -U postgres -d a2a_mcp > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-$(date +%Y%m%d).sql
```

### Update Deployment

```bash
# Pull latest changes
git pull origin main

# Rebuild
npm install
npm run build

# Restart (development)
npm start

# Restart (Kubernetes)
kubectl rollout restart deployment/a2a-mcp-server -n a2a-mcp
```

---

## Troubleshooting

### Server Won't Start

```bash
# Check Node version
node --version  # Should be 20.x or higher

# Check port availability
lsof -i :3000  # Metrics port
lsof -i :8787  # WebSocket port
lsof -i :9000  # Dashboard port

# Kill processes if needed
kill -9 <PID>
```

### Can't Connect to Redis

```bash
# Check Redis is running
redis-cli ping
# Expected: PONG

# Check connection from server
redis-cli -h localhost -p 6379 ping
```

### Can't Connect to PostgreSQL

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -U postgres -d a2a_mcp -c "SELECT 1;"
```

### High Memory Usage

```bash
# Check memory usage
kubectl top pods -n a2a-mcp  # Kubernetes

# Or
docker stats  # Docker

# Increase heap size if needed
node --max-old-space-size=4096 dist/index.js
```

### WebSocket Disconnections

```bash
# Check load balancer timeout settings
# Increase session timeout in Kubernetes service

# Check network policies
kubectl get networkpolicies -n a2a-mcp
```

---

## Next Steps

1. **Read the Production Runbook**: `docs/PRODUCTION_RUNBOOK.md`
2. **Review Deployment Checklist**: `docs/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
3. **Explore Workflow Templates**: `src/workflow-templates/production-templates.ts`
4. **Check API Documentation**: `docs/openapi.yaml`
5. **Join Discussions**: https://github.com/Scarmonit/A2A/discussions

---

## Quick Reference

### Key Files

- `.env` - Environment configuration
- `k8s/deployment.yaml` - Kubernetes deployment
- `docker-compose.yml` - Docker Compose setup
- `monitoring/grafana-dashboard.json` - Grafana dashboard
- `docs/openapi.yaml` - API specification

### Key Commands

```bash
npm start                 # Start server
npm run build            # Build project
npm test                 # Run tests
npm run lint             # Check code quality
npm run format           # Format code

kubectl get pods         # Check Kubernetes pods
kubectl logs <pod>       # View pod logs
kubectl describe pod     # Pod details
```

### Important URLs

- Health: http://localhost:3000/healthz
- Metrics: http://localhost:3000/metrics
- Agent Status: http://localhost:3000/api/agent?action=status
- WebSocket: ws://localhost:8787
- Dashboard: ws://localhost:9000

---

## Getting Help

- **Documentation**: `docs/` directory
- **Issues**: https://github.com/Scarmonit/A2A/issues
- **Discussions**: https://github.com/Scarmonit/A2A/discussions
- **Security**: `SECURITY.md`

---

**Congratulations!** 🎉 Your A2A MCP Server is now production-ready!

For detailed operational guidance, see the [Production Runbook](./PRODUCTION_RUNBOOK.md).
