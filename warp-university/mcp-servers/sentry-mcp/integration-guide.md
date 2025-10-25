# Sentry MCP Integration Guide

## Overview
Setup instructions for Sentry MCP server integration.

## Prerequisites
- Sentry account
- Organization with API access
- MCP client configured

## Installation
```bash
npm install -g @modelcontextprotocol/server-sentry
```

## Configuration
1. Get Sentry Auth Token from Settings > API
2. Add to MCP config:
```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sentry"],
      "env": {
        "SENTRY_AUTH_TOKEN": "your-token",
        "SENTRY_ORG": "your-org-slug"
      }
    }
  }
}
```

## Verification
- Query recent issues
- Check project access

## Next Steps
- Review [usage-examples.md](./usage-examples.md)
- Configure alert rules
