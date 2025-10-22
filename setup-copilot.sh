#!/bin/bash

# A2A MCP Server - Copilot Integration Setup Script
# This script helps you configure A2A MCP Server with GitHub Copilot

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}A2A MCP Server - Copilot Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
fi

echo -e "${YELLOW}Detected OS: ${OS}${NC}"
echo ""

# Get absolute path to A2A directory
A2A_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo -e "${GREEN}A2A installation path: ${A2A_PATH}${NC}"
echo ""

# Check Node.js version
echo -e "${YELLOW}Checking Node.js version...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js 20.x or higher.${NC}"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}Node.js version 20 or higher is required. Current version: $(node --version)${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Node.js version: $(node --version)${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Build the project
echo -e "${YELLOW}Building the project...${NC}"
npm run build
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
echo ""

# Determine config directory
CONFIG_DIR=""
case $OS in
    "macos")
        CONFIG_DIR="$HOME/Library/Application Support/Claude"
        COPILOT_CONFIG_DIR="$HOME/.config/github-copilot"
        ;;
    "linux")
        CONFIG_DIR="$HOME/.config/Claude"
        COPILOT_CONFIG_DIR="$HOME/.config/github-copilot"
        ;;
    "windows")
        CONFIG_DIR="$APPDATA/Claude"
        COPILOT_CONFIG_DIR="$APPDATA/github-copilot"
        ;;
esac

echo -e "${YELLOW}Select integration type:${NC}"
echo "1) GitHub Copilot CLI"
echo "2) Claude Desktop"
echo "3) Both"
echo "4) Manual (just show config)"
read -p "Enter choice (1-4): " CHOICE

case $CHOICE in
    1|3)
        echo ""
        echo -e "${YELLOW}Configuring GitHub Copilot CLI...${NC}"
        mkdir -p "$COPILOT_CONFIG_DIR"
        
        MCP_CONFIG="$COPILOT_CONFIG_DIR/mcp.json"
        
        # Create or update mcp.json
        if [ -f "$MCP_CONFIG" ]; then
            echo -e "${YELLOW}Backing up existing config to mcp.json.backup${NC}"
            cp "$MCP_CONFIG" "$MCP_CONFIG.backup"
        fi
        
        cat > "$MCP_CONFIG" <<EOF
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["${A2A_PATH}/dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "STREAM_PORT": "8787",
        "STREAM_HOST": "127.0.0.1",
        "MAX_CONCURRENCY": "50",
        "LOG_LEVEL": "info"
      }
    }
  }
}
EOF
        
        echo -e "${GREEN}✓ GitHub Copilot configuration created at: ${MCP_CONFIG}${NC}"
        ;;
esac

case $CHOICE in
    2|3)
        echo ""
        echo -e "${YELLOW}Configuring Claude Desktop...${NC}"
        mkdir -p "$CONFIG_DIR"
        
        CLAUDE_CONFIG="$CONFIG_DIR/claude_desktop_config.json"
        
        # Create or update claude_desktop_config.json
        if [ -f "$CLAUDE_CONFIG" ]; then
            echo -e "${YELLOW}Backing up existing config to claude_desktop_config.json.backup${NC}"
            cp "$CLAUDE_CONFIG" "$CLAUDE_CONFIG.backup"
        fi
        
        cat > "$CLAUDE_CONFIG" <<EOF
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["${A2A_PATH}/dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "STREAM_PORT": "8787",
        "MAX_CONCURRENCY": "50"
      }
    }
  }
}
EOF
        
        echo -e "${GREEN}✓ Claude Desktop configuration created at: ${CLAUDE_CONFIG}${NC}"
        ;;
esac

case $CHOICE in
    4)
        echo ""
        echo -e "${YELLOW}Manual Configuration${NC}"
        echo ""
        echo -e "${BLUE}For GitHub Copilot CLI, add to ~/.config/github-copilot/mcp.json:${NC}"
        echo ""
        cat <<EOF
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["${A2A_PATH}/dist/index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "STREAM_PORT": "8787",
        "MAX_CONCURRENCY": "50"
      }
    }
  }
}
EOF
        echo ""
        echo -e "${BLUE}For Claude Desktop, add to:${NC}"
        echo "  macOS: ~/Library/Application Support/Claude/claude_desktop_config.json"
        echo "  Linux: ~/.config/Claude/claude_desktop_config.json"
        echo "  Windows: %APPDATA%\\Claude\\claude_desktop_config.json"
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Restart GitHub Copilot CLI or Claude Desktop"
echo "2. Test the integration:"
echo "   ${BLUE}@a2a list all available agents${NC}"
echo ""
echo -e "${YELLOW}For more information:${NC}"
echo "- Read COPILOT_INTEGRATION.md for detailed guide"
echo "- Check examples in the examples/ directory"
echo "- Visit https://github.com/Scarmonit/A2A for documentation"
echo ""
echo -e "${GREEN}Happy coding with A2A! 🚀${NC}"
