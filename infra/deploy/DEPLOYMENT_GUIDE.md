# CloudSage Deployment Guide

Complete guide for deploying CloudSage to production.

---

## 🎯 Deployment Overview

CloudSage consists of 3 components:
1. **Frontend** - Next.js app on Netlify
2. **Backend** - Raindrop API service
3. **Worker** - Vultr Cloud Compute risk scorer

---

## 🚀 Quick Deployment (15 minutes)

### Prerequisites

- Raindrop account with API key
- Vultr account with API key
- Netlify account (free tier works)
- GitHub repository (public or private)

### Step 1: Deploy Vultr Worker (5 min)

```bash
# 1. Create Vultr instance
# Go to: https://my.vultr.com/deploy/
# - Region: New Jersey (or closest)
# - Plan: Cloud Compute - $6/month (1GB RAM)
# - OS: Ubuntu 22.04 LTS

# 2. SSH into instance
ssh root@YOUR_VULTR_IP

# 3. Run deployment script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/cloudsage-ai-ops-oracle/main/infra/deploy/deploy-vultr-worker.sh
chmod +x deploy.sh
./deploy.sh

# 4. Save the output:
# - Worker URL: http://YOUR_IP:8080
# - API Key: [generated key]
```

### Step 2: Deploy Backend to Raindrop (5 min)

```bash
# From your local machine
cd /path/to/cloudsage-ai-ops-oracle

# Run deployment script
./infra/deploy/deploy-raindrop.sh

# When prompted, enter:
# - RAINDROP_MCP_URL: https://mcp.raindrop.run/
# - RAINDROP_API_KEY: [your Raindrop API key]
# - VULTR_WORKER_URL: http://YOUR_VULTR_IP:8080
# - VULTR_API_KEY: [from Step 1]

# Save the deployment URL from output
```

### Step 3: Deploy Frontend to Netlify (5 min)

```bash
# Update environment variable
cd apps/web
echo "NEXT_PUBLIC_API_URL=https://your-raindrop-url.lmapp.run/api" > .env.production

# Deploy
npm run build
netlify deploy --prod

# Or use Netlify UI:
# 1. Connect GitHub repo
# 2. Set build command: npm run build
# 3. Set publish directory: .next
# 4. Add environment variable: NEXT_PUBLIC_API_URL
```

---

## 📋 Detailed Deployment Steps

### 1. Vultr Worker Deployment

#### Option A: Manual Deployment (Recommended for first time)

**1.1 Create Vultr Instance**

Go to https://my.vultr.com/deploy/

**Settings:**
- **Choose Server:** Cloud Compute
- **CPU & Storage Technology:** Regular Performance
- **Server Location:** New Jersey (or closest to you)
- **Server Type:** Ubuntu 22.04 LTS x64
- **Server Size:** 25 GB SSD, 1 vCPU, 1024 MB Memory ($6/mo)
- **Additional Features:** None required
- **Server Hostname:** cloudsage-risk-worker

Click **Deploy Now**

**1.2 Wait for Provisioning** (~2 minutes)

**1.3 Get Instance Details**
- IP Address: Copy from Vultr dashboard
- Root Password: Copy from Vultr dashboard (or use SSH key)

**1.4 SSH into Instance**

```bash
ssh root@YOUR_VULTR_IP
# Enter password when prompted
```

**1.5 Run Deployment Script**

```bash
# Download script
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/cloudsage-ai-ops-oracle/main/infra/deploy/deploy-vultr-worker.sh

# Make executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

**1.6 Save Configuration**

The script will output:
```
Worker URL: http://YOUR_IP:8080
API Key: [32-character hex string]
```

**Save these values!** You'll need them for backend deployment.

**1.7 Verify Deployment**

```bash
# Test health endpoint
curl http://YOUR_VULTR_IP:8080/health

# Expected response:
# {"status":"ok","service":"vultr-risk-worker","timestamp":"..."}
```

#### Option B: Terraform Deployment (Automated)

```bash
cd infra/vultr/terraform

# Configure
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Add your Vultr API key and GitHub repo

# Deploy
terraform init
terraform apply

# Get configuration
terraform output -raw worker_url
terraform output -raw worker_api_key
```

---

### 2. Backend Deployment to Raindrop

**2.1 Install Raindrop CLI** (if not installed)

```bash
npm install -g @liquidmetal-ai/raindrop@latest
```

**2.2 Authenticate**

```bash
raindrop auth login
```

Follow the prompts to authenticate.

**2.3 Prepare Environment Variables**

You'll need:
- `RAINDROP_MCP_URL`: https://mcp.raindrop.run/
- `RAINDROP_API_KEY`: Your Raindrop API key
- `VULTR_WORKER_URL`: http://YOUR_VULTR_IP:8080 (from Step 1)
- `VULTR_API_KEY`: [from Step 1]

**2.4 Run Deployment Script**

```bash
cd /path/to/cloudsage-ai-ops-oracle
./infra/deploy/deploy-raindrop.sh
```

Enter the values when prompted.

**2.5 Save Deployment URL**

The script will output:
```
Deployment URL: https://cloudsage-api.XXXXX.lmapp.run
```

**Save this URL!** You'll need it for frontend deployment.

**2.6 Verify Deployment**

```bash
# Test health endpoint
curl https://your-deployment-url.lmapp.run/api/hello

# Expected response:
# {"status":"ok","message":"Hello from CloudSage API!"}
```

---

### 3. Frontend Deployment to Netlify

**3.1 Install Netlify CLI** (if not installed)

```bash
npm install -g netlify-cli
```

**3.2 Authenticate**

```bash
netlify login
```

**3.3 Configure Environment**

```bash
cd apps/web

# Create production environment file
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=https://your-raindrop-url.lmapp.run/api
EOF
```

Replace `your-raindrop-url` with your actual Raindrop deployment URL from Step 2.

**3.4 Build**

```bash
npm install
npm run build
```

**3.5 Deploy**

```bash
# First deployment (creates site)
netlify deploy

# Review the preview URL, then deploy to production
netlify deploy --prod
```

**3.6 Save Deployment URL**

Netlify will output:
```
Website URL: https://your-site.netlify.app
```

**3.7 Verify Deployment**

Open the URL in your browser and test:
1. Register a new account
2. Create a project
3. Ingest sample logs
4. View risk score and forecast

---

## 🔄 Updates & Maintenance

### Update Vultr Worker

```bash
# SSH into Vultr instance
ssh root@YOUR_VULTR_IP

# Navigate to project
cd /root/cloudsage-ai-ops-oracle

# Run update script
./infra/deploy/update-vultr-worker.sh
```

### Update Backend

```bash
cd /path/to/cloudsage-ai-ops-oracle
./infra/deploy/deploy-raindrop.sh
```

### Update Frontend

```bash
cd apps/web
npm run build
netlify deploy --prod
```

---

## 🐛 Troubleshooting

### Worker Issues

**Problem:** Health check fails

```bash
# Check if worker is running
ssh root@YOUR_VULTR_IP "pm2 status"

# View logs
ssh root@YOUR_VULTR_IP "pm2 logs risk-worker"

# Restart
ssh root@YOUR_VULTR_IP "pm2 restart risk-worker"
```

**Problem:** API key mismatch

```bash
# Check worker API key
ssh root@YOUR_VULTR_IP "cat /root/cloudsage-ai-ops-oracle/services/vultr-worker/.env"

# Update backend with correct key
# Edit apps/api/.env
# Redeploy backend
```

### Backend Issues

**Problem:** Deployment fails

```bash
# Check authentication
raindrop auth list

# Re-authenticate
raindrop auth login

# Check manifest
cd apps/api
raindrop build validate
```

**Problem:** Can't reach worker

```bash
# Test worker from backend
curl http://YOUR_VULTR_IP:8080/health

# Check firewall on Vultr
ssh root@YOUR_VULTR_IP "ufw status"
```

### Frontend Issues

**Problem:** API calls fail

```bash
# Check environment variable
cat apps/web/.env.production

# Should match your Raindrop URL
# Rebuild and redeploy if wrong
```

**Problem:** Build fails

```bash
# Clear cache
rm -rf apps/web/.next
rm -rf apps/web/node_modules

# Reinstall and rebuild
cd apps/web
npm install
npm run build
```

---

## 📊 Monitoring

### Check All Services

```bash
# Worker
curl http://YOUR_VULTR_IP:8080/health

# Backend
curl https://your-raindrop-url.lmapp.run/api/hello

# Frontend
curl https://your-netlify-site.netlify.app
```

### View Logs

```bash
# Worker logs
ssh root@YOUR_VULTR_IP "pm2 logs risk-worker --lines 100"

# Backend logs
cd apps/api
raindrop build logs

# Frontend logs (in Netlify dashboard)
netlify logs
```

---

## 💰 Cost Breakdown

### Monthly Costs

- **Vultr Worker:** $6/month (1GB RAM instance)
- **Raindrop Backend:** Pay-as-you-go (free tier available)
- **Netlify Frontend:** Free (100GB bandwidth)

**Total:** ~$6-10/month for small-scale production

### Scaling Costs

- **Vultr Worker (2GB):** $12/month
- **Vultr Worker (4GB):** $24/month
- **Multiple Workers:** $6/month per worker
- **Netlify Pro:** $19/month (unlimited bandwidth)

---

## 🔐 Security Checklist

- [ ] Use strong API keys (32+ characters)
- [ ] Enable Vultr firewall (only ports 22, 8080)
- [ ] Use SSH keys instead of passwords
- [ ] Keep environment variables secret
- [ ] Enable HTTPS (Raindrop and Netlify do this automatically)
- [ ] Regularly update system packages
- [ ] Monitor logs for suspicious activity
- [ ] Set up backup strategy

---

## 🎯 Production Checklist

Before going live:

- [ ] All services deployed and tested
- [ ] Environment variables configured correctly
- [ ] API keys are secure and not committed to git
- [ ] Health checks passing for all services
- [ ] End-to-end test completed (register → create project → ingest logs → view forecast)
- [ ] Monitoring set up
- [ ] Backup strategy in place
- [ ] Documentation updated with actual URLs
- [ ] Team has access to all accounts (Vultr, Raindrop, Netlify)

---

## 📚 Additional Resources

- **Raindrop Docs:** https://docs.raindrop.run
- **Vultr Docs:** https://www.vultr.com/docs/
- **Netlify Docs:** https://docs.netlify.com/
- **PM2 Docs:** https://pm2.keymetrics.io/docs/

---

**Need help?** Check the troubleshooting section or open an issue on GitHub.
