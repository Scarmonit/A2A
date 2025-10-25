#!/usr/bin/env bash
set -euo pipefail

# warp-ollama-setup.sh
# Automates Warp + Ollama setup, OpenAI-compatible config, model installs, and A2A integration test.
# Supports macOS (arm64/x86_64) and Linux (x86_64/aarch64). Requires sudo for some steps.

log() { printf "[warp-ollama] %s\n" "$*"; }
err() { printf "[warp-ollama][ERROR] %s\n" "$*" >&2; }

die() { err "$*"; exit 1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing dependency: $1"; }

OS="$(uname -s)"
ARCH="$(uname -m)"
DATE_TS="$(date -u +%Y%m%d-%H%M%S)"

log "Detected OS=$OS ARCH=$ARCH"

# System specs
log "Collecting system specs..."
CPU_INFO="$(uname -p 2>/dev/null || echo "$ARCH")"
MEM_TOTAL="$(
  if command -v sysctl >/dev/null 2>&1; then
    sysctl -n hw.memsize 2>/dev/null || true
  elif [ -f /proc/meminfo ]; then
    awk '/MemTotal/ {print $2*1024}' /proc/meminfo
  fi
)"
GPU_INFO="$(
  if command -v nvidia-smi >/dev/null 2>&1; then nvidia-smi --query-gpu=name,memory.total --format=csv,noheader; 
  elif command -v system_profiler >/dev/null 2>&1; then system_profiler SPDisplaysDataType 2>/dev/null | awk '/Chipset Model|VRAM/ {print $0}';
  elif command -v lspci >/dev/null 2>&1; then lspci | grep -i -E 'vga|3d|nvidia|amd|intel';
  else echo "GPU: unknown"; fi
)"
log "CPU: $CPU_INFO"
log "MEM: ${MEM_TOTAL:-unknown} bytes"
log "GPU: $GPU_INFO"

# Ensure basic deps
for c in curl tar uname awk sed grep; do require_cmd "$c"; done

# Install or verify Ollama
install_ollama() {
  if command -v ollama >/dev/null 2>&1; then
    log "Ollama already installed: $(ollama --version 2>/dev/null || echo unknown)"
    return
  fi
  log "Installing Ollama..."
  case "$OS" in
    Darwin)
      if command -v brew >/dev/null 2>&1; then
        brew install ollama || brew upgrade ollama || die "Failed to install Ollama via brew"
      else
        curl -fsSL https://ollama.com/download/Ollama-darwin.zip -o /tmp/Ollama.zip || die "Download failed"
        unzip -q /tmp/Ollama.zip -d /Applications || die "Unzip failed"
        open -a Ollama
      fi
      ;;
    Linux)
      curl -fsSL https://ollama.com/install.sh | sh || die "Ollama install script failed"
      ;;
    *) die "Unsupported OS: $OS" ;;
  esac
}

ensure_ollama_running() {
  if ! pgrep -fa "ollama" >/dev/null 2>&1; then
    log "Starting Ollama service..."
    if [ "$OS" = "Linux" ]; then
      sudo systemctl enable --now ollama 2>/dev/null || nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
    else
      nohup ollama serve >/tmp/ollama-serve.log 2>&1 &
    fi
    sleep 2
  fi
  curl -fsS http://127.0.0.1:11434/api/tags >/dev/null || die "Ollama API not responding on :11434"
}

# Install models
pull_model() {
  local model="$1"
  log "Pulling model: $model"
  ollama pull "$model" || die "Failed to pull $model"
}

# Create OpenAI-compatible config for apps
setup_openai_compat() {
  local cfg_dir="$HOME/.config/ollama"
  mkdir -p "$cfg_dir"
  local env_file="$HOME/.config/ollama/openai_compat.env"
  cat > "$env_file" <<EOF
# Point OpenAI SDK-compatible tools to local Ollama
# Usage example:
#   export OPENAI_BASE_URL=http://127.0.0.1:11434/v1
#   export OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://127.0.0.1:11434/v1
OPENAI_API_KEY=ollama
EOF
  log "Wrote OpenAI compatibility env at $env_file"
}

# A2A integration test: run a minimal completion via OpenAI format
integration_test_a2a() {
  local model="$1"
  log "Running integration test against model: $model"
  # Test using curl with OpenAI Chat Completions-compatible route
  local payload='{"model":"'"$model"'","messages":[{"role":"user","content":"Say hello from A2A test."}]}'
  local resp
  resp=$(curl -fsS -H "Content-Type: application/json" \
              -d "$payload" http://127.0.0.1:11434/v1/chat/completions || true)
  if echo "$resp" | grep -q 'choices'; then
    log "Integration test OK for $model"
  else
    err "Integration test FAILED for $model"; echo "$resp" >&2; return 1
  fi
}

main() {
  install_ollama
  ensure_ollama_running

  # Preferred model names; adjust if upstream names change
  local MODELS=("gpt-oss" "mistral")
  for m in "${MODELS[@]}"; do pull_model "$m"; done

  setup_openai_compat

  # Try both models to validate
  local failed=0
  for m in "${MODELS[@]}"; do
    if ! integration_test_a2a "$m"; then failed=$((failed+1)); fi
  done

  # Optional: write a small helper script to source env for OpenAI clients
  local helper="$HOME/.config/ollama/export-openai-ollama.sh"
  mkdir -p "$(dirname "$helper")"
  cat > "$helper" <<'HLP'
#!/usr/bin/env bash
export OPENAI_BASE_URL=${OPENAI_BASE_URL:-http://127.0.0.1:11434/v1}
export OPENAI_API_KEY=${OPENAI_API_KEY:-ollama}
echo "OPENAI_* set for Ollama at $OPENAI_BASE_URL"
HLP
  chmod +x "$helper"
  log "Helper created: $helper"

  if [ $failed -eq 0 ]; then
    log "All integration tests passed. Setup complete."
  else
    err "$failed integration test(s) failed. Check /tmp/ollama-serve.log and connectivity."
    exit 1
  fi
}

main "$@"
