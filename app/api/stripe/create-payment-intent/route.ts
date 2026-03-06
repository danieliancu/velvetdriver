import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

export async function POST(request: Request) {
  try {
    if (!stripe || !publishableKey) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const body = await request.json();
    const amount = Number(body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const currency = String(body?.currency ?? 'gbp').toLowerCase();
    const passengerName = String(body?.passengerName ?? '').trim();
    const passengerEmail = String(body?.passengerEmail ?? '').trim();
    const pickup = String(body?.pickup ?? '').trim();
    const dropOff = Array.isArray(body?.dropOffs)
      ? String(body.dropOffs[body.dropOffs.length - 1] ?? '').trim()
      : '';

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        passengerName,
        passengerEmail,
        pickup,
        dropOff,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      publishableKey,
    });
  } catch (err) {
    console.error('Stripe create payment intent error', err);
    return NextResponse.json({ error: 'Failed to create payment intent' }, { status: 500 });
  }
}
