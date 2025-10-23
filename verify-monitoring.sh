#!/usr/bin/env bash
# Verification script for A2A Monitoring Stack

set -e

echo "========================================="
echo "A2A Monitoring Stack Verification"
echo "========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to validate YAML files
validate_yaml() {
    local file=$1
    local name=$2
    echo -n "Validating $name... "
    if npx js-yaml "$file" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Check if Docker is running
echo -n "Checking Docker... "
if docker info > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    echo "Error: Docker is not running"
    exit 1
fi

# Validate configuration files
validate_yaml "prometheus.yml" "prometheus.yml"
validate_yaml "alerts.yml" "alerts.yml"
validate_yaml "alertmanager.yml" "alertmanager.yml"
validate_yaml "grafana/provisioning/datasources/prometheus.yml" "Grafana datasource config"
validate_yaml "grafana/provisioning/dashboards/default.yml" "Grafana dashboard config"

echo -n "Validating Grafana dashboard JSON... "
if command -v jq > /dev/null 2>&1; then
    if jq empty grafana/dashboards/a2a-mcp-overview.json > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        exit 1
    fi
elif python3 -m json.tool grafana/dashboards/a2a-mcp-overview.json > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo ""
echo "========================================="
echo "All configuration files are valid!"
echo "========================================="
echo ""

# Check if services are running
echo "Checking if monitoring services are running..."
echo ""

# Define service to container name mapping
declare -A container_names=(
    ["a2a-mcp-server"]="a2a-agents"
    ["prometheus"]="a2a-prometheus"
    ["grafana"]="a2a-grafana"
    ["node-exporter"]="a2a-node-exporter"
    ["alertmanager"]="a2a-alertmanager"
)

for service in "${!container_names[@]}"; do
    container_name="${container_names[$service]}"
    echo -n "Checking $service... "
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        echo -e "${GREEN}Running${NC}"
    else
        echo -e "${YELLOW}Not running${NC}"
    fi
done

echo ""
echo "========================================="
echo "Service Endpoints"
echo "========================================="
echo "Grafana:        http://localhost:3001 (admin/admin)"
echo "Prometheus:     http://localhost:9090"
echo "Alert Manager:  http://localhost:9093"
echo "A2A Metrics:    http://localhost:3000/metrics"
echo "A2A Health:     http://localhost:8787/healthz"
echo "Node Exporter:  http://localhost:9100/metrics"
echo ""

# Test if services are accessible (only if running)
if docker ps --format '{{.Names}}' | grep -q "^a2a-prometheus$"; then
    echo "Testing Prometheus API..."
    if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Prometheus is healthy${NC}"
    else
        echo -e "${RED}✗ Prometheus is not responding${NC}"
    fi
fi

if docker ps --format '{{.Names}}' | grep -q "^a2a-grafana$"; then
    echo "Testing Grafana API..."
    if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Grafana is healthy${NC}"
    else
        echo -e "${RED}✗ Grafana is not responding${NC}"
    fi
fi

echo ""
echo "========================================="
echo "To start the monitoring stack:"
echo "  docker compose up -d"
echo ""
echo "To stop the monitoring stack:"
echo "  docker compose down"
echo ""
echo "To view logs:"
echo "  docker compose logs -f"
echo "========================================="
