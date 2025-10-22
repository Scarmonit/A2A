#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Function for logging messages
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting setup..."

# 1. Dependency Installation
log "Checking and installing dependencies..."

# Check for Node.js and npm
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
  log "Error: Node.js and npm are required. Please install them and try again."
  exit 1
fi

log "Node.js and npm are installed."

# Check for Python and pip
if ! command -v python3 &> /dev/null || ! command -v pip3 &> /dev/null; then
    log "Error: Python3 and pip3 are required. Please install them and try again."
    exit 1
fi

log "Python3 and pip3 are installed."

# Install Node.js dependencies
log "Installing Node.js dependencies..."
npm install

# Install Python dependencies
log "Installing Python dependencies..."
pip3 install -r requirements-greenlet.txt

# 2. Environment Setup
log "Setting up environment..."

if [ ! -f .env.example ]; then
  log "Error: .env.example not found. Please make sure this file exists."
  exit 1
fi

if [ ! -f .env ]; then
  log "Creating .env file from .env.example..."
  cp .env.example .env
  log "Successfully created .env file."
fi

# 3. Environment Validation
log "Validating environment..."

# Source the .env file to make its variables available
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
else
  log "Error: .env file not found."
  exit 1
fi

# Check for empty values
if grep -q '= *$' .env; then
    log "Error: The .env file contains empty values. Please fill in all the required environment variables."
    exit 1
fi
log "Environment variables are set."

# 4. Run Tests
log "Running tests..."
npm run test:all

log "Setup complete!"
