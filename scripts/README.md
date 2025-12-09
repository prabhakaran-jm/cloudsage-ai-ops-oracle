# Scripts Directory

**Note:** Deployment scripts have been moved to `infra/deploy/`

This directory now contains utility scripts only.

---

## 📁 Deployment Scripts (Moved)

All deployment scripts are now in **`infra/deploy/`**:

- `infra/deploy/deploy-raindrop.sh` - Deploy backend to Raindrop
- `infra/deploy/deploy-vultr-worker.sh` - Deploy worker to Vultr
- `infra/deploy/update-vultr-worker.sh` - Update worker code
- `infra/deploy/create-worker-env.sh` - Create worker .env file
- `infra/deploy/verify-worker-key.sh` - Verify worker API key

---

## 🔧 Utility Scripts (Here)

- `test-worker-integration.js` - Test worker integration

---

## 🚀 Quick Commands

### Deploy Backend
```bash
./infra/deploy/deploy-raindrop.sh
```

### Deploy Vultr Worker
```bash
# SSH into Vultr instance first
ssh root@YOUR_VULTR_IP

# Then run
curl -o deploy.sh https://raw.githubusercontent.com/YOUR_USERNAME/cloudsage-ai-ops-oracle/main/infra/deploy/deploy-vultr-worker.sh
chmod +x deploy.sh
./deploy.sh
```

### Update Worker
```bash
# SSH into Vultr instance
ssh root@YOUR_VULTR_IP

# Run update script
./infra/deploy/update-vultr-worker.sh
```

---

See `infra/deploy/README.md` for complete deployment documentation.
