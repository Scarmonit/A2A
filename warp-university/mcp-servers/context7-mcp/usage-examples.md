# Context7 MCP Usage Examples

## Overview
Context management and knowledge base examples using Context7 MCP.

## Example 1: Search Knowledge Base
```javascript
const results = await mcp.call('context7', {
  method: 'search',
  query: 'authentication best practices',
  limit: 10
});
```

## Example 2: Index Documents
```javascript
const indexed = await mcp.call('context7', {
  method: 'indexDocument',
  document: {
    title: 'API Documentation',
    content: '...'
  }
});
```

## Example 3: Get Context
```javascript
const context = await mcp.call('context7', {
  method: 'getContext',
  topic: 'user-authentication',
  maxTokens: 5000
});
```

## Best Practices
- Structure documents clearly
- Use semantic tagging
- Maintain up-to-date indices
- Optimize context window size
