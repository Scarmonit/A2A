#!/bin/bash
# Quick Start Script for A2A MCP Dashboard
# This script helps you quickly start the dashboard services

set -e

echo "🚀 A2A MCP Dashboard Quick Start"
echo "================================="
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build the project
echo "🔨 Building project..."
npm run build
echo ""

# Function to start services
start_services() {
    echo "Starting services..."
    echo ""
    
    # Start WebSocket server in background
    echo "🔌 Starting WebSocket Server on port 8081..."
    WS_PORT=8081 node dist/src/websocket-server.js &
    WS_PID=$!
    
    # Wait a bit for WebSocket to start
    sleep 2
    
    echo "✅ WebSocket server started (PID: $WS_PID)"
    echo ""
    echo "📊 Dashboard is ready!"
    echo ""
    echo "Access points:"
    echo "  - WebSocket: ws://localhost:8081"
    echo "  - Test Dashboard: file://$(pwd)/examples/dashboard-test.html"
    echo ""
    echo "To stop the services, press Ctrl+C"
    echo ""
    
    # Trap to cleanup on exit
    trap "echo ''; echo '🛑 Stopping services...'; kill $WS_PID 2>/dev/null; echo '✅ Services stopped'; exit 0" EXIT SIGINT SIGTERM
    
    # Keep script running
    wait $WS_PID
}

# Check command
case "${1:-start}" in
    start)
        start_services
        ;;
    docker)
        echo "🐳 Starting with Docker Compose..."
        docker-compose up -d
        echo ""
        echo "✅ Services started!"
        echo ""
        echo "Access points:"
        echo "  - WebSocket: ws://localhost:8081"
        echo "  - Prometheus: http://localhost:9090"
        echo "  - Grafana: http://localhost:3001 (admin/admin)"
        echo ""
        echo "To view logs: docker-compose logs -f"
        echo "To stop: docker-compose down"
        ;;
    test)
        echo "🧪 Running dashboard tests..."
        npm run test:dashboard
        ;;
    *)
        echo "Usage: $0 {start|docker|test}"
        echo ""
        echo "Commands:"
        echo "  start  - Start WebSocket server locally"
        echo "  docker - Start all services with Docker Compose"
        echo "  test   - Run dashboard tests"
        exit 1
        ;;
esac
