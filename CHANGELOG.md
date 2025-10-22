# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **GitHub Copilot Integration**: Complete MCP integration for GitHub Copilot
  - Configuration file (.github/copilot/mcp-config.json)
  - VS Code settings template (.vscode/settings.example.json)
  - Comprehensive integration guide (docs/COPILOT_INTEGRATION.md)
  - Quick start guide (docs/COPILOT_QUICKSTART.md)
  - Working examples (examples/copilot-integration-example.ts)
  - Enables Copilot to use 20+ agent types and advanced tools
  - Real-time WebSocket streaming support
  - Permission management and agent-to-agent handoffs
- Full automation setup for Copilot
- CHANGELOG.md for tracking project changes
- CODEOWNERS for code ownership tracking
- SECURITY.md for security vulnerability reporting
- CONTRIBUTING.md for contribution guidelines
- GitHub Actions workflows for CI/CD automation
- Issue and PR templates for standardized contributions

### Changed
- Enhanced copilot-instructions.md with repository-specific context
- Updated .gitignore to exclude build artifacts and dependencies
- Updated README.md with GitHub Copilot integration section

### Fixed
- Build issues with missing @types/uuid dependency
- Syntax error in websocket-server.ts (incomplete getStats method)

## [0.1.0] - 2025-10-22

### Added
- Initial A2A-style MCP Server implementation
- TypeScript support with WebSocket streaming
- Tools: list_agents, describe_agent, open_session, close_session, invoke_agent, handoff, cancel, get_status
- MCP stdio transport plus WebSocket side-channel for streaming
- Railway, Render, Fly.io, and Vercel deployment configurations
- Healthcheck configuration improvements

### Fixed
- Railway deployment healthcheck configuration issue
