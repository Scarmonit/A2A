#!/bin/bash
# A2A MCP Server - Docker Deployment Script
# This script deploys A2A using Docker Compose

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env"
DOCKER_COMPOSE_FILE="$PROJECT_DIR/docker-compose.yml"

echo -e "${BLUE}=== A2A MCP Server - Docker Deployment ===${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if running as root or in docker group
if [ "$EUID" -ne 0 ] && ! groups | grep -q docker; then
    echo -e "${YELLOW}Warning: Not running as root and not in docker group${NC}"
    echo "You may need to run with sudo or add yourself to the docker group:"
    echo "  sudo usermod -aG docker \$USER"
    echo ""
fi

cd "$PROJECT_DIR"

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}No .env file found. Creating from template...${NC}"

    if [ -f "$PROJECT_DIR/.env.production" ]; then
        cp "$PROJECT_DIR/.env.production" "$ENV_FILE"
    elif [ -f "$PROJECT_DIR/.env.example" ]; then
        cp "$PROJECT_DIR/.env.example" "$ENV_FILE"
    else
        echo -e "${RED}Error: No environment template found${NC}"
        exit 1
    fi

    # Generate secure token
    SECURE_TOKEN=$(openssl rand -hex 32)
    sed -i "s/CHANGE_THIS_TO_SECURE_RANDOM_TOKEN/$SECURE_TOKEN/g" "$ENV_FILE" 2>/dev/null || true

    echo -e "${GREEN}.env file created${NC}"
    echo -e "${YELLOW}Please edit .env and configure your settings:${NC}"
    echo "  nano $ENV_FILE"
    read -p "Press Enter to continue after editing, or Ctrl+C to exit..."
fi

# Function to display deployment menu
show_menu() {
    echo ""
    echo -e "${BLUE}What would you like to do?${NC}"
    echo "1) Start services (production)"
    echo "2) Start services with monitoring (Prometheus + Grafana)"
    echo "3) Stop services"
    echo "4) Restart services"
    echo "5) View logs"
    echo "6) Rebuild and restart"
    echo "7) Check status"
    echo "8) Clean up (remove containers and volumes)"
    echo "9) Exit"
    echo ""
    read -p "Enter choice [1-9]: " choice
}

# Function to start services
start_services() {
    local profile=$1
    echo -e "${GREEN}Building and starting services...${NC}"

    if [ -n "$profile" ]; then
        docker-compose --profile "$profile" up -d --build
    else
        docker-compose up -d --build
    fi

    echo -e "${GREEN}Services started successfully!${NC}"
    show_service_info
}

# Function to stop services
stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"
    docker-compose down
    echo -e "${GREEN}Services stopped${NC}"
}

# Function to restart services
restart_services() {
    echo -e "${YELLOW}Restarting services...${NC}"
    docker-compose restart
    echo -e "${GREEN}Services restarted${NC}"
    show_service_info
}

# Function to view logs
view_logs() {
    echo -e "${BLUE}Viewing logs (Ctrl+C to exit)...${NC}"
    docker-compose logs -f
}

# Function to rebuild
rebuild_services() {
    echo -e "${YELLOW}Stopping services...${NC}"
    docker-compose down

    echo -e "${GREEN}Rebuilding images...${NC}"
    docker-compose build --no-cache

    echo -e "${GREEN}Starting services...${NC}"
    docker-compose up -d

    echo -e "${GREEN}Rebuild complete!${NC}"
    show_service_info
}

# Function to check status
check_status() {
    echo -e "${BLUE}Service Status:${NC}"
    docker-compose ps

    echo ""
    echo -e "${BLUE}Container Health:${NC}"
    docker-compose exec a2a-mcp-server curl -s http://localhost:8787/healthz || echo -e "${RED}Health check failed${NC}"
}

# Function to clean up
cleanup() {
    echo -e "${RED}WARNING: This will remove all containers, networks, and volumes!${NC}"
    read -p "Are you sure? (yes/no): " confirm

    if [ "$confirm" = "yes" ]; then
        echo -e "${YELLOW}Cleaning up...${NC}"
        docker-compose down -v
        echo -e "${GREEN}Cleanup complete${NC}"
    else
        echo -e "${YELLOW}Cleanup cancelled${NC}"
    fi
}

# Function to show service information
show_service_info() {
    echo ""
    echo -e "${GREEN}=== Service Information ===${NC}"
    echo -e "${BLUE}Main Server:${NC} http://localhost:8787"
    echo -e "${BLUE}Health Check:${NC} http://localhost:8787/healthz"
    echo -e "${BLUE}Metrics:${NC} http://localhost:8787/metrics"

    # Check if monitoring is enabled
    if docker-compose ps | grep -q "a2a-prometheus"; then
        echo -e "${BLUE}Prometheus:${NC} http://localhost:9091"
        echo -e "${BLUE}Grafana:${NC} http://localhost:3001 (admin/agents123)"
    fi

    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "  docker-compose logs -f                # View logs"
    echo "  docker-compose ps                     # Check status"
    echo "  docker-compose exec a2a-mcp-server sh # Access container shell"
    echo ""
}

# Main menu loop
while true; do
    show_menu

    case $choice in
        1)
            start_services
            ;;
        2)
            start_services "monitoring"
            ;;
        3)
            stop_services
            ;;
        4)
            restart_services
            ;;
        5)
            view_logs
            ;;
        6)
            rebuild_services
            ;;
        7)
            check_status
            ;;
        8)
            cleanup
            ;;
        9)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac

    # Pause before showing menu again
    echo ""
    read -p "Press Enter to continue..."
done
