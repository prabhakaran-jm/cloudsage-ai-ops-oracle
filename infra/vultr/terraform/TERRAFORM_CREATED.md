# ✅ Terraform Files Created!

All Terraform configuration files have been created for deploying the CloudSage risk worker to Vultr.

---

## 📁 Files Created

```
infra/vultr/terraform/
├── main.tf                      # Main Terraform configuration
├── variables.tf                 # Input variables
├── outputs.tf                   # Output values
├── startup.sh                   # Automated deployment script
├── terraform.tfvars.example     # Example configuration
├── .gitignore                   # Git ignore rules
└── README.md                    # Detailed documentation
```

---

## 🚀 Quick Start

### 1. Configure

```bash
cd infra/vultr/terraform

# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required:**
- `vultr_api_key` - Get from https://my.vultr.com/settings/#settingsapi
- `github_repo` - Your GitHub repository URL

### 2. Deploy

```bash
# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy
terraform apply
```

### 3. Get Configuration

```bash
# View all outputs
terraform output

# Get worker URL
terraform output -raw worker_url

# Get API key
terraform output -raw worker_api_key
```

---

## 📋 What This Does

When you run `terraform apply`, it will:

1. **Create Vultr Instance**
   - Ubuntu 22.04 LTS
   - 1 vCPU, 1GB RAM ($6/month)
   - New Jersey region (configurable)

2. **Configure Firewall**
   - Allow port 22 (SSH)
   - Allow port 8080 (Worker API)
   - Block all other ports

3. **Automated Setup** (via startup.sh)
   - Install Node.js 20
   - Install PM2
   - Clone your repository
   - Install dependencies
   - Build TypeScript
   - Create .env file
   - Start worker with PM2
   - Configure auto-start on boot

4. **Generate Outputs**
   - Worker URL
   - API key
   - SSH command
   - Backend configuration

---

## ⏱️ Deployment Time

- **Terraform apply:** ~30 seconds
- **Instance provisioning:** ~1 minute
- **Startup script:** ~2 minutes
- **Total:** ~3-4 minutes

---

## 🔍 Verify Deployment

```bash
# Get worker URL
WORKER_URL=$(terraform output -raw worker_url)

# Test health endpoint
curl $WORKER_URL/health

# Expected response:
# {"status":"ok","service":"vultr-risk-worker","timestamp":"..."}
```

---

## 📝 Next Steps

1. **Deploy the worker**
   ```bash
   terraform apply
   ```

2. **Update backend configuration**
   ```bash
   # Get values
   terraform output -raw worker_url
   terraform output -raw worker_api_key
   
   # Add to apps/api/.env
   VULTR_WORKER_URL=http://YOUR_IP:8080
   VULTR_API_KEY=your_generated_key
   ```

3. **Test integration**
   ```bash
   # From your backend
   curl -X POST $VULTR_WORKER_URL/score \
     -H "Authorization: Bearer $VULTR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"projectId":"test","logs":["ERROR: test"]}'
   ```

---

## 🎯 For Hackathon

**You don't need to use this right now!**

Your current manual deployment works fine for the hackathon.

**Use this after hackathon when you want:**
- Reproducible infrastructure
- Easy scaling (multiple workers)
- Infrastructure as Code
- Automated deployments

---

## 📚 Documentation

- **README.md** - Complete Terraform documentation
- **terraform.tfvars.example** - Configuration template
- **startup.sh** - Automated setup script

---

## 💡 Tips

1. **Keep terraform.tfvars secret** - It contains your API key
2. **Commit .tf files** - Version control your infrastructure
3. **Use terraform plan** - Preview changes before applying
4. **terraform destroy** - Remove everything when done

---

**Ready to deploy?** Follow the Quick Start above or read README.md for details!
