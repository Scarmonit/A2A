# DevOps

This directory contains Docker production setups, cloud log analysis patterns, and database optimization strategies for reliable, observable systems.

## Contents
- Docker production setup
- Cloud log analysis
- Database optimization
- IaC patterns and runbooks

## Docker Production Setup

### Example: Dockerfile
```Dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM gcr.io/distroless/nodejs20-debian12
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
USER 10001
EXPOSE 8080
CMD ["dist/server.js"]
```

### Compose: docker-compose.prod.yml
```yaml
version: "3.9"
services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    image: myorg/app:latest
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    ports:
      - "80:8080"
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    healthcheck:
      test: ["CMD", "node", "dist/healthcheck.js"]
      interval: 30s
      timeout: 5s
      retries: 3
```

## Cloud Log Analysis

### Structured Logging
- Use JSON logs with fields: ts, level, msg, trace_id, span_id, user_id
- Include request_id in all inbound/outbound requests
- Redact PII at source

### Query Examples (Loki)
```logql
{app="web"} |= "ERROR" | json | line_format "{{.ts}} {{.msg}} {{.trace_id}}"
{app="web"} | json | unwrap duration(duration_ms) | avg_over_time(@duration[5m])
```

### Query Examples (CloudWatch Logs Insights)
```sql
fields @timestamp, @message
| filter level = "error"
| parse @message /trace=(?<trace_id>[^\s]+)/
| stats count() by trace_id
```

## Database Optimization

### Postgres Settings Checklist
- shared_buffers: 25% RAM
- work_mem sized for concurrent queries
- effective_cache_size: 50-75% RAM
- enable pg_stat_statements, auto_explain

### Operational Queries
```sql
-- Top queries by total time
SELECT query, total_exec_time, calls, (total_exec_time/calls) AS avg_time
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;

-- Index bloat estimate
SELECT schemaname, relname, round(100*(pg_relation_size(relid)-pg_indexes_size(relid))/pg_relation_size(relid),2) AS bloat_pct
FROM pg_stat_all_indexes ORDER BY bloat_pct DESC LIMIT 20;
```

## IaC Patterns
- Keep modules versioned and immutable
- Use remote state with locking
- Separate workspaces for envs (dev/stg/prod)
- Apply policy-as-code (OPA/Conftest)

## Runbooks
- Deployment rollback: tag previous image and redeploy
- DB migration failure: run down migration, enable maintenance mode, investigate
- Incident severity matrix and escalation path
