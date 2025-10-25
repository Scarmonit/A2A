# Warp University: A2A Integration Guide

This guide documents the complete integration of Warp workflows with the A2A project. It covers end-to-end patterns you can copy-paste to automate and operate agents locally and in production.

## 1) Agent automation workflows

Warp workflow: a2a/agents.run
```yaml
name: Run A2A Agents
command: |
  pnpm install --frozen-lockfile
  pnpm build
  pnpm tsx examples/zero-click/launch.ts --env .env 
  # or run test agent swarm
  node tests/test-hundreds-agents.js --concurrency 64 --duration 10m
files:
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - examples/**
  - tests/**
```
Usage in Warp:
- Open Workflows tab → search "Run A2A Agents" → Run.
- Or CLI: `warp workflows run "Run A2A Agents"`.

With A2A codebase (programmatic):
```bash
pnpm tsx src/agents/launcher.ts --profile production --parallel 8
```

## 2) MCP server configurations

Warp workflow: a2a/mcp.dev
```yaml
name: Dev MCP Server
command: |
  pnpm install
  pnpm tsx src/mcp/server.ts --transport sse --port 3333 --log-level debug \
    --config mcp.config.json
env:
  A2A_ENV: dev
files:
  - src/mcp/**
  - mcp.config.json
```
Code example to connect from A2A client:
```ts
import { createSseClient } from "./src/mcp/client/sse";
const client = await createSseClient({ url: "http://localhost:3333/sse" });
await client.ping();
```

Prod profile:
```yaml
name: Prod MCP Server
command: |
  node dist/mcp/server.js --transport sse --port $PORT --config mcp.config.json
env:
  NODE_ENV: production
```

## 3) Production-ready Docker setups

Warp workflow: a2a/docker.compose.up
```yaml
name: A2A Docker Compose Up
command: |
  docker compose -f docker-compose.yml --project-name a2a up -d --build
```
Single image build + run (Railway/Render compatible):
```yaml
name: Build & Run A2A
command: |
  docker build -t a2a:latest .
  docker run -d --name a2a \
    -p 3000:3000 \
    --env-file .env \
    a2a:latest
```
Kubernetes (k8s/) with Warp variables:
```yaml
name: Deploy A2A to K8s
command: |
  kubectl apply -f k8s/deployment.yaml
  kubectl rollout status deploy/a2a-server -n ${NAMESPACE:=default}
```

## 4) Security test generation

Warp workflow: a2a/security.scan
```yaml
name: Security Scan
command: |
  pnpm dlx snyk test || true
  pnpm dlx @microsoft/security-devops azd || true
  pnpm dlx eslint . --max-warnings=0
  pnpm dlx @codeql/cli analyze --format=sarif -o reports/codeql.sarif || true
files:
  - package.json
  - src/**
  - .github/workflows/security.yml
```
Generate fuzz tests for endpoints (example):
```bash
pnpm tsx tests/security/generate-fuzz.ts --target http://localhost:3000/api --out tests/security/fuzz
```

## 5) Database optimization matrices

Warp workflow: a2a/db.optimize
```yaml
name: Prisma Optimization Matrix
command: |
  pnpm prisma generate
  pnpm tsx scripts/bench/run-db-matrix.ts --models User,Event,Job \
    --strategies indexed,composite,cascading \
    --concurrency 8 --samples 1000 --report reports/db-matrix.json
files:
  - prisma/**
  - scripts/bench/**
```
Example matrix consumer:
```ts
import fs from 'node:fs';
const matrix = JSON.parse(fs.readFileSync('reports/db-matrix.json','utf8'));
console.table(matrix.topStrategies);
```

## 6) Parallel agent execution patterns

Warp workflow: a2a/agents.parallel
```yaml
name: Parallel Agent Swarm
command: |
  pnpm tsx src/agents/swarm.ts --agents 128 --mode sse --rate-limit window:100/1s \
    --backpressure fifo --fanout 8 --retry 3
```
Code pattern inside A2A:
```ts
import pLimit from 'p-limit';
import { runAgent } from '../src/agents/runner';
const limit = pLimit(8);
const tasks = inputs.map(input => limit(() => runAgent(input)));
await Promise.allSettled(tasks);
```

---

Tips
- Use Warp Variables for PORT, NAMESPACE, and profiles.
- Pin Node version with .tool-versions or Volta to match CI.
- Align Warp workflows with .github/workflows to mirror production.
