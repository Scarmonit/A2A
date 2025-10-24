# A2A MCP Server

[![CI Status](https://github.com/Scarmonit/A2A/actions/workflows/ci.yml/badge.svg)](https://github.com/Scarmonit/A2A/actions/workflows/ci.yml)
[![Security Scan](https://github.com/Scarmonit/A2A/actions/workflows/security.yml/badge.svg)](https://github.com/Scarmonit/A2A/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An Agent-to-Agent Model Context Protocol (MCP) server built with TypeScript, featuring WebSocket streaming for real-time agent communication and production-ready management capabilities.

## Features

### Core MCP Features

- **MCP Protocol Support**: Full implementation of the Model Context Protocol
- **WebSocket Streaming**: High-performance real-time communication
- **Agent Management**: List, describe, open sessions, close sessions, invoke agents
- **Handoff Support**: Seamless agent-to-agent handoffs
- **Status Tracking**: Real-time status monitoring and cancellation
- **Idempotency**: Built-in support for idempotent operations
- **Parallel Command Execution**: Execute multiple commands concurrently using execa

### Production-Ready Features 🚀

- **Auto-Recovery**: Automatic restart with exponential backoff (1s → 2s → 4s)
- **Health Monitoring**: Configurable health checks (default 30s intervals)
- **Real-time Dashboard**: WebSocket-based live metrics broadcasting
- **Kubernetes Support**: Production-grade container orchestration
- **Event-Driven Architecture**: EventEmitter-based lifecycle hooks
- **Prometheus Integration**: Built-in metrics collection
- **Horizontal Auto-Scaling**: HPA configuration for dynamic scaling
- **Persistent Storage**: PVC support for data persistence
- **Graceful Shutdown**: Proper cleanup and resource management

📖 **[Complete Production Features Guide](./docs/PRODUCTION_FEATURES.md)**

### Zero-Click Automation ⚡

- **Event-Driven Automation**: Automatically trigger agents based on events (webhooks, schedules, file changes, metrics)
- **Proactive Agent Suggestions**: AI-powered suggestions with pattern learning and confidence scoring
- **Smart Execution**: Auto-approve trusted operations, manual approval for sensitive tasks
- **Agent Chaining**: Chain multiple agents together for complex workflows
- **Condition Monitoring**: Watch system conditions and react proactively
- **Pattern Learning**: Learn from execution history to suggest optimizations

📖 **[Complete Zero-Click Automation Guide](./docs/ZERO_CLICK_GUIDE.md)**

## Parallel Command Execution

The A2A server includes a powerful parallel command executor built with [execa](https://github.com/sindresorhus/execa), enabling you to run multiple commands concurrently using Promise.all.

### Features

- Execute multiple commands in parallel with Promise.all
- Script-style interface for running named commands
- NPM script parallel execution
- Detailed result reporting (stdout, stderr, exit codes, duration)
- Built-in error handling and timeout support

### Usage Examples

#### Example 1: Run Multiple Commands in Parallel

```typescript
import { executeParallel } from './src/parallel-executor';

const commands = [
  { command: 'npm', args: ['run', 'build'] },
  { command: 'npm', args: ['run', 'test'] },
  { command: 'npm', args: ['run', 'lint'] }
];

const results = await executeParallel(commands);
console.log(`Completed ${results.filter(r => r.success).length}/${results.length} commands`);
```

#### Example 2: Run NPM Scripts in Parallel

```typescript
import { executeNpmScripts } from './src/parallel-executor';

// Run multiple npm scripts concurrently
const results = await executeNpmScripts(['build', 'test', 'lint']);
```

#### Example 3: Run Named Scripts with Script Interface

```typescript
import { executeScripts } from './src/parallel-executor';

const scripts = {
  'build': 'npm run build',
  'test': 'npm run test',
  'lint': 'eslint src/**/*.ts'
};

const results = await executeScripts(scripts);
console.log('Build result:', results.build.success);
console.log('Test result:', results.test.success);
```

#### Example 4: Advanced Configuration

```typescript
import { executeParallel, CommandConfig } from './src/parallel-executor';

const commands: CommandConfig[] = [
  {
    command: 'npm',
    args: ['run', 'build'],
    options: {
      cwd: './packages/core',
      env: { NODE_ENV: 'production' }
    }
  },
  {
    command: 'npm',
    args: ['test'],
    options: {
      cwd: './packages/utils'
    }
  }
];

const results = await executeParallel(commands);
results.forEach(result => {
  console.log(`Command: ${result.command}`);
  console.log(`Duration: ${result.duration}ms`);
  console.log(`Success: ${result.success}`);
});
```

### Benefits of Parallel Execution

- **Faster CI/CD**: Run build, test, and lint tasks concurrently
- **Improved Development**: Execute multiple dev servers simultaneously
- **Efficient Testing**: Run test suites in parallel across packages
- **Better Resource Utilization**: Maximize CPU and I/O usage

## Production Management

### EnhancedMCPManager

Production-ready MCP server management with auto-recovery:

```typescript
import { EnhancedMCPManager } from './src/enhanced-mcp-manager.js';

const manager = new EnhancedMCPManager();

// Register server with auto-recovery
manager.registerServer({
  id: 'my-server',
  type: 'api',
  command: 'node',
  args: ['server.js'],
  healthCheck: async () => true,
  autoRestart: true,
  maxRestarts: 3
});

// Start server and health monitoring
await manager.startServer('my-server');
manager.startHealthMonitoring(30000); // 30-second intervals

// Listen for lifecycle events
manager.on('server:recovered', ({ id, attempts }) => {
  console.log(`Server ${id} recovered after ${attempts} attempts`);
});
```

### RealtimeDashboardHandler

Real-time metrics broadcasting for monitoring:

```typescript
import { RealtimeDashboardHandler } from './src/realtime-dashboard-handler.js';

const dashboard = new RealtimeDashboardHandler({
  port: 9000,
  updateIntervalMs: 5000,
  mcpManager: manager
});

// Start broadcasting metrics
dashboard.startMetricsBroadcast();

// Connect from client
const ws = new WebSocket('ws://localhost:9000');
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  if (type === 'metrics:update') {
    console.log('Agents:', data.agents.total);
    console.log('Memory:', data.performance.memoryUsageMB + 'MB');
  }
};
```

## Tools

### Core Agent Tools

- `list_agents` - List all available agents
- `describe_agent` - Get detailed information about an agent
- `open_session` - Open a new agent session
- `close_session` - Close an existing session
- `invoke_agent` - Invoke an agent with streaming response
- `handoff` - Hand off to another agent
- `cancel` - Cancel ongoing operations
- `get_status` - Get current operation status

### Zero-Click Automation Tools

- `zero_click_add_automation_rule` - Create event-driven automation rules
- `zero_click_add_monitor` - Add proactive condition monitors
- `zero_click_get_suggestions` - Get AI-powered suggestions
- `zero_click_start_webhook_server` - Start webhook server for external events
- `zero_click_add_schedule` - Add scheduled event triggers
- `zero_click_watch_file` - Watch files for changes
- `zero_click_monitor_metric` - Monitor system metrics

📖 **[Complete Zero-Click Tools Reference](./docs/ZERO_CLICK_GUIDE.md#mcp-tools)**

## Transport

- **MCP stdio**: For Claude and other MCP clients
- **WebSocket**: High-performance side-channel at `ws://127.0.0.1:8787`
- **Dashboard WebSocket**: Real-time metrics at `ws://127.0.0.1:9000`

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher

### Installation

```bash
# Clone the repository
git clone https://github.com/Scarmonit/A2A.git
cd A2A

# Install dependencies
npm install

# Build the project
npm run build
```

### Development

```bash
# Run in development mode (with auto-reload)
npm run dev
```

The server will start with:
- MCP stdio transport for clients
- WebSocket server at `ws://127.0.0.1:8787`

### Production

```bash
# Build and start
npm run build
npm start
```

## Kubernetes Deployment

Deploy A2A to Kubernetes for production workloads:

```bash
# Build Docker image
docker build -t scarmonit/a2a-mcp:latest .

# Deploy to Kubernetes
kubectl apply -f k8s/deployment.yaml

# Check status
kubectl get pods -n a2a-mcp
kubectl get svc -n a2a-mcp

# Access services
kubectl port-forward -n a2a-mcp svc/a2a-mcp-websocket 8787:8787
kubectl port-forward -n a2a-mcp svc/a2a-mcp-metrics 3000:3000
```

### Kubernetes Features

- **Auto-Scaling**: HPA with CPU/memory thresholds (2-10 replicas)
- **Health Probes**: Liveness, readiness, and startup checks
- **Load Balancing**: External access via LoadBalancer service
- **Persistent Storage**: 5Gi PVC for data persistence
- **Prometheus**: ServiceMonitor for metrics scraping
- **Resource Management**: CPU and memory limits/requests

📖 **[Kubernetes Deployment Guide](./docs/PRODUCTION_FEATURES.md#kubernetes-deployment)**

## Usage

### With GitHub Copilot

GitHub Copilot can integrate with A2A to leverage advanced agent capabilities directly in your development workflow.

**Quick Setup:**

1. Build the A2A server:
   ```bash
   npm install && npm run build
   ```

2. Configure VS Code (add to `.vscode/settings.json` or user settings):
   ```json
   {
     "github.copilot.advanced": {
       "mcpServers": {
         "a2a-agent-server": {
           "command": "node",
           "args": ["${workspaceFolder}/dist/index.js"],
           "env": {
             "ENABLE_STREAMING": "true",
             "STREAM_PORT": "8787",
             "LOG_LEVEL": "info"
           }
         }
       }
     }
   }
   ```

3. Reload VS Code window

**What Copilot Can Do With A2A:**
- Deploy and manage specialized agents (web scraping, content creation, data analysis)
- Execute parallel commands (build, test, lint concurrently)
- Perform advanced file operations and automation
- Manage cloud infrastructure and deployments
- Real-time streaming for live updates

📖 **[Complete GitHub Copilot Integration Guide](./docs/COPILOT_INTEGRATION.md)**

### With Claude Desktop

1. Install and build the server (see Installation)
2. Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["/path/to/A2A/dist/index.js"]
    }
  }
}
```

3. Restart Claude Desktop

### WebSocket Client

```typescript
import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:8787');

ws.on('open', () => {
  ws.send(JSON.stringify({
    jsonrpc: '2.0',
    method: 'list_agents',
    params: {},
    id: 1
  }));
});

ws.on('message', (data) => {
  console.log('Received:', data.toString());
});
```

## Streaming Protocol

All streaming operations use the following event types:

- `start` - Operation started
- `chunk` - Data chunk received
- `final` - Operation completed
- `error` - Error occurred

## Deployment

### Supported Platforms

- **Kubernetes** (Production) - [Deploy Guide](./docs/PRODUCTION_FEATURES.md#kubernetes-deployment)
- **Railway** (Primary) - [Deploy Guide](./YOUR_DEPLOYMENT.md)
- **Render** - Automatic deployment via GitHub Actions
- **Fly.io** - [Setup Guide](./QUICK_DEPLOY.md)
- **Vercel** - Serverless deployment

### Environment Variables

See `.env.example` for required environment variables.

### Deployment Status

✅ All Railway deployments are healthy and operational
  
✅ All services are functioning correctly

## Testing

```bash
# Run all tests
npm test

# Run specific test file
node --test tests/enhanced-features.test.ts

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Monitoring

### Prometheus Metrics

Available at `/metrics` endpoint (port 3000):

```bash
curl http://localhost:3000/metrics
```

### Health Check

```bash
curl http://localhost:3000/healthz
```

### Agent Status API

```bash
curl http://localhost:3000/api/agent?action=status
```

## Documentation

### Production Features
- **[Production Features Guide](./docs/PRODUCTION_FEATURES.md)** - Complete production deployment guide
- **[Auto-Recovery](./docs/PRODUCTION_FEATURES.md#enhancedmcpmanager)** - Automatic restart with exponential backoff
- **[Health Monitoring](./docs/PRODUCTION_FEATURES.md#health-monitoring)** - Configurable health checks
- **[Real-time Dashboard](./docs/PRODUCTION_FEATURES.md#realtimedashboardhandler)** - Live metrics broadcasting
- **[Kubernetes](./docs/PRODUCTION_FEATURES.md#kubernetes-deployment)** - Production K8s deployment

### GitHub Copilot Integration
- **[Feature Overview](./docs/COPILOT_FEATURES.md)** - Visual guide to all capabilities
- **[Complete Integration Guide](./docs/COPILOT_INTEGRATION.md)** - Full setup, usage, and troubleshooting
- **[Quick Start (5 min)](./docs/COPILOT_QUICKSTART.md)** - Get started in under 5 minutes

### Deployment & Setup
- [Quick Deploy Guide](./QUICK_DEPLOY.md) - Fast deployment instructions
- [Your Deployment Guide](./YOUR_DEPLOYMENT.md) - Custom deployment setup
- [Ollama Setup](./OLLAMA_SETUP.md) - Ollama integration guide
- [Free Domains](./FREE_DOMAINS.md) - Free domain options

### Project Guidelines
- [Contributing](./CONTRIBUTING.md) - Contribution guidelines
- [Security](./SECURITY.md) - Security policy and reporting
- [Changelog](./CHANGELOG.md) - Version history

## Contributing

We welcome contributions! Please read our [Contributing Guide](./CONTRIBUTING.md) for details on:

- Code of conduct
- Development workflow
- Coding standards
- Pull request process
- Testing requirements

## Security

Found a security vulnerability? Please read our [Security Policy](./SECURITY.md) for responsible disclosure guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## Support

- **Issues**: [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Scarmonit/A2A/discussions)
- **Maintainer**: [@Scarmonit](https://github.com/Scarmonit)

## Acknowledgments

Built with:

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk) - MCP SDK
- [execa](https://github.com/sindresorhus/execa) - Process execution for parallel commands
- [ws](https://github.com/websockets/ws) - WebSocket implementation
- [pino](https://github.com/pinojs/pino) - Structured logging
- [zod](https://github.com/colinhacks/zod) - Runtime type validation
