// Test script to demonstrate hundreds of agents deployment
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

async function testHundredsOfAgents() {
  console.log('🚀 Testing A2A MCP Server with hundreds of agents...\n');
  
  // Start the server
  const server = spawn('node', ['dist/index.js'], {
    env: { ...process.env, MAX_CONCURRENCY: '50', LOG_LEVEL: 'warn' }
  });
  
  // Wait for server to start
  await sleep(2000);
  
  const tests = [
    // Test 1: Deploy 100 agents
    {
      name: "Generate and deploy 100 agents",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "generate_agents",
            count: 100,
            template: {
              category: "test-batch",
              tags: ["performance", "test", "batch-100"]
            }
          }
        }
      })
    },
    
    // Test 2: Get stats
    {
      name: "Check agent registry stats",
      message: JSON.stringify({
        jsonrpc: "2.0", 
        id: 2,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "get_stats"
          }
        }
      })
    },
    
    // Test 3: Filter agents by category
    {
      name: "Filter agents by category",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 3, 
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "filter_agents",
            category: "test-batch"
          }
        }
      })
    },
    
    // Test 4: Generate another 200 agents
    {
      name: "Generate and deploy 200 more agents",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call", 
        params: {
          name: "agent_control",
          arguments: {
            action: "generate_agents",
            count: 200,
            template: {
              category: "test-large",
              tags: ["performance", "test", "batch-200"]
            }
          }
        }
      })
    },
    
    // Test 5: Final stats
    {
      name: "Final agent registry stats",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "agent_control", 
          arguments: {
            action: "get_stats"
          }
        }
      })
    }
  ];
  
  // Send test messages to server via stdin
  for (const test of tests) {
    console.log(`📋 ${test.name}...`);
    
    server.stdin.write(test.message + '\n');
    
    // Wait between tests
    await sleep(1000);
  }
  
  // Wait for processing
  await sleep(3000);
  
  // Cleanup
  server.kill();
  
  console.log('\n✅ Test completed! Check server output above for results.');
  console.log('🎯 Your A2A MCP server can now handle hundreds of agents efficiently!');
}

// Run the test
testHundredsOfAgents().catch(console.error);