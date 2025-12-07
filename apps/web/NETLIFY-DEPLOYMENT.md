# Netlify Deployment Guide - Next.js in Monorepo

## Problem

When deploying a Next.js app from a monorepo to Netlify, the `@netlify/plugin-nextjs` plugin fails with:
```
Cannot find module 'next/dist/server/lib/start-server.js'
```

**Root Cause**: npm workspaces hoist dependencies to the root `node_modules`, but Netlify's plugin expects them in `apps/web/node_modules`.

## Solution ✅

We use **Next.js standalone output mode** which creates a self-contained build with all dependencies bundled.

### What Changed

1. **next.config.js** - Added `output: 'standalone'`
2. **netlify.toml** - Updated build command to use custom script
3. **netlify-build.sh** - Created custom build script for monorepo
4. **Workflow** - Dependencies installed from root, standalone output deployed

## Configuration Files

### 1. next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Standalone output mode - creates self-contained deployment
  output: 'standalone',

  // Resolve modules from workspace root
  experimental: {
    outputFileTracingRoot: require('path').join(__dirname, '../../'),
  },
}

module.exports = nextConfig
```

**What this does**:
- `output: 'standalone'` - Bundles all dependencies into `.next/standalone`
- `outputFileTracingRoot` - Traces dependencies from monorepo root
- Creates a minimal, self-contained deployment package

### 2. netlify.toml (root)

```toml
[build]
  base = "apps/web"
  command = "bash netlify-build.sh"
  publish = ".next"

  [build.environment]
    NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

### 3. netlify-build.sh (apps/web/)

```bash
#!/bin/bash
set -e

# Install workspace dependencies from root
cd ../..
npm install --legacy-peer-deps

# Build Next.js with standalone output
cd apps/web
npm run build
```

## How It Works

### Build Process

1. **Netlify starts build** in `apps/web/` (base directory)
2. **Custom script runs**:
   - Navigates to monorepo root
   - Installs all workspace dependencies
   - Returns to `apps/web/`
   - Builds Next.js with `npm run build`
3. **Next.js creates standalone output**:
   - `.next/standalone/` - Bundled server + dependencies
   - `.next/static/` - Static assets
   - `.next/server/` - Server chunks
4. **Netlify plugin deploys**:
   - Detects standalone output
   - Creates serverless functions
   - Sets up routing
   - Deploys to CDN

### Runtime

- **Serverless Functions**: Created from `.next/standalone` for SSR/API routes
- **Static Assets**: Served from CDN (`.next/static`)
- **Client-side Routing**: Works automatically with the plugin
- **Dynamic Routes**: `/projects/[id]` - Handled by serverless functions

## Deployment Steps

### First-Time Setup

1. **Push code to GitHub**:
   ```bash
   git add .
   git commit -m "Fix: Configure Next.js standalone output for Netlify"
   git push
   ```

2. **In Netlify Dashboard**:
   - Import your repository
   - **Build command**: `bash netlify-build.sh`
   - **Publish directory**: `apps/web/.next`
   - **Base directory**: `apps/web`
   - **Add plugin**: `@netlify/plugin-nextjs` (if not auto-detected)

3. **Set Environment Variables** in Netlify:
   ```
   NEXT_PUBLIC_API_URL=https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run/api
   ```

4. **Deploy**:
   - Click "Deploy site"
   - Wait for build to complete
   - Test the deployment

### Subsequent Deployments

Simply push to GitHub:
```bash
git push
```

Netlify will automatically build and deploy.

## Verifying the Fix

### During Build

Look for these in build logs:

```
✓ Standalone output created at .next/standalone
✓ Creating Serverless functions for Next.js
✓ Optimizing static pages
```

### After Deployment

Test these endpoints:

```bash
# Static pages
curl https://your-site.netlify.app/

# Health/test endpoint
curl https://your-site.netlify.app/api/health

# Dynamic route
curl https://your-site.netlify.app/projects/test-id
```

All should work without the "Cannot find module" error.

## Alternative Solutions (If Needed)

### Option 1: Static Export (Current Client-Side Only Apps)

If all your pages use `'use client'` and don't need SSR:

```javascript
// next.config.js
const nextConfig = {
  output: 'export', // Static HTML export
  images: {
    unoptimized: true, // Required for static export
  },
}
```

```toml
# netlify.toml
[build]
  command = "bash netlify-build.sh"
  publish = "out"  # Static export goes to 'out' directory

# No plugin needed for static export
```

**Pros**: Simpler, no serverless functions, faster
**Cons**: No SSR, no API routes, no dynamic optimization

### Option 2: Install Dependencies Locally (Doesn't Work with npm workspaces)

This approach doesn't work because npm workspaces always hoist:

```bash
# This doesn't prevent hoisting ❌
cd apps/web
npm install --legacy-peer-deps
```

### Option 3: Use pnpm Instead of npm

pnpm has better monorepo support and doesn't hoist by default:

```yaml
# package.json (root)
"packageManager": "pnpm@8.15.0"
```

But this requires changing the entire monorepo setup.

## Common Issues

### Issue: "Cannot find module 'next/dist/server/...'"

**Solution**: Ensure `output: 'standalone'` is in next.config.js

### Issue: Build succeeds but site shows 404

**Solution**:
- Check `publish` directory is `.next` (not `out`)
- Ensure `@netlify/plugin-nextjs` plugin is enabled
- Verify base directory is `apps/web`

### Issue: API routes don't work

**Solution**:
- Standalone output is required for API routes
- Ensure pages/api/* files exist
- Check plugin is creating serverless functions

### Issue: Client-side routing doesn't work

**Solution**:
- Plugin should handle redirects automatically
- If not, add to netlify.toml:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```

### Issue: "Module not found: Can't resolve '...'"

**Solution**:
- Check `outputFileTracingRoot` in next.config.js
- Ensure workspace dependencies are installed
- Run `npm install` in root before building

## Testing Locally

Test standalone output locally:

```bash
# Build
cd apps/web
npm run build

# Run standalone server
node .next/standalone/apps/web/server.js

# Test
curl http://localhost:3000
```

## Rollback Plan

If deployment fails, quickly revert:

```bash
git revert HEAD
git push
```

Or deploy previous working commit in Netlify dashboard.

## Resources

- [Next.js Standalone Output](https://nextjs.org/docs/advanced-features/output-file-tracing)
- [Netlify Next.js Plugin](https://github.com/netlify/netlify-plugin-nextjs)
- [Netlify Monorepo Guide](https://docs.netlify.com/configure-builds/monorepos/)

## Summary

**Before**: Dependencies hoisted → Plugin can't find Next.js → Runtime error
**After**: Standalone output → Self-contained build → Deployment works ✅

The key insight is that `output: 'standalone'` creates a complete, bundled deployment that includes all necessary dependencies, avoiding the monorepo hoisting issue entirely.
