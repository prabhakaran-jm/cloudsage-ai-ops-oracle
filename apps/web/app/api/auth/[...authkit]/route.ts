// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS

import { handleAuth } from '@workos-inc/authkit-nextjs';

// WorkOS AuthKit configuration
// All required env vars should be set in Netlify:
// - WORKOS_CLIENT_ID
// - WORKOS_API_KEY
// - WORKOS_COOKIE_PASSWORD (at least 32 chars)
// - WORKOS_REDIRECT_URI (optional, but recommended)
const config: any = {};

// Client ID - WorkOS AuthKit reads this from env automatically, but explicitly setting it can help
if (process.env.WORKOS_CLIENT_ID) {
  config.clientId = process.env.WORKOS_CLIENT_ID;
}

// Cookie password is required for session encryption (must be at least 32 characters)
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

// Export the WorkOS AuthKit handler
// This handles /api/auth/signin, /api/auth/callback, /api/auth/signout, etc.
export const GET = handleAuth(config);

