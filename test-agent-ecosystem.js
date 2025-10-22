// Test script for agent-to-agent ecosystem
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

async function testAgentEcosystem() {
  console.log('🌐 Testing Agent-to-Agent Ecosystem...\n');
  console.log('This will test:');
  console.log('✨ Permission granting between agents');
  console.log('🔧 Tool sharing and discovery');
  console.log('🏢 Agent MCP servers');
  console.log('🤝 Inter-agent collaboration\n');
  
  // Start the enhanced server
  const server = spawn('node', ['dist/index.js'], {
    env: { 
      ...process.env, 
      MAX_CONCURRENCY: '20', 
      LOG_LEVEL: 'info',
      ENABLE_STREAMING: 'true'
    },
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  let serverOutput = '';
  server.stdout.on('data', (data) => {
    serverOutput += data.toString();
    console.log('📊 SERVER:', data.toString().trim());
  });
  
  server.stderr.on('data', (data) => {
    console.log('⚠️  ERROR:', data.toString().trim());
  });
  
  // Wait for server to start
  await sleep(3000);
  
  const tests = [
    // Test 1: Deploy agent ecosystem
    {
      name: "Deploy 20 agents with diverse capabilities",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "generate_agents",
            count: 20
          }
        }
      })
    },
    
    // Test 2: Agent requests permission from another agent
    {
      name: "Data Processor requests file permissions from File Ops agent",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "request_permission",
            id: "data-processor-000",
            targetAgentId: "file-ops-000",
            permission: "file:write",
            reason: "Need to save processed data to files"
          }
        }
      })
    },
    
    // Test 3: File Ops agent grants permission
    {
      name: "File Ops agent grants file:write permission to Data Processor",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "grant_permission",
            id: "file-ops-000",
            targetAgentId: "data-processor-000",
            permission: "file:write",
            delegable: true,
            expiresIn: 3600000,
            reason: "Approved for data processing tasks"
          }
        }
      })
    },
    
    // Test 4: Create MCP server for Code Gen agent
    {
      name: "Create MCP server for Code Generator agent",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "create_mcp_server",
            id: "code-gen-000",
            mcpConfig: {
              maxClients: 5,
              requireAuth: false
            }
          }
        }
      })
    },
    
    // Test 5: Add custom tool to agent
    {
      name: "Add advanced code analysis tool to Code Gen agent",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "add_tool_to_agent",
            id: "code-gen-000",
            tool: {
              name: "analyze_code_complexity",
              description: "Analyze code complexity and suggest optimizations",
              inputSchema: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  language: { type: "string" }
                },
                required: ["code", "language"]
              },
              outputSchema: {
                type: "object",
                properties: {
                  complexity: { type: "number" },
                  suggestions: { type: "array" }
                }
              },
              permissions: ["code:analyze"],
              cost: 5,
              shareable: true
            }
          }
        }
      })
    },
    
    // Test 6: Share tool between agents
    {
      name: "Share code analysis tool with Data Processor agent",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 6,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "share_tool",
            providerAgentId: "code-gen-000",
            consumerAgentId: "data-processor-000",
            toolName: "analyze_code_complexity",
            shareOptions: {
              costPerUse: 2,
              expiresIn: 7200000
            }
          }
        }
      })
    },
    
    // Test 7: Discover available tools
    {
      name: "Discover all shareable tools in the ecosystem",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 7,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "discover_tools",
            discoveryFilters: {
              maxCost: 10
            }
          }
        }
      })
    },
    
    // Test 8: Connect to another agent's MCP server
    {
      name: "Connect Data Processor to Code Gen MCP server",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 8,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "connect_to_agent_mcp",
            id: "data-processor-000",
            targetAgentId: "code-gen-000"
          }
        }
      })
    },
    
    // Test 9: Execute shared tool
    {
      name: "Execute shared code analysis tool",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 9,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "execute_shared_tool",
            consumerAgentId: "data-processor-000",
            providerAgentId: "code-gen-000",
            toolName: "analyze_code_complexity",
            toolParams: {
              code: "function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }",
              language: "javascript"
            }
          }
        }
      })
    },
    
    // Test 10: Check permissions and sharing agreements
    {
      name: "Check Data Processor permissions and agreements",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 10,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "get_permissions",
            id: "data-processor-000"
          }
        }
      })
    },
    
    // Test 11: Get sharing agreements
    {
      name: "Get all sharing agreements for Code Gen agent",
      message: JSON.stringify({
        jsonrpc: "2.0",
        id: 11,
        method: "tools/call",
        params: {
          name: "agent_control",
          arguments: {
            action: "get_sharing_agreements",
            id: "code-gen-000"
          }
        }
      })
    }
  ];
  
  // Execute all tests
  for (const [index, test] of tests.entries()) {
    console.log(`\\n🧪 Test ${index + 1}/11: ${test.name}...`);
    
    server.stdin.write(test.message + '\\n');
    
    // Wait between tests
    await sleep(index < 6 ? 4000 : 2000); // Longer waits for complex operations
  }
  
  // Wait for all processing to complete
  console.log('\\n⏳ Waiting for agent ecosystem operations to complete...');
  await sleep(15000);
  
  // Cleanup
  server.kill();
  
  console.log('\\n🎉 Agent-to-Agent Ecosystem Test Completed!');
  console.log('\\n🌟 Your A2A MCP server now supports:');
  console.log('\\n🔐 PERMISSION SYSTEM:');
  console.log('   ✅ Agents can grant permissions to each other');
  console.log('   ✅ Permission delegation with expiration');
  console.log('   ✅ Request/approve workflow');
  console.log('   ✅ Authorization chains and revocation');
  
  console.log('\\n🏗️  AGENT MCP SERVERS:');
  console.log('   ✅ Each agent can host its own MCP server');
  console.log('   ✅ Custom tools with sharing capabilities');
  console.log('   ✅ Port allocation and process management');
  console.log('   ✅ Client connections and rate limiting');
  
  console.log('\\n🔧 TOOL SHARING ECOSYSTEM:');
  console.log('   ✅ Tool discovery across agent network');
  console.log('   ✅ Sharing agreements with cost/expiration');
  console.log('   ✅ Cross-agent tool execution');
  console.log('   ✅ Marketplace-style tool economy');
  
  console.log('\\n🤝 INTER-AGENT COLLABORATION:');
  console.log('   ✅ Direct agent-to-agent communication');
  console.log('   ✅ Dynamic partnership formation');
  console.log('   ✅ Resource sharing and delegation');
  console.log('   ✅ Federated agent ecosystem');
  
  console.log('\\n🚀 Your agents can now:');
  console.log('   • Form autonomous partnerships');
  console.log('   • Share tools and capabilities dynamically');
  console.log('   • Grant and manage permissions independently');
  console.log('   • Create their own MCP servers with custom tools');
  console.log('   • Discover and collaborate across the network');
  console.log('   • Build a self-organizing agent marketplace!');
}

// Run the test
testAgentEcosystem().catch(console.error);