#!/bin/bash
set -e

# Railway Deployment Script for A2A MCP Server
# This script automates the two-service deployment to Railway

echo "========================================="
echo "Railway A2A Deployment Script"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Railway CLI not found!${NC}"
    echo "Installing Railway CLI..."

    # Try npm installation
    if command -v npm &> /dev/null; then
        npm install -g @railway/cli
    else
        # Try shell installation
        curl -fsSL https://railway.app/install.sh | sh
    fi
fi

# Verify installation
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Failed to install Railway CLI${NC}"
    echo "Please install manually: https://docs.railway.app/guides/cli"
    exit 1
fi

echo -e "${GREEN}Railway CLI found!${NC}"
echo ""

# Check authentication
echo "Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}Not authenticated. Starting login...${NC}"
    railway login
fi

echo -e "${GREEN}Authenticated!${NC}"
echo ""

# Generate secure token if not provided
if [ -z "$STREAM_TOKEN" ]; then
    echo "Generating secure STREAM_TOKEN..."
    STREAM_TOKEN=$(openssl rand -hex 32)
    echo -e "${GREEN}Generated token: ${STREAM_TOKEN}${NC}"
fi

# Prompt for Ollama URL
if [ -z "$LOCAL_LLM_URL" ]; then
    echo -e "${YELLOW}Enter your Ollama/LLM URL:${NC}"
    read -p "LOCAL_LLM_URL: " LOCAL_LLM_URL
fi

echo ""
echo "========================================="
echo "Creating Railway Project"
echo "========================================="
railway init --name a2a-mcp-server

echo ""
echo "========================================="
echo "Deploying Service 1: a2a-ws (WebSocket)"
echo "========================================="

# Create WebSocket service
railway service create a2a-ws

# Set environment variables for WS service
echo "Setting environment variables for a2a-ws..."
railway variables set \
    NODE_ENV=production \
    LOG_LEVEL=info \
    ENABLE_STREAMING=true \
    STREAM_HOST=0.0.0.0 \
    METRICS_PORT=0 \
    STREAM_TOKEN="$STREAM_TOKEN" \
    LOCAL_LLM_URL="$LOCAL_LLM_URL" \
    MAX_CONCURRENCY=100 \
    MAX_QUEUE_SIZE=50000 \
    MAX_SUBS_PER_REQUEST=16 \
    --service a2a-ws

# Deploy WS service
echo "Deploying a2a-ws..."
railway up --service a2a-ws

echo -e "${GREEN}WebSocket service deployed!${NC}"

echo ""
echo "========================================="
echo "Deploying Service 2: a2a-api (API/Health)"
echo "========================================="

# Create API service
railway service create a2a-api

# Set environment variables for API service
echo "Setting environment variables for a2a-api..."
railway variables set \
    NODE_ENV=production \
    LOG_LEVEL=info \
    ENABLE_STREAMING=false \
    STREAM_HOST=0.0.0.0 \
    STREAM_PORT=0 \
    STREAM_TOKEN="$STREAM_TOKEN" \
    LOCAL_LLM_URL="$LOCAL_LLM_URL" \
    MAX_CONCURRENCY=100 \
    MAX_QUEUE_SIZE=50000 \
    --service a2a-api

# Deploy API service
echo "Deploying a2a-api..."
railway up --service a2a-api

echo -e "${GREEN}API service deployed!${NC}"

echo ""
echo "========================================="
echo "Generating Domains"
echo "========================================="

# Generate Railway domains
echo "Generating domain for a2a-ws..."
WS_DOMAIN=$(railway domain --service a2a-ws)

echo "Generating domain for a2a-api..."
API_DOMAIN=$(railway domain --service a2a-api)

echo ""
echo -e "${GREEN}Deployment Complete!${NC}"
echo ""
echo "========================================="
echo "Service URLs"
echo "========================================="
echo "WebSocket Service: https://$WS_DOMAIN"
echo "API Service: https://$API_DOMAIN"
echo ""
echo "========================================="
echo "Next Steps"
echo "========================================="
echo "1. Test health endpoint:"
echo "   curl https://$API_DOMAIN/healthz"
echo ""
echo "2. Test metrics endpoint:"
echo "   curl https://$API_DOMAIN/metrics"
echo ""
echo "3. Set up custom domains (optional):"
echo "   - ws.a2a.yourdomain → $WS_DOMAIN"
echo "   - api.a2a.yourdomain → $API_DOMAIN"
echo ""
echo "4. Configure Cloudflare DNS (if using custom domains):"
echo "   - CNAME ws.a2a → $WS_DOMAIN (Proxied)"
echo "   - CNAME api.a2a → $API_DOMAIN (Proxied)"
echo "   - Bypass cache for /stream*, /metrics*, /healthz*"
echo ""
echo "========================================="
echo "Important Credentials"
echo "========================================="
echo "STREAM_TOKEN: $STREAM_TOKEN"
echo ""
echo -e "${YELLOW}Save this token securely!${NC}"
echo ""
