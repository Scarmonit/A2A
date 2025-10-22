#!/bin/bash
# Warp CLI Integration for A2A (Agent-to-Agent) Repository
# This script automates Warp CLI installation, configuration, and workflow optimization
# Based on analysis of Warp CLI documentation

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Warp CLI is installed
check_warp_cli() {
    if command -v warp-cli &> /dev/null; then
        log_info "Warp CLI is already installed (version: $(warp-cli --version))"
        return 0
    else
        log_warn "Warp CLI is not installed"
        return 1
    fi
}

# Function to install Warp CLI on macOS
install_warp_cli_macos() {
    log_info "Installing Warp CLI on macOS..."
    if command -v brew &> /dev/null; then
        brew tap warpdotdev/tap
        brew install warp-cli
        log_info "Warp CLI installed successfully via Homebrew"
    else
        log_warn "Homebrew not found. Please install Homebrew first or download Warp CLI manually"
        log_info "Visit: https://docs.warp.dev/developers/cli#installing-the-cli"
        return 1
    fi
}

# Function to install Warp CLI on Linux
install_warp_cli_linux() {
    log_info "Installing Warp CLI on Linux..."
    curl -fsSL https://releases.warp.dev/warp-cli/install.sh | bash
    log_info "Warp CLI installed successfully"
}

# Function to detect OS and install Warp CLI
install_warp_cli() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        install_warp_cli_macos
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        install_warp_cli_linux
    else
        log_error "Unsupported OS: $OSTYPE"
        return 1
    fi
}

# Function to configure Warp CLI for A2A workflows
configure_warp_cli() {
    log_info "Configuring Warp CLI for A2A workflows..."
    
    # Set up authentication if needed
    if ! warp-cli whoami &> /dev/null; then
        log_warn "Warp CLI not authenticated. Run 'warp-cli login' to authenticate"
    else
        log_info "Warp CLI is authenticated as: $(warp-cli whoami)"
    fi
    
    # Create custom workflow configurations
    log_info "Setting up A2A-specific Warp workflows..."
}

# Function to create Warp workflow for A2A deployment
create_a2a_warp_workflows() {
    log_info "Creating Warp workflows for A2A deployment automation..."
    
    # Create workflows directory if it doesn't exist
    mkdir -p .warp/workflows
    
    # Create deployment workflow
    cat > .warp/workflows/a2a_deploy.yaml << 'EOF'
name: A2A Deploy
description: Deploy A2A agent with automated checks
commands:
  - name: Run Tests
    command: npm test || python -m pytest
  - name: Build
    command: npm run build || python setup.py build
  - name: Deploy
    command: ./deploy.sh
EOF
    
    # Create monitoring workflow
    cat > .warp/workflows/a2a_monitor.yaml << 'EOF'
name: A2A Monitor
description: Monitor A2A agent health and performance
commands:
  - name: Check Status
    command: ./scripts/check_agent_status.sh
  - name: View Logs
    command: tail -f logs/agent.log
  - name: Performance Metrics
    command: ./scripts/performance_metrics.sh
EOF
    
    log_info "Warp workflows created successfully in .warp/workflows/"
}

# Function to optimize Warp CLI usage for A2A
optimize_warp_integration() {
    log_info "Optimizing Warp CLI integration..."
    
    # Add Warp CLI aliases to shell config
    SHELL_CONFIG="$HOME/.bashrc"
    if [[ "$SHELL" == */zsh ]]; then
        SHELL_CONFIG="$HOME/.zshrc"
    fi
    
    # Check if aliases already exist
    if ! grep -q "# A2A Warp CLI Aliases" "$SHELL_CONFIG" 2>/dev/null; then
        log_info "Adding A2A Warp CLI aliases to $SHELL_CONFIG"
        cat >> "$SHELL_CONFIG" << 'EOF'

# A2A Warp CLI Aliases
alias a2a-deploy="warp-cli run a2a_deploy"
alias a2a-monitor="warp-cli run a2a_monitor"
alias a2a-logs="tail -f logs/agent.log"
alias a2a-status="./scripts/check_agent_status.sh"
EOF
        log_info "Aliases added. Run 'source $SHELL_CONFIG' to apply changes"
    else
        log_info "A2A Warp CLI aliases already configured"
    fi
}

# Function to run health check
health_check() {
    log_info "Running Warp CLI health check..."
    
    if check_warp_cli; then
        log_info "✓ Warp CLI is installed and accessible"
        
        if warp-cli whoami &> /dev/null; then
            log_info "✓ Warp CLI is authenticated"
        else
            log_warn "⚠ Warp CLI is not authenticated"
        fi
        
        if [[ -d .warp/workflows ]]; then
            log_info "✓ A2A Warp workflows are configured"
        else
            log_warn "⚠ A2A Warp workflows not found"
        fi
    else
        log_error "✗ Warp CLI is not installed"
        return 1
    fi
}

# Main execution
main() {
    log_info "Starting Warp CLI Integration for A2A..."
    
    case "${1:-setup}" in
        install)
            if ! check_warp_cli; then
                install_warp_cli
            fi
            ;;
        configure)
            configure_warp_cli
            create_a2a_warp_workflows
            optimize_warp_integration
            ;;
        setup)
            if ! check_warp_cli; then
                install_warp_cli
            fi
            configure_warp_cli
            create_a2a_warp_workflows
            optimize_warp_integration
            ;;
        health)
            health_check
            ;;
        *)
            echo "Usage: $0 {install|configure|setup|health}"
            echo "  install   - Install Warp CLI"
            echo "  configure - Configure Warp CLI for A2A"
            echo "  setup     - Full setup (install + configure)"
            echo "  health    - Run health check"
            exit 1
            ;;
    esac
    
    log_info "Warp CLI integration completed successfully!"
}

main "$@"
