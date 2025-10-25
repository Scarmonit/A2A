# Figma MCP Integration Guide

## Overview
This guide provides step-by-step instructions for setting up and integrating the Figma MCP server into your development environment.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Figma account with API access
- MCP client configured (Claude Desktop, Cursor, or compatible)

## Installation

### Step 1: Install the Figma MCP Server

```bash
npm install -g @modelcontextprotocol/server-figma
```

### Step 2: Generate Figma Access Token

1. Log in to your Figma account
2. Go to Settings > Account > Personal Access Tokens
3. Click "Generate new token"
4. Give it a descriptive name (e.g., "MCP Server Access")
5. Copy the token (you won't be able to see it again)

### Step 3: Configure MCP Client

Add the following configuration to your MCP client settings file:

#### For Claude Desktop (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-figma"],
      "env": {
        "FIGMA_PERSONAL_ACCESS_TOKEN": "your-token-here"
      }
    }
  }
}
```

#### For Cursor or other editors:

Refer to your editor's MCP configuration documentation and adapt the above config accordingly.

### Step 4: Restart Your MCP Client

Restart your application to load the new configuration.

## Verification

To verify the integration is working:

1. Open your MCP client
2. Try accessing a Figma file
3. Request component information or design tokens
4. Check for successful responses

## Configuration Options

You can customize the server behavior with additional environment variables:

- `FIGMA_PERSONAL_ACCESS_TOKEN` (required): Your Figma API token
- `FIGMA_API_BASE_URL` (optional): Custom API endpoint (defaults to official Figma API)
- `FIGMA_CACHE_ENABLED` (optional): Enable caching for better performance
- `FIGMA_TIMEOUT` (optional): API request timeout in milliseconds

## Troubleshooting

### Common Issues

**Problem**: "Authentication failed" error
- **Solution**: Verify your token is correctly set in the configuration
- Check token hasn't expired
- Ensure no extra spaces in the token string

**Problem**: "File not found" error
- **Solution**: Verify you have access to the Figma file
- Check file key is correct
- Ensure file is not private or you lack permissions

**Problem**: Server not responding
- **Solution**: Check MCP client logs
- Verify Node.js version compatibility
- Restart the MCP client

## Security Best Practices

1. **Never commit tokens to version control**
2. Use environment variables for sensitive data
3. Rotate tokens regularly
4. Use read-only tokens when possible
5. Monitor token usage in Figma settings

## Next Steps

- Review [usage-examples.md](./usage-examples.md) for practical examples
- Check Figma API documentation for advanced features
- Explore integration with your development workflow

## Support

For issues or questions:
- Check the official MCP documentation
- Review Figma API docs: https://www.figma.com/developers/api
- Open an issue in this repository
