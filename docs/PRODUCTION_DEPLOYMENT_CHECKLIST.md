# Production Deployment Checklist

A comprehensive checklist for deploying A2A MCP Server to production environments.

---

## Pre-Deployment Checklist

### 1. Code Quality & Testing

- [ ] All tests passing (`npm test`)
- [ ] Integration tests passing (`npm run test:integration`)
- [ ] TypeScript compilation successful (`npm run build`)
- [ ] ESLint checks passing (no warnings or errors)
- [ ] Prettier formatting applied
- [ ] Security scan completed (`npm audit`)
- [ ] No TODO/FIXME in critical paths
- [ ] Code review completed and approved

### 2. Configuration

- [ ] Environment variables configured
  - [ ] `NODE_ENV=production`
  - [ ] `METRICS_PORT` set (default: 3000)
  - [ ] `STREAM_PORT` set (default: 8787)
  - [ ] `LOG_LEVEL` set (default: info)
  - [ ] `REDIS_HOST` and `REDIS_PORT` (if using Redis)
  - [ ] `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB` (if using PostgreSQL)
  - [ ] `OTEL_EXPORTER_OTLP_ENDPOINT` (if using OpenTelemetry)

- [ ] Database migrations completed
- [ ] Rate limiting configured
- [ ] Permission policies defined
- [ ] Workflow templates loaded

### 3. Infrastructure

- [ ] Kubernetes cluster provisioned
- [ ] Persistent volumes created (5Gi PVC)
- [ ] ConfigMaps and Secrets created
- [ ] Namespaces configured (`a2a-mcp`)
- [ ] Resource limits set (CPU: 500m, Memory: 512Mi)
- [ ] HPA configured (2-10 replicas)
- [ ] LoadBalancer service configured

### 4. Monitoring & Observability

- [ ] Prometheus ServiceMonitor deployed
- [ ] Grafana dashboards imported
- [ ] Alert rules configured
- [ ] Log aggregation configured (ELK/Loki)
- [ ] Distributed tracing enabled (Jaeger/Zipkin)
- [ ] Health check endpoints verified
  - [ ] `/healthz` responding
  - [ ] `/metrics` exposing Prometheus metrics
  - [ ] `/api/agent?action=status` returning agent stats

### 5. Security

- [ ] TLS/SSL certificates installed
- [ ] API keys/tokens generated and secured
- [ ] Network policies applied
- [ ] RBAC policies configured
- [ ] Secret management configured (Vault/AWS Secrets Manager)
- [ ] Rate limiting enabled
- [ ] DDoS protection configured
- [ ] Security headers configured

### 6. Backup & Recovery

- [ ] Database backup strategy configured
- [ ] Backup retention policy set (default: 30 days)
- [ ] Recovery procedures documented
- [ ] Disaster recovery plan reviewed
- [ ] Backup testing completed

---

## Deployment Steps

### Step 1: Build and Push Docker Image

```bash
# Build Docker image
docker build -t scarmonit/a2a-mcp:v0.1.0 .

# Tag for registry
docker tag scarmonit/a2a-mcp:v0.1.0 your-registry.com/a2a-mcp:v0.1.0

# Push to registry
docker push your-registry.com/a2a-mcp:v0.1.0
```

**Checklist:**
- [ ] Image built successfully
- [ ] Image scanned for vulnerabilities
- [ ] Image pushed to registry
- [ ] Image tagged with version

### Step 2: Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace a2a-mcp

# Apply ConfigMap
kubectl apply -f k8s/deployment.yaml

# Verify deployment
kubectl get pods -n a2a-mcp
kubectl get svc -n a2a-mcp
```

**Checklist:**
- [ ] Namespace created
- [ ] Deployment successful
- [ ] Pods running (2+ replicas)
- [ ] Services exposed
- [ ] LoadBalancer IP assigned

### Step 3: Initialize Database

```bash
# Connect to database
psql -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB

# Run migrations
npm run migrate
```

**Checklist:**
- [ ] Database schema created
- [ ] Migrations applied
- [ ] Indexes created
- [ ] Initial data loaded

### Step 4: Verify Health

```bash
# Check pod health
kubectl get pods -n a2a-mcp

# Check logs
kubectl logs -n a2a-mcp deployment/a2a-mcp-server

# Test health endpoint
curl http://<loadbalancer-ip>:3000/healthz

# Test metrics endpoint
curl http://<loadbalancer-ip>:3000/metrics

# Test WebSocket
wscat -c ws://<loadbalancer-ip>:8787
```

**Checklist:**
- [ ] All pods healthy
- [ ] No error logs
- [ ] Health endpoint returns `{"ok":true}`
- [ ] Metrics endpoint returns data
- [ ] WebSocket connection successful

### Step 5: Enable Monitoring

```bash
# Import Grafana dashboard
kubectl apply -f monitoring/grafana-dashboard.json

# Verify Prometheus scraping
curl http://prometheus:9090/api/v1/targets
```

**Checklist:**
- [ ] Prometheus scraping metrics
- [ ] Grafana dashboard loaded
- [ ] Alerts configured
- [ ] Log aggregation working

### Step 6: Load Testing

```bash
# Run load tests
npm run test:integration:load

# Monitor performance
kubectl top pods -n a2a-mcp
```

**Checklist:**
- [ ] Load tests passing
- [ ] Response times < 6s avg (100 clients)
- [ ] Memory usage stable
- [ ] CPU usage < 70%
- [ ] No connection errors

---

## Post-Deployment Checklist

### Immediate (0-24 hours)

- [ ] Monitor error rates (should be < 1%)
- [ ] Monitor response times (P95 < 8s)
- [ ] Check for memory leaks
- [ ] Verify auto-scaling working
- [ ] Test failover scenarios
- [ ] Verify backup jobs running
- [ ] Review security logs

### Short-term (1-7 days)

- [ ] Performance baselines established
- [ ] Alert thresholds tuned
- [ ] On-call rotation established
- [ ] Runbook updated
- [ ] Incident response tested
- [ ] User feedback collected

### Long-term (7+ days)

- [ ] Capacity planning reviewed
- [ ] Cost optimization implemented
- [ ] Performance optimizations applied
- [ ] Feature flags reviewed
- [ ] Compliance audit completed

---

## Rollback Plan

### Quick Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/a2a-mcp-server -n a2a-mcp

# Verify rollback
kubectl rollout status deployment/a2a-mcp-server -n a2a-mcp
```

**Checklist:**
- [ ] Previous version identified
- [ ] Rollback command tested
- [ ] Rollback time < 5 minutes
- [ ] Data consistency verified

### Database Rollback

```bash
# Restore database from backup
pg_restore -h $POSTGRES_HOST -U $POSTGRES_USER -d $POSTGRES_DB backup.dump
```

**Checklist:**
- [ ] Backup identified
- [ ] Restore procedure documented
- [ ] Data integrity verified

---

## Monitoring Metrics

### Key Performance Indicators (KPIs)

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Uptime | 99.9% | < 99.5% |
| Error Rate | < 1% | > 2% |
| Response Time (P95) | < 8s | > 10s |
| Memory Usage | < 80% | > 90% |
| CPU Usage | < 70% | > 85% |
| WebSocket Connections | Stable | Dropping |
| Agent Invocations/sec | Increasing | Dropping |
| Health Check Success | 100% | < 98% |

### Alert Rules

1. **High Error Rate**: > 2% errors in 5 minutes
2. **Slow Response**: P95 latency > 10s for 5 minutes
3. **Memory Pressure**: Memory usage > 90% for 10 minutes
4. **Pod Crashes**: Any pod restart in production
5. **Database Connection**: Database connection failures
6. **Rate Limit Exceeded**: > 100 rate limit hits/minute

---

## Emergency Contacts

| Role | Contact | Escalation |
|------|---------|-----------|
| On-Call Engineer | [Name/Phone] | 15 minutes |
| Team Lead | [Name/Phone] | 30 minutes |
| DevOps Lead | [Name/Phone] | 1 hour |
| CTO | [Name/Phone] | 2 hours |

---

## Runbook Links

- [Incident Response Runbook](./INCIDENT_RESPONSE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
- [Performance Tuning](./PERFORMANCE_TUNING.md)
- [Scaling Guide](./SCALING_GUIDE.md)

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Developer | | | |
| QA Lead | | | |
| DevOps Lead | | | |
| Security Lead | | | |
| Manager | | | |

---

**Deployment Date:** _________________
**Deployed By:** _________________
**Version:** _________________
**Environment:** _________________

---

## Notes

Use this section for deployment-specific notes, issues encountered, or special configurations applied.

_______________________________________________________
_______________________________________________________
_______________________________________________________
