# AUTONOMOUS BROWSER EXECUTION

This document specifies a comprehensive, production-grade architecture for fully autonomous browser control with parallel execution, optimization techniques, API usage, and integration patterns designed for zero‑click automation within the A2A repository.

## 1. Goals and Non‑Goals
- Goals:
  - Zero‑click, end‑to‑end autonomous execution of browser tasks
  - Robust parallelization across tasks, tabs, and page elements
  - Deterministic workflows with recoverability, safety, and observability
  - Extensible API surface for orchestration and integrations
- Non‑Goals:
  - Replacing human review for irreversible actions without policy gates
  - Bypassing site authentication or terms of service

## 2. System Overview
An agentic controller orchestrates browser drivers via an execution engine. The engine manages:
- Perceptual loop (DOM/visual state capture)
- Planner (task decomposition, policy guardrails)
- Executor (actions, retries, backoff, waits)
- Parallelizer (task graph, work stealing)
- Memory (short‑term page state, long‑term cache)
- Observability (tracing, metrics, logs, replays)

## 3. Core Components
- Controller: High-level goal intake, policy enforcement, multi-run coordination.
- Planner: Converts goals to a DAG of steps with pre/post-conditions.
- Action Library: Click, type, select, upload, drag, evaluate JS, download, scroll, wait, etc.
- Perception: DOM snapshot, accessibility tree, vision OCR, layout metrics, mutation observers.
- Synchronization: Explicit waits (selectors, network idle), implicit heuristics, deadlines.
- Error Handling: Circuit breakers, bounded retries, state diffs, fallback strategies.
- Sandbox: Domain-isolated contexts, cookie jars, feature flags, test mode.

## 4. Execution Model
- Tasks compile into a TaskGraph (DAG) with node types: UIAction, APICall, Compute, IO.
- Ready nodes execute in parallel up to resource limits (concurrency tokens).
- Each node defines:
  - Inputs, outputs, side effects, idempotency, rollback/compensate handler.
  - Timeouts, retry policy (exponential backoff + jitter), and observability spans.
- Determinism:
  - Use selector stability ranking, attribute pinning, and content hashing.
  - Record state before/after images to enable replay and differential debugging.

## 5. Parallel Execution Strategies
- Intra-page:
  - Parallel DOM queries and prefetching of required nodes.
  - Concurrent file uploads/downloads using streams.
  - Overlap waits with computation (e.g., parse results while network idles).
- Inter-tab:
  - Spawn tabs per subgoal; propagate cookies selectively; use service worker cache.
  - Use shared throttled network pools to avoid server rate limits.
- Inter-task:
  - Queue with priorities; work-stealing between agents; enforce per-domain caps.
- Dataflow parallelism:
  - Map/Reduce style over lists (e.g., scrape multiple result pages concurrently), then reduce.

## 6. Selector Strategy and Robustness
- Primary: data-testid, role, name, accessible name, aria attributes.
- Secondary: text with semantic normalization (whitespace, case, locale).
- Tertiary: CSS/XPath with structural anchors and sibling relationships.
- Anti-flakiness:
  - Avoid ephemeral IDs; ignore nodes beginning with underscores.
  - Wait for interactable states (visible, enabled, stable bounding box).
  - Use scroll-into-view with retry on stale element references.

## 7. Synchronization and Waits
- Explicit waits:
  - Selector present/visible, network idle, specific XHR completion, WebSocket settle.
- Adaptive waits:
  - Page phase detection (LCP/CLS stabilization, mutation rate threshold).
  - Backoff tuned per site profile.
- Deadlines and Escalation:
  - Node-level and task-level deadlines; escalate to alternative paths on expiration.

## 8. Error Handling and Recovery
- Categories: Transient (timeouts), Recoverable (stale nodes), Irrecoverable (auth required).
- Playbooks:
  - Refresh section; clear overlays/popups; re-run with alternative selectors.
  - Backtrack via breadcrumbs; clear filters; paginate.
  - On auth walls: stop, surface sign-in URL, and do not proceed.
- Snapshot + Replay: Store DOM, screenshots, HAR for postmortem and deterministic tests.

## 9. API Surface
- Browser API (pseudo‑TS):
  ```ts
  interface ActionOptions { timeoutMs?: number; retries?: number; jitter?: boolean; }
  interface ClickOpts extends ActionOptions { scroll?: boolean; }
  interface TypeOpts extends ActionOptions { replace?: boolean; delayMs?: number; }
  interface SelectOpts extends ActionOptions {}
  interface UploadOpts extends ActionOptions { name: string; url: string; }

  class Browser {
    click(node: string, opts?: ClickOpts): Promise<void>;
    type(node: string, value: string, opts?: TypeOpts): Promise<void>;
    select(node: string, opts?: SelectOpts): Promise<void>;
    upload(node: string, file: UploadOpts): Promise<void>;
    waitFor(selector: string, cond: 'present'|'visible'|'stable', ms: number): Promise<void>;
    evaluate<T>(fn: () => T): Promise<T>;
    scroll(dir: 'up'|'down'): Promise<void>;
    download(node: string): Promise<Blob>;
  }
  ```
- Orchestrator API:
  ```ts
  type NodeType = 'UIAction'|'APICall'|'Compute'|'IO';
  interface TaskNode<I,O> { id: string; type: NodeType; run(input: I): Promise<O>; deps: string[]; timeoutMs?: number; retries?: number; compensate?(o: O): Promise<void>; }
  interface TaskGraph { nodes: TaskNode<any,any>[]; }
  runTaskGraph(graph: TaskGraph, opts?: { concurrency?: number }): Promise<Record<string,unknown>>
  ```

## 10. Parallel Orchestration Example
```ts
const graph: TaskGraph = {
  nodes: [
    { id: 'open', type: 'UIAction', deps: [], run: async () => openUrl('https://example.com') },
    { id: 'search', type: 'UIAction', deps: ['open'], run: async () => type('#q','laptop') },
    { id: 'submit', type: 'UIAction', deps: ['search'], run: async () => click('#submit') },
    { id: 'wait', type: 'Compute', deps: ['submit'], run: async () => waitForResults() },
    // Fan-out product detail fetches in parallel
    ...Array.from({length: 10}).map((_,i) => ({
      id: `detail_${i}`, type: 'UIAction', deps: ['wait'], run: async () => openInNewTab(productLink(i)) }) ),
    { id: 'aggregate', type: 'Compute', deps: ['wait', ...Array.from({length:10},(_,i)=>`detail_${i}`)], run: aggregateResults },
  ]
}
await runTaskGraph(graph, { concurrency: 5 });
```

## 11. Zero‑Click Automation Best Practices
- Pre-approve domains and action classes with policy tokens.
- Require confirm gates for irreversible operations unless running in sandbox.
- Use dry‑run to validate selectors and side effects before live run.
- Cache site-specific selector profiles; keep heuristics per domain.
- Log every action with trace IDs; redact sensitive fields.

## 12. Optimization Techniques
- Selector caching and DOM diffing to avoid redundant queries.
- Network:
  - HTTP/2 multiplexing, keep‑alive pools, concurrency windows.
  - Respect robots/ratelimits; exponential backoff with jitter.
- Rendering:
  - Throttle reflows; batch mutations; prefer requestIdleCallback for low-priority work.
- Data processing:
  - Stream parse large pages; compress snapshots; incremental checkpoints.

## 13. Integration Patterns
- Ingestion:
  - Read seeds from queues (SQS/Kafka), schedules (CRON), or webhooks.
- Outputs:
  - Emit to S3/GCS, databases, or callbacks.
- Extensibility:
  - Plugin hooks: beforeAction, afterAction, onError, onSnapshot.
  - Site adapters provide tailored selectors and flows.

## 14. Security and Compliance
- Never execute untrusted scripts; sanitize evaluated code.
- Content Security: strict CSP in automation frames.
- Secrets management: OS keychain or KMS; rotate tokens; least privilege.
- PII handling: mask in logs, encrypt at rest, purpose limitation.

## 15. Example: File Upload and Download in Parallel
```ts
await Promise.all([
  browser.upload('input[type=file]', { name: 'doc.pdf', url: uploadUrl }),
  browser.click('button#submit')
]);
await browser.waitFor('#result','visible',15000);
const file = await browser.download('a#export');
```

## 16. Workflow Diagram (ASCII)
```
Goal -> Planner -> TaskGraph -> Executor -> Parallelizer -> Browser Actions
                                 |                |               |
                               Observability  Error Handler   Perception
```

## 17. Testing & CI
- Deterministic replays from snapshots; golden selector tests per site.
- Headless and headed modes; visual diffs on failures.
- CI stages: lint -> typecheck -> unit -> e2e (record) -> e2e (replay).

## 18. Operational Runbooks
- Hotfix flaky selector: ship adapter update; invalidate cache; warm selector map.
- Handle auth wall: stop, label task failed, emit sign‑in URL.
- Rate limit events: reduce concurrency, increase backoff, schedule retry.

## 19. Telemetry
- Emit OpenTelemetry spans per action; tag with node id, selector, duration, retries.
- Dashboard SLOs: success rate, p95 action latency, mean retries, replay success.

## 20. Glossary
- DAG: Directed Acyclic Graph of task dependencies
- Idempotency: Re‑running without unintended side effects
- Compensating action: Operation to undo/mitigate side effects

-- End of document --
