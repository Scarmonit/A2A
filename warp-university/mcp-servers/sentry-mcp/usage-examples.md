# Sentry MCP Usage Examples

## Overview
Error tracking and performance monitoring examples using Sentry MCP.

## Example 1: Query Errors
```javascript
const errors = await mcp.call('sentry', {
  method: 'getIssues',
  project: 'my-project',
  filter: { status: 'unresolved', level: 'error' }
});
```

## Example 2: Create Release
```javascript
const release = await mcp.call('sentry', {
  method: 'createRelease',
  version: 'v1.0.0',
  projects: ['my-project']
});
```

## Example 3: Performance Monitoring
```javascript
const metrics = await mcp.call('sentry', {
  method: 'getMetrics',
  project: 'my-project',
  period: '7d'
});
```

## Best Practices
- Set up proper alerts
- Tag releases consistently
- Monitor performance thresholds
