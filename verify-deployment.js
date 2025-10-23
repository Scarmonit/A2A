#!/usr/bin/env node
/**
 * A2A MCP Server Deployment Verification Script
 * Tests WebSocket connectivity and agent availability
 */

import WebSocket from 'ws';

const WS_URL = 'ws://127.0.0.1:8787';
const TIMEOUT = 5000;

console.log('🔍 A2A MCP Server Deployment Verification\n');
console.log('=' .repeat(50));

// Test WebSocket connection
function testWebSocketConnection() {
  return new Promise((resolve, reject) => {
    console.log('\n✓ Testing WebSocket connection...');
    console.log(`  Connecting to: ${WS_URL}`);

    const ws = new WebSocket(WS_URL);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Connection timeout'));
    }, TIMEOUT);

    ws.on('open', () => {
      clearTimeout(timeout);
      console.log('  ✅ WebSocket connected successfully!');

      // Send list_agents request
      console.log('\n✓ Sending list_agents request...');
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_agents',
          arguments: {}
        },
        id: 1
      }));
    });

    ws.on('message', (data) => {
      const response = JSON.parse(data.toString());
      console.log('  ✅ Received response from server');
      console.log('  Response:', JSON.stringify(response, null, 2));

      clearTimeout(timeout);
      ws.close();
      resolve(response);
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    ws.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

// Main verification
async function verify() {
  try {
    const response = await testWebSocketConnection();

    console.log('\n' + '='.repeat(50));
    console.log('✅ DEPLOYMENT VERIFICATION SUCCESSFUL!');
    console.log('='.repeat(50));
    console.log('\n📊 Server Status:');
    console.log('  - WebSocket Server: Running');
    console.log('  - URL: ' + WS_URL);
    console.log('  - Protocol: MCP over WebSocket');
    console.log('  - Status: Ready to accept agent requests');
    console.log('\n🎉 The A2A MCP Server is operational!');
    console.log('\n💡 Next steps:');
    console.log('  1. Connect GitHub Copilot or Claude Desktop');
    console.log('  2. Deploy additional agents as needed');
    console.log('  3. Monitor server logs for activity');
    console.log('\n📖 See DEPLOYMENT_STATUS.md for full details');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ DEPLOYMENT VERIFICATION FAILED!');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('  1. Check if server is running: ps aux | grep "node dist/index.js"');
    console.error('  2. Check server logs for errors');
    console.error('  3. Verify port 8787 is not blocked');
    process.exit(1);
  }
}

verify();
