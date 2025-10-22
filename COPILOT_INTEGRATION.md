# GitHub Copilot Integration Guide

## Overview

This guide shows you how to integrate the A2A MCP Server with GitHub Copilot to supercharge your development workflow with intelligent agent orchestration.

## What You Get

When you integrate A2A with GitHub Copilot, you gain access to:

- **30+ Pre-built Agents**: Web scrapers, content writers, API testers, database managers, and more
- **Agent Orchestration**: Create complex multi-agent workflows
- **Real-time Streaming**: WebSocket-based streaming for live agent communication
- **Tool Sharing**: Agents can share capabilities with each other
- **Permission Management**: Fine-grained access control between agents
- **Parallel Execution**: Run multiple commands and agents concurrently
- **Ecosystem Templates**: Pre-configured agent groups for common use cases

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm 9.x or higher
- GitHub Copilot installed and configured

### Step 1: Install and Build

```bash
# Clone the repository (if not already done)
git clone https://github.com/Scarmonit/A2A.git
cd A2A

# Install dependencies
npm install

# Build the project
npm run build
```

### Step 2: Configure GitHub Copilot

#### For GitHub Copilot CLI

Create or edit your MCP configuration file at `~/.config/github-copilot/mcp.json`:

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["/absolute/path/to/A2A/dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "STREAM_PORT": "8787",
        "MAX_CONCURRENCY": "50",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

**Important**: Replace `/absolute/path/to/A2A` with the actual absolute path to your A2A installation.

#### For Claude Desktop (Alternative)

If you're using Claude Desktop, add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["/absolute/path/to/A2A/dist/index.js"]
    }
  }
}
```

### Step 3: Restart Copilot

Restart GitHub Copilot or Claude Desktop to load the new MCP server configuration.

### Step 4: Verify Installation

Ask Copilot to use the A2A server:

```
@a2a list all available agents
```

You should see a list of available agents including echo, web-scraper, content-writer, data-analyst, and more.

## Configuration Options

### Environment Variables

Configure the A2A MCP Server behavior with these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_STREAMING` | `true` | Enable WebSocket streaming |
| `STREAM_PORT` | `8787` | WebSocket server port |
| `STREAM_HOST` | `127.0.0.1` | WebSocket server host |
| `MAX_CONCURRENCY` | `50` | Maximum concurrent agent executions |
| `MAX_QUEUE_SIZE` | `10000` | Maximum request queue size |
| `LOG_LEVEL` | `info` | Logging level (debug, info, warn, error) |
| `METRICS_PORT` | `0` | Prometheus metrics port (0=disabled) |
| `REQUEST_TTL_MS` | `300000` | Request retention time (5 minutes) |
| `IDEMP_TTL_MS` | `900000` | Idempotency key TTL (15 minutes) |

### Preset Configurations

We provide several preset configurations for common use cases. Use the `.copilot-mcp.json` file to select a preset:

#### Web Development

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "INITIAL_AGENTS": "web-scraper,content-writer,api-tester"
      }
    }
  }
}
```

#### Data Analysis

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "INITIAL_AGENTS": "data-analyst,content-writer"
      }
    }
  }
}
```

#### DevOps

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "INITIAL_AGENTS": "deploy-manager,security-scanner,real-time-monitor"
      }
    }
  }
}
```

#### Full Automation

```json
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "MAX_CONCURRENCY": "100",
        "INITIAL_AGENTS": "workflow-orchestrator,email-automator,database-manager"
      }
    }
  }
}
```

## Using A2A with Copilot

### Basic Commands

#### List All Agents

```
@a2a list all available agents
```

#### Describe an Agent

```
@a2a describe the web-scraper agent
```

#### Invoke an Agent

```
@a2a invoke the web-scraper agent to scrape https://example.com
```

### Advanced Usage

#### Create Custom Agent Ecosystem

```
@a2a create a custom agent ecosystem for web development including a scraper, 
content generator, and API tester
```

#### Deploy Multiple Agents

```
@a2a deploy 5 data processing agents with template { category: "data_processing", 
tags: ["analytics", "reporting"] }
```

#### Share Tools Between Agents

```
@a2a share the "export_data" tool from data-analyst agent to content-writer agent
```

#### Manage Permissions

```
@a2a grant file:write permission to agent-123 for accessing shared resources
```

## Agent Categories

### Enhanced Agents

- **web-scraper**: Advanced web scraping with pagination and data extraction
- **content-writer**: SEO-optimized content generation with multiple formats
- **data-analyst**: Comprehensive data analysis with visualization
- **api-tester**: Automated API testing with performance metrics
- **deploy-manager**: Multi-platform deployment automation
- **security-scanner**: Vulnerability scanning and compliance checking

### Advanced Agents

- **email-automator**: SMTP integration with campaign tracking
- **database-manager**: Multi-database support with query optimization
- **cloud-orchestrator**: Multi-cloud deployment and cost optimization
- **ml-pipeline-manager**: End-to-end ML pipeline automation
- **workflow-orchestrator**: Complex workflow management
- **real-time-monitor**: Real-time metrics and intelligent alerting

### Practical Tools

Execute standalone tools without agent invocation:

- **http-request**: Make HTTP requests
- **read-file**: Read file contents
- **write-file**: Write to files
- **execute-command**: Run shell commands
- **parse-json**: Parse JSON data
- **format-data**: Format data in various formats
- **validate-schema**: Validate data against schemas
- **transform-data**: Transform data structures

## Use Cases

### 1. Web Development Workflow

```
@a2a create an agent ecosystem for web development

Then invoke:
- web-scraper to analyze competitor sites
- api-tester to validate your endpoints
- content-writer to generate documentation
```

### 2. Data Processing Pipeline

```
@a2a create a data analysis ecosystem

Then:
- data-analyst to process datasets
- content-writer to generate reports
- deploy-manager to publish results
```

### 3. DevOps Automation

```
@a2a create a devops ecosystem

Then:
- security-scanner to check vulnerabilities
- deploy-manager to deploy to multiple platforms
- real-time-monitor to track deployment health
```

### 4. Content Marketing

```
@a2a create a content marketing ecosystem

Then:
- web-scraper for research
- content-writer for article generation
- api-tester for SEO validation
```

## Real-time Streaming

The A2A server includes WebSocket streaming for real-time agent communication. When you invoke an agent, you'll receive:

1. **Start Event**: Agent execution begins
2. **Chunk Events**: Progress updates and partial results
3. **Final Event**: Complete results with metadata
4. **Error Events**: Any errors that occur

The streaming URL is automatically provided in the response:

```json
{
  "ok": true,
  "data": {
    "requestId": "req-abc123",
    "status": "queued",
    "streamUrl": "ws://127.0.0.1:8787/channels/req-abc123"
  }
}
```

## Monitoring and Metrics

Enable Prometheus metrics by setting `METRICS_PORT`:

```json
{
  "env": {
    "METRICS_PORT": "9090"
  }
}
```

Then access:
- Metrics: `http://localhost:9090/metrics`
- Health: `http://localhost:9090/healthz`

Available metrics:
- `a2a_requests_created_total`: Total requests created
- `a2a_requests_completed_total`: Completed requests by status
- `a2a_running_jobs`: Currently running jobs
- `a2a_queue_size`: Request queue size
- `a2a_total_agents`: Total deployed agents
- `a2a_enabled_agents`: Currently enabled agents
- `a2a_ws_clients`: WebSocket client count
- `a2a_ws_channels`: Active WebSocket channels

## Troubleshooting

### Copilot Can't Find the A2A Server

1. Check the path in your configuration is absolute and correct
2. Verify the server builds successfully: `npm run build`
3. Check the dist/index.js file exists
4. Restart Copilot/Claude Desktop

### Agent Invocation Fails

1. Check LOG_LEVEL=debug for detailed logs
2. Verify the agent exists: `@a2a list all agents`
3. Check permissions if using advanced features
4. Ensure WebSocket port 8787 is not in use

### Streaming Connection Issues

1. Verify ENABLE_STREAMING=true
2. Check STREAM_PORT is not blocked by firewall
3. Ensure WebSocket server started (check logs)
4. Try a different port if 8787 is in use

### Performance Issues

1. Adjust MAX_CONCURRENCY for your workload
2. Increase MAX_QUEUE_SIZE if requests are rejected
3. Monitor metrics at /metrics endpoint
4. Consider running on a dedicated machine

## Advanced Configuration

### Custom Agent Development

Create your own agents programmatically:

```typescript
import { agentRegistry } from './src/agents';

const customAgent = {
  id: 'my-custom-agent',
  name: 'My Custom Agent',
  description: 'A specialized agent for my workflow',
  category: 'custom',
  tags: ['specialized', 'custom'],
  enabled: true,
  capabilities: [
    {
      name: 'process',
      description: 'Process custom data',
      inputSchema: { type: 'object', properties: { data: { type: 'string' } } },
      outputSchema: { type: 'object' }
    }
  ]
};

agentRegistry.deploy(customAgent);
```

### Multi-Agent Workflows

Chain multiple agents together:

```
@a2a First invoke web-scraper to get data from site, then pass results to 
data-analyst for processing, finally use content-writer to generate a report
```

The handoff capability automatically manages context between agents.

## Security Considerations

1. **Permissions**: Always use the minimum required permissions
2. **Rate Limits**: Configure appropriate rate limits for production
3. **Authentication**: Enable requireAuth for production deployments
4. **Network**: Keep WebSocket server on localhost or secure network
5. **Secrets**: Never commit tokens or credentials to configuration
6. **Monitoring**: Enable metrics and alerting for production use

## Best Practices

1. **Start Small**: Begin with a single agent, expand as needed
2. **Use Presets**: Leverage preset configurations for common use cases
3. **Monitor Performance**: Track metrics to optimize concurrency
4. **Enable Streaming**: Real-time feedback improves UX
5. **Version Control**: Keep configuration files in version control
6. **Documentation**: Document custom agents and workflows
7. **Testing**: Test agent interactions before production use
8. **Backup**: Back up agent configurations and data

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Scarmonit/A2A/discussions)
- **Documentation**: [Full Documentation](./README.md)
- **Examples**: Check the `examples/` directory

## What's Next?

- Explore the [Parallel Execution Guide](./docs/PARALLEL_EXECUTION_GUIDE.md)
- Learn about [Greenlet Integration](./docs/GREENLET_A2A_GUIDE.md)
- Check out [Deployment Options](./YOUR_DEPLOYMENT.md)
- Review [Security Best Practices](./SECURITY.md)

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
