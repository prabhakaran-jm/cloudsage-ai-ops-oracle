// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS

import { handleAuth } from '@workos-inc/authkit-nextjs';

// WorkOS AuthKit typically auto-detects redirect URI from route
// But we can explicitly set it if provided in env
const config: any = {};

// Set redirect URI if provided (must match WorkOS dashboard configuration)
// This ensures it's available even if env vars aren't loaded correctly
if (process.env.WORKOS_REDIRECT_URI) {
  config.redirectUri = process.env.WORKOS_REDIRECT_URI;
}

export const GET = handleAuth(config);

