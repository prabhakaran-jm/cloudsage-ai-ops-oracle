// WorkOS AuthKit route handler
// Handles authentication callbacks from WorkOS

import { handleAuth } from '@workos-inc/authkit-nextjs';
import { NextRequest, NextResponse } from 'next/server';

// WorkOS AuthKit configuration
// All required env vars should be set in Netlify:
// - WORKOS_CLIENT_ID
// - WORKOS_API_KEY
// - WORKOS_COOKIE_PASSWORD (at least 32 chars)
// - WORKOS_REDIRECT_URI (optional, but recommended)

function getWorkOSConfig() {
  const config: any = {
    debug: process.env.NODE_ENV === 'development',
  };

  // Validate required environment variables
  const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
  const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
  const WORKOS_COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD;
  const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI;

  if (!WORKOS_CLIENT_ID) {
    throw new Error('WORKOS_CLIENT_ID is not set');
  }
  if (!WORKOS_API_KEY) {
    throw new Error('WORKOS_API_KEY is not set');
  }
  if (!WORKOS_COOKIE_PASSWORD) {
    throw new Error('WORKOS_COOKIE_PASSWORD is not set (must be at least 32 characters)');
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

  // Add error handling
  config.onError = (error: any) => {
    console.error('[WorkOS AuthKit Error]:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
  };

  return config;
}

// Create the handler with error wrapping
let workOSHandler: ((req: NextRequest) => Promise<Response | NextResponse>) | null = null;
let configError: Error | null = null;

try {
  const config = getWorkOSConfig();
  workOSHandler = handleAuth(config);
} catch (error: any) {
  console.error('[WorkOS Config Error]:', error.message);
  configError = error;
}

// Wrapper function to handle errors gracefully
async function handleRequest(req: NextRequest): Promise<NextResponse> {
  if (!workOSHandler) {
    return NextResponse.json(
      {
        error: 'WorkOS configuration error',
        message: configError?.message || 'WorkOS is not properly configured',
        details: 'Check Netlify environment variables: WORKOS_CLIENT_ID, WORKOS_API_KEY, WORKOS_COOKIE_PASSWORD',
      },
      { status: 500 }
    );
  }

  try {
    const response = await workOSHandler(req);
    // handleAuth returns Response, but Next.js can handle it
    // Convert to NextResponse if needed
    if (response instanceof NextResponse) {
      return response;
    }
    // Create NextResponse from Response
    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error: any) {
    console.error('[WorkOS Handler Error]:', {
      message: error?.message,
      error: error,
      stack: error?.stack,
    });
    return NextResponse.json(
      {
        error: 'WorkOS authentication error',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Export the WorkOS AuthKit handler
// This handles /api/auth/signin, /api/auth/callback, /api/auth/signout, etc.
export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

