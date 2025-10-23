# A2A MCP Server - Production Runbook

Operations guide for running A2A MCP Server in production environments.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Common Operations](#common-operations)
3. [Troubleshooting](#troubleshooting)
4. [Incident Response](#incident-response)
5. [Performance Tuning](#performance-tuning)
6. [Maintenance](#maintenance)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Load Balancer                        │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
┌─────────────────┐             ┌─────────────────┐
│   A2A Pod 1     │             │   A2A Pod 2     │
│  (Replica 1)    │             │  (Replica 2)    │
└─────────────────┘             └─────────────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
┌─────────────────┐             ┌─────────────────┐
│   PostgreSQL    │             │     Redis       │
│   (Primary)     │             │    (Cache)      │
└─────────────────┘             └─────────────────┘
```

### Key Components

- **A2A MCP Server**: Node.js application running in Kubernetes
- **PostgreSQL**: Persistent storage for agents, workflows, permissions
- **Redis**: Caching and session management
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization

---

## Common Operations

### 1. Scaling Operations

#### Manual Scaling

```bash
# Scale up
kubectl scale deployment/a2a-mcp-server --replicas=5 -n a2a-mcp

# Scale down
kubectl scale deployment/a2a-mcp-server --replicas=2 -n a2a-mcp

# Verify
kubectl get pods -n a2a-mcp
```

#### Auto-Scaling Configuration

```bash
# View current HPA
kubectl get hpa -n a2a-mcp

# Edit HPA
kubectl edit hpa a2a-mcp-hpa -n a2a-mcp
```

**When to Scale:**
- CPU usage > 70% sustained
- Memory usage > 80% sustained
- Response time P95 > 8s
- WebSocket connections > 80 per pod

### 2. Deployment Operations

#### Rolling Update

```bash
# Update image
kubectl set image deployment/a2a-mcp-server \
  a2a-mcp=your-registry.com/a2a-mcp:v0.2.0 \
  -n a2a-mcp

# Monitor rollout
kubectl rollout status deployment/a2a-mcp-server -n a2a-mcp

# View history
kubectl rollout history deployment/a2a-mcp-server -n a2a-mcp
```

#### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/a2a-mcp-server -n a2a-mcp

# Rollback to specific revision
kubectl rollout undo deployment/a2a-mcp-server --to-revision=3 -n a2a-mcp
```

### 3. Monitoring Operations

#### View Logs

```bash
# All pods
kubectl logs -n a2a-mcp -l app=a2a-mcp --tail=100

# Specific pod
kubectl logs -n a2a-mcp <pod-name> --tail=100 -f

# Previous instance (if crashed)
kubectl logs -n a2a-mcp <pod-name> --previous
```

#### Check Metrics

```bash
# Pod metrics
kubectl top pods -n a2a-mcp

# Node metrics
kubectl top nodes

# Prometheus query
curl 'http://prometheus:9090/api/v1/query?query=a2a_agents_total'
```

#### Access Dashboard

```bash
# Port-forward to access locally
kubectl port-forward -n a2a-mcp svc/a2a-mcp-metrics 3000:3000

# Access in browser
open http://localhost:3000/metrics
```

### 4. Database Operations

#### Connect to PostgreSQL

```bash
# Port-forward
kubectl port-forward -n a2a-mcp svc/postgres 5432:5432

# Connect
psql -h localhost -U postgres -d a2a_mcp
```

#### Backup Database

```bash
# Create backup
pg_dump -h $POSTGRES_HOST -U $POSTGRES_USER -d a2a_mcp > backup-$(date +%Y%m%d).sql

# Compress
gzip backup-$(date +%Y%m%d).sql
```

#### Restore Database

```bash
# Restore from backup
gunzip backup-20250101.sql.gz
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d a2a_mcp < backup-20250101.sql
```

### 5. Cache Operations

#### Clear Redis Cache

```bash
# Connect to Redis
kubectl exec -it -n a2a-mcp <redis-pod> -- redis-cli

# Clear all cache
FLUSHDB

# Clear specific pattern
KEYS a2a:*
DEL a2a:session:12345
```

---

## Troubleshooting

### Issue: High Memory Usage

**Symptoms:**
- Memory usage > 90%
- Pods being OOMKilled
- Slow response times

**Diagnosis:**
```bash
# Check memory usage
kubectl top pods -n a2a-mcp

# Check for memory leaks
kubectl exec -it -n a2a-mcp <pod-name> -- node -e "console.log(process.memoryUsage())"

# View detailed metrics
curl http://<pod-ip>:3000/metrics | grep memory
```

**Resolution:**
1. Check for memory leaks in application code
2. Increase memory limits: `kubectl edit deployment/a2a-mcp-server`
3. Scale horizontally: `kubectl scale --replicas=5`
4. Clear cache: `redis-cli FLUSHDB`
5. Restart pods: `kubectl rollout restart deployment/a2a-mcp-server`

### Issue: High Error Rate

**Symptoms:**
- Error rate > 2%
- 5xx responses in logs
- Alert: "High Error Rate"

**Diagnosis:**
```bash
# Check error logs
kubectl logs -n a2a-mcp -l app=a2a-mcp | grep ERROR

# Query Prometheus
curl 'http://prometheus:9090/api/v1/query?query=rate(a2a_errors_total[5m])'

# Check agent status
curl http://<pod-ip>:3000/api/agent?action=status
```

**Resolution:**
1. Identify failing agents/tools
2. Check database connectivity
3. Verify Redis connectivity
4. Review recent deployments
5. Scale up if resource constrained
6. Rollback if deployment-related

### Issue: WebSocket Disconnections

**Symptoms:**
- Frequent WebSocket disconnections
- Streaming failures
- Client timeout errors

**Diagnosis:**
```bash
# Check WebSocket connections
kubectl logs -n a2a-mcp -l app=a2a-mcp | grep "WebSocket"

# Check load balancer timeout
kubectl describe svc/a2a-mcp-websocket -n a2a-mcp

# Test connection
wscat -c ws://<loadbalancer-ip>:8787
```

**Resolution:**
1. Increase load balancer timeout (default: 3600s)
2. Check network policies
3. Verify session affinity configured
4. Check for memory pressure causing restarts
5. Review WebSocket server configuration

### Issue: Database Connection Failures

**Symptoms:**
- "Cannot connect to database" errors
- Slow queries
- Connection pool exhausted

**Diagnosis:**
```bash
# Check database status
kubectl get pods -n a2a-mcp | grep postgres

# Check connection pool
psql -c "SELECT * FROM pg_stat_activity;"

# Check slow queries
psql -c "SELECT query, state, wait_event FROM pg_stat_activity WHERE state = 'active';"
```

**Resolution:**
1. Verify PostgreSQL pod healthy
2. Increase connection pool size
3. Optimize slow queries (add indexes)
4. Scale database (read replicas)
5. Check network policies
6. Restart application pods

### Issue: Rate Limiting Triggered

**Symptoms:**
- 429 Too Many Requests errors
- "Rate limit exceeded" in logs
- Alert: "High Rate Limit Hits"

**Diagnosis:**
```bash
# Check rate limit metrics
curl 'http://prometheus:9090/api/v1/query?query=a2a_rate_limit_exceeded_total'

# View logs
kubectl logs -n a2a-mcp -l app=a2a-mcp | grep "rate limit"
```

**Resolution:**
1. Identify offending agent/client
2. Review rate limit configuration
3. Increase limits if legitimate traffic
4. Block malicious clients
5. Implement request throttling

---

## Incident Response

### Severity Levels

| Severity | Description | Response Time | Example |
|----------|-------------|---------------|---------|
| SEV1 | Critical outage | 15 minutes | All pods down |
| SEV2 | Major degradation | 30 minutes | High error rate |
| SEV3 | Minor issue | 2 hours | Single pod unhealthy |
| SEV4 | Maintenance | Next business day | Logs cleanup |

### Incident Response Process

1. **Detect**: Alert triggered or issue reported
2. **Assess**: Determine severity and impact
3. **Escalate**: Notify on-call engineer
4. **Mitigate**: Immediate actions to restore service
5. **Investigate**: Root cause analysis
6. **Resolve**: Permanent fix
7. **Document**: Post-mortem report

### Emergency Procedures

#### Complete Outage (SEV1)

```bash
# 1. Check cluster health
kubectl get nodes
kubectl get pods -n a2a-mcp

# 2. Check recent changes
kubectl rollout history deployment/a2a-mcp-server -n a2a-mcp

# 3. Quick rollback if needed
kubectl rollout undo deployment/a2a-mcp-server -n a2a-mcp

# 4. Force restart all pods
kubectl rollout restart deployment/a2a-mcp-server -n a2a-mcp

# 5. Verify recovery
kubectl get pods -n a2a-mcp
curl http://<loadbalancer-ip>:3000/healthz
```

#### Database Down (SEV1)

```bash
# 1. Check PostgreSQL pod
kubectl get pods -n a2a-mcp | grep postgres

# 2. Restart PostgreSQL
kubectl delete pod <postgres-pod-name> -n a2a-mcp

# 3. Wait for recovery
kubectl wait --for=condition=ready pod -l app=postgres -n a2a-mcp

# 4. Verify connectivity
kubectl exec -it -n a2a-mcp <a2a-pod> -- node -e "require('pg').Pool({}).connect().then(c => c.release())"
```

---

## Performance Tuning

### Node.js Optimization

```bash
# Increase heap size
--max-old-space-size=2048

# Enable source maps for debugging
--enable-source-maps

# Enable async stack traces
--async-stack-traces
```

### Database Optimization

```sql
-- Add indexes for common queries
CREATE INDEX idx_agents_category ON agents(category);
CREATE INDEX idx_agents_tags ON agents USING GIN(tags);
CREATE INDEX idx_workflows_status ON workflows(status);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM agents WHERE category = 'web_scraper';

-- Vacuum and analyze
VACUUM ANALYZE agents;
```

### Redis Optimization

```bash
# Set max memory policy
CONFIG SET maxmemory 256mb
CONFIG SET maxmemory-policy allkeys-lru

# Check memory usage
INFO memory

# Monitor slow commands
SLOWLOG GET 10
```

---

## Maintenance

### Weekly Tasks

- [ ] Review error logs
- [ ] Check disk usage
- [ ] Verify backups completed
- [ ] Review performance metrics
- [ ] Update dependencies (security patches)

### Monthly Tasks

- [ ] Capacity planning review
- [ ] Cost optimization analysis
- [ ] Security audit
- [ ] Performance testing
- [ ] Disaster recovery drill

### Quarterly Tasks

- [ ] Major version updates
- [ ] Compliance review
- [ ] Architecture review
- [ ] Load testing
- [ ] Runbook review and update

---

## Quick Reference

### Important URLs

- Grafana: http://grafana.example.com
- Prometheus: http://prometheus.example.com
- Kibana (logs): http://kibana.example.com
- A2A Metrics: http://<loadbalancer-ip>:3000/metrics
- A2A Health: http://<loadbalancer-ip>:3000/healthz

### Common Commands

```bash
# Check pod status
kubectl get pods -n a2a-mcp

# View logs
kubectl logs -n a2a-mcp -l app=a2a-mcp --tail=50

# Restart deployment
kubectl rollout restart deployment/a2a-mcp-server -n a2a-mcp

# Scale up
kubectl scale deployment/a2a-mcp-server --replicas=5 -n a2a-mcp

# Check metrics
kubectl top pods -n a2a-mcp

# Port-forward for local access
kubectl port-forward -n a2a-mcp svc/a2a-mcp-metrics 3000:3000
```

---

**Last Updated:** 2025-01-23
**Maintained By:** DevOps Team
**Version:** 1.0
