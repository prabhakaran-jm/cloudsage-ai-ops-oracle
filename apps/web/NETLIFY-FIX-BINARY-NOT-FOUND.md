# Fix: "next: not found" Error on Netlify

## Error

```
sh: 1: next: not found
npm error Lifecycle script `build` failed with error:
npm error code 127
```

## Root Cause

In a monorepo with npm workspaces:
1. Dependencies are hoisted to the root `node_modules/`
2. The `next` binary is installed at `ROOT/node_modules/.bin/next`
3. When Netlify runs `npm run build` from `apps/web/`, it can't find `next`
4. The PATH doesn't include the root `node_modules/.bin` directory

## Solution Applied ✅

I've implemented **TWO fixes** (belt and suspenders approach):

### Fix 1: Update Build Script to Add Root to PATH

**File**: `apps/web/netlify-build.sh`

```bash
# Add root node_modules/.bin to PATH
export PATH="$REPO_ROOT/node_modules/.bin:$PATH"

# Now 'next' binary can be found
npm run build
```

**How it works**:
- Installs dependencies at root
- Adds root `node_modules/.bin` to PATH
- Runs build from `apps/web/` with access to root binaries

### Fix 2: Use npx in package.json

**File**: `apps/web/package.json`

```json
{
  "scripts": {
    "build": "npx next build"  // Changed from "next build"
  }
}
```

**How it works**:
- `npx` searches up the directory tree for the `next` binary
- Finds it in the root `node_modules/.bin/`
- Executes it correctly

## Alternative Solution (More Reliable)

If the above doesn't work, use workspace commands from root.

### Switch to Root-Based Build

Replace your current `netlify.toml` with this configuration:

```toml
[build]
  # Build from repository root (not apps/web)
  base = "/"

  # Use workspace command
  command = "npm install --legacy-peer-deps && npm run build --workspace=@cloudsage/web"

  # Publish directory (relative to root)
  publish = "apps/web/.next"

  [build.environment]
    NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

**Benefits**:
- ✅ Builds from root where binaries are installed
- ✅ No PATH manipulation needed
- ✅ More reliable for monorepos
- ✅ Simpler configuration

**To use this**:
```bash
# Backup current config
mv netlify.toml netlify-old.toml

# Use alternative config
mv netlify-alternative.toml netlify.toml

# Commit and push
git add .
git commit -m "Fix: Use root-based build for Netlify"
git push
```

## Testing Locally

### Test the Fixed Build Script

```bash
cd apps/web
bash netlify-build.sh
```

Expected output:
```
🔧 Building Next.js app in monorepo...
📁 Repository root: /path/to/repo
📦 Installing workspace dependencies...
✓ Dependencies installed
✓ PATH updated to include root node_modules/.bin
🔨 Building Next.js application...
✓ Build complete
✓ Standalone output created at .next/standalone
✓ Build script complete
```

### Verify PATH is Set Correctly

```bash
cd apps/web
bash -c 'export PATH="../../node_modules/.bin:$PATH" && which next'
```

Should output: `/path/to/repo/node_modules/.bin/next`

### Test npx Fallback

```bash
cd apps/web
npx next build
```

Should build successfully.

## Which Solution to Use?

### Use Current Fix (PATH-based) If:
- ✅ You want to keep base directory as `apps/web`
- ✅ You have other build customizations in the script
- ✅ You need fine-grained control over the build process

### Use Alternative (Root-based) If:
- ✅ The PATH fix doesn't work
- ✅ You want a simpler, more standard monorepo setup
- ✅ You prefer using npm workspace commands
- ✅ You want the most reliable solution

## Deployment Checklist

### 1. Verify Changes

```bash
# Check package.json has npx
cat apps/web/package.json | grep "build"
# Should show: "build": "npx next build"

# Check build script sets PATH
cat apps/web/netlify-build.sh | grep "export PATH"
# Should show: export PATH="$REPO_ROOT/node_modules/.bin:$PATH"
```

### 2. Test Locally

```bash
cd apps/web
bash netlify-build.sh
```

### 3. Commit and Push

```bash
git add .
git commit -m "Fix: Add root node_modules/.bin to PATH for Netlify build"
git push
```

### 4. Watch Netlify Build

Look for these in the build log:
```
✓ PATH updated to include root node_modules/.bin
🔨 Building Next.js application...
✓ Compiled successfully
✓ Build complete
```

Should **NOT** see:
```
❌ sh: 1: next: not found
```

## Troubleshooting

### If "next: not found" Still Occurs

**Try Alternative Solution**:
```bash
# Use root-based build
cp netlify-alternative.toml netlify.toml
git add netlify.toml
git commit -m "Switch to root-based workspace build"
git push
```

### If Build Fails with Different Error

**Check Dependencies**:
```bash
# Ensure next is in package.json
cat apps/web/package.json | grep "next"

# Should show:
# "next": "^14.2.0"
```

**Check Workspace Configuration**:
```bash
# Verify workspace is defined
cat package.json | grep -A 5 "workspaces"

# Should include "apps/web"
```

### If Build Succeeds But Deployment Fails

**Check Plugin**:
- Ensure `@netlify/plugin-nextjs` is installed
- Check Netlify dashboard → Site settings → Plugins

**Check Output**:
- Publish directory should be `.next` (relative to base)
- Or `apps/web/.next` (if base is `/`)

## Comparison: PATH-based vs Root-based

| Aspect | PATH-based (Current) | Root-based (Alternative) |
|--------|---------------------|--------------------------|
| **Base dir** | `apps/web` | `/` (root) |
| **Build command** | `bash netlify-build.sh` | `npm run build --workspace=...` |
| **Publish dir** | `.next` | `apps/web/.next` |
| **Complexity** | Medium (custom script) | Low (standard npm) |
| **Reliability** | Good (with PATH fix) | Excellent |
| **Monorepo best practice** | Good | Better |

## Summary of Changes

### Files Modified

1. ✅ **apps/web/package.json**
   - Changed: `"build": "npx next build"`
   - Why: npx searches up for binaries

2. ✅ **apps/web/netlify-build.sh**
   - Added: `export PATH="$REPO_ROOT/node_modules/.bin:$PATH"`
   - Why: Makes root binaries accessible

3. ✅ **netlify-alternative.toml** (created)
   - Alternative configuration using root-based build
   - Use if PATH-based fix doesn't work

### Testing Status

- ✅ Build script updated
- ✅ package.json updated
- ✅ Alternative config created
- ⏸️ Ready to test on Netlify

### Next Steps

1. **Option A**: Push current changes and test
   ```bash
   git push
   ```

2. **Option B**: Switch to root-based build first
   ```bash
   cp netlify-alternative.toml netlify.toml
   git add .
   git push
   ```

**Recommendation**: Try Option A first (PATH-based). If it fails, use Option B (root-based).

---

## Quick Commands

```bash
# Test build locally
cd apps/web && bash netlify-build.sh

# Push current fix
git add . && git commit -m "Fix: next binary PATH issue" && git push

# Or switch to alternative
cp netlify-alternative.toml netlify.toml
git add . && git commit -m "Use root-based build" && git push

# Check Netlify logs
netlify open
```

---

**Status**: ✅ Both fixes applied. Ready to deploy!
