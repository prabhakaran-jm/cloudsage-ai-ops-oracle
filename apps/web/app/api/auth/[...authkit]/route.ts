// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS
// Based on: https://workos.com/docs/authkit/vanilla/nodejs

import { handleAuth } from '@workos-inc/authkit-nextjs';

// WorkOS AuthKit configuration
// All required env vars should be set in Netlify:
// - WORKOS_CLIENT_ID
// - WORKOS_API_KEY
// - WORKOS_COOKIE_PASSWORD (at least 32 chars) - used for sealed sessions
// - WORKOS_REDIRECT_URI (optional, but recommended)

// According to WorkOS docs, cookiePassword must be 32 characters long
// Generate with: openssl rand -base64 24
const config: any = {
  debug: process.env.NODE_ENV === 'development',
};

// Set required configuration
// WorkOS reads from env vars automatically, but we set explicitly for clarity
if (process.env.WORKOS_CLIENT_ID) {
  config.clientId = process.env.WORKOS_CLIENT_ID;
}

if (process.env.WORKOS_API_KEY) {
  config.apiKey = process.env.WORKOS_API_KEY;
}

// cookiePassword is required for sealed sessions (encrypted cookies)
// Must be at least 32 characters as per WorkOS documentation
if (process.env.WORKOS_COOKIE_PASSWORD) {
  config.cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
  
  // Validate length (WorkOS requirement)
  if (config.cookiePassword.length < 32) {
    console.error('[WorkOS] WORKOS_COOKIE_PASSWORD must be at least 32 characters');
  }
} else {
  console.error('[WorkOS] WORKOS_COOKIE_PASSWORD is not set');
}

// Set redirect URI if provided (must match WorkOS dashboard configuration exactly)
// This is the callback endpoint that WorkOS redirects to after authentication
if (process.env.WORKOS_REDIRECT_URI) {
  config.redirectUri = process.env.WORKOS_REDIRECT_URI;
}

// Add error handling callback
// This logs errors to help with debugging
config.onError = (error: any) => {
  console.error('[WorkOS AuthKit Error]:', {
    message: error?.message,
    error: error,
    stack: error?.stack,
  });
};

// Export the WorkOS AuthKit handler
// handleAuth automatically handles:
// - /api/auth/signin: Redirects to WorkOS hosted sign-in page
// - /api/auth/callback: Exchanges authorization code for user session
// - /api/auth/signout: Ends the user session
// - /api/auth/user: Returns the current authenticated user
//
// The handler uses sealed sessions (encrypted with cookiePassword) for security
// Sessions are automatically managed via cookies
const handler = handleAuth(config);

export const GET = handler;
export const POST = handler;

