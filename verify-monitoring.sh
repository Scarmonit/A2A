#!/bin/bash
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
echo -n "Validating prometheus.yml... "
if npx js-yaml prometheus.yml > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo -n "Validating alerts.yml... "
if npx js-yaml alerts.yml > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo -n "Validating alertmanager.yml... "
if npx js-yaml alertmanager.yml > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo -n "Validating Grafana datasource config... "
if npx js-yaml grafana/provisioning/datasources/prometheus.yml > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo -n "Validating Grafana dashboard config... "
if npx js-yaml grafana/provisioning/dashboards/default.yml > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
    exit 1
fi

echo -n "Validating Grafana dashboard JSON... "
if python3 -m json.tool grafana/dashboards/a2a-mcp-overview.json > /dev/null 2>&1; then
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

services=("a2a-mcp-server" "prometheus" "grafana" "node-exporter" "alertmanager")
for service in "${services[@]}"; do
    echo -n "Checking $service... "
    if docker ps --format '{{.Names}}' | grep -q "a2a-$service"; then
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
if docker ps --format '{{.Names}}' | grep -q "a2a-prometheus"; then
    echo "Testing Prometheus API..."
    if curl -s http://localhost:9090/-/healthy > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Prometheus is healthy${NC}"
    else
        echo -e "${RED}✗ Prometheus is not responding${NC}"
    fi
fi

if docker ps --format '{{.Names}}' | grep -q "a2a-grafana"; then
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
