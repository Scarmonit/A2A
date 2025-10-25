#!/bin/bash
# A2A MCP Server - Production Setup Script
# This script sets up the A2A server for production deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="a2a"
APP_USER="a2a"
APP_DIR="/opt/a2a"
REPO_URL="${REPO_URL:-}"  # Set via environment variable

echo -e "${GREEN}=== A2A MCP Server - Production Setup ===${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Check for required commands
command -v node >/dev/null 2>&1 || {
    echo -e "${YELLOW}Node.js not found. Installing Node.js 20.x...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
}

command -v npm >/dev/null 2>&1 || {
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
}

command -v docker >/dev/null 2>&1 || {
    echo -e "${YELLOW}Docker not found. Please install Docker first.${NC}"
    echo "Visit: https://docs.docker.com/engine/install/"
    exit 1
}

command -v nginx >/dev/null 2>&1 || {
    echo -e "${YELLOW}Nginx not found. Installing Nginx...${NC}"
    apt-get update
    apt-get install -y nginx
}

# Create application user
if ! id "$APP_USER" &>/dev/null; then
    echo -e "${GREEN}Creating application user: $APP_USER${NC}"
    useradd -r -s /bin/false "$APP_USER"
else
    echo -e "${YELLOW}User $APP_USER already exists${NC}"
fi

# Create application directory
echo -e "${GREEN}Creating application directory: $APP_DIR${NC}"
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/data"
mkdir -p "$APP_DIR/data/agent-memory"
mkdir -p "$APP_DIR/data/vector_db"
mkdir -p "$APP_DIR/backups"

# Clone or copy repository
if [ -n "$REPO_URL" ]; then
    echo -e "${GREEN}Cloning repository from: $REPO_URL${NC}"
    git clone "$REPO_URL" "$APP_DIR" || {
        echo -e "${YELLOW}Directory exists, pulling latest changes...${NC}"
        cd "$APP_DIR" && git pull
    }
else
    echo -e "${YELLOW}No REPO_URL set. Assuming files are already in $APP_DIR${NC}"
    if [ "$(pwd)" != "$APP_DIR" ]; then
        echo -e "${GREEN}Copying files to $APP_DIR${NC}"
        cp -r ./* "$APP_DIR/"
    fi
fi

cd "$APP_DIR"

# Install dependencies
echo -e "${GREEN}Installing Node.js dependencies...${NC}"
npm install --production

# Build application
echo -e "${GREEN}Building application...${NC}"
npm run build

# Setup environment file
if [ ! -f "$APP_DIR/.env" ]; then
    echo -e "${GREEN}Creating .env file from production template${NC}"
    cp .env.production .env

    # Generate secure token
    SECURE_TOKEN=$(openssl rand -hex 32)
    sed -i "s/CHANGE_THIS_TO_SECURE_RANDOM_TOKEN/$SECURE_TOKEN/g" .env

    echo -e "${YELLOW}Please edit $APP_DIR/.env and configure:${NC}"
    echo "  - DATABASE_URL"
    echo "  - VOYAGE_API_KEY (if using Voyage AI)"
    echo "  - Other settings as needed"
else
    echo -e "${YELLOW}.env file already exists, skipping...${NC}"
fi

# Set permissions
echo -e "${GREEN}Setting file permissions...${NC}"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod -R 750 "$APP_DIR"
chmod -R 770 "$APP_DIR/data"

# Setup systemd service
echo -e "${GREEN}Installing systemd service...${NC}"
if [ -f "$APP_DIR/deployment/systemd/a2a.service" ]; then
    cp "$APP_DIR/deployment/systemd/a2a.service" /etc/systemd/system/
    systemctl daemon-reload
    systemctl enable a2a
    echo -e "${GREEN}Systemd service installed and enabled${NC}"
else
    echo -e "${YELLOW}Systemd service file not found${NC}"
fi

# Setup Nginx
echo -e "${GREEN}Configuring Nginx...${NC}"
if [ -f "$APP_DIR/deployment/nginx/a2a.conf" ]; then
    # Backup existing config if it exists
    if [ -f /etc/nginx/sites-available/a2a ]; then
        cp /etc/nginx/sites-available/a2a /etc/nginx/sites-available/a2a.backup
    fi

    cp "$APP_DIR/deployment/nginx/a2a.conf" /etc/nginx/sites-available/a2a

    # Enable site
    ln -sf /etc/nginx/sites-available/a2a /etc/nginx/sites-enabled/a2a

    echo -e "${YELLOW}Please edit /etc/nginx/sites-available/a2a and:${NC}"
    echo "  - Replace 'your.domain.com' with your actual domain"
    echo "  - Configure SSL certificates (see DEPLOYMENT.md)"

    # Test Nginx configuration
    nginx -t && echo -e "${GREEN}Nginx configuration is valid${NC}" || {
        echo -e "${RED}Nginx configuration has errors. Please fix before restarting.${NC}"
    }
else
    echo -e "${YELLOW}Nginx config file not found${NC}"
fi

# Configure firewall
if command -v ufw >/dev/null 2>&1; then
    echo -e "${GREEN}Configuring firewall...${NC}"
    ufw allow 22/tcp   # SSH
    ufw allow 80/tcp   # HTTP
    ufw allow 443/tcp  # HTTPS
    echo -e "${YELLOW}Firewall rules added. Enable with: sudo ufw enable${NC}"
fi

# Create backup script
echo -e "${GREEN}Creating backup script...${NC}"
cat > /usr/local/bin/a2a-backup << 'EOF'
#!/bin/bash
# A2A Backup Script
BACKUP_DIR="/opt/a2a/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf "$BACKUP_DIR/a2a-data-$TIMESTAMP.tar.gz" /opt/a2a/data
# Keep only last 7 backups
ls -t "$BACKUP_DIR"/a2a-data-*.tar.gz | tail -n +8 | xargs -r rm
echo "Backup created: $BACKUP_DIR/a2a-data-$TIMESTAMP.tar.gz"
EOF

chmod +x /usr/local/bin/a2a-backup

# Create update script
echo -e "${GREEN}Creating update script...${NC}"
cat > /usr/local/bin/a2a-update << 'EOF'
#!/bin/bash
# A2A Update Script
set -e
cd /opt/a2a
echo "Pulling latest changes..."
git pull
echo "Installing dependencies..."
npm install --production
echo "Building application..."
npm run build
echo "Restarting service..."
systemctl restart a2a
echo "Update complete!"
EOF

chmod +x /usr/local/bin/a2a-update

# Setup cron for automatic backups (daily at 2 AM)
echo -e "${GREEN}Setting up automatic backups...${NC}"
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/a2a-backup") | crontab -

echo ""
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Edit the configuration file: sudo nano $APP_DIR/.env"
echo "2. Edit Nginx configuration: sudo nano /etc/nginx/sites-available/a2a"
echo "3. Start the service: sudo systemctl start a2a"
echo "4. Check status: sudo systemctl status a2a"
echo "5. Reload Nginx: sudo systemctl reload nginx"
echo "6. (Optional) Get SSL certificate: sudo certbot --nginx -d your.domain.com"
echo ""
echo -e "${GREEN}Useful commands:${NC}"
echo "  - View logs: sudo journalctl -u a2a -f"
echo "  - Restart service: sudo systemctl restart a2a"
echo "  - Backup data: sudo /usr/local/bin/a2a-backup"
echo "  - Update app: sudo /usr/local/bin/a2a-update"
echo ""
echo -e "${GREEN}See DEPLOYMENT.md for more details${NC}"
