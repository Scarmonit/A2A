# MCP Servers

This directory contains Model Context Protocol (MCP) server implementations for integrating external systems into Warp workflows.

## Implementations

- Figma MCP
- Linear MCP
- Puppeteer MCP
- Sentry MCP
- Context7 MCP

Each implementation includes:
- Setup instructions
- Environment configuration
- Available tools and schemas
- Example Warp usage

## Figma MCP
- Tools: search_components, export_assets, list_files
- Env: FIGMA_API_TOKEN
- Start: npm run mcp:figma

## Linear MCP
- Tools: create_issue, search_issues, sprint_summary
- Env: LINEAR_API_KEY, LINEAR_TEAM_ID
- Start: npm run mcp:linear

## Puppeteer MCP
- Tools: navigate, click, type, screenshot, extract
- Env: none (optional: PROXY_URL)
- Start: npm run mcp:puppeteer

## Sentry MCP
- Tools: query_issues, release_health, alerts
- Env: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT
- Start: npm run mcp:sentry

## Context7 MCP
- Tools: fetch_context, session_state, memory_write
- Env: CONTEXT7_API_KEY
- Start: npm run mcp:context7

## Directory Layout
```
mcp-servers/
  figma-mcp/
  linear-mcp/
  puppeteer-mcp/
  sentry-mcp/
  context7-mcp/
  README.md
```

## Warp Usage Examples
```bash
# Query Linear issues via MCP tool
warp workflow run issues
@mcp.linear.search_issues "status:In Progress assignee:me"

# Export Figma assets
@mcp.figma.export_assets --file XYZ --ids 12:34,56:78 --format png

# Capture Puppeteer screenshot
@mcp.puppeteer.screenshot https://example.com --out screenshot.png

# Check Sentry release health
@mcp.sentry.release_health my-service@1.2.3

# Fetch enriched context
@mcp.context7.fetch_context --session current
```
