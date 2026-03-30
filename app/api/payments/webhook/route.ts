import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getDbPool } from '@/lib/db';
import { logPaymentEvent, syncPaymentIntentToDb } from '@/lib/ride-payments';
import { stripe } from '@/lib/stripe-server';

const pool = getDbPool();

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: 'Missing Stripe webhook configuration' }, { status: 400 });
  }

  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Invalid signature' }, { status: 400 });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await logPaymentEvent(conn, {
      stripeEventId: event.id,
      eventType: event.type,
      source: 'webhook',
      status: 'received',
      payload: { id: event.id, type: event.type },
    });

    switch (event.type) {
      case 'payment_intent.amount_capturable_updated':
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.canceled':
        await syncPaymentIntentToDb(conn, event.data.object as Stripe.PaymentIntent, event.id);
        break;
      case 'charge.succeeded':
      case 'charge.failed':
      case 'payment_method.attached':
        await logPaymentEvent(conn, {
          stripeEventId: event.id,
          eventType: event.type,
          source: 'webhook',
          status: 'processed',
          payload: event.data.object as Record<string, any>,
        });
        break;
      default:
        break;
    }

    await conn.commit();
    return NextResponse.json({ received: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Stripe webhook error', err);
    return NextResponse.json({ error: err?.message || 'Webhook processing failed' }, { status: 500 });
  } finally {
    conn.release();
  }
}
