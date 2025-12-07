# Netlify Deployment Checklist ✅

Use this checklist to deploy your Next.js app from the monorepo to Netlify.

---

## Pre-Deployment (Local Testing)

### ☐ 1. Verify Configuration Files

Check these files have the correct configuration:

- [ ] **apps/web/next.config.js** has `output: 'standalone'`
- [ ] **netlify.toml** (root) has `command = "bash netlify-build.sh"`
- [ ] **apps/web/netlify-build.sh** exists and is executable

### ☐ 2. Test Build Locally

```bash
cd apps/web
npm run build
```

Expected: Build succeeds, `.next/standalone/` directory created

### ☐ 3. Test Standalone Output

```bash
./test-standalone.sh
```

Expected: All checks pass ✅

### ☐ 4. Test Server Locally

```bash
node .next/standalone/apps/web/server.js
```

Then visit: http://localhost:3000

Expected: App loads correctly

### ☐ 5. Test All Routes

- [ ] Homepage loads: `http://localhost:3000/`
- [ ] Projects page: `http://localhost:3000/projects`
- [ ] Dynamic route: `http://localhost:3000/projects/test-id`
- [ ] API route (if any): `http://localhost:3000/api/health`

---

## Deployment to Netlify

### ☐ 6. Commit and Push Changes

```bash
git add .
git commit -m "Fix: Configure Next.js standalone output for Netlify deployment"
git push origin main
```

### ☐ 7. Create/Configure Netlify Site

**Option A: New Site**

1. Go to [Netlify Dashboard](https://app.netlify.com/)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select your repository
4. Continue to step 8

**Option B: Existing Site**

1. Go to your site in Netlify Dashboard
2. Go to "Site settings" → "Build & deploy"
3. Update build settings (step 8)

### ☐ 8. Configure Build Settings

Set these in Netlify:

**Build settings:**
```
Base directory: apps/web
Build command: bash netlify-build.sh
Publish directory: .next
```

**Environment variables:**
```
NEXT_PUBLIC_API_URL = https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run/api
```

Add any other environment variables your app needs.

### ☐ 9. Verify Plugin

Go to "Plugins" section, ensure:
- [ ] `@netlify/plugin-nextjs` is installed
- [ ] If not, click "Install plugin" and search for it

### ☐ 10. Deploy

Click "Deploy site" (or push triggers auto-deploy)

---

## Post-Deployment Verification

### ☐ 11. Check Build Logs

Look for these success indicators:

```
✓ Standalone output created at .next/standalone
✓ Creating Serverless functions for Next.js
✓ Optimizing static pages
✓ Build succeeded!
```

If build fails:
- [ ] Check error message
- [ ] Verify `netlify-build.sh` has correct permissions
- [ ] Check Node version is set to 20
- [ ] Review troubleshooting section in NETLIFY-DEPLOYMENT.md

### ☐ 12. Test Deployed Site

Get your Netlify URL (e.g., `your-app.netlify.app`) and test:

```bash
# Homepage
curl https://your-app.netlify.app/

# Projects page
curl https://your-app.netlify.app/projects

# Dynamic route
curl https://your-app.netlify.app/projects/test-id

# API route (if you have one)
curl https://your-app.netlify.app/api/health
```

Or open in browser:
- [ ] Homepage works
- [ ] Navigation works
- [ ] Dynamic routes work
- [ ] Client-side routing works (no page refresh)
- [ ] API endpoints work (if applicable)

### ☐ 13. Check for Errors

In Netlify Dashboard:
- [ ] Go to "Functions" tab - should show Next.js functions
- [ ] Go to "Functions" → click a function → check logs
- [ ] No "module not found" errors

### ☐ 14. Test Production Features

- [ ] Images load correctly
- [ ] CSS/styles apply
- [ ] JavaScript bundles load
- [ ] Links work without 404s
- [ ] Forms submit (if applicable)
- [ ] API calls to backend work

---

## Troubleshooting Checklist

### ☐ If Build Fails

- [ ] Check build command is exactly: `bash netlify-build.sh`
- [ ] Verify `netlify-build.sh` exists in `apps/web/`
- [ ] Check script has execute permissions
- [ ] Review build logs for specific error
- [ ] Try manual build locally first

### ☐ If Site Shows 404

- [ ] Publish directory is `.next` (not `out` or `.next/standalone`)
- [ ] Base directory is `apps/web`
- [ ] Plugin `@netlify/plugin-nextjs` is enabled
- [ ] Check "Functions" tab shows Next.js functions

### ☐ If "Cannot find module" Error

- [ ] `output: 'standalone'` is in next.config.js
- [ ] Build script installs from root: `cd ../.. && npm install`
- [ ] `outputFileTracingRoot` points to repo root

### ☐ If Static Assets Don't Load

- [ ] `public/` directory exists in `apps/web/`
- [ ] Check browser console for 404s
- [ ] Verify `assetPrefix` in next.config.js

### ☐ If API Routes Don't Work

- [ ] Using `output: 'standalone'` (not `'export'`)
- [ ] `pages/api/` directory exists
- [ ] Check "Functions" tab in Netlify
- [ ] Review function logs for errors

---

## Optional: Custom Domain

### ☐ 15. Add Custom Domain (Optional)

1. In Netlify Dashboard → "Domain management"
2. Click "Add domain alias"
3. Enter your domain: `app.cloudsage.com`
4. Follow DNS configuration instructions
5. Wait for DNS propagation (up to 48 hours)
6. Enable HTTPS (automatic via Let's Encrypt)

---

## Final Checklist

### Deployment Complete When:

- [x] Build succeeds without errors
- [x] Site loads at Netlify URL
- [x] All routes work (static, dynamic, API)
- [x] No "module not found" errors
- [x] Client-side routing works
- [x] Static assets load correctly
- [x] Forms/API calls work (if applicable)

---

## Rollback Plan

If deployment breaks:

### Quick Rollback:
1. Go to Netlify Dashboard → "Deploys"
2. Find last working deploy
3. Click "..." → "Publish deploy"

### Git Rollback:
```bash
git revert HEAD
git push
```

---

## Success! 🎉

Your Next.js app from the monorepo is now deployed on Netlify!

**Next Steps:**
- [ ] Share the Netlify URL with your team
- [ ] Set up custom domain (optional)
- [ ] Configure analytics (optional)
- [ ] Set up monitoring (optional)

**Useful Links:**
- Netlify Dashboard: https://app.netlify.com/
- Build logs: Site → Deploys → Click latest deploy
- Function logs: Site → Functions → Click a function
- Domain settings: Site → Domain management

---

## Documentation Reference

- **Full Guide**: `NETLIFY-DEPLOYMENT.md`
- **Quick Reference**: `NETLIFY-FIX-SUMMARY.md`
- **Overview**: `../NETLIFY-DEPLOY-FIX.md` (root)

---

**Date**: ____________________
**Deployed by**: ____________________
**Netlify URL**: ____________________
**Status**: ☐ Success  ☐ Issues (see troubleshooting)
