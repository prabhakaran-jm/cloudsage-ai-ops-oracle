import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-11-17.clover',
  typescript: true,
});

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required', verified: false },
        { status: 400 }
      );
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured', verified: false },
        { status: 500 }
      );
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found', verified: false },
        { status: 404 }
      );
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') {
      return NextResponse.json(
        { error: 'Payment not completed', verified: false },
        { status: 400 }
      );
    }

    // Get customer email from session
    let customerEmail: string | null = null;
    
    if (session.customer_email) {
      customerEmail = session.customer_email;
    } else if (session.customer_details?.email) {
      customerEmail = session.customer_details.email;
    } else if (session.customer && typeof session.customer !== 'string') {
      // Customer is an object, check if it has email
      const customer = session.customer as Stripe.Customer;
      if ('email' in customer && customer.email) {
        customerEmail = customer.email;
      }
    }

    console.log('[Checkout Verify] Session verified:', {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerEmail,
      subscriptionId: session.subscription,
    });

    if (!customerEmail) {
      return NextResponse.json(
        { error: 'No customer email found in session', verified: false },
        { status: 400 }
      );
    }

    // Create/login user and get JWT token
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cloudsage-api.01kbv4q1d3d0twvhykd210v58w.lmapp.run/api';
    
    try {
      const loginResponse = await fetch(`${API_BASE_URL}/auth/stripe-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: customerEmail }),
      });

      if (!loginResponse.ok) {
        const errorData = await loginResponse.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Failed to create/login user');
      }

      const { token, user } = await loginResponse.json();

      console.log('[Checkout Verify] User created/logged in:', user.email);

      // TODO: Update user subscription status in your database
      // You can add logic here to:
      // 1. Store subscription ID in user record
      // 2. Update subscription status
      // 3. Link Stripe customer ID

      return NextResponse.json({
        verified: true,
        token, // JWT token for frontend
        user: {
          id: user.id,
          email: user.email,
        },
        session: {
          id: session.id,
          paymentStatus: session.payment_status,
          subscriptionId: session.subscription,
        },
      });
    } catch (loginError: any) {
      console.error('[Checkout Verify] User creation/login error:', loginError);
      return NextResponse.json(
        { error: loginError.message || 'Failed to create user account', verified: false },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Stripe session verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify session', verified: false },
      { status: 500 }
    );
  }
}

