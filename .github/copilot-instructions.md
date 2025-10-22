# Copilot Instructions for A2A MCP Server

## Project Overview

A2A (Agent-to-Agent) is a Model Context Protocol (MCP) server implementation in TypeScript that enables AI agents to communicate and collaborate through a standardized protocol. The server provides:

- **Agent Management**: Deploy, discover, and manage AI agents with various capabilities
- **Streaming Support**: High-performance WebSocket streaming for real-time agent interactions
- **Tool Registry**: Extensible tool system for agents to interact with external systems
- **Session Management**: Track and manage agent sessions with idempotency support
- **Metrics & Monitoring**: Built-in Prometheus metrics and health checks
- **Multi-Platform Deployment**: Support for Railway, Render, Fly.io, and Vercel

**Target Users**: Developers building AI agent systems, multi-agent orchestration platforms, and MCP-compliant applications.

## Tech Stack & Tools

**Core Technologies**:
- **Language**: TypeScript 5.6+
- **Runtime**: Node.js 20+
- **MCP SDK**: @modelcontextprotocol/sdk ^1.5.0
- **WebSocket**: ws ^8.18.0 for streaming
- **Logging**: pino ^9.3.2
- **Monitoring**: prom-client ^15.1.3
- **Validation**: zod ^3.23.8

**Build & Development**:
- **TypeScript Compiler**: tsc
- **Dev Server**: ts-node-dev for hot reload
- **Package Manager**: npm

**Deployment Platforms**:
- Railway, Render, Fly.io, Vercel
- Docker support with multi-stage builds

## Coding Guidelines & Conventions

**Code Style**:
- Use TypeScript strict mode (configured in tsconfig.json)
- Prefer functional programming patterns where appropriate
- Use async/await for asynchronous operations
- Export types and interfaces for public APIs

**Naming Conventions**:
- **Files**: kebab-case (e.g., `agent-executor.ts`, `streaming.ts`)
- **Classes**: PascalCase (e.g., `AgentRegistry`, `StreamHub`)
- **Functions/Variables**: camelCase (e.g., `ensureRequestId`, `agentExecutor`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_CONCURRENCY`, `ENABLE_STREAMING`)
- **Types/Interfaces**: PascalCase (e.g., `AgentDescriptor`, `RequestRecord`)

**Error Handling**:
- Always provide meaningful error messages
- Use try-catch blocks for async operations
- Log errors with appropriate context using pino logger
- Return structured error responses in MCP format

**Comments**:
- Add JSDoc comments for public APIs and complex functions
- Explain "why" not "what" in inline comments
- Keep comments up-to-date with code changes

**Dependencies**:
- Minimize external dependencies
- Prefer well-maintained packages with active communities
- Check for security vulnerabilities before adding new dependencies

## Project Structure

```
/home/runner/work/A2A/A2A/
├── src/                          # TypeScript source files
│   ├── index.ts                  # Main MCP server entry point
│   ├── agents.ts                 # Core agent registry and management
│   ├── enhanced-agents.ts        # Enhanced agent types and ecosystem
│   ├── advanced-agents.ts        # Advanced agent capabilities
│   ├── agent-executor.ts         # Agent execution engine
│   ├── agent-memory.ts           # Memory management for agents
│   ├── agent-mcp-servers.ts      # MCP server management
│   ├── tools.ts                  # Core tool registry
│   ├── practical-tools.ts        # Practical tool implementations
│   ├── advanced-tools.ts         # Advanced tool capabilities
│   ├── streaming.ts              # WebSocket streaming hub
│   ├── permissions.ts            # Permission management
│   ├── workflow-orchestrator.ts  # Workflow orchestration
│   ├── ai-integration.ts         # AI provider integrations
│   ├── analytics-engine.ts       # Analytics and metrics
│   └── agent-types.ts            # Type definitions
├── dist/                         # Compiled JavaScript output
├── api/                          # API handlers (for serverless)
├── scripts/                      # Utility scripts
├── .github/                      # GitHub workflows and configs
│   ├── workflows/deploy.yml      # CI/CD deployment pipeline
│   └── copilot-instructions.md   # This file
├── package.json                  # Project dependencies and scripts
├── tsconfig.json                 # TypeScript configuration
├── Dockerfile                    # Docker container definition
└── docker-compose.yml            # Multi-container setup
```

**Key Components**:
- **Agent Registry** (`agents.ts`): Central registry for agent discovery and filtering
- **Stream Hub** (`streaming.ts`): WebSocket-based streaming for real-time updates
- **Agent Executor** (`agent-executor.ts`): Executes agent capabilities with concurrency control
- **Tool Registry** (`tools.ts`, `practical-tools.ts`, `advanced-tools.ts`): Extensible tool system

## Testing & Validation Strategy

**Build & Test Commands**:
```bash
npm run build              # Compile TypeScript to JavaScript
npm run dev               # Run dev server with hot reload
npm start                 # Run production server
npm run agent:continuous  # Run with increased memory for large agent ecosystems
```

**Testing Approach**:
- The project includes test files for various scenarios:
  - `test-agent-ecosystem.js` - Test agent ecosystem functionality
  - `test-real-agents.js` - Test real agent interactions
  - `test-ollama-integration.js` - Test Ollama integration
  - `simple-agent-test.js` - Basic agent functionality tests
  - `test-hundreds-agents.js` - Stress test with many agents

**Before Committing**:
1. Run `npm run build` to ensure TypeScript compiles without errors
2. Test locally with `npm run dev` and verify MCP tools respond correctly
3. Check that streaming WebSocket endpoint works (default: `ws://127.0.0.1:8787`)
4. Verify environment variables are properly documented in `.env.example`

**Testing New Features**:
- Add new test files following the `test-*.js` naming pattern
- Test agent registration, invocation, and streaming
- Verify idempotency keys work correctly
- Check metrics endpoint if monitoring features are affected

## Troubleshooting & Common Issues

**Build Errors**:
- **Missing type declarations**: Ensure all `@types/*` packages are installed
- **Module not found**: Run `npm ci` to clean install dependencies
- **TypeScript errors**: Check `tsconfig.json` settings match Node.js version

**Runtime Issues**:
- **Port already in use**: Change `STREAM_PORT` environment variable (default: 8787)
- **WebSocket connection fails**: Check firewall settings and ensure streaming is enabled (`ENABLE_STREAMING=true`)
- **Memory issues with large agent ecosystems**: Use `npm run agent:continuous` for increased memory
- **Agent not found**: Verify agent is properly registered in AgentRegistry

**Deployment Issues**:
- **Healthcheck failing**: The server uses stdio transport for MCP, ensure platform healthchecks are disabled or point to metrics endpoint
- **Environment variables**: Ensure all required env vars are set (see `.env.example`)
- **Build timeout**: Increase build timeout for platforms like Railway/Render

**Common Configuration**:
- `ENABLE_STREAMING`: Enable/disable WebSocket streaming (default: true)
- `STREAM_PORT`: WebSocket server port (default: 8787)
- `MAX_CONCURRENCY`: Maximum concurrent agent executions (default: 50)
- `MAX_QUEUE_SIZE`: Maximum request queue size (default: 10000)
- `METRICS_PORT`: Prometheus metrics port (0 to disable)

---

# Automation & CI/CD Policy

## Purpose
Define how Copilot-enabled automation agents and bots should behave in this repository, enabling safe, auditable automation that can create branches, open PRs, run checks, and merge when policies are met.

## Scope & Authority

**Allowed automated actions** (no extra manual approval unless stated):
- Create feature/fix/chore/hotfix branches off the repository default branch
- Commit code, tests, and docs to new branches
- Open PRs with populated title, body, checklist, linked issues, and labels
- Trigger CI/CD via commits and PRs
- Auto-merge PRs when all automated merge rules are satisfied
- Draft and create releases when semantic-versioning criteria are met

**Disallowed / restricted actions** (require explicit human approval):
- Direct pushes to protected branches (main/master/etc.) unless branch protection allows it
- Changing repository settings, branch protection, required reviewers, or secrets
- Adding/modifying secrets, credentials, or other sensitive config
- Force-pushes, reverting protected history, destructive infra changes affecting production
- Auto-merge for BREAKING CHANGES or major-version bumps — these always require human maintainer approval

## Branch Naming Conventions

- `feature/<short-desc>[-<ticket>]` - New features
- `fix/<short-desc>[-<ticket>]` - Bug fixes
- `chore/<short-desc>` - Maintenance tasks
- `hotfix/<short-desc>` - Critical production fixes

## Commit Message Policy (Conventional Commits)

**Format**: `<type>(<scope>): <short summary>`

**Body**: Optional longer description and rationale

**Footer**: References like `Closes #<issue>`, `BREAKING CHANGE: ...`

**Accepted types**: feat, fix, docs, style, refactor, perf, test, chore, ci

## Automated PR Content

Agents should populate PRs with:

**Title**: Concise summary (optional prefix feat/fix/ci)

**Body**:
- Summary: What changed and why
- Implementation notes
- Test plan
- Checklist:
  - [ ] TypeScript compiles without errors
  - [ ] Tests added/updated for new functionality
  - [ ] Documentation updated (if applicable)
  - [ ] Environment variables documented in .env.example (if added)
  - [ ] Streaming functionality tested (if affected)

**Labels** to apply automatically where applicable:
- `type:feature`, `type:bug`, `type:chore`, `needs:review`, `needs:tests`, `blocked`

## Auto-merge Rules

Agent may auto-merge a PR only when **ALL** conditions are met:
- All required CI checks & status checks pass
- Required reviews are completed (or no required-review rule is in place)
- No merge conflicts with base branch
- No blocker labels (e.g., `blocked`)
- PR does not include BREAKING CHANGE or major version bump

When auto-merge is performed, use squash or merge strategy consistent with project policy and include the automation identity in the commit body.

## Security & Safety

- **Never** commit secrets, private keys, tokens, or credentials
- If a potential secret is detected, open a draft PR and security issue; stop any auto-merge until secret rotation
- Run static analysis, dependency vulnerability scanning, and secret scanning on every PR
- Respect CODEOWNERS and required reviewers; assign code owners automatically when affected
- Require signed commits or include agent signature metadata in PR/commit message when possible

## Auditability & Traceability

- All automated changes must reference the originating issue or task
- Include a short changelog entry in CHANGELOG.md and mention it in the PR body (if one exists)
- Agent identity and rationale must be present in commit messages and PR bodies for audit trails
- Keep audit logs in repository (e.g., .github/automation/audit.log entries or documented PRs)

## Quality & Developer Experience

- Agents must include unit tests and documentation updates with code changes
- Prefer small, focused PRs - if large change needed, break into sequenced PRs tied to umbrella issue
- Provide reproducible test plans in PR bodies
- Ensure TypeScript types are properly defined for new code
- Follow existing code patterns and conventions in the repository

## Failure & Escalation

- If unsure about behavior or change touches infra/security/permissions, open issue and assign maintainers
- If automated workflows fail repeatedly, open issue with logs and disable further retries until maintainer investigates
- For build failures, check if issue is pre-existing before attempting to fix

## Operational & Token Management

- Automation should use a named repository bot account if possible
- Include bot name in commit/PR metadata
- Track and rotate automation tokens according to organization policy
- Limit scopes of tokens to least privilege required

## Enforcement via CI

**Required checks** (examples — repository should wire these to workflows):
- TypeScript compilation (tsc)
- Code style (linters)
- Unit tests
- Integration tests (when applicable)
- Dependency vulnerability scanning
- Secret scanning
- License check

Configure branch protection to require these checks for merges to protected branches.

## Templates & Examples

**Example commit**:
```
feat(agent-executor): add concurrent execution limit

Add configurable concurrency limit to prevent resource exhaustion.
Includes tests and updates to env variable documentation.

Closes #123
```

**Example PR body**:
```
## Summary
Add concurrency control to agent executor to prevent resource exhaustion.

## Why
Without limits, hundreds of simultaneous agent invocations could crash the server.

## What Changed
- Added MAX_CONCURRENCY environment variable
- Implemented queue system in agent-executor.ts
- Added concurrency tests

## Testing
- Unit tests: npm run build && node dist/test-hundreds-agents.js
- Manual test: Started server with MAX_CONCURRENCY=5 and verified queuing behavior

## Checklist
- [x] TypeScript compiles without errors
- [x] Tests added for concurrency limits
- [x] Documentation updated in .env.example
- [x] Streaming functionality verified unaffected
```

## Revision & Governance

- Agents may propose changes to this file via PR
- Changes to automation policy must be reviewed/approved by repo maintainers
- Maintain revision history section below

## Contact & Incident Response

- Tag maintainers in CODEOWNERS for questions about automation behavior
- Follow repository SECURITY.md for incidents and notify maintainers immediately

## Revision History

- **2025-10-22**: Enhanced with project overview, tech stack, coding guidelines, structure, testing strategy, and troubleshooting
- **2025-10-22**: Initial full-automation proposal
