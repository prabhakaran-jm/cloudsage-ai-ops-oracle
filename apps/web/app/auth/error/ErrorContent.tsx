'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#121121] py-12 px-4 sm:px-6 lg:px-8">
      <div className="relative z-10 max-w-md w-full space-y-8">
        <div className="bg-white/5 backdrop-blur-lg border border-red-500/50 rounded-xl p-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">WorkOS Setup Required</h2>
            <p className="text-white/70 mb-4">
              {errorDescription || error || 'WorkOS authentication requires additional setup.'}
            </p>
            
            <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-left text-sm text-amber-200 mb-4">
              <p className="font-semibold mb-2">Quick Fix for Demo:</p>
              <p className="mb-2">Use <strong>email/password login</strong> below - it works immediately without WorkOS setup!</p>
            </div>
            
            <div className="mt-4 p-4 bg-white/5 rounded-lg text-left text-sm text-white/60">
              <p className="font-semibold mb-2">To Enable WorkOS SSO:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Go to <a href="https://dashboard.workos.com" target="_blank" rel="noopener noreferrer" className="text-[#5048e5] underline">dashboard.workos.com</a></li>
                <li>Create an <strong>Organization</strong> (required)</li>
                <li>Add redirect URI: <code className="text-xs bg-black/30 px-1 rounded">https://steady-melomakarona-42c054.netlify.app/api/auth/callback</code></li>
                <li>Add your email to the organization</li>
                <li>Enable authentication method (Email Magic Link recommended)</li>
              </ol>
            </div>

            <div className="mt-6 flex gap-4">
              <Link
                href="/login"
                className="px-4 py-2 bg-[#5048e5] hover:bg-[#5048e5]/90 text-white rounded-lg transition-colors"
              >
                Back to Login
              </Link>
              <Link
                href="/"
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Go Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

