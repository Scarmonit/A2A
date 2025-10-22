# VS Code Configuration for A2A

This directory contains VS Code-specific configuration files for the A2A MCP Server.

## Files

### settings.example.json

Example VS Code settings for GitHub Copilot integration with A2A.

**To use:**

1. Copy to `settings.json`:
   ```bash
   cp settings.example.json settings.json
   ```

2. Or add the configuration to your existing `settings.json`

**Note:** The `settings.json` file is gitignored to prevent committing user-specific configurations.

## What This Enables

When configured, GitHub Copilot in VS Code can:

- **Deploy Agents**: Create specialized agents (web scraper, content writer, data analyst, etc.)
- **Execute Tools**: Run parallel commands, file operations, and more
- **Manage Workflows**: Orchestrate complex multi-agent workflows
- **Real-time Streaming**: Get live updates via WebSocket
- **Permission Control**: Fine-grained permission management

## Configuration Variables

The configuration uses VS Code variables:

- `${workspaceFolder}` - Automatically resolves to your workspace root

## Environment Variables

Customize server behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_STREAMING` | `true` | Enable WebSocket streaming |
| `STREAM_PORT` | `8787` | WebSocket server port |
| `STREAM_HOST` | `127.0.0.1` | WebSocket bind address |
| `MAX_CONCURRENCY` | `50` | Max concurrent operations |
| `LOG_LEVEL` | `info` | Logging level |

## Quick Test

After configuration:

1. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Ask Copilot: "List all available A2A agents"
3. You should see a response with agent listings

## Troubleshooting

**Server not responding?**
- Verify build completed: `npm run build`
- Check `dist/index.js` exists
- Review VS Code Output panel for errors

**Port conflict?**
- Change `STREAM_PORT` in environment variables
- Default is 8787

## Documentation

- [Complete Integration Guide](../docs/COPILOT_INTEGRATION.md)
- [Quick Start (5 min)](../docs/COPILOT_QUICKSTART.md)
- [Working Examples](../examples/copilot-integration-example.ts)

## Support

- [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
- [Main README](../README.md)
