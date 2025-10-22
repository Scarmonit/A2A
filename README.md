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
npm run start
```

### Testing Locally

1. Start the server:
   ```bash
   npm run dev
   ```

2. Connect a WebSocket client to:
   ```
   ws://127.0.0.1:8787/stream?requestId=<id>
   ```

3. Call `invoke_agent` via MCP tool to receive streaming chunks

## Response Format

`invoke_agent` returns:
```json
{
  "requestId": "uuid",
  "status": "pending|running|completed|failed",
  "streamUrl": "ws://..."
}
```

Stream events:
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
- [ws](https://github.com/websockets/ws) - WebSocket implementation
- [pino](https://github.com/pinojs/pino) - Structured logging
- [zod](https://github.com/colinhacks/zod) - Runtime type validation
