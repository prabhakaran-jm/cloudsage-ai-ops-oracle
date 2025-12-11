'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import Link from 'next/link';

// Check if WorkOS is enabled (client-side check via env)
const WORKOS_ENABLED = process.env.NEXT_PUBLIC_WORKOS_ENABLED === 'true';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiClient.login(email, password);
      router.push('/projects');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkOSLogin = () => {
    // Redirect to WorkOS AuthKit sign-in
    // WorkOS will handle organization selection if multiple exist
    // If only one organization, it will use that automatically
    window.location.href = '/api/auth/signin';
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#121121] py-12 px-4 sm:px-6 lg:px-8">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#121121]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-[#5048e5]/20 rounded-full blur-[200px]"></div>
      </div>

      <div className="relative z-10 max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center">
          <div className="size-12 text-[#5048e5] mb-4">
            <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
            </svg>
          </div>
          <h2 className="text-center text-3xl font-bold text-white">
            Sign in to CloudSage
          </h2>
          <p className="mt-2 text-center text-sm text-white/60">
            Monitor your systems with AI-powered insights
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-8">
          {/* WorkOS Enterprise SSO */}
          <div className="mb-6">
            <button
              onClick={handleWorkOSLogin}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-white/20 text-sm font-medium rounded-lg text-white bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5048e5] transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="currentColor"/>
              </svg>
              <span>Continue with Enterprise SSO</span>
              <span className="ml-auto text-xs px-2 py-0.5 bg-[#5048e5]/20 text-[#a5a0f5] rounded">WorkOS</span>
            </button>
            <p className="text-xs text-center text-white/40 mt-2">
              Powered by WorkOS • SSO, SAML, MFA supported
            </p>
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-xs text-amber-200">
                <strong>Note:</strong> WorkOS requires an organization to be set up in the dashboard. 
                If you see an error, use email/password login below or set up WorkOS at{' '}
                <a href="https://dashboard.workos.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-100">
                  dashboard.workos.com
                </a>
              </p>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-[#121121] text-white/50">or continue with email</span>
            </div>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none relative block w-full px-4 py-3 bg-black/30 border border-white/10 placeholder-white/40 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5048e5] focus:border-transparent sm:text-sm"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none relative block w-full px-4 py-3 bg-black/30 border border-white/10 placeholder-white/40 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5048e5] focus:border-transparent sm:text-sm"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-br from-[#5048e5] to-purple-600 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5048e5] disabled:opacity-50 disabled:cursor-not-allowed transition-transform shadow-[0_0_20px_rgba(80,72,229,0.3)]"
              >
                {loading ? 'Signing in...' : 'Sign in with Email'}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center">
          <Link
            href="/register"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Don&apos;t have an account? <span className="text-[#5048e5] font-semibold">Register</span>
          </Link>
        </div>

        <div className="text-center">
          <Link
            href="/"
            className="text-sm text-white/50 hover:text-white/70 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

