// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS
// Based on: https://workos.com/docs/authkit/vanilla/nodejs

import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

// WorkOS AuthKit configuration
// All required env vars should be set in Netlify:
// - WORKOS_CLIENT_ID
// - WORKOS_API_KEY
// - WORKOS_COOKIE_PASSWORD (at least 32 chars) - used for sealed sessions
// - WORKOS_REDIRECT_URI (optional, but recommended)

function getWorkOSConfig() {
  const config: any = {
    debug: process.env.NODE_ENV === 'development',
  };

  // Validate and set required configuration
  const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
  const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
  const WORKOS_COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD;
  const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI;

  if (!WORKOS_CLIENT_ID) {
    throw new Error('WORKOS_CLIENT_ID is not set in environment variables');
  }
  if (!WORKOS_API_KEY) {
    throw new Error('WORKOS_API_KEY is not set in environment variables');
  }
  if (!WORKOS_COOKIE_PASSWORD) {
    throw new Error('WORKOS_COOKIE_PASSWORD is not set in environment variables (must be at least 32 characters)');
  }
  if (WORKOS_COOKIE_PASSWORD.length < 32) {
    throw new Error(`WORKOS_COOKIE_PASSWORD must be at least 32 characters (got ${WORKOS_COOKIE_PASSWORD.length})`);
  }

  config.clientId = WORKOS_CLIENT_ID;
  config.apiKey = WORKOS_API_KEY;
  config.cookiePassword = WORKOS_COOKIE_PASSWORD;

  // Set redirect URI if provided (must match WorkOS dashboard configuration exactly)
  if (WORKOS_REDIRECT_URI) {
    config.redirectUri = WORKOS_REDIRECT_URI;
  }

  // Add error handling callback
  config.onError = (error: any) => {
    console.error('[WorkOS AuthKit Error]:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
  };

  return config;
}

// Create handler with error handling
let workOSHandler: ((req: NextRequest) => Promise<Response>) | null = null;
let configError: string | null = null;

try {
  const config = getWorkOSConfig();
  workOSHandler = handleAuth(config);
} catch (error: any) {
  console.error('[WorkOS Config Error]:', error.message);
  configError = error.message;
}

// Export the WorkOS AuthKit handler
// handleAuth automatically handles:
// - /api/auth/signin: Redirects to WorkOS hosted sign-in page
// - /api/auth/callback: Exchanges authorization code for user session
// - /api/auth/signout: Ends the user session
// - /api/auth/user: Returns the current authenticated user
//
// The handler uses sealed sessions (encrypted with cookiePassword) for security
// Sessions are automatically managed via cookies

// Export handlers - if config failed, return error; otherwise use WorkOS handler directly
// Using the handler directly avoids any wrapper issues that might cause the headers error
export async function GET(req: NextRequest) {
  if (!workOSHandler) {
    console.error('[WorkOS] Handler not initialized:', configError);
    return NextResponse.json(
      {
        error: 'WorkOS configuration error',
        message: configError || 'WorkOS is not properly configured',
        details: 'Check Netlify environment variables: WORKOS_CLIENT_ID, WORKOS_API_KEY, WORKOS_COOKIE_PASSWORD',
        help: 'Visit /auth/debug for diagnostics',
      },
      { status: 500 }
    );
  }
  
  // Call WorkOS handler directly - no wrapper to avoid potential issues
  try {
    return await workOSHandler(req) as NextResponse;
  } catch (error: any) {
    console.error('[WorkOS Handler Error]:', error);
    return NextResponse.json(
      {
        error: 'WorkOS authentication error',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!workOSHandler) {
    console.error('[WorkOS] Handler not initialized:', configError);
    return NextResponse.json(
      {
        error: 'WorkOS configuration error',
        message: configError || 'WorkOS is not properly configured',
        details: 'Check Netlify environment variables: WORKOS_CLIENT_ID, WORKOS_API_KEY, WORKOS_COOKIE_PASSWORD',
        help: 'Visit /auth/debug for diagnostics',
      },
      { status: 500 }
    );
  }
  
  // Call WorkOS handler directly - no wrapper to avoid potential issues
  try {
    return await workOSHandler(req) as NextResponse;
  } catch (error: any) {
    console.error('[WorkOS Handler Error]:', error);
    return NextResponse.json(
      {
        error: 'WorkOS authentication error',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

