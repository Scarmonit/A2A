# Linear MCP Integration Guide

## Overview
Step-by-step setup instructions for integrating Linear MCP server into your development environment.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Linear account with API access
- MCP client configured

## Installation

### Step 1: Install Linear MCP Server

```bash
npm install -g @modelcontextprotocol/server-linear
```

### Step 2: Generate Linear API Key

1. Log in to your Linear workspace
2. Go to Settings > API
3. Click "Create new API key"
4. Give it a name (e.g., "MCP Server")
5. Set appropriate permissions (read/write)
6. Copy the API key

### Step 3: Configure MCP Client

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "linear": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-linear"],
      "env": {
        "LINEAR_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Step 4: Restart MCP Client

Restart your application to apply changes.

## Verification

1. Open your MCP client
2. Query for Linear issues
3. Create a test issue
4. Verify data syncs correctly

## Configuration Options

- `LINEAR_API_KEY` (required): Your Linear API key
- `LINEAR_WEBHOOK_SECRET` (optional): For webhook integration
- `LINEAR_TEAM_ID` (optional): Default team ID

## Troubleshooting

**Authentication Error**
- Verify API key is correct
- Check key hasn't been revoked
- Ensure proper permissions

**Rate Limiting**
- Linear has API rate limits
- Implement request caching
- Use webhooks for real-time updates

## Security

1. Never commit API keys to version control
2. Use environment variables
3. Rotate keys regularly
4. Monitor API usage

## Next Steps

- Review [usage-examples.md](./usage-examples.md)
- Set up Linear webhooks for automation
- Configure team-specific workflows
