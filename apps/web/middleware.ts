// Middleware for authentication
// Supports both WorkOS SSO and legacy JWT auth

import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { authkitMiddleware } from '@workos-inc/authkit-nextjs';

// Check if WorkOS is configured
const WORKOS_ENABLED = process.env.WORKOS_CLIENT_ID && process.env.WORKOS_API_KEY;

export default async function middleware(request: NextRequest, event: NextFetchEvent) {
  // If WorkOS is configured, use AuthKit middleware for protected routes
  if (WORKOS_ENABLED) {
    // Let WorkOS handle auth for protected routes
    // authkitMiddleware() returns a function that expects (request, event)
    return authkitMiddleware()(request, event);
  }
  
  // Fallback: check for legacy JWT token
  const token = request.cookies.get('auth_token')?.value || 
                request.headers.get('Authorization')?.replace('Bearer ', '');
  
  const isProtectedRoute = request.nextUrl.pathname.startsWith('/projects');
  const isAuthPage = request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register';
  
  // If accessing protected route without token, redirect to login
  if (isProtectedRoute && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  
  // If accessing auth page with token, redirect to projects
  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/projects', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match protected routes
    '/projects/:path*',
    // Match auth pages
    '/login',
    '/register',
    // WorkOS callback
    '/api/auth/:path*',
  ],
};

