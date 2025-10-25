#!/bin/bash
# OPTIMIZED CLAUDE CODE BOOTSTRAP - AUTONOMOUS PARALLEL EXECUTION
# Enhancements: Parallel downloads, caching, retry logic, progress tracking

set -e

# Configuration
TARGET="${1:-stable}"
GCS_BUCKET="https://storage.googleapis.com/claude-code-dist-86c565f3-f756-42ad-8dfa-d59b1c096819/claude-code-releases"
DOWNLOAD_DIR="$HOME/.claude/downloads"
CACHE_DIR="$HOME/.claude/cache"
MAX_RETRIES=3
PARALLEL_DOWNLOADS=true

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
