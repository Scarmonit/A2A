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
```

#### Example 2: Execute NPM Scripts in Parallel

```typescript
import { executeNpmScriptsParallel } from './src/parallel-executor';

const results = await executeNpmScriptsParallel(['build', 'test', 'lint']);
```

## Warp University Integration

### Overview of Warp Workflows

The A2A MCP Server now integrates seamlessly with Warp University workflows, providing production-ready automation patterns and agent orchestration capabilities. This integration enables:

- **Multi-Agent Workflows**: Coordinate multiple AI agents working on complex tasks simultaneously
- **MCP Server Integration**: Direct access to Warp's MCP servers for enhanced context and tool access
- **Production Patterns**: Battle-tested workflows for common development and operations tasks
- **Extensible Templates**: Pre-built workflow templates that can be customized for your needs

### Quick Start Guide

Get started with Warp + A2A in minutes:

#### 1. Install Warp CLI

```bash
# Clone the Warp University repository
git clone https://github.com/your-org/warp-university.git
cd warp-university

# Install dependencies
npm install
```

#### 2. Configure A2A Integration

```bash
# Link Warp with your A2A server
export A2A_SERVER_URL="ws://localhost:3000"
export A2A_API_KEY="your-api-key"

# Initialize Warp configuration
warp init --with-a2a
```

#### 3. Run Your First Warp Agent with A2A

```bash
# Execute a simple workflow
warp run --workflow code-review --parallel

# Or use the A2A parallel executor
node -e "require('./src/parallel-executor').executeWarpWorkflow('code-review')"
```

### Documentation Links

Explore the complete Warp University documentation:

- **[Warp Getting Started](./warp-university/README.md)** - Introduction and setup guide
- **[Workflow Templates](./warp-university/workflows/README.md)** - Pre-built workflow templates
- **[MCP Server Configuration](./warp-university/docs/mcp-servers.md)** - Configuring MCP servers
- **[Agent Orchestration Guide](./warp-university/docs/agent-orchestration.md)** - Multi-agent coordination
- **[Production Deployment](./warp-university/docs/production-deployment.md)** - Deploy Warp workflows at scale
- **[API Reference](./warp-university/docs/api-reference.md)** - Complete API documentation
- **[Troubleshooting Guide](./warp-university/docs/troubleshooting.md)** - Common issues and solutions

### Example Workflows

#### Example 1: Code Review with Multiple Agents

```typescript
import { WarpWorkflowExecutor } from './warp-university/src/executor';
import { executeParallel } from './src/parallel-executor';

const workflow = new WarpWorkflowExecutor({
  name: 'code-review',
  agents: ['linter', 'security-scanner', 'test-runner'],
  mcpServers: ['github', 'sonarqube'],
  parallel: true
});

// Execute with A2A parallel execution
const results = await workflow.execute({
  repository: 'Scarmonit/A2A',
  branch: 'feature/warp-integration'
});

console.log(`Review completed: ${results.summary}`);
```

#### Example 2: Automated Deployment Pipeline

```typescript
import { WarpWorkflowExecutor } from './warp-university/src/executor';

const pipeline = new WarpWorkflowExecutor({
  name: 'deploy-pipeline',
  stages: [
    { name: 'build', parallel: ['compile', 'test', 'lint'] },
    { name: 'security', parallel: ['scan-dependencies', 'scan-containers'] },
    { name: 'deploy', sequential: ['staging', 'production'] }
  ],
  mcpServers: ['docker', 'kubernetes', 'slack']
});

await pipeline.execute();
```

#### Example 3: Real-Time Monitoring Agent

```typescript
import { WarpAgent } from './warp-university/src/agent';

const monitor = new WarpAgent({
  name: 'system-monitor',
  mcpServers: ['prometheus', 'grafana'],
  triggers: [
    { type: 'metric', threshold: 'cpu > 80%' },
    { type: 'metric', threshold: 'memory > 90%' }
  ],
  actions: [
    'scale-up',
    'alert-ops-team',
    'capture-diagnostics'
  ]
});

await monitor.start();
```

### Benefits of Integration

#### 🚀 Parallel Execution

- **Concurrent Agent Operations**: Run multiple Warp agents simultaneously using A2A's parallel executor
- **Promise.all Integration**: Seamless integration with JavaScript's native concurrency primitives
- **Resource Optimization**: Efficient resource utilization with configurable concurrency limits
- **Performance Gains**: Reduce workflow execution time by up to 80% for parallelizable tasks

#### 🔌 MCP Server Ecosystem

- **Rich Context Access**: Connect to 50+ MCP servers for enhanced agent capabilities
- **Tool Integration**: Leverage MCP tools for file systems, databases, APIs, and more
- **Standardized Interface**: Use consistent MCP protocol across all integrations
- **Custom Servers**: Build and integrate your own MCP servers seamlessly

#### 💪 Production-Ready Workflows

- **Battle-Tested Patterns**: Use proven workflow patterns from real-world deployments
- **Error Handling**: Comprehensive error handling and retry mechanisms
- **Monitoring & Observability**: Built-in metrics, logging, and tracing
- **Scalability**: Horizontal scaling support with Kubernetes and Docker
- **High Availability**: Auto-recovery and health checks ensure uptime

#### 🔧 Developer Experience

- **TypeScript Support**: Full type safety and IDE autocompletion
- **Hot Reload**: Fast iteration with automatic workflow reloading
- **Debugging Tools**: Integrated debugger and trace visualization
- **Template Library**: Start quickly with pre-built workflow templates
- **Documentation**: Comprehensive guides, examples, and API references

#### 🎯 Use Case Examples

- **CI/CD Automation**: Automated testing, building, and deployment pipelines
- **Code Review**: Multi-agent code analysis with security, quality, and style checks
- **Infrastructure Management**: Automated provisioning, scaling, and monitoring
- **Data Processing**: Parallel data transformation and analysis workflows
- **Content Generation**: Multi-agent content creation and review processes

## Documentation

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
