/**
 * GitHub Copilot + A2A MCP Server Integration Example
 * 
 * This example demonstrates how GitHub Copilot can interact with the A2A MCP Server
 * to leverage advanced agent capabilities in your development workflow.
 * 
 * Prerequisites:
 * - A2A MCP Server built and configured
 * - GitHub Copilot enabled in VS Code
 * - MCP configuration added to VS Code settings
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import WebSocket from 'ws';

/**
 * Example 1: List Available Agents
 * 
 * Ask Copilot: "Show me all available agents"
 * Copilot will invoke agent_control with action: list_agents
 */
export async function exampleListAgents() {
  console.log('Example: List agents that Copilot can access');
  
  // This is what Copilot does behind the scenes:
  const request = {
    action: 'list_agents'
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
  
  // Expected response includes all deployed agents:
  // { agents: [{ id: 'echo', name: 'Echo Agent', ... }, ...] }
}

/**
 * Example 2: Create a Specialized Agent
 * 
 * Ask Copilot: "Create a web scraper agent for extracting GitHub repository data"
 * Copilot will invoke agent_control with action: create_enhanced_agent
 */
export async function exampleCreateAgent() {
  console.log('Example: Create specialized agent via Copilot');
  
  // Copilot generates this request:
  const request = {
    action: 'create_enhanced_agent',
    agentType: 'web-scraper',
    agentConfig: {
      name: 'github-scraper',
      description: 'Extract repository data from GitHub',
      config: {
        rateLimit: 100,
        retries: 3,
        timeout: 30000
      }
    }
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
}

/**
 * Example 3: Execute Parallel Commands
 * 
 * Ask Copilot: "Run build, test, and lint in parallel"
 * Copilot will use practical tools for parallel execution
 */
export async function exampleParallelExecution() {
  console.log('Example: Execute parallel commands via Copilot');
  
  // Copilot generates this request:
  const request = {
    action: 'execute_practical_tool',
    toolName: 'parallel_commands',
    toolParams: {
      commands: [
        { command: 'npm', args: ['run', 'build'] },
        { command: 'npm', args: ['run', 'test'] },
        { command: 'npm', args: ['run', 'lint'] }
      ]
    }
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
  console.log('\nThis will execute all three commands concurrently!');
}

/**
 * Example 4: Deploy an Agent Ecosystem
 * 
 * Ask Copilot: "Set up a complete web development ecosystem"
 * Copilot will deploy multiple coordinated agents
 */
export async function exampleAgentEcosystem() {
  console.log('Example: Deploy agent ecosystem via Copilot');
  
  // Copilot generates this request:
  const request = {
    action: 'create_agent_ecosystem',
    useCase: 'web-development'
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
  console.log('\nThis deploys:');
  console.log('- Web scraper for data collection');
  console.log('- Content writer for documentation');
  console.log('- API tester for validation');
  console.log('- Deploy manager for deployment');
}

/**
 * Example 5: WebSocket Streaming with Copilot
 * 
 * When Copilot invokes an agent, you can subscribe to real-time updates
 */
export async function exampleWebSocketStreaming() {
  console.log('Example: Subscribe to agent execution via WebSocket');
  
  // Connect to the WebSocket stream
  const ws = new WebSocket('ws://127.0.0.1:8787');
  
  ws.on('open', () => {
    console.log('Connected to A2A WebSocket stream');
    
    // When Copilot invokes an agent, you'll receive:
    console.log('\nExpected events:');
    console.log('1. { type: "start", requestId: "..." }');
    console.log('2. { type: "chunk", content: "progress updates" }');
    console.log('3. { type: "final", result: { ... } }');
  });
  
  ws.on('message', (data: Buffer) => {
    const event = JSON.parse(data.toString());
    
    switch (event.type) {
      case 'start':
        console.log(`\n[START] Agent execution began: ${event.requestId}`);
        break;
      case 'chunk':
        console.log(`[PROGRESS] ${event.content}`);
        break;
      case 'final':
        console.log(`[COMPLETE] Result:`, event.result);
        break;
      case 'error':
        console.error(`[ERROR] ${event.message}`);
        break;
    }
  });
  
  ws.on('close', () => {
    console.log('Disconnected from WebSocket stream');
  });
  
  // Keep connection alive for demo
  setTimeout(() => {
    ws.close();
  }, 30000);
}

/**
 * Example 6: Permission Management
 * 
 * Ask Copilot: "Grant file write permission to the web-scraper agent"
 * Copilot manages agent permissions
 */
export async function examplePermissionManagement() {
  console.log('Example: Manage agent permissions via Copilot');
  
  // Copilot generates this request:
  const request = {
    action: 'grant_permission',
    id: 'github-scraper',
    targetAgentId: 'github-scraper',
    permission: 'file:write',
    delegable: false,
    expiresIn: 3600000, // 1 hour
    reason: 'Allow scraper to save extracted data'
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
}

/**
 * Example 7: Check Operation Status
 * 
 * Ask Copilot: "What's the status of my last agent execution?"
 * Copilot checks operation status
 */
export async function exampleCheckStatus() {
  console.log('Example: Check agent operation status via Copilot');
  
  // Copilot generates this request:
  const request = {
    action: 'get_status',
    requestId: 'req_123abc' // From previous invocation
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
  console.log('\nExpected response:');
  console.log(JSON.stringify({
    id: 'req_123abc',
    status: 'done', // or 'running', 'queued', 'error'
    agentId: 'github-scraper',
    result: { /* execution result */ }
  }, null, 2));
}

/**
 * Example 8: Agent Handoff
 * 
 * Ask Copilot: "After scraping, hand off data to the data-analyst agent"
 * Copilot coordinates between agents
 */
export async function exampleAgentHandoff() {
  console.log('Example: Agent-to-agent handoff via Copilot');
  
  // Copilot generates this request:
  const request = {
    action: 'handoff',
    fromRequestId: 'req_scraper_123',
    toAgentId: 'data-analyst',
    capability: 'analyze',
    payload: {
      data: { /* scraped data */ },
      analysisType: 'statistical'
    }
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
  console.log('\nThis creates a seamless workflow:');
  console.log('scraper → data → analyst → insights');
}

/**
 * Example 9: Get Agent Statistics
 * 
 * Ask Copilot: "Show me A2A server statistics"
 */
export async function exampleGetStats() {
  console.log('Example: Retrieve server statistics via Copilot');
  
  const request = {
    action: 'get_stats'
  };
  
  console.log('Copilot request:', JSON.stringify(request, null, 2));
  console.log('\nExpected response includes:');
  console.log('- Total agents deployed');
  console.log('- Active agents');
  console.log('- Disabled agents');
  console.log('- Agent categories');
}

/**
 * Example 10: Complete Workflow
 * 
 * Ask Copilot: "Set up a complete data pipeline: scrape GitHub repos, 
 *                analyze stars/forks, and generate a report"
 */
export async function exampleCompleteWorkflow() {
  console.log('Example: Complete workflow orchestrated by Copilot');
  
  console.log('\nCopilot will:');
  console.log('1. Create web-scraper agent');
  console.log('2. Create data-analyst agent');
  console.log('3. Create content-writer agent (for report)');
  console.log('4. Invoke scraper with GitHub URLs');
  console.log('5. Hand off data to analyst');
  console.log('6. Hand off insights to writer');
  console.log('7. Return final report');
  
  console.log('\nAll orchestrated through natural language!');
}

/**
 * Main function to run examples
 */
export async function main() {
  console.log('='.repeat(60));
  console.log('GitHub Copilot + A2A MCP Server Examples');
  console.log('='.repeat(60));
  
  // Run examples
  await exampleListAgents();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await exampleCreateAgent();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await exampleParallelExecution();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await exampleAgentEcosystem();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await examplePermissionManagement();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await exampleCheckStatus();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await exampleAgentHandoff();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await exampleGetStats();
  console.log('\n' + '-'.repeat(60) + '\n');
  
  await exampleCompleteWorkflow();
  console.log('\n' + '='.repeat(60));
  
  console.log('\n✅ All examples completed!');
  console.log('\nTo use these in Copilot:');
  console.log('1. Configure A2A in VS Code settings');
  console.log('2. Ask Copilot in natural language');
  console.log('3. Copilot will use A2A automatically');
  console.log('\nSee docs/COPILOT_INTEGRATION.md for full guide');
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
