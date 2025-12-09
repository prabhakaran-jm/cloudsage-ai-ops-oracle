# CloudSage Deployment Scripts

All deployment scripts for CloudSage are centralized here.

---

## 📁 Scripts Overview

### Backend Deployment
- **`deploy-raindrop.sh`** - Deploy backend API to Raindrop Platform

### Vultr Worker Deployment
- **`deploy-vultr-worker.sh`** - Initial deployment of worker to Vultr instance
- **`update-vultr-worker.sh`** - Update worker code on existing instance
- **`create-worker-env.sh`** - Create/update worker .env file
- **`verify-worker-key.sh`** - Test worker API key and connectivity

### Testing
- **`test-integration.js`** - Test complete backend → worker integration

---

## 🚀 Deployment Workflows

### 1. Deploy Backend to Raindrop

```bash
# From project root
./infra/deploy/deploy-raindrop.sh
```

**What it does:**
- Checks Raindrop CLI installation
- Validates authentication
- Builds TypeScript
- Validates manifest
- Sets environment variables
- Deploys to Raindrop
- Shows deployment URL

**Prerequisites:**
- Raindrop CLI installed
- Raindrop account authenticated
- Environment variables ready

---

### 6. Test Integration

```bash
# Test complete backend → worker integration
node infra/deploy/test-integration.js

# With custom configuration
VULTR_WORKER_URL=http://YOUR_IP:8080 \
VULTR_API_KEY=your_key \
BACKEND_URL=http://localhost:3001 \
node infra/deploy/test-integration.js
```

**What it does:**
- Tests worker health endpoint
- Tests worker score calculation
- Tests backend health endpoint
- Tests complete integration (register → create project → ingest logs → get risk score)

**Prerequisites:**
- Worker running and accessible
- Backend running (for integration test)
- Node.js 18+ (for native fetch support)

---

### 2. Deploy Vultr Worker (First Time)

#### Option A: Manual Deployment

```bash
# 1. Create Vultr instance
# Go to: https://my.vultr.com/deploy/

# 2. SSH into instance
ssh root@YOUR_VULTR_IP

# 3. Download and run deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/cloudsage-ai-ops-oracle/main/infra/deploy/deploy-vultr-worker.sh
chmod +x deploy.sh
./deploy.sh
```

#### Option B: Terraform (Automated)

```bash
# See infra/vultr/terraform/README.md
cd infra/vultr/terraform
terraform init
terraform apply
```

**What it does:**
- Updates system packages
- Installs Node.js 20, Git, PM2
- Clones repository
- Installs dependencies
- Builds TypeScript
- Creates .env file
- Starts worker with PM2
- Configures firewall

---

### 3. Update Vultr Worker

```bash
# SSH into Vultr instance
ssh root@YOUR_VULTR_IP

# Navigate to project
cd /root/cloudsage-ai-ops-oracle

# Run update script
./infra/deploy/update-vultr-worker.sh
```

**What it does:**
- Pulls latest code
- Installs dependencies
- Rebuilds TypeScript
- Restarts PM2 process
- Tests worker endpoint

---

### 4. Create/Update Worker Environment

```bash
# SSH into Vultr instance
ssh root@YOUR_VULTR_IP

# Run env creation script
./infra/deploy/create-worker-env.sh [OPTIONAL_API_KEY]
```

**What it does:**
- Creates .env file if missing
- Sets PORT, API_KEY, NODE_ENV
- Shows current configuration

---

### 5. Verify Worker Configuration

```bash
# From your local machine
export VULTR_WORKER_URL=http://YOUR_VULTR_IP:8080
export VULTR_API_KEY=your_api_key

./infra/deploy/verify-worker-key.sh
```

**What it does:**
- Tests health endpoint
- Tests score endpoint with Bearer token
- Tests score endpoint with X-API-Key header
- Verifies API key matches

---

## 🔄 Complete Deployment Flow

### Initial Setup

```bash
# 1. Deploy Vultr Worker
ssh root@YOUR_VULTR_IP
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/cloudsage-ai-ops-oracle/main/infra/deploy/deploy-vultr-worker.sh
chmod +x deploy.sh
./deploy.sh

# 2. Note the API_KEY from output

# 3. Deploy Backend
cd /path/to/cloudsage-ai-ops-oracle
./infra/deploy/deploy-raindrop.sh
# Enter VULTR_WORKER_URL and VULTR_API_KEY when prompted

# 4. Deploy Frontend (if needed)
cd apps/web
netlify deploy --prod
```

### Updates

```bash
# Update Worker
ssh root@YOUR_VULTR_IP
cd /root/cloudsage-ai-ops-oracle
./infra/deploy/update-vultr-worker.sh

# Update Backend
cd /path/to/cloudsage-ai-ops-oracle
./infra/deploy/deploy-raindrop.sh

# Update Frontend
cd apps/web
npm run build
netlify deploy --prod
```

---

## 🔧 Script Details

### deploy-raindrop.sh

**Usage:**
```bash
./infra/deploy/deploy-raindrop.sh
```

**Interactive prompts:**
- RAINDROP_MCP_URL (default: https://mcp.raindrop.run/)
- RAINDROP_API_KEY
- VULTR_WORKER_URL
- VULTR_API_KEY

**Output:**
- Deployment status
- Deployment URL
- Service endpoints

---

### deploy-vultr-worker.sh

**Usage:**
```bash
# On Vultr instance
./deploy.sh
```

**Interactive prompts:**
- Repository URL (if not cloned)

**Output:**
- Worker IP address
- Health check URL
- Score endpoint URL
- Generated API_KEY
- Backend environment variables

---

### update-vultr-worker.sh

**Usage:**
```bash
# On Vultr instance
./infra/deploy/update-vultr-worker.sh
```

**No prompts** - Fully automated

**Output:**
- Update status
- PM2 status
- Test results

---

### create-worker-env.sh

**Usage:**
```bash
# On Vultr instance
./infra/deploy/create-worker-env.sh [API_KEY]
```

**Arguments:**
- `API_KEY` (optional) - Custom API key, or uses default

**Output:**
- .env file location
- Current contents
- Restart instructions

---

### verify-worker-key.sh

**Usage:**
```bash
# From local machine
export VULTR_WORKER_URL=http://YOUR_IP:8080
export VULTR_API_KEY=your_key
./infra/deploy/verify-worker-key.sh
```

**Environment variables:**
- `VULTR_WORKER_URL` - Worker URL
- `VULTR_API_KEY` - API key to test

**Output:**
- Health check result
- Bearer token test result
- X-API-Key header test result

---

## 🐛 Troubleshooting

### Backend Deployment Fails

```bash
# Check Raindrop CLI
raindrop --version

# Check authentication
raindrop auth list

# Re-authenticate
raindrop auth login

# Check manifest
cd apps/api
raindrop build validate
```

### Worker Not Starting

```bash
# SSH into instance
ssh root@YOUR_VULTR_IP

# Check PM2 status
pm2 status

# View logs
pm2 logs risk-worker

# Restart
pm2 restart risk-worker

# Check .env file
cat /root/cloudsage-ai-ops-oracle/services/vultr-worker/.env
```

### Worker API Key Mismatch

```bash
# On Vultr instance
cd /root/cloudsage-ai-ops-oracle/services/vultr-worker
cat .env | grep API_KEY

# Update if needed
./infra/deploy/create-worker-env.sh NEW_API_KEY
pm2 restart risk-worker

# Update backend
# Add new VULTR_API_KEY to apps/api/.env
# Redeploy backend
```

### Health Check Fails

```bash
# Check if worker is running
ssh root@YOUR_VULTR_IP "pm2 status"

# Check firewall
ssh root@YOUR_VULTR_IP "ufw status"

# Test locally on instance
ssh root@YOUR_VULTR_IP "curl http://localhost:8080/health"

# Check from outside
curl http://YOUR_VULTR_IP:8080/health
```

---

## 📊 Monitoring

### Check Worker Status

```bash
# PM2 status
ssh root@YOUR_VULTR_IP "pm2 status"

# View logs
ssh root@YOUR_VULTR_IP "pm2 logs risk-worker --lines 50"

# Monitor in real-time
ssh root@YOUR_VULTR_IP "pm2 monit"
```

### Check Backend Status

```bash
# Health check
curl https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run/api/hello

# Raindrop status
cd apps/api
raindrop build status
```

---

## 🔐 Security Notes

1. **Never commit .env files** - They contain secrets
2. **Use strong API keys** - Generate with `openssl rand -hex 32`
3. **Restrict firewall** - Only open necessary ports
4. **Use SSH keys** - Disable password authentication
5. **Keep updated** - Regularly update system packages

---

## 📚 Additional Resources

- **Raindrop Docs:** https://docs.raindrop.run
- **Vultr Docs:** https://www.vultr.com/docs/
- **PM2 Docs:** https://pm2.keymetrics.io/docs/usage/quick-start/
- **Terraform Guide:** `../vultr/terraform/README.md`

---

## 🎯 Quick Reference

```bash
# Deploy backend
./infra/deploy/deploy-raindrop.sh

# Deploy worker (first time)
ssh root@VULTR_IP
curl -o deploy.sh https://raw.githubusercontent.com/USER/REPO/main/infra/deploy/deploy-vultr-worker.sh
chmod +x deploy.sh && ./deploy.sh

# Update worker
ssh root@VULTR_IP
cd /root/cloudsage-ai-ops-oracle
./infra/deploy/update-vultr-worker.sh

# Verify worker
export VULTR_WORKER_URL=http://IP:8080
export VULTR_API_KEY=key
./infra/deploy/verify-worker-key.sh

# Check status
ssh root@VULTR_IP "pm2 status"
ssh root@VULTR_IP "pm2 logs risk-worker"
```

---

**Need help?** Check the troubleshooting section or open an issue on GitHub.
