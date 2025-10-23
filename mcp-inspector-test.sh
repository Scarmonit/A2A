#!/bin/bash
# MCP Inspector Test Script
# This script tests the A2A MCP server using the MCP Inspector

echo "🔍 A2A MCP Server - Inspector Test"
echo "=================================="
echo ""

# Check if build exists
if [ ! -f "dist/index.js" ]; then
    echo "❌ Build not found. Running npm run build..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "❌ Build failed. Please fix build errors first."
        exit 1
    fi
fi

echo "✅ Build found at dist/index.js"
echo ""

# Check if MCP Inspector is available
echo "📦 Checking for MCP Inspector..."
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

echo "✅ npx found"
echo ""

echo "🚀 Launching MCP Inspector..."
echo ""
echo "Instructions:"
echo "1. The inspector will open in your browser"
echo "2. You'll see the available tools"
echo "3. Test the agent_control tool with different actions"
echo "4. Try 'list_agents', 'get_stats', 'list_enhanced_types'"
echo ""
echo "Press Ctrl+C to exit when done"
echo ""

# Launch MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
