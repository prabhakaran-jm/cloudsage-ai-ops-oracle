'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (token) {
      // Store token in localStorage (for backend API calls)
      localStorage.setItem('auth_token', token);
      console.log('[Auth Callback] Token stored, redirecting to projects...');
      // Redirect to projects page
      router.push('/projects');
    } else {
      // No token, redirect to login
      console.error('[Auth Callback] No token found in query params');
      router.push('/login?error=no_token');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Completing sign-in...</p>
      </div>
    </div>
  );
}

