# CloudSage Vultr Worker - Terraform Deployment

Deploy the CloudSage risk scoring worker to Vultr Cloud Compute using Terraform.

---

## 🚀 Quick Start

### Prerequisites

1. **Terraform installed** (v1.0+)
   ```bash
   # macOS
   brew install terraform
   
   # Linux
   wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
   unzip terraform_1.6.0_linux_amd64.zip
   sudo mv terraform /usr/local/bin/
   ```

2. **Vultr API Key**
   - Go to: https://my.vultr.com/settings/#settingsapi
   - Click "Enable API" if not enabled
   - Copy your API key

3. **GitHub Repository**
   - Your CloudSage repository must be accessible
   - Public repo or set up deploy keys for private repo

---

## 📝 Setup

### Step 1: Configure Variables

```bash
# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required variables:**
```hcl
vultr_api_key = "YOUR_VULTR_API_KEY"
github_repo   = "https://github.com/YOUR_USERNAME/cloudsage-ai-ops-oracle.git"
```

**Optional variables:**
```hcl
region         = "ewr"           # New Jersey (closest to you)
plan           = "vc2-1c-1gb"    # $6/month
ssh_key_ids    = []              # Add SSH keys for access
worker_api_key = ""              # Leave empty to auto-generate
```

### Step 2: Initialize Terraform

```bash
terraform init
```

This downloads the Vultr provider and prepares Terraform.

### Step 3: Plan Deployment

```bash
terraform plan
```

Review what will be created:
- 1 Vultr Cloud Compute instance
- 1 Firewall group with rules
- Random API key (if not provided)

### Step 4: Deploy

```bash
terraform apply
```

Type `yes` to confirm.

**Deployment takes 2-3 minutes:**
1. Creates Vultr instance
2. Runs startup script
3. Installs Node.js, PM2, dependencies
4. Clones your repository
5. Builds and starts the worker

### Step 5: Get Configuration

```bash
# View all outputs
terraform output

# Get worker URL
terraform output -raw worker_url

# Get API key (sensitive)
terraform output -raw worker_api_key
```

---

## 🔧 Configuration

### Update Backend

Add these to `apps/api/.env`:

```bash
# Get values from Terraform
VULTR_WORKER_URL=$(terraform output -raw worker_url)
VULTR_API_KEY=$(terraform output -raw worker_api_key)

# Add to .env
echo "VULTR_WORKER_URL=$VULTR_WORKER_URL" >> ../../apps/api/.env
echo "VULTR_API_KEY=$VULTR_API_KEY" >> ../../apps/api/.env
```

### Redeploy Backend

```bash
cd ../../../apps/api
./scripts/deploy-raindrop.sh
```

---

## ✅ Verify Deployment

### Test Health Endpoint

```bash
# Get worker URL
WORKER_URL=$(terraform output -raw worker_url)

# Test health
curl $WORKER_URL/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "vultr-risk-worker",
  "timestamp": "2024-12-09T..."
}
```

### Test Score Endpoint

```bash
# Get API key
API_KEY=$(terraform output -raw worker_api_key)

# Test scoring
curl -X POST $WORKER_URL/score \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test",
    "logs": [
      "ERROR: Database connection timeout",
      "WARN: Memory usage at 85%"
    ]
  }'
```

Expected response:
```json
{
  "projectId": "test",
  "riskScore": {
    "score": 45,
    "labels": ["Database Issues", "Memory Pressure"],
    "timestamp": "2024-12-09T..."
  }
}
```

---

## 🔍 Management

### SSH Access

```bash
# Get SSH command
terraform output -raw ssh_command

# Or manually
ssh root@$(terraform output -raw instance_ip)
```

### View Logs

```bash
# SSH into instance
ssh root@$(terraform output -raw instance_ip)

# View PM2 logs
pm2 logs risk-worker

# View last 100 lines
pm2 logs risk-worker --lines 100
```

### Restart Worker

```bash
ssh root@$(terraform output -raw instance_ip) "pm2 restart risk-worker"
```

### Update Worker Code

```bash
ssh root@$(terraform output -raw instance_ip) << 'EOF'
cd /root/cloudsage-ai-ops-oracle
git pull
cd services/vultr-worker
npm install
npm run build
pm2 restart risk-worker
EOF
```

---

## 🔄 Updates

### Update Infrastructure

```bash
# Modify terraform.tfvars or *.tf files
nano terraform.tfvars

# Plan changes
terraform plan

# Apply changes
terraform apply
```

### Update Worker Code Only

```bash
# SSH and update
ssh root@$(terraform output -raw instance_ip) << 'EOF'
cd /root/cloudsage-ai-ops-oracle
git pull
cd services/vultr-worker
npm install
npm run build
pm2 restart risk-worker
EOF
```

---

## 🗑️ Destroy

### Remove Everything

```bash
# Destroy all resources
terraform destroy
```

Type `yes` to confirm.

**This will:**
- Delete the Vultr instance
- Remove firewall rules
- Delete all data on the instance

**Backup first if needed!**

---

## 📊 Costs

### Instance Costs
- **vc2-1c-1gb**: $6/month (1 vCPU, 1GB RAM)
- **vc2-2c-4gb**: $18/month (2 vCPU, 4GB RAM)
- **vc2-4c-8gb**: $36/month (4 vCPU, 8GB RAM)

### Additional Costs
- **Backups**: $1/month (optional)
- **Bandwidth**: Included (1TB+)
- **Snapshots**: $0.05/GB/month (optional)

### Total Monthly Cost
- **Minimum**: $6/month (single worker)
- **Recommended**: $18/month (2 vCPU for better performance)

---

## 🔒 Security

### Firewall Rules

Automatically configured:
- Port 22 (SSH) - Open to all
- Port 8080 (Worker API) - Open to all
- All other ports - Blocked

### API Key

- Auto-generated 32-character random key
- Or provide your own in `terraform.tfvars`
- Stored securely in Terraform state

### SSH Access

Add your SSH keys:
```hcl
# In terraform.tfvars
ssh_key_ids = ["your-ssh-key-id"]
```

Get SSH key ID:
```bash
vultr-cli ssh-key list
```

---

## 🐛 Troubleshooting

### Worker Not Starting

```bash
# SSH into instance
ssh root@$(terraform output -raw instance_ip)

# Check PM2 status
pm2 status

# View logs
pm2 logs risk-worker

# Restart
pm2 restart risk-worker
```

### Health Check Fails

```bash
# Check if worker is running
ssh root@$(terraform output -raw instance_ip) "pm2 status"

# Check firewall
ssh root@$(terraform output -raw instance_ip) "ufw status"

# Test locally on instance
ssh root@$(terraform output -raw instance_ip) "curl http://localhost:8080/health"
```

### Terraform Errors

```bash
# Refresh state
terraform refresh

# Re-initialize
rm -rf .terraform
terraform init

# Force unlock (if locked)
terraform force-unlock LOCK_ID
```

---

## 📚 Additional Resources

- **Vultr Docs**: https://www.vultr.com/docs/
- **Terraform Vultr Provider**: https://registry.terraform.io/providers/vultr/vultr/latest/docs
- **Vultr CLI**: https://github.com/vultr/vultr-cli

---

## 🎯 Next Steps

1. ✅ Deploy worker with Terraform
2. ✅ Update backend configuration
3. ✅ Test integration
4. 📊 Set up monitoring (optional)
5. 🔄 Configure auto-scaling (optional)
6. 🔒 Set up SSL/HTTPS (optional)

---

**Questions?** Check the main `infra/README.md` or open an issue on GitHub.
