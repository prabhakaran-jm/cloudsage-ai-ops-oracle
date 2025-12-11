import { Suspense } from 'react';
import ErrorContent from './ErrorContent';

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="relative min-h-screen flex items-center justify-center bg-[#121121] py-12 px-4 sm:px-6 lg:px-8">
          <div className="relative z-10 max-w-md w-full">
            <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-8">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 mb-4 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
                  <svg className="w-8 h-8 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-white/70 mb-2">Loading error details...</h2>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}

