# OpenSSH Server Setup for Windows Server 2025

## Overview
Complete guide for installing, configuring, and securing OpenSSH Server on Windows Server 2025 with production best practices and automation integration.

## Prerequisites

### System Requirements
- Windows Server 2025, 2022, 2019, Windows 11, or Windows 10 (build 1809+)
- PowerShell 5.1 or later
- Administrator account membership

### Prerequisite Verification

```powershell
# Check Windows version
winver.exe

# Verify PowerShell version
$PSVersionTable.PSVersion

# Confirm administrator privileges
(New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
```

## Installation

### Windows Server 2025 (Pre-installed)

OpenSSH is installed by default in Windows Server 2025.

#### Enable via Server Manager (GUI)

1. Open **Server Manager**
2. Navigate to **Local Server** in the left pane
3. Locate **Remote SSH Access** in Properties
4. Click **Disabled** to enable the OpenSSH service

#### Enable via PowerShell

```powershell
# Start the SSH service
Start-Service sshd

# Set to start automatically
Set-Service -Name sshd -StartupType Automatic

# Verify service status
Get-Service sshd
```

### Earlier Windows Versions (Optional Feature)

```powershell
# Install OpenSSH Server
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Start and enable service
Start-Service sshd
Set-Service -Name sshd -StartupType Automatic
```

## Firewall Configuration

### Create Firewall Rule

```powershell
# Allow SSH traffic on port 22
New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' `
  -DisplayName 'OpenSSH Server (TCP)' `
  -Protocol TCP `
  -Action Allow `
  -Direction Inbound `
  -LocalPort 22 `
  -Enabled True

# Verify rule creation
Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP'
```

### Custom Port Configuration (Optional)

```powershell
# For custom port (e.g., 2222)
New-NetFirewallRule -Name 'OpenSSH-Server-Custom-TCP' `
  -DisplayName 'OpenSSH Server Custom Port (TCP)' `
  -Protocol TCP `
  -Action Allow `
  -Direction Inbound `
  -LocalPort 2222 `
  -Enabled True
```

## Security Configuration

### SSH Configuration File Location

```
C:\ProgramData\ssh\sshd_config
```

### Best Practice Configuration

```bash
# Edit sshd_config with administrator privileges

# Authentication Settings
PasswordAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
PermitEmptyPasswords no

# Security Enhancements
MaxAuthTries 3
LoginGraceTime 60
ClientAliveInterval 300
ClientAliveCountMax 2

# Protocol and Encryption
Protocol 2
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group-exchange-sha256

# Access Control
AllowGroups administrators openssh users
DenyUsers guest

# Logging
SyslogFacility AUTH
LogLevel INFO

# Performance
UseDNS no
X11Forwarding no
```

### Apply Configuration Changes

```powershell
# Restart SSH service to apply changes
Restart-Service sshd

# Test configuration
sshd -t
```

## Key-Based Authentication

### Generate SSH Keys (Client-Side)

```powershell
# Generate ED25519 key (recommended)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Or generate RSA key (4096-bit minimum)
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Generate ECDSA key
ssh-keygen -t ecdsa -b 521 -C "your_email@example.com"
```

### Deploy Public Key (Server-Side)

```powershell
# Create .ssh directory in user profile
$userProfile = $env:USERPROFILE
New-Item -Path "$userProfile\.ssh" -ItemType Directory -Force

# Set appropriate permissions
$acl = Get-Acl "$userProfile\.ssh"
$acl.SetAccessRuleProtection($true, $false)
$administratorsRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  "BUILTIN\Administrators", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$ownerRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  $env:USERNAME, "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.AddAccessRule($administratorsRule)
$acl.AddAccessRule($ownerRule)
Set-Acl "$userProfile\.ssh" $acl

# Add public key to authorized_keys
Add-Content -Path "$userProfile\.ssh\authorized_keys" -Value (Get-Content "path\to\id_ed25519.pub")

# Set authorized_keys permissions
icacls "$userProfile\.ssh\authorized_keys" /inheritance:r /grant:r "$(($env:USERNAME)):F" /grant:r "BUILTIN\Administrators:F"
```

### Administrators Group Special Configuration

```powershell
# For administrators, authorized_keys must be in ProgramData
$adminKeys = "C:\ProgramData\ssh\administrators_authorized_keys"
New-Item -Path $adminKeys -ItemType File -Force

# Copy public key content
Add-Content -Path $adminKeys -Value (Get-Content "path\to\id_ed25519.pub")

# Set correct permissions (SYSTEM and Administrators only)
icacls $adminKeys /inheritance:r /grant:r "SYSTEM:F" /grant:r "BUILTIN\Administrators:F"
```

## User Access Management

### OpenSSH Users Group

```powershell
# Add user to OpenSSH Users group
Add-LocalGroupMember -Group "openssh users" -Member "username"

# Verify group membership
Get-LocalGroupMember -Group "openssh users"

# Remove user from group
Remove-LocalGroupMember -Group "openssh users" -Member "username"
```

### Configuration-Based Access Control

Edit `C:\ProgramData\ssh\sshd_config`:

```bash
# Allow specific users
AllowUsers user1 user2 admin@192.168.1.100

# Allow specific groups
AllowGroups "openssh users" administrators

# Deny specific users
DenyUsers guest testuser

# Deny specific groups
DenyGroups guests
```

## Connection and Testing

### Connect from Client

```powershell
# Basic connection
ssh domain\username@servername

# Or with IP address
ssh username@192.168.1.100

# Specify key file
ssh -i ~/.ssh/id_ed25519 username@servername

# Custom port
ssh -p 2222 username@servername

# Verbose mode (troubleshooting)
ssh -vvv username@servername
```

### First Connection

On first connection, you'll see:

```
The authenticity of host 'servername (10.00.00.001)' can't be established.
ECDSA key fingerprint is SHA256:...
Are you sure you want to continue connecting (yes/no)?
```

Type `yes` to add the server to known hosts.

### Test Authentication

```powershell
# Test SSH connection without executing commands
ssh -T username@servername

# Test with specific identity file
ssh -T -i ~/.ssh/id_ed25519 username@servername
```

## Advanced Configuration

### Default Shell Configuration

```powershell
# Set PowerShell as default shell
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
  -Value "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" `
  -PropertyType String -Force

# Set PowerShell Core 7+ as default
New-ItemProperty -Path "HKLM:\SOFTWARE\OpenSSH" -Name DefaultShell `
  -Value "C:\Program Files\PowerShell\7\pwsh.exe" `
  -PropertyType String -Force
```

### SSH Agent Configuration

```powershell
# Start SSH Agent service
Start-Service ssh-agent

# Set to start automatically
Set-Service -Name ssh-agent -StartupType Automatic

# Add private key to agent
ssh-add ~/.ssh/id_ed25519

# List loaded keys
ssh-add -l
```

### Port Forwarding Configuration

Edit `sshd_config`:

```bash
# Allow TCP forwarding
AllowTcpForwarding yes

# Allow agent forwarding
AllowAgentForwarding yes

# Gateway ports for remote forwarding
GatewayPorts no
```

### Banner Configuration

```powershell
# Create banner file
$bannerPath = "C:\ProgramData\ssh\banner.txt"
@"
WARNING: Unauthorized access to this system is forbidden!
All connections are monitored and recorded.
"@ | Out-File -FilePath $bannerPath -Encoding ASCII
```

Edit `sshd_config`:

```bash
Banner C:/ProgramData/ssh/banner.txt
```

## Monitoring and Logging

### Event Logging

```powershell
# View SSH service events
Get-WinEvent -LogName "OpenSSH/Operational" -MaxEvents 50

# Filter for authentication failures
Get-WinEvent -FilterHashtable @{
  LogName='OpenSSH/Operational'
  ID=4
} -MaxEvents 20

# Export logs
Get-WinEvent -LogName "OpenSSH/Operational" | Export-Csv -Path "ssh_logs.csv"
```

### Performance Monitoring

```powershell
# Monitor active SSH connections
Get-NetTCPConnection -LocalPort 22 -State Established

# View SSH service details
Get-Service sshd | Format-List *

# Check SSH process
Get-Process sshd
```

## Automation Integration

### PowerShell Remoting over SSH

```powershell
# Enable PowerShell remoting
Enable-PSRemoting -Force

# Configure SSH subsystem in sshd_config
# Add: Subsystem powershell C:/Program Files/PowerShell/7/pwsh.exe -sshs -NoLogo

# Connect via SSH
Enter-PSSession -HostName servername -UserName username

# Execute remote commands
Invoke-Command -HostName servername -UserName username -ScriptBlock { Get-Process }
```

### Ansible Integration

```yaml
# ansible.cfg
[defaults]
host_key_checking = False
interpreter_python = auto_silent

[ssh_connection]
ssh_args = -o ControlMaster=auto -o ControlPersist=60s
pipelining = True
```

```yaml
# inventory.yml
windows_servers:
  hosts:
    server1:
      ansible_host: 192.168.1.100
      ansible_user: administrator
      ansible_ssh_private_key_file: ~/.ssh/id_ed25519
      ansible_connection: ssh
      ansible_shell_type: powershell
```

### A2A Integration

```typescript
// Example: SSH connection management in A2A
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function executeRemoteCommand(host: string, command: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(
      `ssh -o StrictHostKeyChecking=no ${host} "${command}"`
    );
    return stdout;
  } catch (error) {
    throw new Error(`SSH command failed: ${error}`);
  }
}

// Usage with A2A agents
const result = await executeRemoteCommand(
  'admin@windows-server',
  'Get-Service | Where-Object {$_.Status -eq "Running"}'
);
```

## Troubleshooting

### Common Issues

#### Connection Refused

```powershell
# Check if service is running
Get-Service sshd

# Check firewall rule
Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP'

# Test local connection
ssh localhost
```

#### Permission Denied (publickey)

```powershell
# Verify authorized_keys permissions
icacls "$env:USERPROFILE\.ssh\authorized_keys"

# Check sshd_config
Get-Content C:\ProgramData\ssh\sshd_config | Select-String -Pattern "PubkeyAuthentication"

# Enable debug logging
# Edit sshd_config: LogLevel DEBUG3
Restart-Service sshd
```

#### Key File Permissions Issues

```powershell
# Fix private key permissions (client-side)
icacls "$env:USERPROFILE\.ssh\id_ed25519" /inheritance:r /grant:r "$(($env:USERNAME)):R"

# Fix authorized_keys permissions (server-side)
icacls "$env:USERPROFILE\.ssh\authorized_keys" /inheritance:r /grant:r "$(($env:USERNAME)):F"
```

### Debug Mode

```powershell
# Stop service
Stop-Service sshd

# Run in debug mode
sshd -d -d -d

# In another terminal, attempt connection
ssh -vvv username@localhost
```

## Security Hardening Checklist

- [ ] Disable password authentication
- [ ] Use key-based authentication only
- [ ] Change default port (optional)
- [ ] Configure strict file permissions
- [ ] Enable firewall rules
- [ ] Set up access control (AllowUsers/AllowGroups)
- [ ] Configure idle timeout
- [ ] Limit authentication attempts
- [ ] Disable root/administrator direct login
- [ ] Enable logging and monitoring
- [ ] Use strong key algorithms (ED25519/RSA 4096)
- [ ] Regular security audits
- [ ] Keep OpenSSH updated
- [ ] Implement fail2ban equivalent (Windows Firewall dynamic blocking)
- [ ] Use SSH certificates for large deployments

## Performance Optimization

```bash
# sshd_config optimizations
UseDNS no
Compression delayed
MaxStartups 10:30:100
MaxSessions 10

# Enable connection multiplexing (client-side ~/.ssh/config)
Host *
  ControlMaster auto
  ControlPath ~/.ssh/controlmasters/%r@%h:%p
  ControlPersist 10m
  Compression yes
```

## Backup and Recovery

```powershell
# Backup SSH configuration
$backupPath = "C:\Backups\SSH_$(Get-Date -Format 'yyyyMMdd')"
New-Item -Path $backupPath -ItemType Directory -Force

Copy-Item "C:\ProgramData\ssh\*" -Destination $backupPath -Recurse
Copy-Item "$env:USERPROFILE\.ssh\*" -Destination "$backupPath\user_keys" -Recurse

# Create backup script
$script = @'
$date = Get-Date -Format "yyyyMMdd_HHmmss"
$backup = "C:\Backups\SSH_$date"
New-Item -Path $backup -ItemType Directory -Force
Copy-Item "C:\ProgramData\ssh\*" -Destination $backup -Recurse
Write-Host "SSH backup completed: $backup"
'@

$script | Out-File -FilePath "C:\Scripts\Backup-SSH.ps1"

# Schedule backup task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\Scripts\Backup-SSH.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At "2:00AM"
Register-ScheduledTask -TaskName "SSH-DailyBackup" -Action $action -Trigger $trigger -RunLevel Highest
```

## Compliance and Auditing

```powershell
# Generate security audit report
$report = @{
  ServiceStatus = (Get-Service sshd).Status
  StartupType = (Get-Service sshd).StartType
  ConfigFile = Test-Path "C:\ProgramData\ssh\sshd_config"
  AuthorizedUsers = (Get-LocalGroupMember -Group "openssh users").Name
  FirewallRule = (Get-NetFirewallRule -Name 'OpenSSH-Server-In-TCP').Enabled
  RecentConnections = (Get-NetTCPConnection -LocalPort 22 -State Established).Count
  LastModified = (Get-Item "C:\ProgramData\ssh\sshd_config").LastWriteTime
}

$report | ConvertTo-Json | Out-File "SSH_Audit
