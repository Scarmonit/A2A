#!/bin/bash
set -e
echo '🚀 Installing GitHub CLI...'
if command -v gh &> /dev/null; then
    echo '✓ gh CLI already installed'
    gh --version
    exit 0
fi
if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install gh
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
    sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
    sudo apt update && sudo apt install gh -y
else
    echo '❌ Unsupported OS'
    exit 1
fi
echo '✓ GitHub CLI installed successfully'
gh --version
