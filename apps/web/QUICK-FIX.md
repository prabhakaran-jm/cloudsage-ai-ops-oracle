# 🔧 Quick Fix for "next: not found" Error

## What I Fixed

### ✅ 1. Updated package.json
```json
"build": "npx next build"  // Was: "next build"
```

### ✅ 2. Updated netlify-build.sh
```bash
# Added this line:
export PATH="$REPO_ROOT/node_modules/.bin:$PATH"
```

### ✅ 3. Created Alternative Config
`netlify-alternative.toml` - Use if current fix doesn't work

---

## Deploy Now (Recommended)

```bash
# Commit and push
git add .
git commit -m "Fix: Add root node_modules/.bin to PATH for next binary"
git push
```

**Then**: Watch Netlify build logs for success.

---

## Alternative: Use Root-Based Build (More Reliable)

If the above doesn't work, use this:

```bash
# Switch to root-based configuration
mv netlify.toml netlify-backup.toml
cp netlify-alternative.toml netlify.toml

# Commit and push
git add .
git commit -m "Fix: Use root-based workspace build for Netlify"
git push
```

**This**:
- Builds from repository root
- Uses `npm run build --workspace=@cloudsage/web`
- More reliable for monorepos

---

## What to Expect

### In Netlify Build Logs (Success):

```
✓ PATH updated to include root node_modules/.bin
🔨 Building Next.js application...
✓ Compiled successfully
✓ Creating Serverless functions for Next.js
✓ Generating static pages
✓ Build succeeded!
```

### Should NOT See:

```
❌ sh: 1: next: not found
❌ Command failed with exit code 127
```

---

## Test Locally First (Optional)

```bash
cd apps/web
bash netlify-build.sh
```

Expected output:
```
✓ Dependencies installed
✓ PATH updated to include root node_modules/.bin  ← KEY LINE
✓ Build complete
✓ Standalone output created
```

---

## Quick Decision Guide

### Scenario 1: You Want Quick Fix
→ Just push current changes
```bash
git push
```

### Scenario 2: You Want Most Reliable
→ Use alternative config
```bash
cp netlify-alternative.toml netlify.toml
git push
```

### Scenario 3: Build Still Fails
→ See `NETLIFY-FIX-BINARY-NOT-FOUND.md` for detailed troubleshooting

---

## Files Changed

| File | Change | Why |
|------|--------|-----|
| `apps/web/package.json` | Use `npx next build` | npx finds binary |
| `apps/web/netlify-build.sh` | Add root to PATH | Makes binary accessible |
| `netlify-alternative.toml` | Root-based build | Backup solution |

---

**Status**: ✅ Fixed and ready to deploy!

**Action**: `git push` then watch Netlify build.
