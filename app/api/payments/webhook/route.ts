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
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const rideId = Number(session.metadata?.rideId || 0);
        if (rideId && session.payment_status === 'paid') {
          const [rows] = await conn.query<any[]>('SELECT booking_payload FROM client_journeys WHERE id = ? LIMIT 1', [
            rideId,
          ]);
          let payload: Record<string, any> = {};
          if (rows[0]?.booking_payload) {
            try {
              payload =
                typeof rows[0].booking_payload === 'string'
                  ? JSON.parse(rows[0].booking_payload)
                  : rows[0].booking_payload;
            } catch {
              payload = {};
            }
          }
          await conn.execute(
            `UPDATE client_journeys
                SET payment_status = 'paid_by_stripe_link',
                    ride_status = 'payment_captured',
                    captured_amount = COALESCE(NULLIF(captured_amount, 0), price),
                    captured_at = NOW(),
                    primary_payment_intent_id = COALESCE(primary_payment_intent_id, ?),
                    booking_payload = ?,
                    updated_at = NOW()
              WHERE id = ?
              LIMIT 1`,
            [
              typeof session.payment_intent === 'string' ? session.payment_intent : null,
              JSON.stringify({
                ...payload,
                paymentStatus: 'paid_by_stripe_link',
                driverCollectionStatus: 'paid_by_stripe_link',
                stripeCheckoutSessionId: session.id,
                paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : payload.paymentIntentId,
                paidByStripeLinkAt: new Date().toISOString(),
              }),
              rideId,
            ]
          );
        }
        await logPaymentEvent(conn, {
          rideId: rideId || null,
          stripeEventId: event.id,
          eventType: event.type,
          source: 'webhook',
          status: session.payment_status || 'processed',
          payload: session as Record<string, any>,
        });
        break;
      }
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
