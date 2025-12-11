// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS

import { handleAuth } from '@workos-inc/authkit-nextjs';

// WorkOS AuthKit configuration
// All required env vars should be set in Netlify:
// - WORKOS_CLIENT_ID
// - WORKOS_API_KEY
// - WORKOS_COOKIE_PASSWORD (at least 32 chars)
// - WORKOS_REDIRECT_URI (optional, but recommended)
const config: any = {
  debug: process.env.NODE_ENV === 'development',
};

if (process.env.WORKOS_CLIENT_ID) {
  config.clientId = process.env.WORKOS_CLIENT_ID;
}

if (process.env.WORKOS_API_KEY) {
  config.apiKey = process.env.WORKOS_API_KEY;
}

if (process.env.WORKOS_COOKIE_PASSWORD) {
  config.cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
} else {
  // If cookie password is missing, WorkOS will throw an error
  // This will be caught and shown in the error page
  console.warn('[WorkOS] WORKOS_COOKIE_PASSWORD not set');
}

// Set redirect URI if provided (must match WorkOS dashboard configuration exactly)
if (process.env.WORKOS_REDIRECT_URI) {
  config.redirectUri = process.env.WORKOS_REDIRECT_URI;
}

// Add error handling
config.onError = (error: any) => {
  console.error('[WorkOS AuthKit Error]:', error);
  // You could also report this to an error tracking service like Sentry here
};

// Export the WorkOS AuthKit handler
// This handles /api/auth/signin, /api/auth/callback, /api/auth/signout, etc.
export const GET = handleAuth(config);

