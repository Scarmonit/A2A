# A2A MCP Agents - Railway + Vercel + Cloudflare Deployment
# Optimized for your existing accounts

param(
    [string]$Domain = "a2a-agents",
    [string]$Environment = "production"
)

Write-Host "🚀 Deploying A2A MCP Agents with your stack..." -ForegroundColor Green
Write-Host "📋 Using: Railway + Vercel + Cloudflare" -ForegroundColor Cyan

# Build the project first
Write-Host "📦 Building project..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

# Railway deployment (Main MCP server)
Write-Host "`n🚂 Deploying to Railway..." -ForegroundColor Magenta
try {
    # Check if Railway CLI is installed
    $railwayCmd = Get-Command railway -ErrorAction SilentlyContinue
    if (-not $railwayCmd) {
        Write-Host "Installing Railway CLI..." -ForegroundColor Yellow
        npm install -g @railway/cli
    }
    
    # Deploy to Railway with optimized settings
    $env:MAX_CONCURRENCY = "100"
    $env:MAX_QUEUE_SIZE = "50000"
    $env:ENABLE_STREAMING = "true"
    $env:STREAM_PORT = "8787"
    $env:METRICS_PORT = "9090"
    $env:LOG_LEVEL = "info"
    
    railway up --detach
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Railway deployment successful!" -ForegroundColor Green
        $railwayUrl = railway status --json | ConvertFrom-Json | Select-Object -ExpandProperty url
        Write-Host "🔗 Railway URL: $railwayUrl" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Railway deployment failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Railway error: $($_.Exception.Message)" -ForegroundColor Red
}

# Vercel deployment (Serverless functions + Edge)
Write-Host "`n⚡ Deploying to Vercel..." -ForegroundColor Blue
try {
    # Check if Vercel CLI is installed
    $vercelCmd = Get-Command vercel -ErrorAction SilentlyContinue
    if (-not $vercelCmd) {
        Write-Host "Installing Vercel CLI..." -ForegroundColor Yellow
        npm install -g vercel
    }
    
    # Deploy to Vercel
    vercel --prod --yes --force
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Vercel deployment successful!" -ForegroundColor Green
        $vercelUrl = vercel ls --limit=1 --format=json | ConvertFrom-Json | Select-Object -First 1 -ExpandProperty url
        Write-Host "🔗 Vercel URL: https://$vercelUrl" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Vercel deployment failed" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Vercel error: $($_.Exception.Message)" -ForegroundColor Red
}

# Create Cloudflare configuration
Write-Host "`n☁️ Setting up Cloudflare configuration..." -ForegroundColor Cyan

$cloudflareConfig = @"
# Cloudflare DNS Configuration for A2A MCP Agents
# Add these records in your Cloudflare dashboard

## Primary Domain Setup
# Replace 'yourdomain.com' with your actual domain

# Main API (Railway)
Type: CNAME
Name: api
Target: $railwayUrl
TTL: Auto (300s)
Proxy: Enabled ✅

# Serverless Functions (Vercel)  
Type: CNAME
Name: functions
Target: $vercelUrl
TTL: Auto (300s)
Proxy: Enabled ✅

# WebSocket Streaming (Railway)
Type: CNAME  
Name: ws
Target: $railwayUrl
TTL: Auto (300s)
Proxy: Disabled ❌ (WebSocket compatibility)

# Health Check (Railway)
Type: CNAME
Name: health
Target: $railwayUrl  
TTL: Auto (300s)
Proxy: Enabled ✅

# Metrics (Railway)
Type: CNAME
Name: metrics
Target: $railwayUrl
TTL: Auto (300s) 
Proxy: Enabled ✅

## Cloudflare Settings Recommendations:
# SSL/TLS: Full (strict)
# Security Level: Medium
# Browser Cache TTL: 4 hours
# Edge Cache TTL: 2 hours
# Always Use HTTPS: On
# HTTP/3: On
# Brotli: On
# Minify: CSS, JavaScript, HTML
"@

$cloudflareConfig | Out-File -FilePath "cloudflare-dns.txt" -Encoding UTF8
Write-Host "📝 Cloudflare configuration saved to cloudflare-dns.txt" -ForegroundColor Green

# Create deployment verification script
$verifyScript = @"
# A2A MCP Agents - Deployment Verification
# Test all endpoints

Write-Host "🧪 Testing deployments..." -ForegroundColor Cyan

# Test Railway (Main API)
try {
    `$railwayHealth = Invoke-RestMethod -Uri "$railwayUrl/healthz" -Method GET -TimeoutSec 10
    Write-Host "✅ Railway health check: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway health check failed" -ForegroundColor Red
}

# Test Vercel (Serverless)
try {
    `$vercelHealth = Invoke-RestMethod -Uri "https://$vercelUrl/healthz" -Method GET -TimeoutSec 10  
    Write-Host "✅ Vercel health check: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel health check failed" -ForegroundColor Red
}

# Test agent deployment
try {
    `$testPayload = @{
        jsonrpc = "2.0"
        id = 1
        method = "tools/call"
        params = @{
            name = "agent_control"
            arguments = @{
                action = "get_stats"
            }
        }
    } | ConvertTo-Json -Depth 10

    `$response = Invoke-RestMethod -Uri "$railwayUrl" -Method POST -Body `$testPayload -ContentType "application/json" -TimeoutSec 15
    Write-Host "✅ Agent system responsive" -ForegroundColor Green
    Write-Host "📊 Agents: `$(`$response.result.data.total)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Agent system test failed" -ForegroundColor Red
}

Write-Host "`n🎉 Deployment verification complete!" -ForegroundColor Green
"@

$verifyScript | Out-File -FilePath "verify-deployment.ps1" -Encoding UTF8
Write-Host "🔍 Verification script saved to verify-deployment.ps1" -ForegroundColor Green

# Create load balancing configuration for Cloudflare
$loadBalancerConfig = @"
{
  "description": "A2A MCP Agents Load Balancer",
  "name": "a2a-agents-lb",
  "fallback_pool": "railway-primary",
  "default_pools": ["railway-primary", "vercel-backup"],
  "region_pools": {
    "ENAM": ["railway-primary"],
    "EU": ["vercel-backup"],  
    "APAC": ["railway-primary"]
  },
  "pop_pools": {},
  "proxied": true,
  "enabled": true,
  "ttl": 30,
  "steering_policy": "dynamic_latency",
  "session_affinity": "cookie"
}
"@

$loadBalancerConfig | Out-File -FilePath "cloudflare-loadbalancer.json" -Encoding UTF8

# Create performance optimization script
$optimizeScript = @"
# Cloudflare Performance Optimization for A2A MCP Agents

# Page Rules (add in Cloudflare dashboard)
# 1. api.yourdomain.com/healthz*
#    - Cache Level: Bypass
#    - Edge Cache TTL: 2 minutes
#    
# 2. api.yourdomain.com/metrics*  
#    - Cache Level: Bypass
#    - Browser Cache TTL: 30 minutes
#
# 3. ws.yourdomain.com/*
#    - SSL: Flexible (for WebSocket compatibility)
#    - Cache Level: Bypass
#
# 4. *.yourdomain.com/*
#    - Cache Level: Standard
#    - Edge Cache TTL: 2 hours
#    - Browser Cache TTL: 4 hours
#    - Security Level: Medium

Write-Host "⚡ Cloudflare optimization guidelines:" -ForegroundColor Cyan
Write-Host "1. Enable HTTP/3 for faster connections" -ForegroundColor White
Write-Host "2. Use Full (strict) SSL for security" -ForegroundColor White  
Write-Host "3. Enable Brotli compression" -ForegroundColor White
Write-Host "4. Set up Page Rules for caching" -ForegroundColor White
Write-Host "5. Configure Rate Limiting for protection" -ForegroundColor White
"@

$optimizeScript | Out-File -FilePath "cloudflare-optimize.ps1" -Encoding UTF8

# Create monitoring setup
$monitoringScript = @"
# UptimeRobot monitoring configuration
# Add these monitors in your UptimeRobot dashboard

Monitor 1: Railway Main API
- Type: HTTP(s)
- URL: $railwayUrl/healthz
- Monitoring Interval: 1 minute
- HTTP Method: GET
- Expected Status Code: 200

Monitor 2: Vercel Serverless
- Type: HTTP(s)  
- URL: https://$vercelUrl/healthz
- Monitoring Interval: 5 minutes
- HTTP Method: GET
- Expected Status Code: 200

Monitor 3: Agent System Test
- Type: HTTP(s)
- URL: $railwayUrl
- Monitoring Interval: 5 minutes  
- HTTP Method: POST
- Post Data: {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"agent_control","arguments":{"action":"get_stats"}}}
- Content-Type: application/json
"@

$monitoringScript | Out-File -FilePath "monitoring-setup.txt" -Encoding UTF8

Write-Host "`n🎊 Deployment Complete!" -ForegroundColor Green
Write-Host "📊 Your A2A MCP Agents are now running on:" -ForegroundColor Cyan
Write-Host "   🚂 Railway: $railwayUrl" -ForegroundColor White
Write-Host "   ⚡ Vercel: https://$vercelUrl" -ForegroundColor White
Write-Host "   ☁️  Cloudflare: Ready for DNS configuration" -ForegroundColor White

Write-Host "`n📋 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Configure DNS records in Cloudflare (see cloudflare-dns.txt)" -ForegroundColor White
Write-Host "2. Run verification: .\verify-deployment.ps1" -ForegroundColor White  
Write-Host "3. Set up monitoring with UptimeRobot" -ForegroundColor White
Write-Host "4. Configure Cloudflare optimizations" -ForegroundColor White

Write-Host "`n🚀 Your agents are ready to deploy worldwide!" -ForegroundColor Green