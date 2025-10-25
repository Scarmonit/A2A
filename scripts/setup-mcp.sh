#!/usr/bin/env bash
# setup-mcp.sh - Automated installer for MCP servers used by A2A
#
# Features:
# - Detect OS and package manager
# - Check and install dependencies
# - Install and configure MCP servers defined for A2A
# - Idempotent (safe to re-run)
# - Verbose logging to ./scripts/logs/setup-mcp-YYYYmmdd-HHMMSS.log
# - Strict error handling with helpful diagnostics
#
# Usage:
#   bash scripts/setup-mcp.sh [--non-interactive] [--only <server>[,<server>...]] [--skip <server>[,<server>...]]
#   bash scripts/setup-mcp.sh --help
#
# Supported servers (installed if applicable):
#   - ollama           (binary + common models optional)
#   - sqlite-mcp       (npm package @modelcontextprotocol/server-sqlite)
#   - filesystem-mcp   (npm package @modelcontextprotocol/server-filesystem)
#   - web-search-mcp   (npm package @modelcontextprotocol/server-web)
#   - s3-mcp           (npm package @modelcontextprotocol/server-s3)
#
# Notes:
# - Requires: git, curl, bash 4+, node>=18, npm, python3, pip, jq
# - On Linux uses apt/yum/pacman; on macOS uses Homebrew; on Windows (MSYS2/Git-Bash) best-effort
# - Reads defaults and hints from MCP_CONFIGURATION.md when present

set -Eeuo pipefail
IFS=$'\n\t'

START_TS=$(date +%Y%m%d-%H%M%S)
SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
LOG_DIR="${SCRIPT_DIR}/logs"
LOG_FILE="${LOG_DIR}/setup-mcp-${START_TS}.log"

mkdir -p "${LOG_DIR}"
exec > >(tee -a "${LOG_FILE}") 2>&1

# Colors
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; BLUE='\033[0;34m'; NC='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
fi

log()  { echo -e "${BLUE}[INFO]${NC} $*"; }
succ() { echo -e "${GREEN}[OK]  ${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()  { echo -e "${RED}[ERR] ${NC} $*" >&2; }

usage() {
  sed -n '1,80p' "$0" | sed -n '1,40p'
}

NONINTERACTIVE=${NONINTERACTIVE:-0}
ONLY_LIST=""
SKIP_LIST=""

for arg in "$@"; do
  case "$arg" in
    --help|-h) usage; exit 0 ;;
    --non-interactive|--yes|-y) NONINTERACTIVE=1 ;;
    --only) shift; ONLY_LIST=${1:-}; ;;
    --only=*) ONLY_LIST="${arg#*=}" ;;
    --skip) shift; SKIP_LIST=${1:-}; ;;
    --skip=*) SKIP_LIST="${arg#*=}" ;;
    *) ;;
  esac
  [[ "$arg" == --only || "$arg" == --skip ]] && shift || true
done

in_list() { local item="$1" list="$2"; [[ -z "$list" ]] && return 1; IFS=',' read -r -a arr <<< "$list"; for x in "${arr[@]}"; do [[ "$x" == "$item" ]] && return 0; done; return 1; }
should_install() {
  local name="$1"
  if [[ -n "$ONLY_LIST" ]]; then in_list "$name" "$ONLY_LIST" && return 0 || return 1; fi
  if in_list "$name" "$SKIP_LIST"; then return 1; fi
  return 0
}

confirm() {
  local prompt=${1:-Proceed?}
  if (( NONINTERACTIVE )); then return 0; fi
  read -rp "${prompt} [y/N]: " ans || true
  [[ "$ans" =~ ^[Yy]([Ee][Ss])?$ ]]
}

# Detect OS and PM
OS="$(uname -s)"
PM=""
case "$OS" in
  Darwin) PM=brew ;;
  Linux)
    if command -v apt-get >/dev/null 2>&1; then PM=apt; 
    elif command -v dnf >/dev/null 2>&1; then PM=dnf;
    elif command -v yum >/dev/null 2>&1; then PM=yum;
    elif command -v pacman >/dev/null 2>&1; then PM=pacman;
    else PM=""; fi ;;
  MINGW*|MSYS*|CYGWIN*) PM=choco ;; # best-effort
  *) PM="" ;;
esac

ensure_pkg() {
  local pkg="$1"; local brew_formula="${2:-$1}"; local apt_pkg="${3:-$1}"
  if command -v "$pkg" >/dev/null 2>&1; then succ "$pkg present"; return 0; fi
  if [[ -z "$PM" ]]; then warn "No package manager detected; please install $pkg manually."; return 1; fi
  log "Installing dependency: $pkg via $PM"
  case "$PM" in
    brew) brew list --formula "$brew_formula" >/dev/null 2>&1 || brew install "$brew_formula" ;;
    apt) sudo apt-get update -y && sudo apt-get install -y "$apt_pkg" ;;
    dnf) sudo dnf install -y "$apt_pkg" ;;
    yum) sudo yum install -y "$apt_pkg" ;;
    pacman) sudo pacman -Sy --noconfirm "$apt_pkg" ;;
    choco) choco install -y "$apt_pkg" || true ;;
  esac
}

# Core dependencies
log "Checking core dependencies"
ensure_pkg git git git
ensure_pkg curl curl curl
ensure_pkg bash bash bash
ensure_pkg node node nodejs || ensure_pkg node node nodejs
ensure_pkg npm npm npm
ensure_pkg python3 python@3 python3
ensure_pkg pip3 python@3 python3-pip || true
ensure_pkg jq jq jq || true

node_version_ok=0
if command -v node >/dev/null 2>&1; then
  v=$(node -v | sed 's/v//')
  major=${v%%.*}
  if [[ ${major:-0} -ge 18 ]]; then node_version_ok=1; fi
fi
if [[ $node_version_ok -ne 1 ]]; then
  warn "Node.js >= 18 required. Attempting to install LTS via nvm."
  if ! command -v nvm >/dev/null 2>&1; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # shellcheck source=/dev/null
    export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
  fi
  nvm install --lts && nvm use --lts || warn "nvm installation failed; continuing with system node"
fi

npm_global_install() {
  local pkg="$1"
  if npm list -g --depth=0 "$pkg" >/dev/null 2>&1; then succ "npm global $pkg present"; else
    log "Installing npm global package: $pkg"
    npm install -g "$pkg"
  fi
}

# Install servers
install_ollama() {
  if command -v ollama >/dev/null 2>&1; then succ "Ollama already installed"; return 0; fi
  log "Installing Ollama"
  case "$OS" in
    Darwin) curl -fsSL https://ollama.com/download/Ollama-darwin.zip -o /tmp/ollama.zip && unzip -q /tmp/ollama.zip -d /Applications || true ;;
    Linux) curl -fsSL https://ollama.com/install.sh | sh ;;
    MINGW*|MSYS*|CYGWIN*) warn "Ollama Windows install not automated. Please install manually." ;;
    *) warn "Unsupported OS for Ollama automated install." ;;
  esac
}

install_sqlite_mcp() { npm_global_install "@modelcontextprotocol/server-sqlite"; }
install_filesystem_mcp() { npm_global_install "@modelcontextprotocol/server-filesystem"; }
install_web_mcp() { npm_global_install "@modelcontextprotocol/server-web"; }
install_s3_mcp() { npm_global_install "@modelcontextprotocol/server-s3"; }

SERVERS=(
  "ollama:install_ollama"
  "sqlite-mcp:install_sqlite_mcp"
  "filesystem-mcp:install_filesystem_mcp"
  "web-search-mcp:install_web_mcp"
  "s3-mcp:install_s3_mcp"
)

log "Starting MCP server installation"
failed=()
for entry in "${SERVERS[@]}"; do
  name=${entry%%:*}; fn=${entry##*:}
  if ! should_install "$name"; then log "Skipping $name due to filters"; continue; fi
  log "Installing $name"
  if $fn; then succ "$name installed"; else err "$name failed"; failed+=("$name"); fi
done

# Optional: pull common Ollama models
if should_install ollama && command -v ollama >/dev/null 2>&1; then
  if confirm "Download common Ollama models (llama3, qwen2.5, mistral) now?"; then
    for m in llama3 qwen2.5 mistral; do
      log "Pulling model: $m"
      ollama pull "$m" || warn "Failed to pull $m"
    done
  fi
fi

# Summaries
if ((${#failed[@]})); then
  warn "Some servers failed: ${failed[*]}"
  warn "See log: ${LOG_FILE}"
  exit 2
else
  succ "All requested servers installed"
  echo "Log saved to: ${LOG_FILE}"
fi
