#!/bin/bash
# Quick deployment script for Vultr Worker
# Run this on your Vultr Cloud Compute instance

set -e

echo "🚀 Deploying CloudSage Risk Worker"
echo "===================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠${NC} Not running as root. Some commands may need sudo."
fi

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install Node.js 20
echo "Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo -e "${GREEN}✓${NC} Node.js already installed: $(node --version)"
fi

# Install Git
echo "Installing Git..."
apt install -y git

# Install PM2
echo "Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo -e "${GREEN}✓${NC} PM2 already installed"
fi

# Clone or update repository
if [ -d "cloudsage-ai-ops-oracle" ]; then
    echo "Updating repository..."
    cd cloudsage-ai-ops-oracle
    git pull
else
    echo "Cloning repository..."
    echo -e "${YELLOW}⚠${NC} Please provide your repository URL:"
    read -p "Repository URL (or press Enter to skip): " REPO_URL
    if [ -n "$REPO_URL" ]; then
        git clone "$REPO_URL"
        cd cloudsage-ai-ops-oracle
    else
        echo -e "${RED}✗${NC} Repository URL required. Exiting."
        exit 1
    fi
fi

# Navigate to worker directory
cd services/vultr-worker

# Install dependencies
echo "Installing dependencies..."
npm install

# Build
echo "Building TypeScript..."
npm run build

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠${NC} Creating .env file..."
    cat > .env << EOF
PORT=8080
API_KEY=$(openssl rand -hex 32)
NODE_ENV=production
EOF
    echo -e "${GREEN}✓${NC} Created .env file with random API_KEY"
    echo -e "${YELLOW}⚠${NC} IMPORTANT: Save this API_KEY - you'll need it for backend configuration!"
    cat .env | grep API_KEY
else
    echo -e "${GREEN}✓${NC} .env file already exists"
fi

# Setup firewall
echo "Configuring firewall..."
ufw allow 8080/tcp
ufw --force enable

# Start with PM2
echo "Starting worker with PM2..."
pm2 delete risk-worker 2>/dev/null || true
pm2 start dist/main.js --name risk-worker
pm2 save

# Setup PM2 startup
echo "Setting up PM2 startup..."
pm2 startup | grep -v "PM2" | bash || echo "PM2 startup already configured"

# Get IP address
IP_ADDRESS=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Worker Information:"
echo "  IP Address: $IP_ADDRESS"
echo "  Port: 8080"
echo "  Health Check: http://$IP_ADDRESS:8080/health"
echo "  Score Endpoint: http://$IP_ADDRESS:8080/score"
echo ""
echo "Environment Variables for Backend:"
echo "  VULTR_WORKER_URL=http://$IP_ADDRESS:8080"
echo "  VULTR_API_KEY=$(grep API_KEY .env | cut -d '=' -f2)"
echo ""
echo "PM2 Commands:"
echo "  pm2 status          # Check status"
echo "  pm2 logs risk-worker # View logs"
echo "  pm2 restart risk-worker # Restart"
echo ""

