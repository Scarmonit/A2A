# Cloudflare Deployment Script for A2A MCP Server
# This script sets up load balancing between Railway and Vercel deployments

param(
    [Parameter(Mandatory=$true)]
    [string]$Domain,
    
    [Parameter(Mandatory=$true)]
    [string]$CloudflareToken,
    
    [Parameter(Mandatory=$true)]
    [string]$ZoneId,
    
    [string]$RailwayUrl = "",
    
    [string]$VercelUrl = ""
)

$Headers = @{
    "Authorization" = "Bearer $CloudflareToken"
    "Content-Type" = "application/json"
}

Write-Host "🚀 Setting up Cloudflare configuration for A2A MCP Server..." -ForegroundColor Cyan

# Function to create or update DNS record
function Set-DNSRecord {
    param($Name, $Target, $Type = "CNAME", $Proxied = $true)
    
    $recordData = @{
        type = $Type
        name = $Name
        content = $Target
        proxied = $Proxied
        ttl = 300
    }
    
    try {
        # Check if record exists
        $existingRecords = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records?name=$Name.$Domain" -Headers $Headers
        
        if ($existingRecords.result.Count -gt 0) {
            # Update existing record
            $recordId = $existingRecords.result[0].id
            $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records/$recordId" -Method PUT -Headers $Headers -Body ($recordData | ConvertTo-Json)
            Write-Host "✅ Updated DNS record: $Name.$Domain -> $Target" -ForegroundColor Green
        } else {
            # Create new record
            $response = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/dns_records" -Method POST -Headers $Headers -Body ($recordData | ConvertTo-Json)
            Write-Host "✅ Created DNS record: $Name.$Domain -> $Target" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Failed to set DNS record $Name: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Set up DNS records
if ($RailwayUrl) {
    Set-DNSRecord -Name "api" -Target $RailwayUrl -Proxied $true
    Set-DNSRecord -Name "ws" -Target $RailwayUrl -Proxied $false  # WebSocket needs direct connection
    Set-DNSRecord -Name "health" -Target $RailwayUrl -Proxied $true
    Set-DNSRecord -Name "metrics" -Target $RailwayUrl -Proxied $true
}

if ($VercelUrl) {
    Set-DNSRecord -Name "functions" -Target $VercelUrl -Proxied $true
    Set-DNSRecord -Name "backup" -Target $VercelUrl -Proxied $true
}

# Create load balancer pools
Write-Host "🔧 Setting up load balancer pools..." -ForegroundColor Yellow

# Railway pool (primary)
if ($RailwayUrl) {
    $railwayPool = @{
        name = "railway-primary"
        description = "Railway deployment - primary with full MCP capabilities"
        enabled = $true
        minimum_origins = 1
        origins = @(
            @{
                name = "railway-main"
                address = $RailwayUrl
                enabled = $true
                weight = 1
                header = @{}
            }
        )
        origin_steering = @{
            policy = "random"
        }
        monitor = @{
            expected_codes = "200"
            method = "GET"
            path = "/healthz"
            interval = 60
            retries = 2
            timeout = 5
            type = "http"
        }
    }
    
    try {
        $poolResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/load_balancers/pools" -Method POST -Headers $Headers -Body ($railwayPool | ConvertTo-Json -Depth 10)
        $railwayPoolId = $poolResponse.result.id
        Write-Host "✅ Created Railway pool: $railwayPoolId" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create Railway pool: $($_.Exception.Message)" -ForegroundColor Red
        return
    }
}

# Vercel pool (backup)
if ($VercelUrl) {
    $vercelPool = @{
        name = "vercel-backup"
        description = "Vercel deployment - backup with limited MCP capabilities"
        enabled = $true
        minimum_origins = 1
        origins = @(
            @{
                name = "vercel-functions"
                address = $VercelUrl
                enabled = $true
                weight = 1
                header = @{}
            }
        )
        origin_steering = @{
            policy = "random"
        }
        monitor = @{
            expected_codes = "200"
            method = "GET"
            path = "/healthz"
            interval = 60
            retries = 2
            timeout = 5
            type = "http"
        }
    }
    
    try {
        $poolResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/load_balancers/pools" -Method POST -Headers $Headers -Body ($vercelPool | ConvertTo-Json -Depth 10)
        $vercelPoolId = $poolResponse.result.id
        Write-Host "✅ Created Vercel pool: $vercelPoolId" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to create Vercel pool: $($_.Exception.Message)" -ForegroundColor Red
        return
    }
}

# Create main load balancer
if ($railwayPoolId -and $vercelPoolId) {
    Write-Host "⚖️ Setting up main load balancer..." -ForegroundColor Yellow
    
    $loadBalancer = @{
        name = "a2a-mcp-lb"
        description = "A2A MCP Server Load Balancer - Railway primary, Vercel backup"
        enabled = $true
        ttl = 30
        fallback_pool = $railwayPoolId
        default_pools = @($railwayPoolId, $vercelPoolId)
        region_pools = @{
            "ENAM" = @($railwayPoolId)
            "EU" = @($vercelPoolId)
            "APAC" = @($railwayPoolId)
        }
        proxied = $true
        steering_policy = "dynamic_latency"
        session_affinity = "cookie"
    }
    
    try {
        $lbResponse = Invoke-RestMethod -Uri "https://api.cloudflare.com/client/v4/zones/$ZoneId/load_balancers" -Method POST -Headers $Headers -Body ($loadBalancer | ConvertTo-Json -Depth 10)
        Write-Host "✅ Created load balancer: $($lbResponse.result.id)" -ForegroundColor Green
        
        # Set up load balanced domain
        Set-DNSRecord -Name "mcp" -Target "$Domain" -Type "CNAME" -Proxied $true
        
    } catch {
        Write-Host "❌ Failed to create load balancer: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n🎉 Cloudflare setup complete!" -ForegroundColor Green
Write-Host "Your A2A MCP server is now available at:" -ForegroundColor Cyan
if ($RailwayUrl) {
    Write-Host "  🚂 Primary (Railway): https://api.$Domain" -ForegroundColor Blue
    Write-Host "  🔌 WebSocket: wss://ws.$Domain" -ForegroundColor Blue
}
if ($VercelUrl) {
    Write-Host "  ⚡ Backup (Vercel): https://functions.$Domain" -ForegroundColor Blue
}
Write-Host "  ⚖️ Load Balanced: https://mcp.$Domain" -ForegroundColor Green

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Test health endpoints: curl https://api.$Domain/healthz" -ForegroundColor White
Write-Host "2. Test demo: https://api.$Domain/demo?msg=hello" -ForegroundColor White
Write-Host "3. Monitor in Cloudflare dashboard" -ForegroundColor White