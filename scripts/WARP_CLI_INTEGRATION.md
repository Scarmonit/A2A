# Warp CLI Integration for A2A

## Overview

This document describes the Warp CLI integration for the A2A (Agent-to-Agent) repository. The integration provides automated workflows for deployment, monitoring, and optimization of A2A agents using Warp's powerful CLI tools.

## Features

- **Automated Installation**: Detects your operating system and installs Warp CLI automatically
- **Workflow Automation**: Pre-configured workflows for common A2A tasks
- **Health Monitoring**: Built-in health checks and status monitoring
- **Shell Integration**: Custom aliases for quick access to A2A commands
- **Cross-Platform Support**: Works on macOS and Linux

## Installation

### Quick Setup

Run the complete setup with a single command:

```bash
./scripts/warp_cli_integration.sh setup
```

This will:
1. Install Warp CLI if not already installed
2. Configure Warp CLI for A2A workflows
3. Create custom workflow files
4. Set up shell aliases

### Manual Installation

If you prefer to install components separately:

```bash
# Install Warp CLI only
./scripts/warp_cli_integration.sh install

# Configure workflows and aliases
./scripts/warp_cli_integration.sh configure
```

## Available Commands

### Script Commands

| Command | Description |
|---------|-------------|
| `./scripts/warp_cli_integration.sh setup` | Complete setup (install + configure) |
| `./scripts/warp_cli_integration.sh install` | Install Warp CLI only |
| `./scripts/warp_cli_integration.sh configure` | Configure workflows and aliases |
| `./scripts/warp_cli_integration.sh health` | Run health check |

### Shell Aliases (after setup)

Once configured, you can use these convenient aliases:

| Alias | Description |
|-------|-------------|
| `a2a-deploy` | Run the A2A deployment workflow |
| `a2a-monitor` | Start monitoring A2A agent |
| `a2a-logs` | View real-time agent logs |
| `a2a-status` | Check agent status |

## Workflows

### A2A Deploy Workflow

Automated deployment workflow that:
- Runs tests (npm or pytest)
- Builds the project
- Executes deployment script

**Location**: `.warp/workflows/a2a_deploy.yaml`

**Usage**:
```bash
a2a-deploy
# or
warp-cli run a2a_deploy
```

### A2A Monitor Workflow

Monitoring workflow that provides:
- Agent status checks
- Real-time log viewing
- Performance metrics

**Location**: `.warp/workflows/a2a_monitor.yaml`

**Usage**:
```bash
a2a-monitor
# or
warp-cli run a2a_monitor
```

## Configuration Files

The integration creates the following files:

```
.warp/
└── workflows/
    ├── a2a_deploy.yaml    # Deployment workflow
    └── a2a_monitor.yaml   # Monitoring workflow
```

## Authentication

If Warp CLI requires authentication:

```bash
warp-cli login
```

Follow the prompts to authenticate with your Warp account.

## Health Check

Run a comprehensive health check to verify your setup:

```bash
./scripts/warp_cli_integration.sh health
```

This will check:
- ✓ Warp CLI installation
- ✓ Authentication status
- ✓ Workflow configuration

## Troubleshooting

### Issue: Warp CLI not found after installation

**Solution**: Reload your shell configuration
```bash
source ~/.bashrc  # or ~/.zshrc
```

### Issue: Permission denied when running script

**Solution**: Make the script executable
```bash
chmod +x scripts/warp_cli_integration.sh
```

### Issue: Homebrew not found (macOS)

**Solution**: Install Homebrew first
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Issue: Workflows not appearing

**Solution**: Verify workflow files exist
```bash
ls -la .warp/workflows/
```

## Advanced Configuration

### Custom Workflows

You can create custom workflows in `.warp/workflows/`. Example:

```yaml
name: Custom A2A Workflow
description: Your custom workflow description
commands:
  - name: Step 1
    command: echo "Custom command"
  - name: Step 2
    command: ./custom_script.sh
```

### Environment Variables

Set these environment variables for advanced configuration:

```bash
export WARP_CLI_CONFIG_PATH="/custom/path/.warp"
export A2A_LOG_LEVEL="debug"
```

## Integration with CI/CD

Integrate Warp CLI workflows into your CI/CD pipeline:

### GitHub Actions Example

```yaml
name: A2A Deploy
on: [push]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Warp CLI
        run: ./scripts/warp_cli_integration.sh install
      - name: Deploy
        run: ./scripts/warp_cli_integration.sh setup
```

## Benefits

1. **Efficiency**: Automated workflows reduce manual deployment time
2. **Consistency**: Standardized processes across the team
3. **Visibility**: Built-in monitoring and logging
4. **Flexibility**: Easy to customize and extend
5. **Reliability**: Health checks ensure system integrity

## Resources

- [Warp CLI Documentation](https://docs.warp.dev/developers/cli)
- [A2A Repository](https://github.com/Scarmonit/A2A)
- [Warp Terminal](https://www.warp.dev/)

## Contributing

Contributions to improve the Warp CLI integration are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This integration follows the same license as the A2A repository.

## Support

For issues or questions:
- Open an issue in the A2A repository
- Check existing documentation
- Review Warp CLI official docs

---

**Last Updated**: October 22, 2025
**Version**: 1.0.0
