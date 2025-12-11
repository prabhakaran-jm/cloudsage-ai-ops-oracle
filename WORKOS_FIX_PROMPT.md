# WorkOS AuthKit "Couldn't sign in" Error - Fix Prompt

Copy and paste this entire prompt to Gemini CLI or Claude Code:

---

## Problem Statement

I'm getting a WorkOS AuthKit error when trying to sign in: `{"error":{"message":"Something went wrong","description":"Couldn't sign in. If you are not sure what happened, please contact your organization admin."}}`

## Current Setup

**WorkOS Dashboard Configuration (All Verified):**
- ✅ Application created with Client ID: `client_01KB6F849F...`
- ✅ Organization created: "CloudSage" (ID: `org_01KC77X9Q2D6FR454587SP6HRW`)
- ✅ Redirect URI configured: `https://steady-melomakarona-42c054.netlify.app/api/auth/callback`
- ✅ App homepage URL: `https://steady-melomakarona-42c054.netlify.app`
- ✅ Sign-in endpoint: `https://steady-melomakarona-42c054.netlify.app/api/auth/signin`
- ✅ Sign-out redirect: `https://steady-melomakarona-42c054.netlify.app/login`
- ✅ Sign up URL: `https://steady-melomakarona-42c054.netlify.app/register`
- ✅ Email Magic Link enabled in Authentication settings
- ✅ Just-in-time provisioning enabled (or should be enabled)

**Netlify Environment Variables (All Set):**
- `WORKOS_CLIENT_ID` = `client_01KB6F849F...`
- `WORKOS_API_KEY` = `sk_test_...`
- `WORKOS_REDIRECT_URI` = `https://steady-melomakarona-42c054.netlify.app/api/auth/callback`
- `WORKOS_COOKIE_PASSWORD` = (32+ character string)
- `NEXT_PUBLIC_WORKOS_ENABLED` = `true`

**Code Structure:**
- Next.js 14 App Router
- WorkOS AuthKit package: `@workos-inc/authkit-nextjs`
- Route handler: `apps/web/app/api/auth/[...authkit]/route.ts`
- Middleware: `apps/web/middleware.ts`
- Frontend URL: `https://steady-melomakarona-42c054.netlify.app`

## Current Code

**`apps/web/app/api/auth/[...authkit]/route.ts`:**
```typescript
import { handleAuth } from '@workos-inc/authkit-nextjs';

const config: any = {};

if (process.env.WORKOS_COOKIE_PASSWORD) {
  config.cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
}

if (process.env.WORKOS_REDIRECT_URI) {
  config.redirectUri = process.env.WORKOS_REDIRECT_URI;
}

export const GET = handleAuth(config);
```

**`apps/web/middleware.ts`:**
```typescript
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI;
const WORKOS_COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD;
const WORKOS_ENABLED = WORKOS_CLIENT_ID && WORKOS_API_KEY && WORKOS_COOKIE_PASSWORD;

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  if (WORKOS_ENABLED) {
    const workosConfig: any = {
      cookiePassword: WORKOS_COOKIE_PASSWORD,
    };
    
    if (WORKOS_REDIRECT_URI) {
      workosConfig.redirectUri = WORKOS_REDIRECT_URI;
    } else {
      const origin = request.nextUrl.origin;
      workosConfig.redirectUri = `${origin}/api/auth/callback`;
    }
    
    const workosMiddleware = authkitMiddleware(workosConfig);
    return workosMiddleware(request, event);
  }
  // ... fallback JWT logic
}
```

## Error Details

- **Error Message:** "Couldn't sign in. If you are not sure what happened, please contact your organization admin."
- **When it occurs:** After clicking "Continue with Enterprise SSO" → redirected to WorkOS → email entered → redirected back to app → error shown
- **Error URL:** `/auth/error?error=...&error_description=...`
- **Netlify Function Logs:** Check for any WorkOS-related errors in Netlify function logs

## What I Need

1. **Diagnose the root cause** of the "Couldn't sign in" error
2. **Check if the WorkOS AuthKit configuration is missing any required options** (like `organizationId`, `clientId`, etc.)
3. **Verify if Just-in-time provisioning needs additional configuration** in the code
4. **Check if the user needs to be pre-added to the organization** or if JIT should handle it
5. **Review the middleware and route handler** for any misconfigurations
6. **Provide a fix** that ensures users can sign in via WorkOS AuthKit

## Common Causes to Check

1. **Missing `clientId` in config** - WorkOS AuthKit might need `clientId` explicitly set
2. **Organization not linked** - The organization might not be properly linked to the application
3. **User not in organization** - Even with JIT, there might be a configuration issue
4. **Missing environment variables at runtime** - Netlify might not be passing env vars correctly
5. **Cookie password issues** - Session encryption might be failing
6. **Redirect URI mismatch** - Even though it's set, there might be a subtle mismatch
7. **WorkOS API key permissions** - The API key might not have the right permissions

## Expected Behavior

When a user clicks "Continue with Enterprise SSO":
1. Redirects to `/api/auth/signin`
2. WorkOS AuthKit redirects to WorkOS authorization page
3. User enters email (or selects organization if multiple)
4. WorkOS sends magic link email
5. User clicks link in email
6. WorkOS redirects back to `/api/auth/callback`
7. WorkOS AuthKit creates session
8. User is redirected to `/projects` (or intended destination)
9. User is authenticated and can access protected routes

## Additional Context

- This is for a hackathon submission (AI Champion Ship)
- Need "launch-ready" quality authentication
- The app is deployed on Netlify (frontend) and Raindrop (backend)
- Legacy JWT auth still works as fallback
- Organization name: "CloudSage"
- Organization ID: `org_01KC77X9Q2D6FR454587SP6HRW`

## Request

Please:
1. Review the WorkOS AuthKit documentation and our implementation
2. Identify what's missing or misconfigured
3. Provide a complete fix with code changes
4. Explain what was wrong and why the fix works
5. Add any necessary error handling or logging to help debug future issues

---

