# A2A Deployment Configuration

This directory contains all the necessary configuration files and scripts for deploying the A2A MCP Server to production.

## Quick Start

### Docker Deployment (Recommended)

```bash
# Run the interactive deployment script
cd deployment/scripts
./docker-deploy.sh
```

### Native Deployment

```bash
# Run the setup script (requires sudo)
cd deployment/scripts
sudo ./setup.sh
```

## Directory Structure

```
deployment/
├── nginx/
│   └── a2a.conf              # Nginx reverse proxy configuration
├── systemd/
│   └── a2a.service           # Systemd service file
└── scripts/
    ├── setup.sh              # Production setup script (native)
    └── docker-deploy.sh      # Docker deployment script
```

## Configuration Files

### Nginx Configuration (`nginx/a2a.conf`)

- Reverse proxy configuration for A2A server
- SSL/TLS support
- WebSocket proxy for streaming
- Rate limiting
- Security headers
- Monitoring endpoints

**Usage:**
```bash
sudo cp nginx/a2a.conf /etc/nginx/sites-available/a2a
sudo ln -s /etc/nginx/sites-available/a2a /etc/nginx/sites-enabled/a2a
sudo nginx -t
sudo systemctl reload nginx
```

### Systemd Service (`systemd/a2a.service`)

- Service definition for running A2A as a system service
- Auto-restart on failure
- Resource limits
- Security hardening
- Logging configuration

**Usage:**
```bash
sudo cp systemd/a2a.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable a2a
sudo systemctl start a2a
```

## Deployment Scripts

### setup.sh

Automated setup script for native (non-Docker) deployment.

**Features:**
- Installs Node.js if not present
- Creates application user and directories
- Installs dependencies and builds application
- Sets up systemd service
- Configures Nginx
- Creates backup and update scripts
- Sets up automatic daily backups

**Usage:**
```bash
sudo ./setup.sh
```

### docker-deploy.sh

Interactive Docker deployment script.

**Features:**
- Interactive menu for managing services
- Automatic environment file creation
- Secure token generation
- Support for monitoring stack
- Service health checks
- Easy log viewing

**Usage:**
```bash
./docker-deploy.sh
```

**Menu Options:**
1. Start services (production)
2. Start services with monitoring (Prometheus + Grafana)
3. Stop services
4. Restart services
5. View logs
6. Rebuild and restart
7. Check status
8. Clean up (remove containers and volumes)
9. Exit

## Environment Configuration

Before deployment, configure your environment:

1. Copy the production template:
   ```bash
   cp ../.env.production ../.env
   ```

2. Edit the configuration:
   ```bash
   nano ../.env
   ```

3. Update these critical settings:
   - `STREAM_TOKEN` - Generate with: `openssl rand -hex 32`
   - `DATABASE_URL` - Your PostgreSQL connection string
   - `VOYAGE_API_KEY` - Your Voyage AI API key (if using)
   - `MAX_CONCURRENCY` - Based on your server capacity
   - Domain name in Nginx config

## SSL/TLS Configuration

### Using Let's Encrypt (Recommended)

```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Obtain and install certificate
sudo certbot --nginx -d your.domain.com

# Auto-renewal is configured automatically
```

### Manual Certificate

1. Obtain your SSL certificate and key
2. Update Nginx configuration:
   ```nginx
   ssl_certificate /path/to/fullchain.pem;
   ssl_certificate_key /path/to/privkey.pem;
   ```
3. Reload Nginx: `sudo systemctl reload nginx`

## Monitoring Setup

### Enable Monitoring Stack

With Docker:
```bash
docker-compose --profile monitoring up -d
```

Access:
- **Grafana**: http://your-server:3001 (admin/agents123)
- **Prometheus**: http://your-server:9091

### Available Metrics

- `a2a_requests_created_total` - Total requests created
- `a2a_requests_completed_total` - Completed requests (by status)
- `a2a_running_jobs` - Currently running jobs
- `a2a_queue_size` - Queue length
- `a2a_ws_clients` - WebSocket connections
- `a2a_total_agents` - Total deployed agents
- `a2a_enabled_agents` - Enabled agents

## Backup and Restore

### Automatic Backups

The setup script configures daily backups at 2 AM.

Manual backup:
```bash
sudo /usr/local/bin/a2a-backup
```

### Docker Volume Backup

```bash
docker run --rm \
  -v a2a_agent_data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz /data
```

### Restore

```bash
docker run --rm \
  -v a2a_agent_data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "cd /data && tar xzf /backup/backup-YYYYMMDD.tar.gz --strip 1"
```

## Updating the Application

### Native Deployment

```bash
sudo /usr/local/bin/a2a-update
```

Or manually:
```bash
cd /opt/a2a
git pull
npm install --production
npm run build
sudo systemctl restart a2a
```

### Docker Deployment

```bash
cd deployment/scripts
./docker-deploy.sh
# Select option 6: Rebuild and restart
```

## Security Checklist

- [ ] Change `STREAM_TOKEN` to a secure random value
- [ ] Configure firewall (allow only 22, 80, 443)
- [ ] Enable SSL/TLS with Let's Encrypt
- [ ] Update Nginx security headers
- [ ] Restrict `/metrics` endpoint to private networks
- [ ] Set up log rotation
- [ ] Configure rate limiting
- [ ] Regular security updates
- [ ] Use strong database credentials
- [ ] Enable automatic backups

## Troubleshooting

### Check Service Status

Docker:
```bash
docker-compose ps
docker-compose logs -f
```

Systemd:
```bash
sudo systemctl status a2a
sudo journalctl -u a2a -f
```

### Common Issues

**Port already in use:**
```bash
sudo lsof -i :8787
```

**Permission denied:**
```bash
sudo chown -R a2a:a2a /opt/a2a
```

**High memory usage:**
- Reduce `MAX_CONCURRENCY` in `.env`
- Increase `NODE_OPTIONS=--max-old-space-size=XXXX`

**Container won't start:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Support

For detailed deployment instructions, see [DEPLOYMENT.md](../DEPLOYMENT.md)

For issues or questions:
- GitHub Issues: [your-repo-url]/issues
- Documentation: [your-docs-url]
