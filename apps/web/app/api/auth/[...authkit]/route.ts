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
    // CRITICAL: Revoke any existing WorkOS session before redirecting to sign-in
    // This ensures WorkOS doesn't auto-authenticate with a previous session
    const sessionCookie = req.cookies.get('wos-session')?.value;
    
    if (sessionCookie) {
      try {
        const session = await workos.userManagement.loadSealedSession({
          sessionData: sessionCookie,
          cookiePassword: WORKOS_COOKIE_PASSWORD!,
        });

        // Try to extract session ID
        let sessionId: string | undefined;
        
        if ('sessionId' in session && typeof (session as any).sessionId === 'string') {
          sessionId = (session as any).sessionId;
        } else if ('accessToken' in session && typeof (session as any).accessToken === 'string') {
          try {
            const accessToken = (session as any).accessToken;
            const payload = JSON.parse(
              Buffer.from(accessToken.split('.')[1], 'base64').toString()
            );
            sessionId = payload.sid;
          } catch (decodeError) {
            console.warn('[WorkOS Sign-in] Failed to decode access token:', decodeError);
          }
        }

        if (sessionId) {
          await workos.userManagement.revokeSession({ sessionId });
        }
      } catch (revokeError: any) {
        console.error('[WorkOS Sign-in] Failed to revoke existing session:', revokeError?.message);
      }
    }
    
    // Get the authorization URL and append prompt=login to force re-authentication
    // This ensures WorkOS prompts for email/OTP even if there's an active session
    let authorizationUrl = workos.userManagement.getAuthorizationUrl({
      provider: 'authkit', // Using AuthKit, not SSO
      redirectUri: WORKOS_REDIRECT_URI,
      clientId: WORKOS_CLIENT_ID!,
      // Add state to force re-authentication
      state: `force_auth_${Date.now()}`,
    });
    
    // Append OAuth2 parameters to force re-authentication (OAuth2 standard)
    // - prompt=login: Forces WorkOS to always prompt for credentials
    // - max_age=0: Treats any existing session as expired, forcing immediate re-auth
    // - login_hint=: Empty login hint to prevent email pre-filling
    // - state: Unique state parameter to prevent replay attacks and ensure fresh auth
    const url = new URL(authorizationUrl);
    url.searchParams.set('prompt', 'login');
    url.searchParams.set('max_age', '0'); // Force immediate re-authentication
    url.searchParams.set('login_hint', ''); // Clear any pre-filled email
    // Ensure state is unique (already set in getAuthorizationUrl, but we'll update it)
    url.searchParams.set('state', `force_auth_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    authorizationUrl = url.toString();
    
    // Clear any existing WorkOS session cookie
    const redirectResponse = NextResponse.redirect(authorizationUrl);
    redirectResponse.cookies.delete('wos-session');
    redirectResponse.cookies.set('wos-session', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
    
    
    return redirectResponse;
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
    
      email: user.email,
      userId: user.id,
      hasSealedSession: !!sealedSession,
    });
    
    // CRITICAL: Revoke all existing sessions for this user to prevent auto-login issues
    // This ensures that when the user logs out and tries to log in again, they'll be prompted for credentials
    try {
      console.log('[WorkOS Callback] Revoking all existing sessions for user:', user.id);
      const sessions = await workos.userManagement.listSessions(user.id);
      
      if (sessions.data && sessions.data.length > 0) {
        for (const session of sessions.data) {
          try {
            await workos.userManagement.revokeSession({ sessionId: session.id });
          } catch (revokeError: any) {
            console.warn(`[WorkOS Callback] Failed to revoke session ${session.id}:`, revokeError?.message);
          }
        }
        console.log('[WorkOS Callback] ✅ All existing sessions revoked');
      } else {
        console.log('[WorkOS Callback] No existing sessions found for user');
      }
    } catch (sessionError: any) {
      // Log but don't fail - this is a best-effort cleanup
      console.warn('[WorkOS Callback] Failed to revoke existing sessions (non-critical):', {
        message: sessionError?.message,
        error: sessionError,
      });
    }
    
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
      envCheck: {
        hasNextPublicApiUrl: !!process.env.NEXT_PUBLIC_API_URL,
        hasApiUrl: !!process.env.API_URL,
      },
    });
    
    // First, test if API is reachable (API_BASE_URL already includes /api)
    try {
      const healthUrl = `${API_BASE_URL}/health`;
      console.log('[WorkOS Callback] Testing API connectivity:', healthUrl);
      
      const healthCheck = await fetch(healthUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }).catch((err) => {
        console.warn('[WorkOS Callback] Health check fetch failed:', err?.message);
        return null;
      });
      
      if (healthCheck) {
        const healthText = await healthCheck.text().catch(() => '');
        console.log('[WorkOS Callback] API health check result:', {
          status: healthCheck.status,
          ok: healthCheck.ok,
          text: healthText.substring(0, 100),
        });
      } else {
        console.error('[WorkOS Callback] API health check failed - API may be unreachable or CORS blocked');
      }
    } catch (healthError: any) {
      console.error('[WorkOS Callback] API health check error:', {
        message: healthError?.message,
        name: healthError?.name,
      });
    }
    
    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      console.log('[WorkOS Callback] Making fetch request to:', workosLoginUrl);
      
      let tokenResponse;
      try {
        tokenResponse = await fetch(workosLoginUrl, {
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
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        console.error('[WorkOS Callback] Fetch error (network/CORS/timeout):', {
          message: fetchError?.message,
          name: fetchError?.name,
          cause: fetchError?.cause,
          stack: fetchError?.stack,
        });
        throw fetchError;
      }
      
      clearTimeout(timeoutId);
      
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text().catch(() => 'Could not read error response');
        console.error('[WorkOS Callback] Error response body:', errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText, raw: errorText };
        }
        
        console.error('[WorkOS Callback] Failed to get JWT token:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          error: errorData,
          apiUrl: API_BASE_URL,
          workosLoginUrl: workosLoginUrl,
        });
        
        const errorMessage = errorData.error || errorData.message || errorText || 'Unknown error';
        return NextResponse.redirect(new URL(`/auth/error?error=token_exchange_failed&details=${encodeURIComponent(errorMessage)}`, req.url));
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
  if (!workos) {
    // If WorkOS is not configured, just clear the cookie
    return NextResponse.json({ success: true, message: 'Logged out (WorkOS not configured)' });
  }

  try {
    // Get the sealed session from the cookie
    const sessionCookie = req.cookies.get('wos-session')?.value;

    if (sessionCookie) {
      try {
        // Load the sealed session to get session details
        const session = await workos.userManagement.loadSealedSession({
          sessionData: sessionCookie,
          cookiePassword: WORKOS_COOKIE_PASSWORD!,
        });

        // Get the session ID - it may be directly on the session object or in the access token
        // Try to get sessionId from the session object first
        let sessionId: string | undefined;
        
        // Check if session has sessionId property directly
        if ('sessionId' in session && typeof (session as any).sessionId === 'string') {
          sessionId = (session as any).sessionId;
        }
        // Otherwise, try to extract from access token if available
        else if ('accessToken' in session && typeof (session as any).accessToken === 'string') {
          try {
            const accessToken = (session as any).accessToken;
            // Decode JWT to get session ID (sid claim)
            const payload = JSON.parse(
              Buffer.from(accessToken.split('.')[1], 'base64').toString()
            );
            sessionId = payload.sid;
          } catch (decodeError) {
            console.warn('[WorkOS Sign-out] Failed to decode access token:', decodeError);
          }
        }

        if (sessionId) {
          // Revoke the session on WorkOS servers - this invalidates the server-side session
          await workos.userManagement.revokeSession({ sessionId });
          console.log('[WorkOS Sign-out] Session revoked successfully:', sessionId);
        } else {
          console.warn('[WorkOS Sign-out] Could not extract session ID from sealed session');
        }
      } catch (sessionError: any) {
        // Log but don't fail - we'll still clear the cookie
        console.warn('[WorkOS Sign-out] Failed to revoke session (non-critical):', {
          message: sessionError?.message,
          error: sessionError,
        });
      }
    }

    // Clear the session cookie and return success
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' });
    response.cookies.delete('wos-session');
    response.cookies.set('wos-session', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    return response;
  } catch (error: any) {
    console.error('[WorkOS Sign-out Error]:', {
      message: error?.message,
      error: error,
    });

    // Even on error, clear the cookie
    const response = NextResponse.json({ success: true, message: 'Logged out (with errors)' });
    response.cookies.delete('wos-session');
    response.cookies.set('wos-session', '', {
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    return response;
  }
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

