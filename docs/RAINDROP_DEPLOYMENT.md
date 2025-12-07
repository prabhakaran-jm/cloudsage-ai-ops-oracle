# Raindrop Backend Deployment Guide

## Status

✅ **Environment Variables**: Configured via CLI
✅ **Manifest**: Validated and ready
✅ **Build**: Successful
⚠️ **CLI Deployment**: Windows PATH issue with `npx`

## Environment Variables Set

All environment variables have been configured via Raindrop CLI:

- `RAINDROP_MCP_URL`: https://mcp.raindrop.run/
- `RAINDROP_API_KEY`: Configured (secret)
- `VULTR_WORKER_URL`: http://192.248.166.170:8080
- `VULTR_API_KEY`: Configured (secret)
- `PORT`: 3001
- `NODE_ENV`: production

## Deployment Options

### Option 1: Raindrop Dashboard (Recommended)

Due to Windows PATH issues with the CLI, use the Raindrop Dashboard:

1. **Go to Raindrop Dashboard**
   - Visit: https://raindrop.liquidmetal.ai
   - Login with your account

2. **Create New Application**
   - Application Name: `cloudsage_api`
   - Connect your Git repository: `prabhakaran-jm/cloudsage-ai-ops-oracle`
   - Root Directory: `apps/api`

3. **Configure Build Settings**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Node Version: `20.x`

4. **Environment Variables**
   - Environment variables are already set via CLI
   - Verify in dashboard: Settings → Environment Variables

5. **Deploy**
   - Click "Deploy" or enable auto-deploy on push

### Option 2: CLI Deployment (Linux/WSL/Git Bash)

If you have access to Linux/WSL/Git Bash:

```bash
cd apps/api
npm run build
raindrop build deploy --start
```

### Option 3: Manual Build + Deploy

Try building manually first:

```powershell
cd apps/api
npm run build
raindrop build deploy --no-watch
```

## Verify Deployment

After deployment, verify:

1. **Check Status**
   ```bash
   raindrop build status
   ```

2. **Get URL**
   ```bash
   raindrop build find
   ```

3. **Test Endpoint**
   ```bash
   curl https://cloudsage-api.<tenant>.lmapp.run/api/hello
   ```

## Troubleshooting

### Windows PATH Issue

If you see `Error: spawn npx ENOENT`:
- Use Raindrop Dashboard instead
- Or use Git Bash/WSL for CLI commands

### Build Failures

- Ensure `npm run build` succeeds locally
- Check TypeScript errors: `npm run build`
- Verify all dependencies are in `package.json`

### Environment Variables

- View set variables: `raindrop build env list`
- Update variables: `raindrop build env set KEY "value"`
- Variables are automatically available in deployed app

## Next Steps

After successful deployment:

1. Update frontend `.env` with new backend URL
2. Test full integration
3. Monitor logs: `raindrop logs` or via dashboard
4. Set up custom domain (optional)

