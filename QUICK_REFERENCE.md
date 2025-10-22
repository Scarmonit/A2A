# A2A MCP Server - Quick Reference Card

## Installation & Setup

```bash
# 1. Clone and install
git clone https://github.com/Scarmonit/A2A.git
cd A2A
npm install
npm run build

# 2. Configure Copilot (automated)
./setup-copilot.sh        # Linux/macOS
.\setup-copilot.ps1       # Windows

# 3. Restart GitHub Copilot or Claude Desktop
```

## Essential Commands

### Agent Management
| Action | Command |
|--------|---------|
| List agents | `@a2a list all available agents` |
| Describe agent | `@a2a describe the web-scraper agent` |
| Invoke agent | `@a2a invoke the web-scraper agent to scrape https://example.com` |
| Deploy agent | `@a2a deploy a new agent with id 'custom-agent'` |
| Enable/Disable | `@a2a enable agent custom-agent` |

### Agent Ecosystems
| Use Case | Command |
|----------|---------|
| Web Dev | `@a2a create an agent ecosystem for web development` |
| Data Analysis | `@a2a create an agent ecosystem for data-analysis` |
| DevOps | `@a2a create an agent ecosystem for devops` |
| Custom | `@a2a create a custom ecosystem with [agent types]` |

### Tool Management
| Action | Command |
|--------|---------|
| Share tool | `@a2a share tool 'export_data' from data-analyst to content-writer` |
| Discover tools | `@a2a discover tools available in the system` |
| Execute tool | `@a2a execute practical tool 'http-request' with params {...}` |

## Available Agents

### Enhanced Agents
- **web-scraper** - Web scraping with pagination
- **content-writer** - SEO-optimized content generation
- **data-analyst** - Data analysis and visualization
- **api-tester** - Automated API testing
- **deploy-manager** - Multi-platform deployment
- **security-scanner** - Vulnerability scanning

### Advanced Agents
- **email-automator** - Email campaigns and tracking
- **database-manager** - Database optimization
- **cloud-orchestrator** - Multi-cloud deployment
- **ml-pipeline-manager** - ML pipeline automation
- **workflow-orchestrator** - Complex workflows
- **real-time-monitor** - Real-time monitoring

## Environment Variables

```bash
ENABLE_STREAMING=true      # Enable WebSocket streaming
STREAM_PORT=8787           # WebSocket port
MAX_CONCURRENCY=50         # Max concurrent operations
LOG_LEVEL=info             # Logging level
METRICS_PORT=9090          # Prometheus metrics (0=disabled)
```

## Common Use Cases

### 1. Web Scraping & Analysis
```
@a2a invoke web-scraper to analyze competitor site https://example.com,
then use data-analyst to process the data, finally use content-writer
to generate a comparison report
```

### 2. API Testing Suite
```
@a2a invoke api-tester to test all endpoints in my OpenAPI spec,
generate performance report, and identify slow endpoints
```

### 3. Multi-Platform Deployment
```
@a2a invoke deploy-manager to deploy my app to Railway, Render,
and Fly.io in parallel, then monitor health
```

### 4. Content Generation Pipeline
```
@a2a use web-scraper for research, data-analyst for insights,
content-writer for article, and api-tester for SEO validation
```

### 5. Security Audit
```
@a2a invoke security-scanner to scan my project for vulnerabilities,
check dependencies, and generate remediation report
```

## WebSocket Streaming

When you invoke an agent, you get a stream URL:
```json
{
  "requestId": "req-abc123",
  "streamUrl": "ws://127.0.0.1:8787/channels/req-abc123"
}
```

Connect with WebSocket client to receive real-time updates:
- `start` - Operation begins
- `chunk` - Progress updates
- `final` - Complete results
- `error` - Error events

## Monitoring

Access metrics at:
- `http://localhost:9090/metrics` - Prometheus metrics
- `http://localhost:9090/healthz` - Health check

Key metrics:
- `a2a_requests_created_total` - Total requests
- `a2a_running_jobs` - Active jobs
- `a2a_total_agents` - Total agents
- `a2a_ws_clients` - WebSocket connections

## Configuration Files

```
~/.config/github-copilot/mcp.json     # Copilot CLI config
~/Library/Application Support/Claude/  # Claude Desktop (macOS)
%APPDATA%\Claude\                      # Claude Desktop (Windows)
```

## Troubleshooting

### Copilot can't find server
- Check path in config is absolute
- Verify `npm run build` succeeds
- Restart Copilot/Claude Desktop

### Agent invocation fails
- Set LOG_LEVEL=debug for details
- Verify agent exists: `@a2a list all agents`
- Check WebSocket port 8787 is available

### Performance issues
- Adjust MAX_CONCURRENCY
- Monitor metrics endpoint
- Check system resources

## Quick Links

- 📖 [Full Documentation](./COPILOT_INTEGRATION.md)
- 🚀 [Quick Deploy Guide](./QUICK_DEPLOY.md)
- 💡 [Examples](./examples/copilot-usage-examples.md)
- 🐛 [Issues](https://github.com/Scarmonit/A2A/issues)
- 💬 [Discussions](https://github.com/Scarmonit/A2A/discussions)

## Pro Tips

1. **Use Presets**: Start with ecosystem presets for common use cases
2. **Enable Streaming**: Real-time feedback improves development experience
3. **Monitor Metrics**: Track performance to optimize configuration
4. **Share Tools**: Create reusable tools and share between agents
5. **Batch Operations**: Deploy multiple agents at once for efficiency
6. **Handoff**: Chain agents together for complex workflows
7. **Permissions**: Use fine-grained permissions for security

## Support

Need help? Check:
1. This quick reference card
2. [COPILOT_INTEGRATION.md](./COPILOT_INTEGRATION.md)
3. [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
4. [GitHub Discussions](https://github.com/Scarmonit/A2A/discussions)

---

**Version**: 0.1.0  
**Last Updated**: 2025-10-22  
**License**: MIT
