import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { requireStripe, toStripeAmount } from '@/lib/stripe-server';

const pool = getDbPool();

const VALID_ACTIONS = new Set(['collected', 'not_collected', 'send_payment_link']);

const parsePayload = (value: unknown) => {
  if (!value) return {};
  try {
    return typeof value === 'string' ? JSON.parse(value) : (value as Record<string, any>);
  } catch {
    return {};
  }
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

async function sendPaymentLinkEmail(input: {
  to: string;
  passengerName: string;
  bookingCode: string;
  amount: number;
  url: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom || !input.to) return false;

  const html = `
    <h2>Payment required for ${escapeHtml(input.bookingCode)}</h2>
    <p>Dear ${escapeHtml(input.passengerName || 'Client')},</p>
    <p>Your chauffeur reported that payment was not collected in the vehicle. Please pay the outstanding fare using the secure Stripe link below.</p>
    <p><strong>Amount:</strong> GBP ${input.amount.toFixed(2)}</p>
    <p><a href="${escapeHtml(input.url)}">Pay securely by card</a></p>
  `;
  const text = [
    `Payment required for ${input.bookingCode}`,
    `Amount: GBP ${input.amount.toFixed(2)}`,
    `Pay securely by card: ${input.url}`,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: input.to,
      subject: `Velvet Drivers - Payment link ${input.bookingCode}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || `Resend error ${response.status}`);
  }
  return true;
}

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    const action = String(body?.action || '').trim();
    if (!journeyId || !VALID_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid collection action' }, { status: 400 });
    }

    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, price, passenger_name, passenger_email, booking_payload
         FROM client_journeys
        WHERE id = ?
        LIMIT 1`,
      [journeyId]
    );
    const booking = rows[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const payload = parsePayload(booking.booking_payload);
    const amount = Math.max(0, Number(booking.price ?? payload?.totalFare ?? 0) || 0);
    const bookingCode = `VD-${String(journeyId).padStart(4, '0')}`;

    if (action === 'collected' || action === 'not_collected') {
      const paymentStatus = action === 'collected' ? 'collected_by_driver' : 'not_collected';
      const nextPayload = {
        ...payload,
        paymentStatus,
        driverCollectionStatus: paymentStatus,
        driverCollectionUpdatedAt: new Date().toISOString(),
      };
      await conn.execute(
        `UPDATE client_journeys
            SET payment_status = ?,
                ride_status = ?,
                booking_payload = ?,
                updated_at = NOW()
          WHERE id = ?
          LIMIT 1`,
        [paymentStatus, paymentStatus, JSON.stringify(nextPayload), journeyId]
      );
      return NextResponse.json({ ok: true, paymentStatus });
    }

    const stripe = requireStripe();
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'gbp',
            product_data: {
              name: `Velvet Drivers booking ${bookingCode}`,
            },
            unit_amount: toStripeAmount(amount),
          },
          quantity: 1,
        },
      ],
      customer_email: String(booking.passenger_email || payload?.passengerEmail || '') || undefined,
      success_url: `${origin}/?payment=success&booking=${encodeURIComponent(bookingCode)}`,
      cancel_url: `${origin}/?payment=cancelled&booking=${encodeURIComponent(bookingCode)}`,
      payment_intent_data: {
        metadata: {
          rideId: String(journeyId),
          paymentFlow: 'stripe_payment_link',
          bookingRef: bookingCode,
        },
      },
      metadata: {
        rideId: String(journeyId),
        paymentFlow: 'stripe_payment_link',
        bookingRef: bookingCode,
      },
    });

    const paymentLinkUrl = session.url || '';
    const nextPayload = {
      ...payload,
      paymentStatus: 'payment_link_sent',
      driverCollectionStatus: 'payment_link_sent',
      stripePaymentLinkUrl: paymentLinkUrl,
      stripeCheckoutSessionId: session.id,
      paymentLinkSentAt: new Date().toISOString(),
    };
    await conn.execute(
      `UPDATE client_journeys
          SET payment_status = 'payment_link_sent',
              ride_status = 'payment_link_sent',
              booking_payload = ?,
              updated_at = NOW()
        WHERE id = ?
        LIMIT 1`,
      [JSON.stringify(nextPayload), journeyId]
    );

    const emailSent = await sendPaymentLinkEmail({
      to: String(booking.passenger_email || payload?.passengerEmail || ''),
      passengerName: String(booking.passenger_name || payload?.passengerName || 'Client'),
      bookingCode,
      amount,
      url: paymentLinkUrl,
    });

    return NextResponse.json({ ok: true, paymentStatus: 'payment_link_sent', paymentLinkUrl, emailSent });
  } catch (err: any) {
    console.error('Driver collection action error', err);
    return NextResponse.json({ error: err?.message || 'Failed to update collection status' }, { status: 500 });
  } finally {
    conn.release();
  }
}
