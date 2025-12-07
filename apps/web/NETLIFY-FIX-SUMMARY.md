# ✅ Netlify Deployment Fix - Quick Reference

## Problem
```
Cannot find module 'next/dist/server/lib/start-server.js'
```

## Root Cause
npm workspaces hoist dependencies to root, Netlify plugin looks in apps/web/node_modules

## Solution
Use **Next.js standalone output mode** - bundles all dependencies

---

## Files Changed

### ✅ apps/web/next.config.js
```javascript
const nextConfig = {
  output: 'standalone',  // ← Added
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
}
```

### ✅ netlify.toml (root)
```toml
[build]
  base = "apps/web"
  command = "bash netlify-build.sh"  # ← Changed
  publish = ".next"
```

### ✅ apps/web/netlify-build.sh (NEW)
```bash
#!/bin/bash
cd ../..
npm install --legacy-peer-deps
cd apps/web
npm run build
```

---

## Quick Deploy Checklist

### 1. Test Locally
```bash
cd apps/web
npm run build
./test-standalone.sh
node .next/standalone/apps/web/server.js
```

### 2. Push to GitHub
```bash
git add .
git commit -m "Fix: Add standalone output for Netlify deployment"
git push
```

### 3. Netlify Settings
- **Base directory**: `apps/web`
- **Build command**: `bash netlify-build.sh`
- **Publish directory**: `.next`
- **Plugin**: `@netlify/plugin-nextjs` (auto-detected)

### 4. Environment Variables
```
NEXT_PUBLIC_API_URL=https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run/api
```

### 5. Deploy
Click "Deploy site" in Netlify

---

## Verification

Build logs should show:
```
✓ Standalone output created at .next/standalone
✓ Creating Serverless functions
```

Test deployed site:
```bash
curl https://your-site.netlify.app/
curl https://your-site.netlify.app/api/health
curl https://your-site.netlify.app/projects/test-id
```

---

## What Standalone Mode Does

| Before (Regular Build) | After (Standalone) |
|------------------------|-------------------|
| Requires external node_modules | Bundles all dependencies |
| Plugin can't find Next.js | Self-contained package |
| Runtime error | Works ✅ |

---

## Alternative: Static Export (If All Client-Side)

If you don't need SSR/API routes:

```javascript
// next.config.js
const nextConfig = {
  output: 'export',  // Instead of 'standalone'
}
```

```toml
# netlify.toml
[build]
  publish = "out"  # Instead of ".next"
# Remove plugin - not needed for static
```

**Pros**: Simpler, no serverless
**Cons**: No SSR, no API routes, no dynamic optimization

---

## Key Files

| File | Purpose |
|------|---------|
| `next.config.js` | Enable standalone output |
| `netlify.toml` | Configure Netlify build |
| `netlify-build.sh` | Handle monorepo dependencies |
| `test-standalone.sh` | Test locally before deploy |
| `NETLIFY-DEPLOYMENT.md` | Full documentation |

---

## Common Commands

```bash
# Test build locally
cd apps/web
npm run build
./test-standalone.sh

# Run standalone server
node .next/standalone/apps/web/server.js

# Deploy (after pushing to GitHub)
# Netlify auto-deploys on push

# Manual deploy
netlify deploy --prod
```

---

## Troubleshooting

### Build fails with module errors
- Check `npm install --legacy-peer-deps` runs in script
- Verify workspace is configured correctly

### Site shows 404
- Ensure plugin is enabled
- Check publish directory is `.next`
- Verify base directory is `apps/web`

### API routes don't work
- Standalone output required (not export)
- Check plugin is creating functions
- Verify pages/api/* exists

### Slow builds
- Netlify caches dependencies between builds
- First build is slower, subsequent builds faster

---

## Status

- ✅ next.config.js updated with standalone output
- ✅ netlify.toml configured for monorepo
- ✅ Build script created
- ✅ Test script created
- ⏸️ Ready to deploy

---

**Next Step**: Test locally, then push to GitHub and deploy on Netlify!
