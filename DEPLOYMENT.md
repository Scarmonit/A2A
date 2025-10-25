# A2A MCP Server - Deployment Guide

This guide covers deploying the A2A MCP Server to your own server.

## Prerequisites

- Ubuntu/Debian Linux server (20.04+ recommended)
- Docker and Docker Compose installed
- Nginx (for reverse proxy)
- Domain name (optional, but recommended)
- At least 2GB RAM, 2 CPU cores
- 10GB+ storage

## Deployment Options

### Option 1: Docker Deployment (Recommended)

This is the easiest and most reliable deployment method.

#### Step 1: Clone the Repository

```bash
git clone <your-repo-url>
cd A2A
```

#### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file with your settings
nano .env
```

Key production settings to update:
- `NODE_ENV=production`
- `STREAM_HOST=0.0.0.0` (to bind to all interfaces)
- `MAX_CONCURRENCY=100` (adjust based on your server capacity)
- Set `STREAM_TOKEN` for security
- Configure `DATABASE_URL` if using PostgreSQL
- Set `VOYAGE_API_KEY` if using Voyage AI

#### Step 3: Build and Start Services

```bash
# Build the Docker image
docker-compose build

# Start the services
docker-compose up -d

# Verify services are running
docker-compose ps

# Check logs
docker-compose logs -f
```

#### Step 4: Configure Nginx Reverse Proxy

Copy the Nginx configuration:

```bash
sudo cp deployment/nginx/a2a.conf /etc/nginx/sites-available/a2a
sudo ln -s /etc/nginx/sites-available/a2a /etc/nginx/sites-enabled/a2a

# Edit the configuration file
sudo nano /etc/nginx/sites-available/a2a

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

#### Step 5: Enable SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain SSL certificate (replace your.domain.com)
sudo certbot --nginx -d your.domain.com

# Certbot will automatically configure Nginx for SSL
```

#### Step 6: Verify Deployment

```bash
# Check health endpoint
curl http://localhost:8787/healthz

# Or via your domain
curl https://your.domain.com/healthz
```

### Option 2: Native Deployment (Without Docker)

#### Step 1: Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Step 2: Install Dependencies and Build

```bash
cd A2A
npm install
npm run build
```

#### Step 3: Configure Systemd Service

```bash
# Copy systemd service file
sudo cp deployment/systemd/a2a.service /etc/systemd/system/

# Edit the service file to set correct paths
sudo nano /etc/systemd/system/a2a.service

# Reload systemd
sudo systemctl daemon-reload

# Enable and start the service
sudo systemctl enable a2a
sudo systemctl start a2a

# Check status
sudo systemctl status a2a
```

#### Step 4: Configure Nginx (Same as Option 1, Step 4)

## Monitoring Stack (Optional)

Enable Prometheus and Grafana for monitoring:

```bash
# Start monitoring services
docker-compose --profile monitoring up -d

# Access Grafana at http://your-server:3001
# Default credentials: admin / agents123
```

### Prometheus Metrics

Available at `http://your-server:9091` or via `/metrics` endpoint.

Key metrics:
- `a2a_requests_created_total` - Total requests created
- `a2a_requests_completed_total` - Total requests completed
- `a2a_running_jobs` - Currently running jobs
- `a2a_queue_size` - Queue length
- `a2a_ws_clients` - WebSocket connections
- `a2a_total_agents` - Total deployed agents

## Security Considerations

### 1. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

### 2. Set Authentication Token

In `.env`:
```bash
STREAM_TOKEN=your-secure-random-token-here
```

Generate a secure token:
```bash
openssl rand -hex 32
```

### 3. Limit Exposed Ports

The docker-compose.yml exposes ports 8787 and 8800-8850. Consider:
- Using Nginx as the only public-facing service
- Restricting Docker port exposure to localhost only

### 4. Regular Updates

```bash
# Update dependencies
npm audit fix

# Rebuild Docker image
docker-compose build --no-cache

# Restart services
docker-compose up -d
```

## Backup and Restore

### Backup Agent Data

```bash
# Backup Docker volume
docker run --rm \
  -v a2a_agent_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/agent-data-$(date +%Y%m%d).tar.gz /data
```

### Restore Agent Data

```bash
# Restore Docker volume
docker run --rm \
  -v a2a_agent_data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/agent-data-YYYYMMDD.tar.gz --strip 1"
```

## Scaling Considerations

### Vertical Scaling

Adjust in `.env`:
```bash
MAX_CONCURRENCY=200          # Increase concurrent jobs
MAX_QUEUE_SIZE=100000        # Increase queue size
NODE_OPTIONS=--max-old-space-size=4096  # Increase memory
```

### Horizontal Scaling

For multiple instances:
1. Use a load balancer (Nginx, HAProxy)
2. Configure shared PostgreSQL database
3. Use Redis for session storage
4. Consider container orchestration (Kubernetes)

## Troubleshooting

### Check Logs

Docker:
```bash
docker-compose logs -f a2a-mcp-server
```

Systemd:
```bash
sudo journalctl -u a2a -f
```

### Common Issues

**Port already in use:**
```bash
# Check what's using port 8787
sudo lsof -i :8787
```

**Container won't start:**
```bash
# Check Docker logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose up --build -d
```

**High memory usage:**
- Reduce `MAX_CONCURRENCY`
- Increase `MAX_OLD_SPACE_SIZE`
- Check for memory leaks in agent code

## Performance Tuning

### For High-Load Scenarios

In `.env`:
```bash
# Increase worker threads
UV_THREADPOOL_SIZE=128

# Adjust queue settings
MAX_CONCURRENCY=200
MAX_QUEUE_SIZE=100000

# Optimize request cleanup
REQUEST_TTL_MS=300000        # 5 minutes
IDEMP_TTL_MS=900000          # 15 minutes
```

### For Resource-Constrained Environments

```bash
MAX_CONCURRENCY=10
MAX_QUEUE_SIZE=1000
NODE_OPTIONS=--max-old-space-size=512
```

## Maintenance

### Update Application

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Clean Up Old Data

```bash
# Clean Docker system
docker system prune -a

# Clean old logs
docker-compose logs --tail=0 -f &
```

## Support

For issues or questions:
- GitHub Issues: [your-repo-url]/issues
- Documentation: [your-docs-url]

## License

See LICENSE file for details.
