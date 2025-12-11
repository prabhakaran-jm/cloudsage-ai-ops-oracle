// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS

import { handleAuth } from '@workos-inc/authkit-nextjs';

// WorkOS AuthKit configuration
// Requires cookiePassword (at least 32 chars) and optionally redirectUri
const config: any = {};

// Cookie password is required for session encryption (must be at least 32 characters)
if (process.env.WORKOS_COOKIE_PASSWORD) {
  config.cookiePassword = process.env.WORKOS_COOKIE_PASSWORD;
}

// Set redirect URI if provided (must match WorkOS dashboard configuration)
if (process.env.WORKOS_REDIRECT_URI) {
  config.redirectUri = process.env.WORKOS_REDIRECT_URI;
}

export const GET = handleAuth(config);

