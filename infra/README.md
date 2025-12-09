# CloudSage Infrastructure

This directory contains infrastructure-as-code and deployment configurations for CloudSage.

---

## 📁 Directory Structure

```
infra/
├── deploy/          # Frontend deployment configurations (Netlify, Vercel, etc.)
├── vultr/           # Vultr Cloud Compute infrastructure
│   └── terraform/   # Terraform configurations for Vultr resources
└── README.md        # This file
```

---

## 🚀 infra/deploy/

**Purpose:** Frontend deployment configurations and CI/CD pipelines

### What Goes Here

#### 1. Netlify Configuration
Create `infra/deploy/netlify.toml`:
```toml
[build]
  base = "apps/web"
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"
  NEXT_PUBLIC_API_URL = "https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run/api"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

#### 2. Vercel Configuration
Create `infra/deploy/vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "apps/web/package.json",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "apps/web/$1"
    }
  ],
  "env": {
    "NEXT_PUBLIC_API_URL": "https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run/api"
  }
}
```

#### 3. GitHub Actions CI/CD
Create `infra/deploy/github-actions.yml`:
```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: cd apps/web && npm install
      - name: Build
        run: cd apps/web && npm run build
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --prod
        env:
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
```

#### 4. Docker Compose (for local testing)
Create `infra/deploy/docker-compose.yml`:
```yaml
version: '3.8'

services:
  web:
    build:
      context: ../../apps/web
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001/api
    depends_on:
      - api

  api:
    build:
      context: ../../apps/api
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - RAINDROP_API_KEY=${RAINDROP_API_KEY}
      - VULTR_WORKER_URL=http://vultr-worker:8080
    depends_on:
      - vultr-worker

  vultr-worker:
    build:
      context: ../../services/vultr-worker
      dockerfile: Dockerfile
    ports:
      - "8080:8080"
    environment:
      - PORT=8080
      - API_KEY=${VULTR_API_KEY}
```

### How to Use

**For Netlify:**
```bash
# Copy netlify.toml to root
cp infra/deploy/netlify.toml netlify.toml

# Deploy
netlify deploy --prod
```

**For Vercel:**
```bash
# Deploy
vercel --prod
```

**For Docker:**
```bash
# Build and run locally
cd infra/deploy
docker-compose up --build
```

---

## ☁️ infra/vultr/

**Purpose:** Vultr Cloud Compute infrastructure for the risk scoring worker

### What Goes Here

#### 1. Terraform Configuration

**Why Terraform?**
- Infrastructure as Code (IaC)
- Version control your infrastructure
- Reproducible deployments
- Easy to scale (add more workers)

**Create `infra/vultr/terraform/main.tf`:**
```hcl
terraform {
  required_providers {
    vultr = {
      source  = "vultr/vultr"
      version = "~> 2.0"
    }
  }
}

provider "vultr" {
  api_key = var.vultr_api_key
}

# Variables
variable "vultr_api_key" {
  description = "Vultr API Key"
  type        = string
  sensitive   = true
}

variable "ssh_key_id" {
  description = "SSH Key ID for instance access"
  type        = string
}

# Cloud Compute Instance for Risk Worker
resource "vultr_instance" "risk_worker" {
  plan        = "vc2-1c-1gb"  # 1 vCPU, 1GB RAM
  region      = "ewr"          # New Jersey (change as needed)
  os_id       = 1743           # Ubuntu 22.04 LTS
  label       = "cloudsage-risk-worker"
  hostname    = "risk-worker"
  enable_ipv6 = false
  
  ssh_key_ids = [var.ssh_key_id]
  
  # Startup script
  user_data = file("${path.module}/startup.sh")
  
  tags = ["cloudsage", "risk-worker", "production"]
}

# Firewall
resource "vultr_firewall_group" "risk_worker_fw" {
  description = "CloudSage Risk Worker Firewall"
}

resource "vultr_firewall_rule" "allow_http" {
  firewall_group_id = vultr_firewall_group.risk_worker_fw.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "8080"
  notes             = "Allow HTTP traffic to risk worker"
}

resource "vultr_firewall_rule" "allow_ssh" {
  firewall_group_id = vultr_firewall_group.risk_worker_fw.id
  protocol          = "tcp"
  ip_type           = "v4"
  subnet            = "0.0.0.0"
  subnet_size       = 0
  port              = "22"
  notes             = "Allow SSH access"
}

# Outputs
output "instance_ip" {
  value       = vultr_instance.risk_worker.main_ip
  description = "Public IP address of the risk worker"
}

output "worker_url" {
  value       = "http://${vultr_instance.risk_worker.main_ip}:8080"
  description = "Risk worker URL for backend configuration"
}
```

**Create `infra/vultr/terraform/variables.tf`:**
```hcl
variable "vultr_api_key" {
  description = "Vultr API Key"
  type        = string
  sensitive   = true
}

variable "ssh_key_id" {
  description = "SSH Key ID for instance access"
  type        = string
}

variable "region" {
  description = "Vultr region"
  type        = string
  default     = "ewr"  # New Jersey
}

variable "plan" {
  description = "Vultr instance plan"
  type        = string
  default     = "vc2-1c-1gb"
}
```

**Create `infra/vultr/terraform/startup.sh`:**
```bash
#!/bin/bash
# Startup script for Vultr instance
# This runs automatically when the instance is created

set -e

# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git

# Install PM2
npm install -g pm2

# Clone repository (you'll need to set this up with deploy keys)
cd /root
git clone https://github.com/YOUR_USERNAME/cloudsage-ai-ops-oracle.git
cd cloudsage-ai-ops-oracle/services/vultr-worker

# Install dependencies and build
npm install
npm run build

# Create .env file
cat > .env << EOF
PORT=8080
API_KEY=$(openssl rand -hex 32)
NODE_ENV=production
EOF

# Start with PM2
pm2 start dist/main.js --name risk-worker
pm2 save
pm2 startup | grep -v "PM2" | bash

# Configure firewall
ufw allow 8080/tcp
ufw allow 22/tcp
ufw --force enable

echo "Risk worker deployed successfully!"
```

**Create `infra/vultr/terraform/terraform.tfvars.example`:**
```hcl
vultr_api_key = "YOUR_VULTR_API_KEY"
ssh_key_id    = "YOUR_SSH_KEY_ID"
region        = "ewr"
plan          = "vc2-1c-1gb"
```

#### 2. Manual Deployment Scripts

**Create `infra/vultr/deploy-manual.sh`:**
```bash
#!/bin/bash
# Manual deployment to Vultr (without Terraform)

set -e

echo "🚀 CloudSage Vultr Manual Deployment"
echo "====================================="
echo ""

# Check for required tools
if ! command -v vultr-cli &> /dev/null; then
    echo "Installing Vultr CLI..."
    curl -L https://github.com/vultr/vultr-cli/releases/latest/download/vultr-cli_linux_amd64.tar.gz | tar xz
    sudo mv vultr-cli /usr/local/bin/
fi

# Authenticate
echo "Authenticating with Vultr..."
read -p "Enter your Vultr API Key: " VULTR_API_KEY
export VULTR_API_KEY

# Create instance
echo "Creating Vultr instance..."
INSTANCE_ID=$(vultr-cli instance create \
    --region ewr \
    --plan vc2-1c-1gb \
    --os 1743 \
    --label cloudsage-risk-worker \
    --hostname risk-worker \
    --output json | jq -r '.id')

echo "Instance created: $INSTANCE_ID"
echo "Waiting for instance to be ready..."
sleep 60

# Get IP address
IP_ADDRESS=$(vultr-cli instance get $INSTANCE_ID --output json | jq -r '.main_ip')
echo "Instance IP: $IP_ADDRESS"

# SSH and deploy
echo "Deploying application..."
ssh root@$IP_ADDRESS 'bash -s' < ../../services/vultr-worker/deploy.sh

echo ""
echo "✅ Deployment complete!"
echo "Worker URL: http://$IP_ADDRESS:8080"
echo ""
echo "Add to your backend .env:"
echo "VULTR_WORKER_URL=http://$IP_ADDRESS:8080"
```

#### 3. Scaling Configuration

**Create `infra/vultr/scale.sh`:**
```bash
#!/bin/bash
# Scale risk workers (create multiple instances)

NUM_WORKERS=${1:-3}

echo "Creating $NUM_WORKERS risk worker instances..."

for i in $(seq 1 $NUM_WORKERS); do
    echo "Creating worker $i..."
    vultr-cli instance create \
        --region ewr \
        --plan vc2-1c-1gb \
        --os 1743 \
        --label "cloudsage-risk-worker-$i" \
        --hostname "risk-worker-$i"
done

echo "Workers created! Configure load balancer to distribute traffic."
```

### How to Use

#### Option 1: Terraform (Recommended)

```bash
# Navigate to terraform directory
cd infra/vultr/terraform

# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars

# Initialize Terraform
terraform init

# Plan deployment
terraform plan

# Deploy
terraform apply

# Get outputs
terraform output instance_ip
terraform output worker_url

# Destroy (when needed)
terraform destroy
```

#### Option 2: Manual Deployment

```bash
# Make script executable
chmod +x infra/vultr/deploy-manual.sh

# Run deployment
./infra/vultr/deploy-manual.sh
```

#### Option 3: Use Existing Script

```bash
# SSH into your Vultr instance
ssh root@YOUR_VULTR_IP

# Run the deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_REPO/main/services/vultr-worker/deploy.sh
chmod +x deploy.sh
./deploy.sh
```

---

## 🔄 Complete Deployment Workflow

### 1. Deploy Vultr Worker

```bash
# Using Terraform
cd infra/vultr/terraform
terraform init
terraform apply

# Get worker URL
WORKER_URL=$(terraform output -raw worker_url)
```

### 2. Configure Backend

```bash
# Update backend environment variables
cd apps/api
echo "VULTR_WORKER_URL=$WORKER_URL" >> .env

# Deploy backend to Raindrop
./scripts/deploy-raindrop.sh
```

### 3. Deploy Frontend

```bash
# Update frontend environment
cd apps/web
echo "NEXT_PUBLIC_API_URL=https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run/api" > .env.production

# Deploy to Netlify
netlify deploy --prod
```

---

## 📊 Monitoring & Maintenance

### Check Worker Status

```bash
# SSH into worker
ssh root@YOUR_VULTR_IP

# Check PM2 status
pm2 status

# View logs
pm2 logs risk-worker

# Restart worker
pm2 restart risk-worker
```

### Update Worker Code

```bash
# SSH into worker
ssh root@YOUR_VULTR_IP

# Navigate to repo
cd cloudsage-ai-ops-oracle

# Pull latest changes
git pull

# Rebuild and restart
cd services/vultr-worker
npm install
npm run build
pm2 restart risk-worker
```

### Scale Workers

```bash
# Create additional workers
cd infra/vultr
./scale.sh 3  # Creates 3 workers

# Configure load balancer (Vultr Load Balancer or Nginx)
```

---

## 💰 Cost Estimation

### Vultr Cloud Compute
- **vc2-1c-1gb** (1 vCPU, 1GB RAM): $6/month
- **vc2-2c-4gb** (2 vCPU, 4GB RAM): $18/month
- **vc2-4c-8gb** (4 vCPU, 8GB RAM): $36/month

### Raindrop Platform
- Included in hackathon credits
- Production pricing: Pay-as-you-go

### Netlify
- Free tier: 100GB bandwidth/month
- Pro: $19/month (unlimited bandwidth)

### Total Estimated Cost (MVP)
- **Development:** $0 (using credits)
- **Production (small):** ~$25/month
- **Production (scaled):** ~$100/month

---

## 🔐 Security Best Practices

### 1. API Keys
```bash
# Generate secure API key
openssl rand -hex 32

# Store in environment variables (never commit)
echo "API_KEY=..." >> .env
```

### 2. Firewall Rules
```bash
# Only allow necessary ports
ufw allow 22/tcp   # SSH
ufw allow 8080/tcp # Worker API
ufw deny 3306/tcp  # Block MySQL (if not needed)
ufw enable
```

### 3. SSH Keys
```bash
# Generate SSH key
ssh-keygen -t ed25519 -C "cloudsage-deploy"

# Add to Vultr
vultr-cli ssh-key create --name cloudsage --key "$(cat ~/.ssh/id_ed25519.pub)"
```

### 4. HTTPS
```bash
# Install Certbot
apt install certbot

# Get SSL certificate
certbot certonly --standalone -d your-domain.com

# Configure Nginx as reverse proxy with SSL
```

---

## 📚 Additional Resources

- **Vultr Docs:** https://www.vultr.com/docs/
- **Terraform Vultr Provider:** https://registry.terraform.io/providers/vultr/vultr/latest/docs
- **Netlify Docs:** https://docs.netlify.com/
- **PM2 Docs:** https://pm2.keymetrics.io/docs/usage/quick-start/

---

## 🎯 Next Steps

1. **Set up Terraform** for reproducible infrastructure
2. **Configure CI/CD** for automated deployments
3. **Add monitoring** (Datadog, New Relic, or Vultr monitoring)
4. **Set up load balancing** for multiple workers
5. **Implement auto-scaling** based on load
6. **Add backup strategy** for data persistence

---

**Questions?** Check the main README or open an issue on GitHub.
