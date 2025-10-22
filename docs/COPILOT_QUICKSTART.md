# Quick Start: GitHub Copilot + A2A

Get GitHub Copilot working with A2A MCP Server in under 5 minutes.

## Prerequisites

- VS Code with GitHub Copilot extension
- Node.js 20+ installed
- A2A repository cloned

## Setup Steps

### 1. Build A2A (1 minute)

```bash
cd /path/to/A2A
npm install
npm run build
```

Wait for "Compiled successfully" message.

### 2. Configure VS Code (2 minutes)

**Option A: Workspace Settings (Recommended)**

Create/edit `.vscode/settings.json` in your project:

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

**Option B: Copy Template**

```bash
cp .vscode/settings.example.json .vscode/settings.json
```

**Option C: User Settings**

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Type "Preferences: Open User Settings (JSON)"
3. Add the configuration from Option A
4. Replace `${workspaceFolder}` with absolute path to A2A

### 3. Restart VS Code (1 minute)

1. Command Palette → "Developer: Reload Window"
2. Or restart VS Code completely

### 4. Verify (1 minute)

Ask Copilot: **"List all available A2A agents"**

You should see a response listing agents like:
- echo - Simple echo agent
- file-agent - File operations
- web-scraper - Advanced web scraping
- etc.

## What Can You Do Now?

### Deploy Specialized Agents

**"Create a web scraper agent to extract data from GitHub"**

### Execute Parallel Commands

**"Run npm build, test, and lint in parallel"**

### Manage Files

**"Use A2A to create a new TypeScript file with a basic class structure"**

### Get Agent Info

**"Show me details about the data-analyst agent"**

### Create Agent Ecosystems

**"Deploy a complete web development ecosystem with A2A"**

## Troubleshooting

### "Server not responding"

1. Check if build succeeded:
   ```bash
   ls -la dist/index.js
   ```

2. Test server manually:
   ```bash
   node dist/index.js
   ```
   Should show "A2A MCP server ready"

### "Cannot find module"

Run build again:
```bash
npm run build
```

### "Port already in use"

Change the port in settings:
```json
{
  "env": {
    "STREAM_PORT": "8788"
  }
}
```

## Next Steps

- Read the full [Copilot Integration Guide](./COPILOT_INTEGRATION.md)
- Explore [Available Agent Types](./COPILOT_INTEGRATION.md#custom-agent-types)
- Learn about [WebSocket Streaming](./COPILOT_INTEGRATION.md#websocket-streaming)
- Check out [Advanced Configuration](./COPILOT_INTEGRATION.md#advanced-configuration)

## Need Help?

- [Documentation](../README.md)
- [GitHub Issues](https://github.com/Scarmonit/A2A/issues)
- [Discussions](https://github.com/Scarmonit/A2A/discussions)
