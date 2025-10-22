# A2A MCP Server

[![CI Status](https://github.com/Scarmonit/A2A/actions/workflows/ci.yml/badge.svg)](https://github.com/Scarmonit/A2A/actions/workflows/ci.yml)
[![Security Scan](https://github.com/Scarmonit/A2A/actions/workflows/security.yml/badge.svg)](https://github.com/Scarmonit/A2A/actions/workflows/security.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

An Agent-to-Agent Model Context Protocol (MCP) server built with TypeScript, featuring WebSocket streaming for real-time agent communication.

## Features

- **MCP Protocol Support**: Full implementation of the Model Context Protocol
- **WebSocket Streaming**: High-performance real-time communication
- **Agent Management**: List, describe, open sessions, close sessions, invoke agents
- **Handoff Support**: Seamless agent-to-agent handoffs
- **Status Tracking**: Real-time status monitoring and cancellation
- **Idempotency**: Built-in support for idempotent operations
- **Parallel Command Execution**: Execute multiple commands concurrently using execa

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

## Tools

- `list_agents` - List all available agents
- `describe_agent` - Get detailed information about an agent
- `open_session` - Open a new agent session
- `close_session` - Close an existing session
- `invoke_agent` - Invoke an agent with streaming response
- `handoff` - Hand off to another agent
- `cancel` - Cancel ongoing operations
- `get_status` - Get current operation status

## Transport

- **MCP stdio**: For Claude and other MCP clients
- **WebSocket**: High-performance side-channel at `ws://127.0.0.1:8787`

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

- **Railway** (Primary) - [Deploy Guide](./YOUR_DEPLOYMENT.md)
- **Render** - Automatic deployment via GitHub Actions
- **Fly.io** - [Setup Guide](./QUICK_DEPLOY.md)
- **Vercel** - Serverless deployment

### Environment Variables

See `.env.example` for required environment variables.

### Deployment Status

✅ All Railway deployments are healthy and operational
  
✅ All services are functioning correctly

## Documentation

- **[GitHub Copilot Integration](./docs/COPILOT_INTEGRATION.md)** - Complete guide for Copilot integration
- [Quick Deploy Guide](./QUICK_DEPLOY.md) - Fast deployment instructions
- [Your Deployment Guide](./YOUR_DEPLOYMENT.md) - Custom deployment setup
- [Ollama Setup](./OLLAMA_SETUP.md) - Ollama integration guide
- [Free Domains](./FREE_DOMAINS.md) - Free domain options
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
