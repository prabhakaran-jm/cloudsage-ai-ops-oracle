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
      provider: 'authkit', // Using AuthKit, not SSO
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
      provider: 'authkit',
    });
    
    // Provide helpful error message for AuthKit-specific issues
    let errorHint = 'Check that WORKOS_CLIENT_ID in Netlify matches your WorkOS dashboard';
    if (error?.message?.includes('client') || error?.message?.includes('SSO')) {
      errorHint = 'Make sure AuthKit is enabled in WorkOS Dashboard (not SSO). Go to Dashboard → AuthKit → Set up AuthKit. Also verify the Client ID is from an AuthKit application, not an SSO application.';
    }
    
    return NextResponse.json(
      {
        error: 'WorkOS AuthKit sign-in error',
        message: error?.message || 'Failed to initiate sign-in',
        hint: errorHint,
        note: 'We are using AuthKit (provider: "authkit"), not SSO. Make sure AuthKit is enabled in your WorkOS dashboard.',
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
    
    console.log('[WorkOS Callback] User authenticated:', {
      email: user.email,
      userId: user.id,
      hasSealedSession: !!sealedSession,
    });
    
    // Exchange WorkOS user for backend JWT token
    // Use server-side env var or fallback to known API URL
    // Note: API_BASE_URL should include /api (e.g., https://api.example.com/api)
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'https://cloudsage-api.01kbv4q1d3d0twvhykd210v58w.lmapp.run/api';
    const workosLoginUrl = `${API_BASE_URL}/auth/workos-login`;
    
    console.log('[WorkOS Callback] Exchanging for JWT token:', {
      apiUrl: API_BASE_URL,
      workosLoginUrl: workosLoginUrl,
      email: user.email,
      workosUserId: user.id,
    });
    
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const tokenResponse = await fetch(workosLoginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          workosUserId: user.id,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      console.log('[WorkOS Callback] Token exchange response:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        ok: tokenResponse.ok,
      });
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text().catch(() => 'Unknown error');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        console.error('[WorkOS Callback] Failed to get JWT token:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorData,
          apiUrl: API_BASE_URL,
        });
        return NextResponse.redirect(new URL(`/auth/error?error=token_exchange_failed&details=${encodeURIComponent(errorData.error || 'Unknown error')}`, req.url));
      }
      
      const tokenData = await tokenResponse.json();
      const { token } = tokenData;
      
      if (!token) {
        console.error('[WorkOS Callback] No token in response:', tokenData);
        return NextResponse.redirect(new URL('/auth/error?error=no_token_in_response', req.url));
      }
      
      console.log('[WorkOS Callback] JWT token received, redirecting to callback page');
      
      // Redirect to a page that will store the token in localStorage
      // We'll pass the token via query parameter (it's a JWT, safe to pass in URL temporarily)
      const redirectUrl = new URL('/auth/callback', req.url);
      redirectUrl.searchParams.set('token', token);
      
      const redirectResponse = NextResponse.redirect(redirectUrl);
      
      // Also set WorkOS session cookie for future use
      if (sealedSession) {
        redirectResponse.cookies.set('wos-session', sealedSession, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
        });
      }
      
      return redirectResponse;
    } catch (tokenError: any) {
      console.error('[WorkOS Callback] Error exchanging for JWT:', {
        message: tokenError?.message,
        name: tokenError?.name,
        cause: tokenError?.cause,
        apiUrl: workosLoginUrl,
      });
      
      let errorMessage = 'token_exchange_failed';
      if (tokenError?.name === 'AbortError') {
        errorMessage = 'token_exchange_timeout';
      } else if (tokenError?.message?.includes('fetch')) {
        errorMessage = 'token_exchange_network_error';
      }
      
      return NextResponse.redirect(new URL(`/auth/error?error=${errorMessage}`, req.url));
    }
  } catch (error: any) {
    console.error('[WorkOS Callback Error]:', error);
    return NextResponse.redirect(new URL('/auth/error?error=callback_failed', req.url));
  }
}

// Handle sign-out
async function handleSignOut(req: NextRequest) {
  // Clear WorkOS session cookie
  const redirectResponse = NextResponse.redirect(new URL('/login', req.url));
  redirectResponse.cookies.delete('wos-session');
  
  // Note: localStorage token will be cleared by the frontend on logout
  // The frontend logout function already handles this
  
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

