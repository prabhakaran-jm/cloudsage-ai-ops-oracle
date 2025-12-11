'use client';

import { useEffect, useState } from 'react';

export default function WorkOSDebugPage() {
  const [checks, setChecks] = useState<Array<{ name: string; status: 'checking' | 'pass' | 'fail'; message: string }>>([]);

  useEffect(() => {
    const runChecks = async () => {
      const results: Array<{ name: string; status: 'checking' | 'pass' | 'fail'; message: string }> = [];

      // Check 1: Environment variables (client-side can only check public ones)
      results.push({
        name: 'WorkOS Enabled Flag',
        status: process.env.NEXT_PUBLIC_WORKOS_ENABLED === 'true' ? 'pass' : 'fail',
        message: process.env.NEXT_PUBLIC_WORKOS_ENABLED === 'true' 
          ? 'NEXT_PUBLIC_WORKOS_ENABLED is set to true'
          : 'NEXT_PUBLIC_WORKOS_ENABLED is not set or false'
      });

      // Check 2: Test redirect URI format
      const currentUrl = window.location.origin;
      const expectedCallback = `${currentUrl}/api/auth/callback`;
      results.push({
        name: 'Redirect URI Format',
        status: 'pass',
        message: `Expected: ${expectedCallback} (must match WorkOS dashboard exactly)`
      });

      // Check 3: Test sign-in endpoint
      try {
        const response = await fetch('/api/auth/signin', { method: 'HEAD', redirect: 'manual' });
        results.push({
          name: 'Sign-in Endpoint',
          status: response.status === 302 || response.status === 307 ? 'pass' : 'fail',
          message: `Status: ${response.status} (should be 302/307 redirect)`
        });
      } catch (error: any) {
        results.push({
          name: 'Sign-in Endpoint',
          status: 'fail',
          message: `Error: ${error.message}`
        });
      }

      setChecks(results);
    };

    runChecks();
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-[#121121] py-12 px-4 sm:px-6 lg:px-8">
      <div className="relative z-10 max-w-2xl w-full space-y-8">
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">WorkOS Configuration Diagnostics</h2>
          
          <div className="space-y-4">
            {checks.map((check, i) => (
              <div key={i} className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                  check.status === 'pass' ? 'bg-green-500/20 text-green-400' :
                  check.status === 'fail' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400 animate-pulse'
                }`}>
                  {check.status === 'pass' ? '✓' : check.status === 'fail' ? '✗' : '○'}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-white mb-1">{check.name}</div>
                  <div className="text-sm text-white/60">{check.message}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <h3 className="font-semibold text-amber-200 mb-2">WorkOS Dashboard Checklist:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm text-amber-200/80">
              <li>Organization created and active</li>
              <li>Your email added to the organization</li>
              <li>Redirect URI added: <code className="bg-black/30 px-1 rounded">{window.location.origin}/api/auth/callback</code></li>
              <li>Authentication method enabled (Email Magic Link recommended)</li>
              <li>Application linked to organization (check Organization settings)</li>
            </ol>
          </div>

          <div className="mt-6 flex gap-4">
            <a
              href="/login"
              className="px-4 py-2 bg-[#5048e5] hover:bg-[#5048e5]/90 text-white rounded-lg transition-colors"
            >
              Back to Login
            </a>
            <a
              href="https://dashboard.workos.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Open WorkOS Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

