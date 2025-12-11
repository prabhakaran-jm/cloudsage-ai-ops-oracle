'use client';

import { useState } from 'react';
import Link from 'next/link';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  ctaLink: string;
  popular: boolean;
  priceId?: string;
  trialDays?: number;
}

const pricingPlans: PricingPlan[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying out CloudSage',
    features: [
      'Up to 3 projects',
      '10,000 log entries/month',
      'Basic risk scoring',
      'Daily AI forecasts',
      'Email support',
    ],
    cta: 'Get Started',
    ctaLink: '/register',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: 'month',
    description: 'For solo engineers and small teams',
    features: [
      'Unlimited projects',
      '100,000 log entries/month',
      'Advanced risk scoring',
      'Real-time AI forecasts',
      'Historical trend analysis',
      'Priority email support',
      'API access',
    ],
    cta: 'Start Free Trial',
    ctaLink: '#',
    popular: true,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
    trialDays: 14, // 14-day free trial
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For teams and organizations',
    features: [
      'Everything in Pro',
      'Unlimited log entries',
      'Custom AI models',
      'Dedicated support',
      'SLA guarantee',
      'Custom integrations',
      'On-premise deployment',
    ],
    cta: 'Contact Sales',
    ctaLink: 'mailto:sales@cloudsage.ai',
    popular: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleCheckout = async (priceId: string, trialDays?: number) => {
    if (!priceId || priceId.trim() === '') {
      alert('Stripe is not configured. Please contact support or try the Free plan.');
      return;
    }
    
    setLoading(priceId);
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, trialDays }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const { sessionId, error } = await response.json();

      if (error) {
        throw new Error(error);
      }

      if (!sessionId) {
        throw new Error('No session ID returned from server');
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load. Please check your internet connection and try again.');
      }

      // @ts-expect-error - TypeScript incorrectly resolves to server-side Stripe type
      // The client-side Stripe from @stripe/stripe-js does have redirectToCheckout
      const { error: redirectError } = await stripe.redirectToCheckout({
        sessionId,
      });

      if (redirectError) {
        throw new Error(redirectError.message);
      }
    } catch (err: any) {
      console.error('Checkout error:', err);
      const errorMessage = err?.message || 'An error occurred. Please try again.';
      alert(`Checkout Error: ${errorMessage}\n\nIf this persists, please contact support.`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative w-full overflow-x-hidden bg-[#121121] text-white antialiased min-h-screen">
      {/* Background Gradient */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[#121121]"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[80vh] bg-[#5048e5]/20 rounded-full blur-[200px]"></div>
      </div>

      <div className="relative z-10 flex h-full grow flex-col">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <header className="flex items-center justify-between whitespace-nowrap py-6">
            <Link href="/" className="flex items-center gap-4 text-white">
              <div className="size-6">
                <svg fill="currentColor" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                  <path clipRule="evenodd" d="M24 4H6V17.3333V30.6667H24V44H42V30.6667V17.3333H24V4Z" fillRule="evenodd"></path>
                </svg>
              </div>
              <h2 className="text-white text-xl font-bold leading-tight tracking-[-0.015em]">CloudSage</h2>
            </Link>
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

          <main className="flex-1 py-20">
            {/* Pricing Header */}
            <div className="text-center mb-16">
              <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl lg:text-7xl bg-gradient-to-br from-white to-white/60 bg-clip-text text-transparent mb-4">
                Simple, Transparent Pricing
              </h1>
              <p className="text-xl text-white/70 max-w-2xl mx-auto">
                Choose the plan that fits your needs. All plans include our core AI-powered risk prediction.
              </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3 max-w-6xl mx-auto">
              {pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative flex flex-col rounded-2xl border ${
                    plan.popular
                      ? 'border-[#5048e5] bg-gradient-to-br from-[#5048e5]/20 to-purple-600/20 scale-105'
                      : 'border-white/10 bg-white/5'
                  } p-8 backdrop-blur-lg transition-all duration-300 hover:border-[#5048e5]/50`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <span className="bg-gradient-to-r from-[#5048e5] to-purple-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-6">
                    <div>
                      <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-4xl font-bold text-white">{plan.price}</span>
                        {plan.period && (
                          <span className="text-white/60 text-lg">/{plan.period}</span>
                        )}
                      </div>
                      <p className="text-white/70 text-sm">
                        {plan.description}
                        {plan.trialDays && (
                          <span className="block mt-1 text-[#5048e5] font-semibold">
                            {plan.trialDays}-day free trial
                          </span>
                        )}
                      </p>
                    </div>

                    <ul className="flex flex-col gap-3 flex-grow">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg
                            className="w-5 h-5 text-[#5048e5] flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          <span className="text-white/80 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-4">
                      {plan.priceId && plan.priceId.trim() !== '' ? (
                        <button
                          onClick={() => handleCheckout(plan.priceId!, plan.trialDays)}
                          disabled={loading === plan.priceId}
                          className={`w-full rounded-lg h-12 px-6 font-bold text-base transition-all ${
                            plan.popular
                              ? 'bg-gradient-to-r from-[#5048e5] to-purple-600 text-white shadow-[0_0_20px_rgba(80,72,229,0.5)] hover:scale-105'
                              : 'bg-white/10 text-white hover:bg-white/20'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {loading === plan.priceId ? 'Processing...' : plan.cta}
                        </button>
                      ) : plan.ctaLink.startsWith('mailto:') ? (
                        <a
                          href={plan.ctaLink}
                          className={`block w-full text-center rounded-lg h-12 px-6 font-bold text-base leading-[48px] transition-all ${
                            plan.popular
                              ? 'bg-gradient-to-r from-[#5048e5] to-purple-600 text-white shadow-[0_0_20px_rgba(80,72,229,0.5)] hover:scale-105'
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                        >
                          {plan.cta}
                        </a>
                      ) : (
                        <Link
                          href={plan.ctaLink}
                          className={`block w-full text-center rounded-lg h-12 px-6 font-bold text-base leading-[48px] transition-all ${
                            plan.popular
                              ? 'bg-gradient-to-r from-[#5048e5] to-purple-600 text-white shadow-[0_0_20px_rgba(80,72,229,0.5)] hover:scale-105'
                              : 'bg-white/10 text-white hover:bg-white/20'
                          }`}
                        >
                          {plan.cta}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* FAQ Section */}
            <div className="mt-20 max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-white text-center mb-12">
                Frequently Asked Questions
              </h2>
              <div className="space-y-6">
                <div className="border border-white/10 rounded-xl bg-white/5 p-6 backdrop-blur-lg">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Can I change plans later?
                  </h3>
                  <p className="text-white/70">
                    Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.
                  </p>
                </div>
                <div className="border border-white/10 rounded-xl bg-white/5 p-6 backdrop-blur-lg">
                  <h3 className="text-lg font-bold text-white mb-2">
                    What payment methods do you accept?
                  </h3>
                  <p className="text-white/70">
                    We accept all major credit cards, debit cards, and ACH transfers through Stripe.
                  </p>
                </div>
                <div className="border border-white/10 rounded-xl bg-white/5 p-6 backdrop-blur-lg">
                  <h3 className="text-lg font-bold text-white mb-2">
                    Is there a free trial?
                  </h3>
                  <p className="text-white/70">
                    Yes! The Pro plan includes a 14-day free trial. No credit card required to start.
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

