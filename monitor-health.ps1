# Multi-Platform Health Monitor for A2A MCP Server
# Monitors Railway, Vercel, and Cloudflare deployments

param(
    [string]$Domain = "",
    [string]$RailwayUrl = "",
    [string]$VercelUrl = "",
    [int]$IntervalSeconds = 60,
    [switch]$Continuous,
    [switch]$Slack,
    [string]$SlackWebhook = ""
)

# Health check endpoints
$Endpoints = @()

if ($RailwayUrl) {
    $Endpoints += @{
        Name = "Railway Primary"
        Url = "$RailwayUrl/healthz"
        Platform = "Railway"
        Critical = $true
        Expected = @{ status = "ok"; platform = "railway" }
    }
    $Endpoints += @{
        Name = "Railway Metrics"
        Url = "$RailwayUrl/metrics"
        Platform = "Railway"
        Critical = $false
        Expected = "a2a_"  # Should contain metrics
    }
}

if ($VercelUrl) {
    $Endpoints += @{
        Name = "Vercel Backup"
        Url = "$VercelUrl/healthz"
        Platform = "Vercel"
        Critical = $false
        Expected = @{ status = "ok"; platform = "vercel" }
    }
}

if ($Domain) {
    $Endpoints += @{
        Name = "Cloudflare Load Balancer"
        Url = "https://mcp.$Domain/healthz"
        Platform = "Cloudflare"
        Critical = $true
        Expected = @{ status = "ok" }
    }
    $Endpoints += @{
        Name = "Primary API"
        Url = "https://api.$Domain/healthz"
        Platform = "Primary"
        Critical = $true
        Expected = @{ status = "ok" }
    }
    $Endpoints += @{
        Name = "Demo Endpoint"
        Url = "https://api.$Domain/demo?msg=health-test&agent=echo"
        Platform = "Demo"
        Critical = $false
        Expected = @{ ok = $true }
    }
}

function Test-Endpoint {
    param($Endpoint)
    
    $result = @{
        Name = $Endpoint.Name
        Platform = $Endpoint.Platform
        Url = $Endpoint.Url
        Status = "Unknown"
        ResponseTime = 0
        Message = ""
        Timestamp = Get-Date
        Critical = $Endpoint.Critical
    }
    
    try {
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
        if ($Endpoint.Url -like "*/metrics") {
            # Text response for metrics
            $response = Invoke-WebRequest -Uri $Endpoint.Url -TimeoutSec 10 -UseBasicParsing
            $stopwatch.Stop()
            $result.ResponseTime = $stopwatch.ElapsedMilliseconds
            
            if ($response.StatusCode -eq 200) {
                if ($response.Content -like "*$($Endpoint.Expected)*") {
                    $result.Status = "Healthy"
                    $result.Message = "Metrics available"
                } else {
                    $result.Status = "Warning"
                    $result.Message = "Metrics format unexpected"
                }
            } else {
                $result.Status = "Unhealthy"
                $result.Message = "HTTP $($response.StatusCode)"
            }
        } else {
            # JSON response
            $response = Invoke-RestMethod -Uri $Endpoint.Url -TimeoutSec 10
            $stopwatch.Stop()
            $result.ResponseTime = $stopwatch.ElapsedMilliseconds
            
            $result.Status = "Healthy"
            $result.Message = "OK"
            
            # Validate expected fields
            if ($Endpoint.Expected -is [hashtable]) {
                foreach ($key in $Endpoint.Expected.Keys) {
                    if ($response.$key -ne $Endpoint.Expected[$key]) {
                        $result.Status = "Warning"
                        $result.Message = "Expected $key=$($Endpoint.Expected[$key]), got $($response.$key)"
                        break
                    }
                }
            }
        }
        
    } catch {
        $stopwatch.Stop()
        $result.ResponseTime = $stopwatch.ElapsedMilliseconds
        $result.Status = "Unhealthy"
        $result.Message = $_.Exception.Message
    }
    
    return $result
}

function Send-SlackAlert {
    param($Results)
    
    if (-not $Slack -or -not $SlackWebhook) { return }
    
    $criticalIssues = $Results | Where-Object { $_.Critical -and $_.Status -eq "Unhealthy" }
    $warnings = $Results | Where-Object { $_.Status -eq "Warning" }
    
    if ($criticalIssues.Count -eq 0 -and $warnings.Count -eq 0) { return }
    
    $color = if ($criticalIssues.Count -gt 0) { "danger" } else { "warning" }
    $title = if ($criticalIssues.Count -gt 0) { "🚨 A2A MCP Critical Issues" } else { "⚠️ A2A MCP Warnings" }
    
    $message = @{
        attachments = @(
            @{
                color = $color
                title = $title
                fields = @()
                ts = [int][double]::Parse((Get-Date -UFormat %s))
            }
        )
    }
    
    foreach ($issue in $criticalIssues) {
        $message.attachments[0].fields += @{
            title = "❌ $($issue.Name)"
            value = "$($issue.Message) ($($issue.ResponseTime)ms)"
            short = $true
        }
    }
    
    foreach ($warning in $warnings) {
        $message.attachments[0].fields += @{
            title = "⚠️ $($warning.Name)"
            value = "$($warning.Message) ($($warning.ResponseTime)ms)"
            short = $true
        }
    }
    
    try {
        Invoke-RestMethod -Uri $SlackWebhook -Method POST -Body ($message | ConvertTo-Json -Depth 10) -ContentType "application/json"
    } catch {
        Write-Host "Failed to send Slack notification: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-HealthReport {
    param($Results)
    
    Clear-Host
    Write-Host "🏥 A2A MCP Server Health Monitor" -ForegroundColor Cyan
    Write-Host "Last check: $(Get-Date)" -ForegroundColor Gray
    Write-Host ("=" * 80) -ForegroundColor Gray
    
    $healthy = $Results | Where-Object { $_.Status -eq "Healthy" }
    $warning = $Results | Where-Object { $_.Status -eq "Warning" }
    $unhealthy = $Results | Where-Object { $_.Status -eq "Unhealthy" }
    
    Write-Host "Summary: " -NoNewline -ForegroundColor White
    Write-Host "$($healthy.Count) Healthy " -NoNewline -ForegroundColor Green
    Write-Host "$($warning.Count) Warning " -NoNewline -ForegroundColor Yellow
    Write-Host "$($unhealthy.Count) Unhealthy" -ForegroundColor Red
    Write-Host ""
    
    foreach ($result in $Results | Sort-Object Critical -Descending, Status) {
        $statusColor = switch ($result.Status) {
            "Healthy" { "Green" }
            "Warning" { "Yellow" }
            "Unhealthy" { "Red" }
            default { "Gray" }
        }
        
        $icon = switch ($result.Status) {
            "Healthy" { "✅" }
            "Warning" { "⚠️" }
            "Unhealthy" { "❌" }
            default { "❓" }
        }
        
        $criticalMark = if ($result.Critical) { " [CRITICAL]" } else { "" }
        
        Write-Host "$icon " -NoNewline -ForegroundColor $statusColor
        Write-Host "$($result.Name)$criticalMark" -NoNewline -ForegroundColor White
        Write-Host " ($($result.Platform)) " -NoNewline -ForegroundColor Gray
        Write-Host "$($result.Status)" -NoNewline -ForegroundColor $statusColor
        Write-Host " - $($result.Message) ($($result.ResponseTime)ms)" -ForegroundColor Gray
    }
    
    Write-Host ""
}

# Main monitoring loop
do {
    $results = @()
    
    Write-Host "🔍 Checking $($Endpoints.Count) endpoints..." -ForegroundColor Yellow
    
    foreach ($endpoint in $Endpoints) {
        $result = Test-Endpoint $endpoint
        $results += $result
        
        $statusChar = switch ($result.Status) {
            "Healthy" { "✓" }
            "Warning" { "!" }
            "Unhealthy" { "✗" }
            default { "?" }
        }
        Write-Host "$statusChar $($result.Name)" -NoNewline
        if ($result.ResponseTime -gt 0) {
            Write-Host " ($($result.ResponseTime)ms)" -ForegroundColor Gray
        } else {
            Write-Host ""
        }
    }
    
    Show-HealthReport $results
    Send-SlackAlert $results
    
    if ($Continuous) {
        Write-Host "Next check in $IntervalSeconds seconds... (Ctrl+C to stop)" -ForegroundColor Gray
        Start-Sleep -Seconds $IntervalSeconds
    }
    
} while ($Continuous)

# Export results to JSON for external processing
$results | ConvertTo-Json -Depth 10 | Out-File "health-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json"
Write-Host "📄 Health report saved to health-report-$(Get-Date -Format 'yyyyMMdd-HHmmss').json" -ForegroundColor Green