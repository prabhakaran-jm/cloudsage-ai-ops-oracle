'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/apiClient';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await apiClient.register(email, password);
      router.push('/projects');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
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
            Create your account
          </h2>
          <p className="mt-2 text-center text-sm text-white/60">
            Start monitoring your systems in minutes
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-8">
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
                  autoComplete="new-password"
                  required
                  className="appearance-none relative block w-full px-4 py-3 bg-black/30 border border-white/10 placeholder-white/40 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5048e5] focus:border-transparent sm:text-sm"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-white/90 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="appearance-none relative block w-full px-4 py-3 bg-black/30 border border-white/10 placeholder-white/40 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5048e5] focus:border-transparent sm:text-sm"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-br from-[#5048e5] to-purple-600 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5048e5] disabled:opacity-50 disabled:cursor-not-allowed transition-transform shadow-[0_0_20px_rgba(80,72,229,0.3)]"
              >
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </div>
          </form>
        </div>

        <div className="text-center">
          <Link
            href="/login"
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Already have an account? <span className="text-[#5048e5] font-semibold">Sign in</span>
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

