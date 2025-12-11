'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your subscription...');

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (!sessionId) {
      setStatus('error');
      setMessage('No session ID found. Please contact support if you completed payment.');
      return;
    }

    // Verify the Stripe session and restore user session
    const verifySession = async () => {
      try {
        const response = await fetch('/api/checkout/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionId }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Verification failed' }));
          throw new Error(errorData.error || 'Failed to verify session');
        }

        const { verified, user } = await response.json();

        if (verified) {
          setStatus('success');
          setMessage('Subscription activated! Redirecting to your projects...');
          
          // Redirect to projects after a short delay
          setTimeout(() => {
            router.push('/projects');
          }, 2000);
        } else {
          throw new Error('Session verification failed');
        }
      } catch (err: any) {
        console.error('Checkout verification error:', err);
        setStatus('error');
        setMessage(err.message || 'Failed to verify your subscription. Please contact support.');
      }
    };

    verifySession();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#121121] flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-4">
        {status === 'verifying' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5048e5] mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-white mb-2">Verifying Subscription</h1>
            <p className="text-white/70">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Subscription Activated!</h1>
            <p className="text-white/70">{message}</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Verification Failed</h1>
            <p className="text-white/70 mb-4">{message}</p>
            <button
              onClick={() => router.push('/projects')}
              className="px-6 py-2 bg-[#5048e5] text-white rounded-lg hover:bg-[#4038d4] transition-colors"
            >
              Go to Projects
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#121121] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5048e5] mx-auto mb-4"></div>
            <p className="text-white/70">Loading...</p>
          </div>
        </div>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}

