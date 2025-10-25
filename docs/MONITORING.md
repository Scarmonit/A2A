# A2A MCP System Monitoring Guide

Complete guide for setting up and using the Prometheus + Grafana monitoring stack for the A2A MCP server.

## 📋 Overview

The A2A MCP system includes a comprehensive observability stack:

- **Prometheus** - Metrics collection and storage
- **Grafana** - Visualization dashboards
- **Node Exporter** - System-level metrics
- **Alert Manager** - Alert routing and management

## 🚀 Quick Start

### Starting the Monitoring Stack

```bash
# Start all services including monitoring
docker-compose up -d

# Verify all services are running
docker-compose ps

# View logs
docker-compose logs -f
```

### Accessing the Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3001 | admin / admin |
| **Prometheus** | http://localhost:9090 | None |
| **Alert Manager** | http://localhost:9093 | None |
| **A2A Metrics** | http://localhost:3000/metrics | None |
| **Node Exporter** | http://localhost:9100/metrics | None |

## 📊 Grafana Dashboard

### Accessing the Dashboard

1. Open http://localhost:3001 in your browser
2. Login with username `admin` and password `admin`
3. The **A2A MCP System Overview** dashboard is automatically provisioned
4. Navigate to **Dashboards → Browse** to find it

### Dashboard Panels

The main dashboard includes:

#### Row 1: Overview Metrics
- **Total Agents** - Current number of registered agents
- **Active Agents** - Number of agents currently processing tasks
- **Requests/sec** - Real-time request rate
- **Error Rate %** - Percentage of failed requests

#### Row 2: Performance
- **MCP Call Latency** - P50, P95, and P99 latency percentiles
- **Memory Usage** - Process memory consumption in MB
- **CPU Usage** - CPU utilization percentage

#### Row 3: MCP Server Details
- **Calls by Server** - Request distribution across MCP servers
- **Success vs Errors** - Pie chart of successful vs failed requests
- **Success Rate by Method** - Table showing success rates per method

#### Row 4: System Health
- **WebSocket Connections** - Number of active WebSocket connections
- **Event Queue Size** - Current size of the event queue
- **Uptime** - Server uptime duration

## 🔍 Prometheus Queries

### Useful PromQL Queries

#### Request Metrics
```promql
# Total request rate
rate(mcp_server_calls_total[5m])

# Error rate
rate(mcp_server_calls_total{status="error"}[5m])

# Success rate percentage
(rate(mcp_server_calls_total{status="success"}[5m]) / rate(mcp_server_calls_total[5m])) * 100
```

#### Latency Metrics
```promql
# P95 latency
histogram_quantile(0.95, rate(mcp_server_call_duration_seconds_bucket[5m]))

# P99 latency
histogram_quantile(0.99, rate(mcp_server_call_duration_seconds_bucket[5m]))
```

#### Agent Metrics
```promql
# Total agents
a2a_agents_total

# Active agents
a2a_active_agents

# Agent changes over time
changes(a2a_agents_total[5m])
```

#### System Metrics
```promql
# Memory usage in MB
process_resident_memory_bytes / 1024 / 1024

# CPU usage percentage
rate(process_cpu_seconds_total[1m]) * 100

# Uptime
time() - process_start_time_seconds
```

## 🚨 Alerting

### Configured Alerts

The system includes the following pre-configured alerts:

#### 1. High MCP Error Rate
- **Condition**: Error rate > 10% for 5 minutes
- **Severity**: Warning
- **Action**: Check logs and investigate error patterns

#### 2. High MCP Latency
- **Condition**: P95 latency > 1 second for 5 minutes
- **Severity**: Warning
- **Action**: Review performance metrics and consider scaling

#### 3. Agent Disconnected
- **Condition**: More than 5 agents disconnected in 5 minutes
- **Severity**: Critical
- **Action**: Check network connectivity and agent health

#### 4. High Memory Usage
- **Condition**: Memory usage > 500MB for 10 minutes
- **Severity**: Warning
- **Action**: Review memory leaks and consider increasing resources

### Viewing Active Alerts

```bash
# Check alerts via API
curl http://localhost:9090/api/v1/alerts

# Check alert manager
curl http://localhost:9093/api/v2/alerts
```

### Configuring Alert Notifications

Edit `alertmanager.yml` to add notification channels:

```yaml
receivers:
  - name: 'email-alerts'
    email_configs:
      - to: 'team@example.com'
        from: 'alerts@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alerts@example.com'
        auth_password: 'password'

  - name: 'slack-alerts'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#alerts'
        title: 'A2A MCP Alert'
```

## 🧪 Testing

### Verify Prometheus Targets

```bash
# Check target health
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {job: .labels.job, health: .health}'

# Expected output:
# {
#   "job": "a2a-mcp-server",
#   "health": "up"
# }
# {
#   "job": "prometheus",
#   "health": "up"
# }
# {
#   "job": "node-exporter",
#   "health": "up"
# }
```

### Verify Grafana Health

```bash
# Check Grafana API
curl -u admin:admin http://localhost:3001/api/health

# Expected output:
# {
#   "database": "ok",
#   "version": "..."
# }
```

### Generate Test Load

You can use the existing test files to generate load:

```bash
# Simple agent test
node simple-agent-test.js

# Load test with hundreds of agents
node test-hundreds-agents.js

# Real agent ecosystem test
node test-agent-ecosystem.js
```

### Verify Metrics Collection

```bash
# Query metrics directly from A2A server
curl http://localhost:3000/metrics

# Query specific metric from Prometheus
curl 'http://localhost:9090/api/v1/query?query=a2a_agents_total'

# Verify alerts are evaluating
curl 'http://localhost:9090/api/v1/alerts'
```

## 🔧 Configuration

### Customizing Scrape Intervals

Edit `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s      # How often to scrape targets
  evaluation_interval: 15s   # How often to evaluate rules
```

### Adding Custom Metrics

In your code, use the analytics engine:

```typescript
import { AnalyticsEngine } from './analytics-engine.js';

const analytics = AnalyticsEngine.getInstance();

// Define a custom metric
analytics.defineMetric({
  name: 'my_custom_metric',
  help: 'Description of the metric',
  type: 'counter',
  labels: ['label1', 'label2']
});

// Update the metric
analytics.incrementCounter('my_custom_metric', { label1: 'value1' });
```

### Creating Custom Dashboards

1. Login to Grafana (http://localhost:3001)
2. Click **+ → Dashboard**
3. Add panels with your desired queries
4. Save the dashboard
5. Export as JSON and place in `grafana/dashboards/`

## 📈 Recording Rules

The system includes pre-configured recording rules for performance:

```yaml
# 5-minute request rate
a2a:mcp_requests:rate5m

# 5-minute error rate
a2a:mcp_errors:rate5m

# Success rate percentage
a2a:mcp_success_rate:percentage
```

Use these in your queries for faster dashboard performance:

```promql
# Instead of: rate(mcp_server_calls_total[5m])
# Use: a2a:mcp_requests:rate5m
```

## 🛠️ Troubleshooting

### Prometheus Not Scraping Metrics

```bash
# Check if A2A metrics endpoint is accessible
curl http://localhost:3000/metrics

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# View Prometheus logs
docker-compose logs prometheus
```

### Grafana Dashboard Not Loading

```bash
# Check Grafana logs
docker-compose logs grafana

# Verify datasource configuration
curl -u admin:admin http://localhost:3001/api/datasources

# Verify dashboard provisioning
docker exec a2a-grafana ls -la /etc/grafana/dashboards
```

### Alerts Not Firing

```bash
# Check alert rules are loaded
curl http://localhost:9090/api/v1/rules

# Check alert evaluation
curl http://localhost:9090/api/v1/alerts

# View Alert Manager logs
docker-compose logs alertmanager
```

### High Memory Usage

```bash
# Check Prometheus retention settings
docker-compose logs prometheus | grep retention

# Reduce retention in prometheus.yml:
--storage.tsdb.retention.time=15d
--storage.tsdb.retention.size=10GB
```

## 🔒 Security Considerations

### Production Deployment

For production deployments:

1. **Change Default Passwords**
   ```yaml
   environment:
     - GF_SECURITY_ADMIN_PASSWORD=your-secure-password
   ```

2. **Enable TLS**
   - Configure reverse proxy (nginx/traefik) with SSL
   - Use Let's Encrypt certificates

3. **Restrict Access**
   - Use firewall rules to limit access
   - Configure authentication for Prometheus/Alert Manager

4. **Secure Secrets**
   - Use Docker secrets or environment variables
   - Never commit passwords to git

## 📊 Performance Tuning

### Optimizing Prometheus

```yaml
# In prometheus.yml
global:
  scrape_interval: 30s     # Increase for lower load
  scrape_timeout: 10s      # Timeout for scrapes
  
# Limit scrape sample size
scrape_configs:
  - job_name: 'a2a-mcp-server'
    sample_limit: 10000
```

### Optimizing Grafana

```yaml
# In docker-compose.yml
environment:
  - GF_DATABASE_WAL=true
  - GF_LOG_LEVEL=warn
  - GF_USERS_DEFAULT_THEME=light
```

## 📚 Additional Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [PromQL Cheat Sheet](https://promlabs.com/promql-cheat-sheet/)
- [Alert Manager Configuration](https://prometheus.io/docs/alerting/latest/configuration/)

## 🎯 Success Metrics

After deployment, you should achieve:

- ✅ Prometheus successfully scraping metrics every 15s
- ✅ Grafana dashboard showing real-time data within 30s
- ✅ All alert rules evaluating correctly
- ✅ Zero data loss over 24-hour period
- ✅ Dashboard load time < 2 seconds

## 🆘 Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review Docker logs: `docker-compose logs`
- Open an issue on GitHub
