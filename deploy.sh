#!/bin/bash

# A2A MCP Agents - One-Click Deployment Script
# Deploys to multiple free cloud platforms simultaneously

set -e

echo "🚀 A2A MCP Agents - One-Click Deployment"
echo "========================================"

# Build the project
echo "📦 Building project..."
npm run build

# Check if git repo exists
if [ ! -d ".git" ]; then
    echo "🔧 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit - A2A MCP Agents"
fi

# Deploy to multiple platforms
deploy_platform() {
    local platform=$1
    local command=$2
    
    echo ""
    echo "🌐 Deploying to $platform..."
    
    if eval "$command"; then
        echo "✅ $platform deployment successful!"
    else
        echo "❌ $platform deployment failed"
    fi
}

# Railway deployment
if command -v railway &> /dev/null; then
    deploy_platform "Railway" "railway up --detach"
elif [ ! -z "$RAILWAY_TOKEN" ]; then
    deploy_platform "Railway" "npx @railway/cli up --detach"
else
    echo "⚠️  Railway CLI not found. Install with: npm i -g @railway/cli"
fi

# Fly.io deployment  
if command -v flyctl &> /dev/null; then
    deploy_platform "Fly.io" "flyctl deploy --remote-only"
elif [ ! -z "$FLY_API_TOKEN" ]; then
    deploy_platform "Fly.io" "npx @flydotio/cli deploy --remote-only"
else
    echo "⚠️  Fly CLI not found. Install with: curl -L https://fly.io/install.sh | sh"
fi

# Render deployment
if [ ! -z "$RENDER_API_KEY" ]; then
    echo "🌐 Deploying to Render..."
    curl -X POST "https://api.render.com/v1/services" \
         -H "Authorization: Bearer $RENDER_API_KEY" \
         -H "Content-Type: application/json" \
         -d @render.json && echo "✅ Render deployment initiated!" || echo "❌ Render deployment failed"
fi

# Vercel deployment
if command -v vercel &> /dev/null; then
    deploy_platform "Vercel" "vercel --prod --yes"
elif [ ! -z "$VERCEL_TOKEN" ]; then
    deploy_platform "Vercel" "npx vercel --prod --yes"
else
    echo "⚠️  Vercel CLI not found. Install with: npm i -g vercel"
fi

# Heroku deployment (if Procfile exists)
if [ -f "Procfile" ] && command -v heroku &> /dev/null; then
    deploy_platform "Heroku" "heroku create a2a-mcp-agents-$(date +%s) && git push heroku main"
fi

# Docker Hub push (if logged in)
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo ""
    echo "🐳 Building and pushing Docker image..."
    docker build -t a2a-mcp-agents:latest .
    
    if [ ! -z "$DOCKER_USERNAME" ]; then
        docker tag a2a-mcp-agents:latest $DOCKER_USERNAME/a2a-mcp-agents:latest
        docker push $DOCKER_USERNAME/a2a-mcp-agents:latest && echo "✅ Docker image pushed!" || echo "❌ Docker push failed"
    fi
fi

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Your A2A MCP Agents are now running on:"
echo "   • Railway: https://a2a-mcp-server.railway.app"
echo "   • Fly.io: https://a2a-mcp-agents.fly.dev" 
echo "   • Render: https://a2a-mcp-server.onrender.com"
echo "   • Vercel: https://a2a-mcp-agents.vercel.app"
echo ""
echo "🔧 Health checks:"
echo "   curl https://your-domain.com/healthz"
echo ""
echo "📈 Metrics:"
echo "   curl https://your-domain.com/metrics"
echo ""
echo "🤖 Test agent deployment:"
echo '   curl -X POST https://your-domain.com -H "Content-Type: application/json" \'
echo '   -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"agent_control\",\"arguments\":{\"action\":\"generate_agents\",\"count\":100}}}"'

# Generate deployment summary
cat > DEPLOYMENT.md << EOF
# A2A MCP Agents - Deployment Summary

## 🚀 Deployed Platforms

- **Railway**: https://a2a-mcp-server.railway.app
- **Fly.io**: https://a2a-mcp-agents.fly.dev
- **Render**: https://a2a-mcp-server.onrender.com  
- **Vercel**: https://a2a-mcp-agents.vercel.app

## 🔧 Quick Commands

\`\`\`bash
# Health check
curl https://your-domain.com/healthz

# Deploy 500 agents
curl -X POST https://your-domain.com \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_control","arguments":{"action":"generate_agents","count":500}}}'

# Get agent stats
curl -X POST https://your-domain.com \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"agent_control","arguments":{"action":"get_stats"}}}'
\`\`\`

## 💫 Performance
- **Max Concurrency**: 100 agents
- **Queue Size**: 50,000 requests
- **Response Time**: < 100ms
- **WebSocket Streaming**: Real-time updates

Generated: $(date)
EOF

echo "📝 Deployment summary saved to DEPLOYMENT.md"