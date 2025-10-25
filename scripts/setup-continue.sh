#!/usr/bin/env bash
set -Eeuo pipefail

# Automated Continue.dev setup script
# - Installs Continue CLI
# - Creates ~/.continue directory structure
# - Copies config templates if present in repo
# - Initializes MCP servers
# - Indexes codebase with Voyage AI via Continue
# - Validates configuration
# - Prints completion report

RED="\033[31m"; GREEN="\033[32m"; YELLOW="\033[33m"; BLUE="\033[34m"; BOLD="\033[1m"; RESET="\033[0m"
log() { printf "%b[%s]%b %s\n" "$BLUE" "setup" "$RESET" "$1"; }
ok() { printf "%b[%s]%b %s\n" "$GREEN" "ok" "$RESET" "$1"; }
warn() { printf "%b[%s]%b %s\n" "$YELLOW" "warn" "$RESET" "$1"; }
err() { printf "%b[%s]%b %s\n" "$RED" "error" "$RESET" "$1" >&2; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    return 1
  fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$(cd "$SCRIPT_DIR/.." && pwd)")"
CONTINUE_HOME="${HOME}/.continue"
CONTINUE_CONFIG_DIR="$CONTINUE_HOME/config"
CONTINUE_MCP_DIR="$CONTINUE_HOME/mcp"
CONTINUE_LOG_DIR="$CONTINUE_HOME/logs"

# 1) Install Continue CLI if missing
install_continue_cli() {
  if command -v continue >/dev/null 2>&1; then
    ok "Continue CLI already installed: $(continue --version 2>/dev/null || echo present)"
    return 0
  fi
  log "Installing Continue CLI..."
  if command -v npm >/dev/null 2>&1; then
    npm i -g @continuedev/continue-cli || {
      warn "npm global install failed; trying npx shim"
      return 0
    }
    ok "Installed via npm"
  elif command -v brew >/dev/null 2>&1; then
    brew tap continuedev/tap || true
    brew install continue || brew upgrade continue || true
    ok "Installed/updated via Homebrew"
  else
    warn "npm/brew not found. Will use npx when invoking Continue commands."
  fi
}

continue_cmd() {
  if command -v continue >/dev/null 2>&1; then
    continue "$@"
  else
    npx -y @continuedev/continue-cli "$@"
  fi
}

# 2) Create directory structure
setup_dirs() {
  mkdir -p "$CONTINUE_CONFIG_DIR" "$CONTINUE_MCP_DIR" "$CONTINUE_LOG_DIR"
  ok "Ensured directories: $CONTINUE_CONFIG_DIR, $CONTINUE_MCP_DIR, $CONTINUE_LOG_DIR"
}

# 3) Copy configuration templates from repo if available
copy_configs() {
  local copied=0
  if [ -d "$REPO_ROOT/.continue" ]; then
    rsync -a --exclude "logs" --exclude "node_modules" "$REPO_ROOT/.continue/" "$CONTINUE_HOME/" && copied=1
  fi
  # Common locations inside repo
  for path in "$REPO_ROOT/continue" "$REPO_ROOT/config/continue" "$REPO_ROOT/scripts/continue"; do
    if [ -d "$path" ]; then
      rsync -a "$path/" "$CONTINUE_HOME/" && copied=1
    fi
  done
  if [ "$copied" -eq 1 ]; then
    ok "Copied repo Continue config into $CONTINUE_HOME"
  else
    warn "No repo-specific Continue config found; generating defaults"
  fi

  # Generate default config.json if missing
  if [ ! -f "$CONTINUE_CONFIG_DIR/config.json" ]; then
    cat > "$CONTINUE_CONFIG_DIR/config.json" << 'JSON'
{
  "$schema": "https://raw.githubusercontent.com/continuedev/continue/main/config.schema.json",
  "models": {
    "default": "openai:gpt-4o-mini"
  },
  "embeddings": {
    "default": "voyage:voyage-2"
  },
  "codebaseIndex": {
    "provider": "voyage-ai",
    "indexName": "a2a-index",
    "paths": ["."]
  },
  "mcpServers": {
    "files": { "command": "continue-mcp-files" }
  }
}
JSON
    ok "Wrote default config.json"
  fi
}

# 4) Initialize MCP servers (if any listed in config)
init_mcp() {
  if grep -q '"mcpServers"' "$CONTINUE_CONFIG_DIR/config.json" 2>/dev/null; then
    log "Initializing MCP servers..."
    continue_cmd mcp install || warn "MCP install encountered issues"
    continue_cmd mcp list || true
    ok "MCP servers initialized/listed"
  else
    warn "No MCP servers defined in config.json"
  fi
}

# 5) Run codebase indexing with Voyage AI
index_codebase() {
  if ! command -v git >/dev/null 2>&1; then warn "git not available; indexing anyway"; fi
  pushd "$REPO_ROOT" >/dev/null || true
  if [ -n "${VOYAGE_API_KEY:-}" ]; then
    export VOYAGE_API_KEY
  fi
  log "Starting codebase indexing (Voyage AI)..."
  continue_cmd index --provider voyage-ai --index-name a2a-index --paths . || {
    warn "Indexing via Continue CLI failed; attempting fallback to 'continue codebase index'"
    continue_cmd codebase index --provider voyage-ai --index-name a2a-index --paths . || warn "Indexing fallback failed"
  }
  popd >/dev/null || true
  ok "Indexing step completed (check logs if warnings appeared)"
}

# 6) Validate configuration
validate() {
  log "Validating Continue configuration..."
  continue_cmd doctor || warn "continue doctor reported issues"
  # Quick checks
  test -d "$CONTINUE_HOME" || err "$CONTINUE_HOME missing"
  test -f "$CONTINUE_CONFIG_DIR/config.json" || err "config.json missing"
  ok "Validation checks executed"
}

# 7) Report summary
report() {
  echo
  echo -e "${BOLD}Setup Summary:${RESET}"
  echo "Continue home: $CONTINUE_HOME"
  echo "Config:        $CONTINUE_CONFIG_DIR/config.json"
  echo "MCP dir:       $CONTINUE_MCP_DIR"
  echo "Logs:          $CONTINUE_LOG_DIR"
  echo
  echo "Key files:"; ls -1 "$CONTINUE_CONFIG_DIR" 2>/dev/null || true
}

main() {
  require_cmd bash || true
  install_continue_cli
  setup_dirs
  copy_configs
  init_mcp
  index_codebase
  validate
  report
  ok "Continue.dev setup completed"
}

main "$@"
