import Link from 'next/link';

export default function Home() {
  return (
    <div className="relative w-full overflow-x-hidden bg-[#121121] text-white antialiased">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#121121]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-[#5048e5]/20 rounded-full blur-[200px]"></div>
      </div>

      <div className="relative z-10 flex h-full grow flex-col">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="flex items-center justify-between whitespace-nowrap py-6">
            <div className="flex items-center gap-4 text-white">
              <div className="size-6">
                <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                </svg>
              </div>
              <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">CloudSage</h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/register"
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-[#5048e5] text-white text-sm font-bold leading-normal tracking-[0.015em] transition-transform hover:scale-105"
              >
                <span className="truncate">Get Started</span>
              </Link>
              <Link
                href="/login"
                className="flex min-w-[84px] max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-white/10 text-white text-sm font-bold leading-normal tracking-[0.015em] transition-colors hover:bg-white/20"
              >
                <span className="truncate">Sign In</span>
              </Link>
            </div>
          </header>

          <main className="flex-1">
            {/* Hero Section */}
            <section className="flex min-h-[calc(100vh-88px)] flex-col items-center justify-center text-center py-20">
              <div className="flex flex-col items-center gap-6">
                <div className="flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full border border-[#5048e5]/30 bg-[#5048e5]/20 pl-2 pr-4 shadow-[0_0_20px_rgba(80,72,229,0.3)]">
                  <span className="text-[#5048e5] text-lg">✓</span>
                  <p className="text-white text-sm font-medium leading-normal">Live & Ready</p>
                </div>
                <h1 className="text-6xl font-bold tracking-tighter sm:text-7xl lg:text-8xl bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent">
                  CloudSage
                </h1>
                <div className="max-w-3xl">
                  <h2 className="text-xl font-medium text-white/90 sm:text-2xl">
                    Proactive AI Monitoring for Solo Engineers.
                  </h2>
                  <p className="mt-4 text-base text-white/70 sm:text-lg">
                    Stop fighting fires. CloudSage uses AI to predict system failures before they happen, giving you peace of mind and more time to build.
                  </p>
                </div>
                
                {/* CTA Buttons - Moved here */}
                <div className="flex flex-col gap-4 sm:flex-row mt-4">
                  <Link
                    href="/register"
                    className="flex min-w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-gradient-to-br from-[#5048e5] to-purple-600 text-white text-base font-bold leading-normal tracking-[0.015em] shadow-[0_0_20px_rgba(80,72,229,0.5)] transition-transform hover:scale-105"
                  >
                    <span className="truncate">Get Started</span>
                  </Link>
                  <Link
                    href="/pricing"
                    className="flex min-w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-white/10 text-white text-base font-bold leading-normal tracking-[0.015em] transition-colors hover:bg-white/20"
                  >
                    <span className="truncate">View Pricing</span>
                  </Link>
                  <Link
                    href="/login"
                    className="flex min-w-[160px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-white/10 text-white text-base font-bold leading-normal tracking-[0.015em] transition-colors hover:bg-white/20"
                  >
                    <span className="truncate">Sign In</span>
                  </Link>
                </div>
              </div>
            </section>

            {/* Feature Section */}
            <section className="py-20">
              <div className="flex flex-col gap-12">
                <div className="text-center">
                  <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                    Ready to Predict the Future?
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="group relative flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-all duration-300 hover:border-[#5048e5]/50 hover:bg-[#5048e5]/10">
                    <div className="absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{background: 'radial-gradient(400px at center, rgba(80, 72, 229, 0.2), transparent)'}}></div>
                    <div className="relative flex items-center justify-center size-12 rounded-lg bg-[#5048e5]/20 text-[#5048e5]">
                      <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div className="relative flex flex-col gap-1">
                      <h3 className="text-xl font-bold leading-tight text-white">Risk Prediction</h3>
                      <p className="text-base font-normal leading-normal text-white/70">
                        Identify potential outages with probabilistic risk scoring.
                      </p>
                    </div>
                  </div>
                  
                  <div className="group relative flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-all duration-300 hover:border-[#5048e5]/50 hover:bg-[#5048e5]/10">
                    <div className="absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{background: 'radial-gradient(400px at center, rgba(80, 72, 229, 0.2), transparent)'}}></div>
                    <div className="relative flex items-center justify-center size-12 rounded-lg bg-[#5048e5]/20 text-[#5048e5]">
                      <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <div className="relative flex flex-col gap-1">
                      <h3 className="text-xl font-bold leading-tight text-white">AI Forecasts</h3>
                      <p className="text-base font-normal leading-normal text-white/70">
                        Forecast resource utilization and performance bottlenecks.
                      </p>
                    </div>
                  </div>
                  
                  <div className="group relative flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-lg transition-all duration-300 hover:border-[#5048e5]/50 hover:bg-[#5048e5]/10">
                    <div className="absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{background: 'radial-gradient(400px at center, rgba(80, 72, 229, 0.2), transparent)'}}></div>
                    <div className="relative flex items-center justify-center size-12 rounded-lg bg-[#5048e5]/20 text-[#5048e5]">
                      <svg className="size-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                    </div>
                    <div className="relative flex flex-col gap-1">
                      <h3 className="text-xl font-bold leading-tight text-white">Pattern Learning</h3>
                      <p className="text-base font-normal leading-normal text-white/70">
                        Automatically detect anomalies by learning your system&apos;s normal behavior.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>


          </main>
        </div>
      </div>
    </div>
  );
}

