# Parallel Execution Guide for A2A

This guide explains how to enable parallelized MCP task runners, GitHub Actions job matrices, and shell batching for A2A multi-agent workflows. It includes examples for SwarmTask-style orchestration, Job Matrix strategies, and MCP Batchit.

## Contents
- GitHub Actions: parallel job matrix and strategy examples
- A2A multi-agent patterns (greenlet pools, fan-out/fan-in)
- MCP shell command batching and chunking
- Examples and scripts paths

## GitHub Actions Parallel Strategies

1) Matrix fan-out by target vector
- File: .github/workflows/parallel-matrix.yml
- Strategy: matrix include defines independent parallel jobs (envs, models, tools)
- Pattern: fan-out -> parallel steps -> fan-in via an artifact or summary

Example:
```yaml
name: Parallel Matrix
on: [workflow_dispatch]
jobs:
  run-matrix:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        task: [lint, unit, e2e]
        node: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - run: npm ci
      - run: npm run ${{ matrix.task }}
```

2) Dynamic matrix from JSON
- File: .github/workflows/dynamic-matrix.yml
- Pattern: build matrix at runtime, echo to GITHUB_OUTPUT, then run

Example:
```yaml
name: Dynamic Matrix
on: [workflow_dispatch]
jobs:
  build-matrix:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.mk.outputs.matrix }}
    steps:
      - uses: actions/checkout@v4
      - id: mk
        run: |
          MATRIX=$(node -e 'console.log(JSON.stringify({include:[{task:"lint"},{task:"unit"},{task:"e2e"}]}))')
          echo "matrix=$MATRIX" >> "$GITHUB_OUTPUT"
  run:
    needs: build-matrix
    runs-on: ubuntu-latest
    strategy:
      matrix: ${{ fromJson(needs.build-matrix.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - run: echo "Running ${{ matrix.task }}"
```

3) Job fan-in with artifacts
- File: .github/workflows/fan-in.yml
- Pattern: each matrix job uploads artifact, an aggregator job downloads all and summarizes

Example:
```yaml
name: Fan In
on: [workflow_dispatch]
jobs:
  worker:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [0,1,2,3]
    steps:
      - uses: actions/checkout@v4
      - run: node scripts/shard.js ${{ matrix.shard }} > shard-${{ matrix.shard }}.json
      - uses: actions/upload-artifact@v4
        with:
          name: shard-${{ matrix.shard }}
          path: shard-${{ matrix.shard }}.json
  aggregate:
    needs: worker
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
        with: { path: artifacts }
      - run: node scripts/aggregate.js artifacts > summary.json
      - uses: actions/upload-artifact@v4
        with: { name: summary, path: summary.json }
```

## A2A Multi-Agent Parallel Patterns

- SwarmTask style fan-out: one coordinator splits tasks into shards and schedules in parallel via MCP clients or greenlet pool
- Greenlet pool: see examples/greenlet-pool-example.ts (pool of workers, task queue)
- Bridge fan-out: see examples/greenlet-bridge-example.ts for pipelining
- Hundreds of agents test: test-hundreds-agents.js demonstrates high concurrency

Coordinator snippet (TypeScript):
```ts
import { GreenletPool } from './src/greenletPool';
const pool = new GreenletPool({ size: Number(process.env.WORKERS||4) });
const tasks = JSON.parse(process.env.TASKS_JSON||'[]');
const results = await pool.map(tasks, async (t)=> runMcpJob(t));
console.log(JSON.stringify(results));
```

## MCP Shell Command Batching (Batchit)

- Batch shell commands to reduce startup overhead and increase throughput
- File: scripts/mcp-batchit.sh
- Usage: scripts/mcp-batchit.sh cmds.txt 8

Example script:
```bash
#!/usr/bin/env bash
set -euo pipefail
CMDS_FILE=${1:-cmds.txt}
PAR=${2:-4}
sem() { while (( $(jobs -r | wc -l) >= PAR )); do wait -n; done; }
while IFS= read -r cmd; do
  [[ -z "$cmd" || "$cmd" =~ ^# ]] && continue
  bash -lc "$cmd" &
  sem
done < "$CMDS_FILE"
wait
```

## Customization Notes
- Choose matrix dimensions to reflect env/model/tool variants
- Use needs: to create fan-in aggregators
- Set strategy.max-parallel to limit concurrency in hosted runners
- Use artifacts for passing data between parallel jobs
- Chunk large input into shards and distribute via matrix
- Prefer greenlet pools for in-process parallelism; use MCP sockets for distributed agents

## File Map to Add
- docs/PARALLEL_EXECUTION_GUIDE.md (this guide)
- .github/workflows/parallel-matrix.yml
- .github/workflows/dynamic-matrix.yml
- .github/workflows/fan-in.yml
- scripts/mcp-batchit.sh
- scripts/mcp-batchit-example.txt
- examples/parallel-coordinator.ts

## README Additions Summary
- Add section "Parallel Execution & Job Matrix" linking to this guide
- Summarize A2A multi-agent patterns and MCP batching
