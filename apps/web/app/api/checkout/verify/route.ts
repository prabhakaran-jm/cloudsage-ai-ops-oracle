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

    // TODO: Update user subscription status in your database
    // For now, we'll just verify the session and let the user through
    // You can add logic here to:
    // 1. Find user by email
    // 2. Update their subscription status
    // 3. Store subscription ID

    return NextResponse.json({
      verified: true,
      session: {
        id: session.id,
        paymentStatus: session.payment_status,
        subscriptionId: session.subscription,
      },
      user: {
        email: customerEmail,
      },
    });
  } catch (error: any) {
    console.error('Stripe session verification error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify session', verified: false },
      { status: 500 }
    );
  }
}

