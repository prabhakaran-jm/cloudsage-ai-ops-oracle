#!/bin/bash
# CloudSage Risk Worker Startup Script
# This script runs automatically when the Vultr instance is created
# It installs dependencies, clones the repo, and starts the worker

set -e

echo "🚀 CloudSage Risk Worker - Automated Setup"
echo "==========================================="
echo ""

# Update system
echo "📦 Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y

# Install Node.js 20
echo "📦 Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
else
    echo "✓ Node.js already installed: $(node --version)"
fi

# Install Git
echo "📦 Installing Git..."
apt-get install -y git

# Install PM2 globally
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
else
    echo "✓ PM2 already installed"
fi

# Install build essentials (for native modules)
echo "📦 Installing build tools..."
apt-get install -y build-essential

# Create app directory
echo "📁 Setting up application directory..."
cd /root

# Clone repository
REPO_URL="${github_repo}"
if [ -d "cloudsage-ai-ops-oracle" ]; then
    echo "📂 Repository already exists, pulling latest changes..."
    cd cloudsage-ai-ops-oracle
    git pull origin main || git pull origin master
else
    echo "📥 Cloning repository..."
    if [ "$REPO_URL" = "https://github.com/YOUR_USERNAME/cloudsage-ai-ops-oracle.git" ]; then
        echo "⚠️  WARNING: Using placeholder repository URL"
        echo "⚠️  Please update github_repo variable in terraform.tfvars"
        echo "⚠️  Attempting to clone anyway..."
    fi
    git clone "$REPO_URL" || {
        echo "❌ Failed to clone repository"
        echo "❌ Please check your github_repo variable"
        exit 1
    }
    cd cloudsage-ai-ops-oracle
fi

# Navigate to worker directory
echo "📂 Navigating to worker directory..."
cd services/vultr-worker

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Create .env file
echo "⚙️  Creating environment configuration..."
cat > .env << EOF
PORT=8080
API_KEY=${api_key}
NODE_ENV=production
EOF

echo "✓ Environment file created"

# Configure firewall
echo "🔒 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 8080/tcp comment 'Risk Worker API'
ufw --force enable

echo "✓ Firewall configured"

# Start with PM2
echo "🚀 Starting worker with PM2..."
pm2 delete risk-worker 2>/dev/null || true
pm2 start dist/main.js --name risk-worker --time
pm2 save

# Setup PM2 startup
echo "⚙️  Configuring PM2 to start on boot..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root | grep -v "PM2" | bash || echo "PM2 startup already configured"

# Get IP address
IP_ADDRESS=$(curl -s ifconfig.me || hostname -I | awk '{print $1}')

# Create status file
cat > /root/cloudsage-status.txt << EOF
CloudSage Risk Worker - Deployment Complete
============================================

Instance Information:
  IP Address: $IP_ADDRESS
  Port: 8080
  Status: Running

Endpoints:
  Health Check: http://$IP_ADDRESS:8080/health
  Score API: http://$IP_ADDRESS:8080/score

Backend Configuration:
  Add these to your backend .env file:
  
  VULTR_WORKER_URL=http://$IP_ADDRESS:8080
  VULTR_API_KEY=${api_key}

Management Commands:
  pm2 status              # Check worker status
  pm2 logs risk-worker    # View logs
  pm2 restart risk-worker # Restart worker
  pm2 stop risk-worker    # Stop worker

Update Worker:
  cd /root/cloudsage-ai-ops-oracle
  git pull
  cd services/vultr-worker
  npm install
  npm run build
  pm2 restart risk-worker

Deployment Time: $(date)
EOF

# Display status
echo ""
echo "✅ Deployment Complete!"
echo ""
cat /root/cloudsage-status.txt

# Test health endpoint
echo ""
echo "🔍 Testing health endpoint..."
sleep 5
curl -s http://localhost:8080/health || echo "⚠️  Health check failed - worker may still be starting"

echo ""
echo "📝 Status saved to: /root/cloudsage-status.txt"
echo ""
