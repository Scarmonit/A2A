<#
.SYNOPSIS
    Automated OpenSSH Server setup for Windows Server 2025

.DESCRIPTION
    Complete automation script for installing, configuring, and securing
    OpenSSH Server on Windows with best practices and A2A integration.

.PARAMETER EnableKeyAuth
    Enable key-based authentication and disable password auth

.PARAMETER CustomPort
    Custom SSH port (default: 22)

.PARAMETER AllowedUsers
    Array of users to add to openssh users group

.PARAMETER SetupFirewall
    Configure firewall rules automatically

.PARAMETER HardenConfig
    Apply security hardening configuration

.EXAMPLE
    .\openssh-setup.ps1 -EnableKeyAuth -SetupFirewall -HardenConfig

.NOTES
    Author: A2A Project Team
    Requires: Administrator privileges
    Version: 1.0.0
#>

[CmdletBinding()]
param(
    [switch]$EnableKeyAuth,
    [int]$CustomPort = 22,
    [string[]]$AllowedUsers = @(),
    [switch]$SetupFirewall,
    [switch]$HardenConfig,
    [switch]$SetupMonitoring,
    [string]$DefaultShell = 'powershell'
)

# Ensure running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

Write-Host "=== OpenSSH Server Setup for Windows Server 2025 ===" -ForegroundColor Cyan
Write-Host ""

# Function to log messages
function Write-Log {
    param([string]$Message, [string]$Level = 'Info')
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $color = switch ($Level) {
        'Success' { 'Green' }
        'Warning' { 'Yellow' }
        'Error' { 'Red' }
        default { 'White' }
    }
    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color
}

# Step 1: Check prerequisites
Write-Log "Checking prerequisites..." 'Info'

$osVersion = [System.Environment]::OSVersion.Version
if ($osVersion.Major -lt 10) {
    Write-Log "Unsupported Windows version. Requires Windows 10/Server 2016 or later" 'Error'
    exit 1
}

$psVersion = $PSVersionTable.PSVersion
if ($psVersion.Major -lt 5 -or ($psVersion.Major -eq 5 -and $psVersion.Minor -lt 1)) {
    Write-Log "PowerShell 5.1 or later required. Current: $($psVersion.ToString())" 'Error'
    exit 1
}

Write-Log "Prerequisites met: Windows $($osVersion.ToString()), PowerShell $($psVersion.ToString())" 'Success'

# Step 2: Install/Enable OpenSSH Server
Write-Log "Configuring OpenSSH Server..." 'Info'

try {
    # Check if OpenSSH is installed
    $sshService = Get-Service -Name sshd -ErrorAction SilentlyContinue
    
    if (-not $sshService) {
        Write-Log "OpenSSH Server not found. Installing..." 'Info'
        
        # For Windows Server 2025, it should be pre-installed
        # For earlier versions, install as optional feature
        $capability = Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'
        
        if ($capability.State -ne 'Installed') {
            Write-Log "Installing OpenSSH.Server..." 'Info'
            Add-WindowsCapability -Online -Name $capability.Name
            Write-Log "OpenSSH Server installed successfully" 'Success'
        }
    } else {
        Write-Log "OpenSSH Server already installed" 'Success'
    }
    
    # Start and enable service
    Write-Log "Starting SSH service..." 'Info'
    Start-Service sshd -ErrorAction Stop
    Set-Service -Name sshd -StartupType Automatic -ErrorAction Stop
    
    Write-Log "SSH service started and set to automatic" 'Success'
    
} catch {
    Write-Log "Failed to configure SSH service: $($_.Exception.Message)" 'Error'
    exit 1
}

# Step 3: Configure firewall
if ($SetupFirewall) {
    Write-Log "Configuring firewall rules..." 'Info'
    
    try {
        $ruleName = 'OpenSSH-Server-In-TCP'
        $existingRule = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
        
        if ($existingRule) {
            Write-Log "Firewall rule already exists. Updating..." 'Warning'
            Remove-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
        }
        
        New-NetFirewallRule -Name $ruleName `
            -DisplayName 'OpenSSH Server (TCP)' `
            -Protocol TCP `
            -Action Allow `
            -Direction Inbound `
            -LocalPort $CustomPort `
            -Enabled True `
            -Profile Any | Out-Null
        
        Write-Log "Firewall rule created for port $CustomPort" 'Success'
        
    } catch {
        Write-Log "Failed to configure firewall: $($_.Exception.Message)" 'Error'
    }
}

# Step 4: Security hardening
if ($HardenConfig) {
    Write-Log "Applying security hardening configuration..." 'Info'
    
    $configPath = 'C:\ProgramData\ssh\sshd_config'
    
    if (-not (Test-Path $configPath)) {
        Write-Log "sshd_config not found at $configPath" 'Error'
    } else {
        try {
            # Backup original config
            $backupPath = "$configPath.backup.$(Get-Date -Format 'yyyyMMddHHmmss')"
            Copy-Item $configPath $backupPath
            Write-Log "Backed up config to $backupPath" 'Success'
            
            # Read current config
            $config = Get-Content $configPath
            
            # Apply hardening settings
            $hardenedConfig = @"
# A2A Hardened SSH Configuration
# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

# Network
Port $CustomPort
AddressFamily any
ListenAddress 0.0.0.0

# Authentication
PasswordAuthentication $(if ($EnableKeyAuth) { 'no' } else { 'yes' })
PubkeyAuthentication yes
PermitRootLogin no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
KerberosAuthentication no
GSSAPIAuthentication no

# Security
MaxAuthTries 3
MaxSessions 10
LoginGraceTime 60
ClientAliveInterval 300
ClientAliveCountMax 2

# Protocol and Encryption
Protocol 2
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group-exchange-sha256

# Features
X11Forwarding no
AllowTcpForwarding yes
AllowAgentForwarding yes
PermitTunnel no
GatewayPorts no

# Performance
UseDNS no
Compression delayed

# Logging
SyslogFacility AUTH
LogLevel INFO

# Subsystems
Subsystem powershell C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -sshs -NoLogo -NoProfile
Subsystem sftp sftp-server.exe

# Access Control
"@

            if ($AllowedUsers.Count -gt 0) {
                $hardenedConfig += "`nAllowUsers $($AllowedUsers -join ' ')"
            }
            
            $hardenedConfig += "`nAllowGroups administrators \"openssh users\""
            
            # Write new config
            $hardenedConfig | Out-File -FilePath $configPath -Encoding ASCII -Force
            
            Write-Log "Security hardening applied successfully" 'Success'
            
            # Restart service to apply changes
            Restart-Service sshd
            Write-Log "SSH service restarted" 'Success'
            
        } catch {
            Write-Log "Failed to apply hardening: $($_.Exception.Message)" 'Error'
        }
    }
}

# Step 5: Configure key-based authentication
if ($EnableKeyAuth) {
    Write-Log "Configuring key-based authentication..." 'Info'
    
    try {
        $sshDir = "$env:ProgramData\ssh"
        $adminKeysFile = "$sshDir\administrators_authorized_keys"
        
        # Create administrators_authorized_keys if it doesn't exist
        if (-not (Test-Path $adminKeysFile)) {
            New-Item -Path $adminKeysFile -ItemType File -Force | Out-Null
            Write-Log "Created administrators_authorized_keys file" 'Success'
        }
        
        # Set correct permissions (SYSTEM and Administrators only)
        $acl = Get-Acl $adminKeysFile
        $acl.SetAccessRuleProtection($true, $false)
        
        # Remove all existing rules
        $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }
        
        # Add SYSTEM and Administrators
        $systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            'NT AUTHORITY\SYSTEM', 'FullControl', 'Allow'
        )
        $adminRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            'BUILTIN\Administrators', 'FullControl', 'Allow'
        )
        
        $acl.AddAccessRule($systemRule)
        $acl.AddAccessRule($adminRule)
        Set-Acl -Path $adminKeysFile -AclObject $acl
        
        Write-Log "Configured administrators_authorized_keys permissions" 'Success'
        Write-Log "Add public keys to: $adminKeysFile" 'Info'
        
    } catch {
        Write-Log "Failed to configure key auth: $($_.Exception.Message)" 'Error'
    }
}

# Step 6: Configure allowed users
if ($AllowedUsers.Count -gt 0) {
    Write-Log "Configuring user access..." 'Info'
    
    foreach ($user in $AllowedUsers) {
        try {
            # Check if user exists
            $userExists = Get-LocalUser -Name $user -ErrorAction SilentlyContinue
            
            if ($userExists) {
                # Add to openssh users group
                Add-LocalGroupMember -Group 'openssh users' -Member $user -ErrorAction SilentlyContinue
                Write-Log "Added $user to openssh users group" 'Success'
            } else {
                Write-Log "User $user does not exist" 'Warning'
            }
        } catch {
            Write-Log "Failed to add $user to group: $($_.Exception.Message)" 'Warning'
        }
    }
}

# Step 7: Configure default shell
if ($DefaultShell) {
    Write-Log "Configuring default shell..." 'Info'
    
    try {
        $shellPath = switch ($DefaultShell.ToLower()) {
            'powershell' { 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe' }
            'pwsh' { 'C:\\Program Files\\PowerShell\\7\\pwsh.exe' }
            'cmd' { 'C:\\Windows\\System32\\cmd.exe' }
            default { $DefaultShell }
        }
        
        if (Test-Path $shellPath) {
            New-ItemProperty -Path 'HKLM:\\SOFTWARE\\OpenSSH' -Name DefaultShell `
                -Value $shellPath -PropertyType String -Force | Out-Null
            
            Write-Log "Default shell set to: $shellPath" 'Success'
        } else {
            Write-Log "Shell path not found: $shellPath" 'Warning'
        }
    } catch {
        Write-Log "Failed to set default shell: $($_.Exception.Message)" 'Warning'
    }
}

# Step 8: Setup monitoring
if ($SetupMonitoring) {
    Write-Log "Setting up SSH monitoring..." 'Info'
    
    try {
        # Create monitoring script
        $monitorScript = @'
$connections = Get-NetTCPConnection -LocalPort 22 -State Established -ErrorAction SilentlyContinue
$serviceStatus = Get-Service sshd

$status = @{
    Timestamp = Get-Date -Format 'o'
    ServiceStatus = $serviceStatus.Status
    ActiveConnections = $connections.Count
    Connections = $connections | Select-Object RemoteAddress, RemotePort, State
}

$status | ConvertTo-Json -Depth 3
'@
        
        $scriptPath = 'C:\\Scripts\\Monitor-SSH.ps1'
        $scriptDir = Split-Path $scriptPath
        
        if (-not (Test-Path $scriptDir)) {
            New-Item -Path $scriptDir -ItemType Directory -Force | Out-Null
        }
        
        $monitorScript | Out-File -FilePath $scriptPath -Encoding UTF8 -Force
        Write-Log "Created monitoring script: $scriptPath" 'Success'
        
    } catch {
        Write-Log "Failed to setup monitoring: $($_.Exception.Message)" 'Warning'
    }
}

# Step 9: Generate status report
Write-Log "Generating configuration report..." 'Info'

$report = @{
    Timestamp = Get-Date -Format 'o'
    Hostname = $env:COMPUTERNAME
    ServiceStatus = (Get-Service sshd).Status
    ServiceStartType = (Get-Service sshd).StartType
    ConfigFile = 'C:\\ProgramData\\ssh\\sshd_config'
    Port = $CustomPort
    KeyAuthEnabled = $EnableKeyAuth
    FirewallConfigured = $SetupFirewall
    HardeningApplied = $HardenConfig
    AllowedUsers = $AllowedUsers
    OpenSSHVersion = (Get-Command sshd.exe).Version.ToString()
}

$reportPath = "SSH_Setup_Report_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
$report | ConvertTo-Json | Out-File -FilePath $reportPath -Encoding UTF8

Write-Log "" 'Info'
Write-Log "=== Setup Complete ===" 'Success'
Write-Log "Configuration report saved to: $reportPath" 'Info'
Write-Log "" 'Info'

# Display connection information
Write-Host ""
Write-Host "Connection Information:" -ForegroundColor Cyan
Write-Host "  Host: $env:COMPUTERNAME" -ForegroundColor White
Write-Host "  Port: $CustomPort" -ForegroundColor White
Write-Host "  Command: ssh $(if ($AllowedUsers) { $AllowedUsers[0] } else { 'username' })@$env:COMPUTERNAME" -ForegroundColor Yellow
Write-Host ""

if ($EnableKeyAuth) {
    Write-Host "Key-based authentication enabled!" -ForegroundColor Green
    Write-Host "  Add your public key to: C:\\ProgramData\\ssh\\administrators_authorized_keys" -ForegroundColor White
    Write-Host ""
}

Write-Host "Testing connection..." -ForegroundColor Cyan
try {
    $testResult = Test-NetConnection -ComputerName localhost -Port $CustomPort -InformationLevel Quiet
    if ($testResult) {
        Write-Host "✓ SSH server is reachable on port $CustomPort" -ForegroundColor Green
    } else {
        Write-Host "✗ SSH server not reachable on port $CustomPort" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ Connection test failed" -ForegroundColor Red
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Add public keys for authentication" -ForegroundColor White
Write-Host "  2. Test SSH connection from client" -ForegroundColor White
Write-Host "  3. Review logs in Event Viewer (OpenSSH/Operational)" -ForegroundColor White
Write-Host "  4. Configure monitoring and alerts" -ForegroundColor White
Write-Host ""
