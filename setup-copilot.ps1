# A2A MCP Server - Copilot Integration Setup Script (PowerShell)
# This script helps you configure A2A MCP Server with GitHub Copilot on Windows

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "A2A MCP Server - Copilot Setup" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Get absolute path to A2A directory
$A2A_PATH = Split-Path -Parent $MyInvocation.MyCommand.Path
Write-Host "A2A installation path: $A2A_PATH" -ForegroundColor Green
Write-Host ""

# Check Node.js version
Write-Host "Checking Node.js version..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    
    if ($versionNumber -lt 20) {
        Write-Host "Node.js version 20 or higher is required. Current version: $nodeVersion" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✓ Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "Node.js is not installed. Please install Node.js 20.x or higher." -ForegroundColor Red
    exit 1
}
Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Build the project
Write-Host "Building the project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Determine config directories
$CLAUDE_CONFIG_DIR = "$env:APPDATA\Claude"
$COPILOT_CONFIG_DIR = "$env:USERPROFILE\.config\github-copilot"

Write-Host "Select integration type:" -ForegroundColor Yellow
Write-Host "1) GitHub Copilot CLI"
Write-Host "2) Claude Desktop"
Write-Host "3) Both"
Write-Host "4) Manual (just show config)"
$choice = Read-Host "Enter choice (1-4)"

switch ($choice) {
    {$_ -in "1", "3"} {
        Write-Host ""
        Write-Host "Configuring GitHub Copilot CLI..." -ForegroundColor Yellow
        
        # Create directory if it doesn't exist
        if (-not (Test-Path $COPILOT_CONFIG_DIR)) {
            New-Item -ItemType Directory -Force -Path $COPILOT_CONFIG_DIR | Out-Null
        }
        
        $MCP_CONFIG = Join-Path $COPILOT_CONFIG_DIR "mcp.json"
        
        # Backup existing config
        if (Test-Path $MCP_CONFIG) {
            Write-Host "Backing up existing config to mcp.json.backup" -ForegroundColor Yellow
            Copy-Item $MCP_CONFIG "$MCP_CONFIG.backup"
        }
        
        # Convert Windows path to forward slashes for JSON
        $jsonPath = $A2A_PATH -replace '\\', '/'
        
        $config = @{
            mcpServers = @{
                a2a = @{
                    command = "node"
                    args = @("$A2A_PATH\dist\index.js")
                    env = @{
                        ENABLE_STREAMING = "true"
                        STREAM_PORT = "8787"
                        STREAM_HOST = "127.0.0.1"
                        MAX_CONCURRENCY = "50"
                        LOG_LEVEL = "info"
                    }
                }
            }
        } | ConvertTo-Json -Depth 10
        
        Set-Content -Path $MCP_CONFIG -Value $config
        Write-Host "✓ GitHub Copilot configuration created at: $MCP_CONFIG" -ForegroundColor Green
    }
}

switch ($choice) {
    {$_ -in "2", "3"} {
        Write-Host ""
        Write-Host "Configuring Claude Desktop..." -ForegroundColor Yellow
        
        # Create directory if it doesn't exist
        if (-not (Test-Path $CLAUDE_CONFIG_DIR)) {
            New-Item -ItemType Directory -Force -Path $CLAUDE_CONFIG_DIR | Out-Null
        }
        
        $CLAUDE_CONFIG = Join-Path $CLAUDE_CONFIG_DIR "claude_desktop_config.json"
        
        # Backup existing config
        if (Test-Path $CLAUDE_CONFIG) {
            Write-Host "Backing up existing config to claude_desktop_config.json.backup" -ForegroundColor Yellow
            Copy-Item $CLAUDE_CONFIG "$CLAUDE_CONFIG.backup"
        }
        
        $config = @{
            mcpServers = @{
                a2a = @{
                    command = "node"
                    args = @("$A2A_PATH\dist\index.js")
                    env = @{
                        ENABLE_STREAMING = "true"
                        STREAM_PORT = "8787"
                        MAX_CONCURRENCY = "50"
                    }
                }
            }
        } | ConvertTo-Json -Depth 10
        
        Set-Content -Path $CLAUDE_CONFIG -Value $config
        Write-Host "✓ Claude Desktop configuration created at: $CLAUDE_CONFIG" -ForegroundColor Green
    }
}

if ($choice -eq "4") {
    Write-Host ""
    Write-Host "Manual Configuration" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For GitHub Copilot CLI, add to $COPILOT_CONFIG_DIR\mcp.json:" -ForegroundColor Blue
    Write-Host ""
    Write-Host @"
{
  "mcpServers": {
    "a2a": {
      "command": "node",
      "args": ["$A2A_PATH\\dist\\index.js"],
      "env": {
        "ENABLE_STREAMING": "true",
        "STREAM_PORT": "8787",
        "MAX_CONCURRENCY": "50"
      }
    }
  }
}
"@
    Write-Host ""
    Write-Host "For Claude Desktop, add to $CLAUDE_CONFIG_DIR\claude_desktop_config.json" -ForegroundColor Blue
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Restart GitHub Copilot CLI or Claude Desktop"
Write-Host "2. Test the integration:"
Write-Host "   @a2a list all available agents" -ForegroundColor Blue
Write-Host ""
Write-Host "For more information:" -ForegroundColor Yellow
Write-Host "- Read COPILOT_INTEGRATION.md for detailed guide"
Write-Host "- Check examples in the examples/ directory"
Write-Host "- Visit https://github.com/Scarmonit/A2A for documentation"
Write-Host ""
Write-Host "Happy coding with A2A! 🚀" -ForegroundColor Green
