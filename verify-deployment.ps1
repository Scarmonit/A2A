# A2A MCP Agents - Deployment Verification
# Test all endpoints

Write-Host "🧪 Testing deployments..." -ForegroundColor Cyan

# Test Railway (Main API)
try {
    $railwayHealth = Invoke-RestMethod -Uri "/healthz" -Method GET -TimeoutSec 10
    Write-Host "✅ Railway health check: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Railway health check failed" -ForegroundColor Red
}

# Test Vercel (Serverless)
try {
    $vercelHealth = Invoke-RestMethod -Uri "https:///healthz" -Method GET -TimeoutSec 10  
    Write-Host "✅ Vercel health check: OK" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel health check failed" -ForegroundColor Red
}

# Test agent deployment
try {
    $testPayload = @{
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

    $response = Invoke-RestMethod -Uri "" -Method POST -Body $testPayload -ContentType "application/json" -TimeoutSec 15
    Write-Host "✅ Agent system responsive" -ForegroundColor Green
    Write-Host "📊 Agents: $($response.result.data.total)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Agent system test failed" -ForegroundColor Red
}

Write-Host "
🎉 Deployment verification complete!" -ForegroundColor Green
