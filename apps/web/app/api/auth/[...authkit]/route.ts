// WorkOS AuthKit route handler
// Workaround: Using Node.js SDK instead of Next.js package due to Netlify Functions compatibility
// Based on: https://workos.com/docs/authkit/vanilla/nodejs

import { WorkOS } from '@workos-inc/node';
import { NextRequest, NextResponse } from 'next/server';

// WorkOS configuration
const WORKOS_CLIENT_ID = process.env.WORKOS_CLIENT_ID;
const WORKOS_API_KEY = process.env.WORKOS_API_KEY;
const WORKOS_COOKIE_PASSWORD = process.env.WORKOS_COOKIE_PASSWORD;
const WORKOS_REDIRECT_URI = process.env.WORKOS_REDIRECT_URI || 'https://steady-melomakarona-42c054.netlify.app/api/auth/callback';

// Initialize WorkOS client
let workos: WorkOS | null = null;
let configError: string | null = null;

try {
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
  
  workos = new WorkOS(WORKOS_API_KEY, {
    clientId: WORKOS_CLIENT_ID,
  });
} catch (error: any) {
  console.error('[WorkOS Config Error]:', error.message);
  configError = error.message;
}

// Handle sign-in: redirect to WorkOS authorization URL
async function handleSignIn(req: NextRequest) {
  if (!workos) {
    return NextResponse.json(
      {
        error: 'WorkOS configuration error',
        message: configError || 'WorkOS is not properly configured',
      },
      { status: 500 }
    );
  }
  
  try {
    // Log configuration for debugging (without exposing secrets)
    console.log('[WorkOS Sign-in] Configuration:', {
      clientId: WORKOS_CLIENT_ID ? `${WORKOS_CLIENT_ID.substring(0, 10)}...` : 'NOT SET',
      redirectUri: WORKOS_REDIRECT_URI,
      hasApiKey: !!WORKOS_API_KEY,
      hasCookiePassword: !!WORKOS_COOKIE_PASSWORD,
    });
    
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: 'authkit',
      redirectUri: WORKOS_REDIRECT_URI,
      clientId: WORKOS_CLIENT_ID!,
    });
    
    console.log('[WorkOS Sign-in] Authorization URL generated:', authorizationUrl.substring(0, 100) + '...');
    
    return NextResponse.redirect(authorizationUrl);
  } catch (error: any) {
    console.error('[WorkOS Sign-in Error]:', {
      message: error?.message,
      error: error,
      clientId: WORKOS_CLIENT_ID ? `${WORKOS_CLIENT_ID.substring(0, 10)}...` : 'NOT SET',
    });
    return NextResponse.json(
      {
        error: 'WorkOS sign-in error',
        message: error?.message || 'Failed to initiate sign-in',
        hint: 'Check that WORKOS_CLIENT_ID in Netlify matches your WorkOS dashboard',
      },
      { status: 500 }
    );
  }
}

// Handle callback: exchange code for session
async function handleCallback(req: NextRequest) {
  if (!workos) {
    return NextResponse.redirect(new URL('/auth/error?error=config_error', req.url));
  }
  
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    
    if (!code) {
      return NextResponse.redirect(new URL('/auth/error?error=no_code', req.url));
    }
    
    // Exchange code for user session
    const { user, sealedSession } = await workos.userManagement.authenticateWithCode({
      clientId: WORKOS_CLIENT_ID!,
      code,
      session: {
        sealSession: true,
        cookiePassword: WORKOS_COOKIE_PASSWORD!,
      },
    });
    
    // Redirect to projects page with sealed session cookie
    const redirectResponse = NextResponse.redirect(new URL('/projects', req.url));
    
    if (sealedSession) {
      redirectResponse.cookies.set('wos-session', sealedSession, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      });
    }
    
    return redirectResponse;
  } catch (error: any) {
    console.error('[WorkOS Callback Error]:', error);
    return NextResponse.redirect(new URL('/auth/error?error=callback_failed', req.url));
  }
}

// Handle sign-out
async function handleSignOut(req: NextRequest) {
  const redirectResponse = NextResponse.redirect(new URL('/login', req.url));
  redirectResponse.cookies.delete('wos-session');
  return redirectResponse;
}

// Main handler
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const path = url.pathname;
  
  if (path.includes('/signin')) {
    return handleSignIn(req);
  } else if (path.includes('/callback')) {
    return handleCallback(req);
  } else if (path.includes('/signout')) {
    return handleSignOut(req);
  }
  
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function POST(req: NextRequest) {
  return GET(req);
}

