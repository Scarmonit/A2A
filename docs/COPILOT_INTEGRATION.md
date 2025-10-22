# GitHub Copilot MCP Integration Guide

## Overview

This guide explains how to integrate the A2A MCP Server with GitHub Copilot, enabling Copilot to leverage advanced agent capabilities, WebSocket streaming, and parallel execution features.

## What is MCP?

The Model Context Protocol (MCP) is an open protocol that standardizes how applications provide context to Large Language Models (LLMs). By integrating A2A with GitHub Copilot via MCP, Copilot gains access to:

- **Agent Ecosystem**: Deploy and manage multiple specialized agents
- **Real-time Streaming**: WebSocket-based streaming for live updates
- **Parallel Execution**: Execute multiple commands concurrently
- **Advanced Tools**: File operations, web scraping, data analysis, and more
- **Permission Management**: Fine-grained control over agent capabilities

## Prerequisites

Before integrating A2A with GitHub Copilot, ensure you have:

- Node.js 20.x or higher
- npm 9.x or higher
- GitHub Copilot subscription (required for VS Code or GitHub.com)
- A2A MCP Server built and ready to run

## Installation

### 1. Build the A2A Server

```bash
cd /path/to/A2A
npm install
npm run build
```

Verify the build creates the `dist/index.js` file:

```bash
ls -la dist/index.js
```

### 2. Configure GitHub Copilot

GitHub Copilot can be configured to use MCP servers through different methods depending on your environment.

#### Option A: VS Code Configuration

1. Open VS Code Settings (JSON)
2. Add the MCP configuration:

```json
{
  "github.copilot.advanced": {
    "mcpServers": {
      "a2a-agent-server": {
        "command": "node",
        "args": ["/absolute/path/to/A2A/dist/index.js"],
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

**Important**: Replace `/absolute/path/to/A2A` with your actual path.

#### Option B: Workspace Configuration

For project-specific configuration, create or update `.vscode/settings.json` in your workspace:

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
          "MAX_CONCURRENCY": "50",
          "LOG_LEVEL": "info"
        }
      }
    }
  }
}
```

#### Option C: Using the Configuration File

Copy the provided configuration file to your setup:

```bash
# Copy the MCP config
cp .github/copilot/mcp-config.json ~/.config/github-copilot/mcp-servers.json
```

Edit the file to set the correct path:

```bash
# Linux/Mac
nano ~/.config/github-copilot/mcp-servers.json

# Windows
notepad %APPDATA%\github-copilot\mcp-servers.json
```

### 3. Restart GitHub Copilot

After configuration:

- **VS Code**: Reload the window (`Ctrl+Shift+P` → "Developer: Reload Window")
- **GitHub.com**: Refresh the page

## Available Agent Control Actions

Once integrated, Copilot can use the `agent_control` tool with these actions:

### Agent Management

- `list_agents` - List all available agents
- `describe_agent` - Get detailed information about a specific agent
- `deploy_agent` - Deploy a new agent
- `update_agent` - Update agent configuration
- `enable_agent` / `disable_agent` - Toggle agent availability
- `remove_agent` - Remove an agent
- `get_stats` - Get agent statistics

### Agent Invocation

- `open_session` - Open a new agent session
- `close_session` - Close an existing session
- `invoke_agent` - Invoke an agent capability
- `handoff` - Transfer control to another agent
- `cancel` - Cancel an ongoing operation
- `get_status` - Check operation status

### Enhanced Agents

- `create_enhanced_agent` - Create specialized agents (web scraper, content writer, data analyst, etc.)
- `create_agent_ecosystem` - Deploy complete ecosystems for specific use cases
- `list_enhanced_types` - List available enhanced agent types

### Advanced Features

- `execute_practical_tool` - Execute practical tools (file operations, git, etc.)
- `execute_advanced_tool` - Execute advanced tools (database, cloud, ML, etc.)
- `grant_permission` / `revoke_permission` - Manage agent permissions
- `create_mcp_server` - Create agent-specific MCP servers

## Usage Examples

### Example 1: List Available Agents

Ask Copilot:
```
"Show me all available agents in the A2A server"
```

Copilot will invoke:
```json
{
  "action": "list_agents"
}
```

### Example 2: Create a Web Scraper Agent

Ask Copilot:
```
"Create a web scraper agent to extract product data"
```

Copilot will invoke:
```json
{
  "action": "create_enhanced_agent",
  "agentType": "web-scraper",
  "agentConfig": {
    "name": "product-scraper",
    "description": "Extract product data from websites"
  }
}
```

### Example 3: Execute Parallel Commands

Ask Copilot:
```
"Run build, test, and lint in parallel"
```

Copilot will invoke:
```json
{
  "action": "execute_practical_tool",
  "toolName": "parallel_commands",
  "toolParams": {
    "commands": [
      { "command": "npm", "args": ["run", "build"] },
      { "command": "npm", "args": ["run", "test"] },
      { "command": "npm", "args": ["run", "lint"] }
    ]
  }
}
```

### Example 4: Deploy an Agent Ecosystem

Ask Copilot:
```
"Set up a complete web development ecosystem"
```

Copilot will invoke:
```json
{
  "action": "create_agent_ecosystem",
  "useCase": "web-development"
}
```

## Environment Variables

Configure the A2A server behavior through environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_STREAMING` | `true` | Enable WebSocket streaming |
| `STREAM_PORT` | `8787` | WebSocket server port |
| `STREAM_HOST` | `127.0.0.1` | WebSocket server host |
| `STREAM_TOKEN` | (none) | Optional authentication token |
| `MAX_CONCURRENCY` | `50` | Maximum concurrent operations |
| `MAX_QUEUE_SIZE` | `10000` | Maximum queue size |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `METRICS_PORT` | `0` | Metrics/health endpoint port (0=disabled) |

## WebSocket Streaming

When `ENABLE_STREAMING` is enabled, the A2A server provides real-time updates via WebSocket:

### Connection URL
```
ws://127.0.0.1:8787
```

### Stream Events

- `start` - Operation started
- `chunk` - Incremental data/progress
- `final` - Operation completed successfully
- `error` - Error occurred

### Example: Subscribe to Agent Execution

```javascript
const ws = new WebSocket('ws://127.0.0.1:8787');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  
  switch(event.type) {
    case 'start':
      console.log('Agent started:', event.requestId);
      break;
    case 'chunk':
      console.log('Progress:', event.content);
      break;
    case 'final':
      console.log('Completed:', event.result);
      break;
    case 'error':
      console.error('Error:', event.message);
      break;
  }
});
```

## Advanced Configuration

### Custom Agent Types

The A2A server includes several pre-built agent types:

#### Enhanced Agents
- **web-scraper** - Advanced web scraping with pagination
- **content-writer** - SEO-optimized content generation
- **data-analyst** - Data analysis and visualization
- **api-tester** - API testing and validation
- **deploy-manager** - Multi-platform deployment
- **security-scanner** - Vulnerability scanning

#### Advanced Agents
- **email-automator** - Email campaign management
- **database-manager** - Database operations and optimization
- **cloud-orchestrator** - Multi-cloud infrastructure management
- **ml-pipeline-manager** - Machine learning pipelines
- **workflow-orchestrator** - Complex workflow automation
- **real-time-monitor** - Real-time monitoring and alerting

### Use Case Ecosystems

Deploy complete agent ecosystems for specific scenarios:

- **web-development** - Full web dev stack (scraper, content, testing, deployment)
- **data-analysis** - Data processing pipeline (collection, analysis, visualization)
- **content-marketing** - Content creation and distribution pipeline
- **devops** - CI/CD and infrastructure management
- **full-stack-automation** - Complete automation stack
- **business-automation** - Business process automation
- **ml-operations** - MLOps pipeline
- **enterprise-integration** - Enterprise system integration

## Troubleshooting

### Server Not Starting

**Problem**: MCP server fails to start

**Solution**:
1. Verify the build completed successfully:
   ```bash
   npm run build
   ls -la dist/index.js
   ```
2. Check for port conflicts (default: 8787)
3. Review logs for error messages

### Connection Refused

**Problem**: Cannot connect to WebSocket server

**Solution**:
1. Verify `ENABLE_STREAMING` is set to `true`
2. Check firewall settings for port 8787
3. Ensure server is running: `curl http://127.0.0.1:8787`

### Agent Not Found

**Problem**: "Unknown agent" error

**Solution**:
1. List available agents: use `list_agents` action
2. Deploy required agent if not present
3. Check agent ID spelling

### Permission Denied

**Problem**: Agent lacks required permissions

**Solution**:
1. Check agent permissions: use `get_permissions` action
2. Grant required permissions: use `grant_permission` action
3. Review agent category permissions in source code

## Monitoring and Metrics

Enable metrics endpoint to monitor server health:

```bash
# Set metrics port (optional)
export METRICS_PORT=9090
npm start
```

Access metrics:
- **Health**: `http://localhost:9090/healthz`
- **Metrics**: `http://localhost:9090/metrics` (Prometheus format)
- **Demo**: `http://localhost:9090/demo?msg=test&agent=echo`

## Security Considerations

### Token Authentication

For production deployments, enable token authentication:

```bash
export STREAM_TOKEN="your-secure-token-here"
npm start
```

Include the token in WebSocket connections:
```javascript
const ws = new WebSocket('ws://127.0.0.1:8787?token=your-secure-token-here');
```

### Permission Management

Agents operate with category-based permissions:
- **web_automation**: network, file read/write
- **content_creation**: file read/write
- **devops**: full permissions (use carefully)
- **security**: file read, network, system read

Use `grant_permission` and `revoke_permission` to manage access.

### Network Security

- Bind to `127.0.0.1` (localhost) by default
- Use VPN or SSH tunnels for remote access
- Enable firewall rules for the WebSocket port
- Consider TLS/SSL for production (requires proxy)

## Performance Tuning

### Concurrency

Adjust concurrent operations based on your hardware:

```bash
# For powerful machines
export MAX_CONCURRENCY=100
export MAX_QUEUE_SIZE=20000

# For resource-constrained environments
export MAX_CONCURRENCY=10
export MAX_QUEUE_SIZE=1000
```

### Memory

Increase Node.js memory for large workloads:

```json
{
  "env": {
    "NODE_OPTIONS": "--max-old-space-size=4096"
  }
}
```

### Logging

Reduce log verbosity in production:

```bash
export LOG_LEVEL=warn
```

## Best Practices

1. **Start Small**: Begin with basic agent operations before deploying ecosystems
2. **Monitor Resources**: Watch memory and CPU usage during agent execution
3. **Use Idempotency**: Include `idempotencyKey` for critical operations
4. **Handle Errors**: Always check operation status with `get_status`
5. **Clean Up**: Close sessions with `close_session` when done
6. **Test Locally**: Validate agents locally before production deployment
7. **Version Control**: Track agent configurations in your repository
8. **Document Agents**: Add clear descriptions to custom agents

## Integration with CI/CD

Use A2A agents in GitHub Actions workflows:

```yaml
name: Deploy with A2A
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup A2A
        run: |
          npm install
          npm run build
      - name: Deploy with Agent
        run: |
          node dist/index.js &
          # Your deployment script using A2A
```

## Support and Resources

- **Documentation**: [README.md](../README.md)
- **Issues**: [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Scarmonit/A2A/discussions)
- **MCP Specification**: [Model Context Protocol](https://modelcontextprotocol.io/)

## Contributing

Found a way to improve Copilot integration? We welcome contributions!

See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](../LICENSE) for details.
