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

const scripts = ['build', 'test', 'lint'];
const results = await executeNpmScriptsParallel(scripts);
```

## OpenSSH Integration

The A2A server provides comprehensive OpenSSH integration for secure remote Windows Server automation and management. This enables A2A agents to execute commands, manage services, and automate tasks on remote Windows systems through secure SSH connections.

### Features

- **SSH Connection Management**: Establish and maintain secure SSH connections to remote Windows Servers
- **Remote Windows Server Automation**: Execute PowerShell scripts, batch commands, and system administration tasks remotely
- **Key-Based Authentication**: Support for SSH key pairs (RSA, ECDSA, Ed25519) for passwordless authentication
- **Secure Command Execution**: Execute commands in isolated sessions with full stdout/stderr capture
- **Session Multiplexing**: Reuse SSH connections for multiple commands to improve performance
- **Integration with A2A Agents**: Seamlessly integrate SSH operations into agent workflows and automation pipelines

### Configuration

Configure OpenSSH connections in your A2A agent configuration:

```typescript
import { SSHExecutor } from './src/ssh-executor';

const sshConfig = {
  host: 'windows-server.example.com',
  port: 22,
  username: 'administrator',
  privateKeyPath: '~/.ssh/id_rsa',
  // Optional: password authentication
  // password: 'your-password'
};

const executor = new SSHExecutor(sshConfig);
```

### Usage Examples

#### Example 1: Execute PowerShell Commands Remotely

```typescript
import { SSHExecutor } from './src/ssh-executor';

const executor = new SSHExecutor(sshConfig);

// Execute a PowerShell command
const result = await executor.execute('powershell -Command "Get-Service | Where-Object {$_.Status -eq \'Running\'}"');
console.log(result.stdout);
```

#### Example 2: Parallel Remote Execution

```typescript
import { SSHExecutor, executeSSHParallel } from './src/ssh-executor';

const servers = [
  { host: 'server1.example.com', ...commonConfig },
  { host: 'server2.example.com', ...commonConfig },
  { host: 'server3.example.com', ...commonConfig }
];

const command = 'powershell -Command "Get-Process"';
const results = await executeSSHParallel(servers, command);
```

#### Example 3: A2A Agent Integration

```typescript
import { Agent } from './src/agent';
import { SSHExecutor } from './src/ssh-executor';

class WindowsManagementAgent extends Agent {
  async deployApplication(serverList: string[]) {
    const deployCommands = serverList.map(server => ({
      host: server,
      command: 'powershell -File C:\\Deploy\\install-app.ps1'
    }));
    
    return await this.executeSSHParallel(deployCommands);
  }
}
```

### Security Best Practices

- Use key-based authentication instead of passwords
- Store private keys securely with appropriate file permissions (600)
- Rotate SSH keys regularly
- Use jump hosts (bastion servers) for additional security layers
- Enable SSH connection logging and monitoring
- Implement command whitelisting for production environments

### Documentation

- **[Complete OpenSSH Integration Guide](./docs/OPENSSH_INTEGRATION.md)** - Full setup and configuration
- **[SSH Security Best Practices](./docs/SSH_SECURITY.md)** - Security guidelines and hardening
- **[Windows Server Automation Examples](./examples/windows-ssh-automation/)** - Real-world automation scenarios
- **[Troubleshooting SSH Connections](./docs/SSH_TROUBLESHOOTING.md)** - Common issues and solutions

## Warp University Integration

Integrate A2A with Warp University for enhanced terminal automation and learning.

### Features

- **Warp Command Blocks**: Execute commands in isolated Warp blocks
- **Terminal Session Management**: Manage multiple terminal sessions
- **Command History Integration**: Access and replay command history
- **AI-Powered Suggestions**: Get intelligent command suggestions

### Setup

1. Install Warp terminal
2. Configure A2A integration in Warp settings
3. Enable agent access to Warp features

### Usage Example

```typescript
import { WarpIntegration } from './src/warp-integration';

const warp = new WarpIntegration();
await warp.executeBlock('npm run build && npm run test');
```

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
