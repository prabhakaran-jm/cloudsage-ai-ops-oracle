# Deploy to Raindrop

## Quick Deploy (Git Bash)

**⚠️ Important:** Use Git Bash, not PowerShell, due to Windows PATH issues.

```bash
# Navigate to API directory
cd /c/Users/User/Projects/cloudsage-ai-ops-oracle/apps/api

# Build
npm run build

# Deploy
raindrop build deploy --start

# Get your API URL
raindrop build find
```

## Or Use Deployment Script

```bash
bash scripts/deploy-raindrop.sh
```

## Verify Deployment

```bash
# Check status
raindrop build status

# View logs
raindrop logs tail

# Get URL
raindrop build find
```

## Troubleshooting

### Windows PATH Issue

If you see `Error: spawn npx ENOENT`:
- **Solution:** Use Git Bash instead of PowerShell
- Git Bash handles PATH correctly and will find `npx`

### Build Already Successful

If build succeeds but deployment fails:
- The build is already done (`dist/` folder exists)
- Try: `raindrop build deploy --no-watch`

## Environment Variables

All environment variables are already set via CLI:
- `RAINDROP_MCP_URL`
- `RAINDROP_API_KEY`
- `VULTR_WORKER_URL`
- `VULTR_API_KEY`
- `PORT`
- `NODE_ENV`

View them: `raindrop build env list`

