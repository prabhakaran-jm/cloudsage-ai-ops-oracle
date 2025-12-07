# Fix Worker Environment Variables

The worker needs to load `.env` file. Here's how to fix it:

## Option 1: Quick Fix (Recommended)

SSH into the worker server and run:

```bash
ssh root@192.248.166.170

# Navigate to worker directory
cd cloudsage-ai-ops-oracle/services/vultr-worker

# Install dotenv
npm install dotenv

# Rebuild
npm run build

# Restart with PM2 (this will load the .env file)
pm2 restart risk-worker --update-env
```

## Option 2: Use PM2 Ecosystem File

Create `ecosystem.config.js` in the worker directory:

```javascript
module.exports = {
  apps: [{
    name: 'risk-worker',
    script: './dist/main.js',
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
  }]
};
```

Then restart:
```bash
pm2 delete risk-worker
pm2 start ecosystem.config.js
pm2 save
```

## Option 3: Pass env vars directly to PM2

```bash
pm2 restart risk-worker --update-env --env production
pm2 set API_KEY=90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178
pm2 restart risk-worker
```

## Verify Fix

After fixing, test the worker:

```bash
curl -X POST http://192.248.166.170:8080/score \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178" \
  -d '{
    "projectId": "test",
    "logs": [{"content": "ERROR: test", "timestamp": "2024-12-07T20:00:00Z"}]
  }'
```

You should get a 200 response with a risk score, not 401 Unauthorized.

