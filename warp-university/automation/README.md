# Automation

This directory contains parallel execution scripts, monorepo synchronization rules, and CI/CD automation patterns for scaling engineering workflows.

## Contents

- Parallel execution scripts
- Monorepo sync rules
- CI/CD pipeline templates
- Scheduler and orchestration patterns

## Parallel Execution Scripts

### Shell Utility: parallel-run.sh

```bash
#!/usr/bin/env bash
set -euo pipefail

# parallel-run.sh: Run multiple commands in parallel and collect exit codes
# Usage: parallel-run.sh "cmd1" "cmd2" "cmd3"

pids=()
log_dir=${PARALLEL_LOG_DIR:-".parallel_logs"}
mkdir -p "$log_dir"

run_cmd() {
  local idx=$1
  local cmd=$2
  echo "[parallel:$idx] starting: $cmd"
  bash -lc "$cmd" &> "$log_dir/$idx.log" &
  pids[$idx]=$!
}

idx=0
for cmd in "$@"; do
  run_cmd $idx "$cmd"
  ((idx++))
done

status=0
for i in "${!pids[@]}"; do
  pid=${pids[$i]}
  if wait "$pid"; then
    echo "[parallel:$i] success"
  else
    echo "[parallel:$i] failed (see $log_dir/$i.log)"
    status=1
  fi
done

exit $status
```

### Node.js Utility: parallel-tasks.mjs

```js
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
const pexec = promisify(exec);

async function run(cmd) {
  try {
    const { stdout, stderr } = await pexec(cmd);
    if (stderr) process.stderr.write(stderr);
    process.stdout.write(stdout);
    return { cmd, ok: true };
  } catch (e) {
    process.stderr.write(e.stderr || e.message);
    return { cmd, ok: false };
  }
}

export async function parallel(tasks, concurrency = 4) {
  const queue = [...tasks];
  const running = new Set();
  const results = [];

  async function next() {
    if (queue.length === 0) return;
    const cmd = queue.shift();
    const p = run(cmd)
      .then((r) => results.push(r))
      .finally(() => running.delete(p));
    running.add(p);
    if (running.size < concurrency) return next();
  }

  await Promise.all(new Array(Math.min(concurrency, tasks.length)).fill(0).map(next));
  await Promise.all([...running]);
  return results;
}

if (require.main === module) {
  const tasks = process.argv.slice(2);
  parallel(tasks, Number(process.env.CONCURRENCY || 4)).then((rs) => {
    const failed = rs.filter((r) => !r.ok);
    process.exit(failed.length ? 1 : 0);
  });
}
```

## Monorepo Sync Rules

### Example: sync-rules.yaml

```yaml
rules:
  - name: "Keep shared configs in sync"
    sources:
      - path: packages/config/.eslintrc.cjs
      - path: packages/config/tsconfig.base.json
    targets:
      - match: "packages/*/.eslintrc.cjs"
      - match: "packages/*/tsconfig.json"
    strategy: "overwrite"
    review: true

  - name: "Propagate CI templates"
    sources:
      - path: .github/workflows/ci.yml
    targets:
      - match: "packages/*/.github/workflows/ci.yml"
    strategy: "merge"
    merge:
      array_strategy: "append_unique"
      key_order: "preserve"
```

### Sync Runner: sync.mjs

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import { load } from 'js-yaml';

async function read(p) { return fs.readFile(p, 'utf8'); }
async function write(p, c) { await fs.mkdir(path.dirname(p), { recursive: true }); return fs.writeFile(p, c); }

async function main() {
  const rules = load(await read('automation/sync-rules.yaml'));
  for (const rule of rules.rules) {
    for (const src of rule.sources) {
      const content = await read(src.path);
      for (const tgt of rule.targets) {
        // naive example applying overwrite strategy
        const targetPaths = [tgt.match.replace('*', 'app1'), tgt.match.replace('*', 'app2')];
        for (const t of targetPaths) {
          await write(t, content);
          console.log(`[sync] ${src.path} -> ${t}`);
        }
      }
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
```

## CI/CD Templates

- GitHub Actions: .github/workflows/parallel-ci.yml
- Example stages: lint, test, build, e2e, deploy
- Use matrix and concurrency groups for efficient utilization

```yaml
name: Parallel CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - run: npm ci
      - run: npm run lint & npm test & wait
  e2e:
    runs-on: ubuntu-latest
    needs: build
    steps:
      - uses: actions/checkout@v4
      - run: echo "Run Playwright here"
```

## Orchestration Patterns

- Use GNU parallel or xargs -P for shell-level concurrency
- Use job queues (e.g., Redis, SQS) for distributed parallelism
- Apply idempotency and retries with exponential backoff
- Capture logs and artifacts per task
- Use circuit breakers for external dependencies

## Best Practices

1. Keep parallel job output isolated per task
2. Set reasonable concurrency to avoid resource contention
3. Use timeouts and health checks
4. Tag and trace tasks for observability
5. Dry-run before large scale syncs
