# Copilot Integration Examples for A2A MCP Server

This file contains examples of how to use the A2A MCP Server with GitHub Copilot.

## Example 1: List Available Agents
**Ask Copilot:** `@a2a list all available agents`

**Expected response:** A list of all deployed agents with their capabilities

## Example 2: Create a Web Development Ecosystem
**Ask Copilot:** `@a2a create an agent ecosystem for web development`

**This will deploy:**
- web-scraper: For analyzing competitor sites
- content-writer: For generating documentation
- api-tester: For validating endpoints

## Example 3: Scrape and Analyze Website
**Ask Copilot:** `@a2a invoke the web-scraper agent to scrape https://example.com and extract all links and headings`

**This will:**
1. Invoke the web-scraper agent
2. Extract data from the specified URL
3. Return structured data with links and headings

## Example 4: Generate SEO Content
**Ask Copilot:** `@a2a invoke the content-writer agent to generate an SEO-optimized blog post about TypeScript best practices, targeting developers`

**This will:**
1. Invoke the content-writer agent
2. Generate SEO-optimized content
3. Return the article with proper headings and keywords

## Example 5: Multi-Agent Workflow
**Ask Copilot:** `@a2a First use web-scraper to analyze top 5 JavaScript frameworks, then pass the data to data-analyst for comparison, finally use content-writer to create a comprehensive report`

**This will:**
1. Invoke web-scraper to collect data
2. Hand off to data-analyst for processing
3. Hand off to content-writer for report generation
4. Return the complete report

## Example 6: Deploy Custom Agent
**Ask Copilot:** `@a2a deploy a new agent with id 'sentiment-analyzer', category 'data_processing', and capability 'analyze' for sentiment analysis`

**This will:**
1. Create a custom agent configuration
2. Deploy it to the A2A system
3. Make it available for invocation

## Example 7: Batch Agent Deployment
**Ask Copilot:** `@a2a deploy 10 data processing agents with template {category: 'data_processing', tags: ['analytics', 'reporting']}`

**This will:**
1. Generate 10 agents based on the template
2. Deploy them in batch
3. Return deployment status

## Example 8: Share Tools Between Agents
**Ask Copilot:** `@a2a share the 'export_data' tool from data-analyst agent to content-writer agent with read-only permissions`

**This will:**
1. Create a tool sharing agreement
2. Set appropriate permissions
3. Enable content-writer to use data-analyst's export tool

## Example 9: Monitor Agent Performance
**Ask Copilot:** `@a2a get system statistics and show agent utilization`

**This will return:**
- Total agents
- Enabled agents
- Running jobs
- Queue size
- Memory usage

## Example 10: Real-time Streaming
**Ask Copilot:** `@a2a invoke the ml-pipeline-manager agent to train a model and stream progress updates`

**This will:**
1. Start the ML training process
2. Stream progress events via WebSocket
3. Return final results when complete

## Example 11: Security Scanning
**Ask Copilot:** `@a2a invoke the security-scanner agent to scan my project for vulnerabilities and generate a report`

**This will:**
1. Scan the codebase for security issues
2. Check dependencies for vulnerabilities
3. Generate a comprehensive security report

## Example 12: Deploy to Multiple Platforms
**Ask Copilot:** `@a2a invoke the deploy-manager agent to deploy my app to Railway, Render, and Fly.io simultaneously`

**This will:**
1. Prepare deployment for each platform
2. Execute deployments in parallel
3. Monitor deployment status
4. Return deployment URLs

## Example 13: Database Operations
**Ask Copilot:** `@a2a invoke the database-manager agent to optimize my PostgreSQL database and create performance report`

**This will:**
1. Analyze database schema
2. Identify optimization opportunities
3. Apply optimizations
4. Generate performance report

## Example 14: Email Campaign Automation
**Ask Copilot:** `@a2a invoke the email-automator agent to create and send a newsletter to my subscriber list with tracking`

**This will:**
1. Generate email content
2. Send to subscriber list
3. Track open rates and clicks
4. Return campaign metrics

## Example 15: Advanced Filtering
**Ask Copilot:** `@a2a filter agents by category 'data_processing' and tags ['analytics', 'reporting'] that are currently enabled`

**This will:**
1. Apply filters to agent list
2. Return matching agents
3. Show their current status

## Programmatic Usage Examples

If you need to use A2A programmatically in your code:

### Example 1: List Agents

```typescript
import { createMCPClient } from './mcp-client-helper';

async function listAgents() {
  const client = await createMCPClient('a2a');
  
  const result = await client.callTool('agent_control', {
    action: 'list_agents'
  });
  
  console.log('Available agents:', result.data.agents);
}
```

### Example 2: Invoke Agent

```typescript
async function invokeAgent() {
  const client = await createMCPClient('a2a');
  
  const result = await client.callTool('agent_control', {
    action: 'invoke_agent',
    agentId: 'web-scraper',
    capability: 'scrape',
    input: {
      url: 'https://example.com',
      options: {
        extractLinks: true,
        extractImages: true
      }
    }
  });
  
  console.log('Request ID:', result.data.requestId);
  console.log('Stream URL:', result.data.streamUrl);
}
```

### Example 3: Create Ecosystem

```typescript
async function createEcosystem() {
  const client = await createMCPClient('a2a');
  
  const result = await client.callTool('agent_control', {
    action: 'create_agent_ecosystem',
    useCase: 'web-development'
  });
  
  console.log('Ecosystem created:', result.data);
}
```

### Example 4: Share Tool

```typescript
async function shareTool() {
  const client = await createMCPClient('a2a');
  
  const result = await client.callTool('agent_control', {
    action: 'share_tool',
    providerAgentId: 'data-analyst',
    consumerAgentId: 'content-writer',
    toolName: 'export_data',
    shareOptions: {
      permissions: ['read'],
      expiresIn: 86400000 // 24 hours
    }
  });
  
  console.log('Tool sharing agreement:', result.data.agreementId);
}
```

### Example 5: Monitor Status

```typescript
async function monitorStatus() {
  const client = await createMCPClient('a2a');
  
  // Start a long-running operation
  const invokeResult = await client.callTool('agent_control', {
    action: 'invoke_agent',
    agentId: 'ml-pipeline-manager',
    capability: 'train',
    input: { model: 'custom', dataset: 'training-data' }
  });
  
  const requestId = invokeResult.data.requestId;
  
  // Poll for status
  const interval = setInterval(async () => {
    const statusResult = await client.callTool('agent_control', {
      action: 'get_status',
      requestId
    });
    
    console.log('Status:', statusResult.data.status);
    
    if (statusResult.data.status === 'done') {
      console.log('Result:', statusResult.data.result);
      clearInterval(interval);
    }
  }, 2000);
}
```

### Example 6: WebSocket Streaming

```typescript
import WebSocket from 'ws';

async function streamingUpdates() {
  const client = await createMCPClient('a2a');
  
  // Start an operation
  const result = await client.callTool('agent_control', {
    action: 'invoke_agent',
    agentId: 'data-analyst',
    capability: 'analyze',
    input: { dataset: 'sales-data.csv' }
  });
  
  // Connect to WebSocket stream
  const ws = new WebSocket(result.data.streamUrl);
  
  ws.on('message', (data) => {
    const event = JSON.parse(data.toString());
    
    switch (event.type) {
      case 'start':
        console.log('Operation started');
        break;
      case 'chunk':
        console.log('Progress:', event.content);
        break;
      case 'final':
        console.log('Complete:', event.result);
        ws.close();
        break;
      case 'error':
        console.error('Error:', event.message);
        ws.close();
        break;
    }
  });
}
```

## More Information

- See [COPILOT_INTEGRATION.md](../COPILOT_INTEGRATION.md) for complete integration guide
- Check [README.md](../README.md) for general documentation
- Visit [GitHub Repository](https://github.com/Scarmonit/A2A) for updates

