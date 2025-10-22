# GitHub Copilot MCP Configuration

This directory contains configuration files for integrating the A2A MCP Server with GitHub Copilot.

## Files

### mcp-config.json

Standard MCP configuration file that can be used to configure GitHub Copilot to use the A2A server.

**Usage:**

1. **For VS Code**: Add this configuration to your VS Code settings (`.vscode/settings.json` or User Settings)
2. **For Claude Desktop**: Use this as reference for the Claude Desktop config file
3. **For other MCP clients**: Adapt as needed for your specific client

**Configuration Options:**

- `command`: The Node.js executable
- `args`: Path to the compiled server (supports `${workspaceFolder}` variable)
- `env`: Environment variables for server configuration
  - `ENABLE_STREAMING`: Enable WebSocket streaming (default: true)
  - `STREAM_PORT`: WebSocket server port (default: 8787)
  - `STREAM_HOST`: WebSocket bind address (default: 127.0.0.1)
  - `MAX_CONCURRENCY`: Maximum concurrent operations (default: 50)
  - `MAX_QUEUE_SIZE`: Maximum queue size (default: 10000)
  - `LOG_LEVEL`: Logging level (info, debug, warn, error)

## Quick Setup for VS Code

1. Build the A2A server:
   ```bash
   npm install && npm run build
   ```

2. Copy the example settings:
   ```bash
   cp ../.vscode/settings.example.json ../.vscode/settings.json
   ```

3. Or manually add to your VS Code settings:
   ```json
   {
     "github.copilot.advanced": {
       "mcpServers": {
         "a2a-agent-server": {
           "command": "node",
           "args": ["${workspaceFolder}/dist/index.js"],
           "env": {
             "ENABLE_STREAMING": "true",
             "LOG_LEVEL": "info"
           }
         }
       }
     }
   }
   ```

4. Reload VS Code window

## Documentation

For complete setup instructions, troubleshooting, and usage examples, see:

- [Complete Integration Guide](../../docs/COPILOT_INTEGRATION.md)
- [Quick Start Guide](../../docs/COPILOT_QUICKSTART.md)
- [Working Examples](../../examples/copilot-integration-example.ts)

## Support

- [Main README](../../README.md)
- [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
- [GitHub Discussions](https://github.com/Scarmonit/A2A/discussions)
