import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import Stripe from 'stripe';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' }) : null;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

type BookingRow = mysql.RowDataPacket & {
  id: number;
  status: string;
  journey_date: string;
  pickup: string;
  destination: string;
  passenger_name: string | null;
  passenger_email: string | null;
  price: number | string | null;
  driver_name: string | null;
  booking_payload: unknown;
  client_email: string | null;
};

async function resolveDriverEmail(rawDriver: string) {
  if (!rawDriver) return { name: '', email: '' };
  const parsedId = Number(rawDriver);
  let rows: mysql.RowDataPacket[] = [];
  if (Number.isFinite(parsedId)) {
    const [result] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT CONCAT_WS(' ', d.first_and_middle_name, d.surname) AS name, u.email
         FROM drivers d
         LEFT JOIN users u ON u.id = d.user_id
        WHERE d.id = ?
        LIMIT 1`,
      [parsedId]
    );
    rows = result;
  }
  if (!rows.length) {
    const [result] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT CONCAT_WS(' ', d.first_and_middle_name, d.surname) AS name, u.email
         FROM drivers d
         LEFT JOIN users u ON u.id = d.user_id
        WHERE LOWER(TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname))) = LOWER(TRIM(?))
        LIMIT 1`,
      [rawDriver]
    );
    rows = result;
  }
  const row = rows[0];
  return {
    name: String(row?.name || rawDriver).trim(),
    email: String(row?.email || '').trim(),
  };
}

async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) {
    throw new Error('Email service not configured');
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.message || `Email send failed (${res.status})`);
  }
}

export async function POST(request: Request) {
  try {
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }

    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const [rows] = await pool.query<BookingRow[]>(
      `SELECT cj.id,
              cj.status,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_email,
              cj.price,
              cj.driver_name,
              cj.booking_payload,
              u.email AS client_email
         FROM client_journeys cj
         LEFT JOIN users u ON u.id = cj.client_id
        WHERE cj.id = ?
        LIMIT 1`,
      [journeyId]
    );
    const booking = rows[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }
    if (booking.status !== 'Upcoming') {
      return NextResponse.json({ error: 'Only active jobs can be refunded from queue.' }, { status: 400 });
    }

    let payload: Record<string, any> = {};
    if (booking.booking_payload) {
      try {
        payload =
          typeof booking.booking_payload === 'string'
            ? JSON.parse(booking.booking_payload)
            : (booking.booking_payload as Record<string, any>);
      } catch {
        payload = {};
      }
    }

    const paymentIntentId = String(payload?.paymentIntentId || '').trim();
    const paymentStatus = String(payload?.paymentStatus || '').trim().toLowerCase();
    if (!paymentIntentId || paymentStatus !== 'succeeded') {
      return NextResponse.json({ error: 'This job is not eligible for refund.' }, { status: 400 });
    }
    if (String(payload?.refund?.status || '').trim().toLowerCase() === 'succeeded') {
      return NextResponse.json({ error: 'This booking has already been refunded.' }, { status: 409 });
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: 'requested_by_customer',
      metadata: { journeyId: String(journeyId) },
    });

    const refundAmount = Number(refund.amount || 0) / 100;
    const nowIso = new Date().toISOString();
    const updatedPayload = {
      ...payload,
      refund: {
        id: refund.id,
        status: refund.status,
        amount: refundAmount,
        currency: String(refund.currency || 'gbp').toUpperCase(),
        createdAt: nowIso,
      },
      cancellation: {
        source: 'admin-refund',
        reason: 'Booking cancelled by admin and fully refunded.',
        at: nowIso,
      },
    };

    await pool.execute(
      `UPDATE client_journeys
          SET status = 'Cancelled',
              booking_payload = ?,
              updated_at = NOW()
        WHERE id = ?
        LIMIT 1`,
      [JSON.stringify(updatedPayload), journeyId]
    );

    const bookingCode = `VD-${String(journeyId).padStart(4, '0')}`;
    const recipient = String(booking.client_email || booking.passenger_email || '').trim();
    const passengerName = String(booking.passenger_name || payload?.passengerName || 'Client').trim();
    const { date, time } = formatDate(String(booking.journey_date || ''));

    const warnings: string[] = [];

    if (recipient) {
      const clientSubject = `Velvet Drivers - Booking cancelled and refunded ${bookingCode}`;
      const clientHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Booking Refunded</title></head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:20px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:6px; overflow:hidden;">
        <tr><td align="center" style="background:linear-gradient(90deg,#3A0511,#000000); padding:24px 20px;">
          <h1 style="margin:0; font-size:22px; color:#ffffff;">Velvet Drivers</h1>
          <p style="margin:8px 0 0; font-size:13px; color:#f2f2f2;">Cancellation & Refund Confirmation</p>
        </td></tr>
        <tr><td style="padding:24px 26px; color:#333333; font-size:14px; line-height:1.6;">
          <p>Dear ${escapeHtml(passengerName)},</p>
          <p>Your booking has been cancelled and your payment has been refunded in full.</p>
          <p><strong>Reference:</strong> ${escapeHtml(bookingCode)}<br />
             <strong>Journey:</strong> ${escapeHtml(date)} at ${escapeHtml(time)}<br />
             <strong>Route:</strong> ${escapeHtml(String(booking.pickup || ''))} to ${escapeHtml(String(booking.destination || ''))}<br />
             <strong>Refunded Amount:</strong> GBP ${refundAmount.toFixed(2)}</p>
          <p>The refund may take a short time to appear depending on your card issuer.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
      const clientText =
        `Booking ${bookingCode} was cancelled and refunded.\n` +
        `Refunded amount: GBP ${refundAmount.toFixed(2)}.\n` +
        `Route: ${booking.pickup} -> ${booking.destination}.`;
      try {
        await sendEmail({ to: recipient, subject: clientSubject, html: clientHtml, text: clientText });
      } catch (err: any) {
        warnings.push(`Client email not sent: ${err?.message || 'unknown error'}`);
      }
    } else {
      warnings.push('Client email missing, refund email skipped.');
    }

    const driverNameRaw = String(booking.driver_name || '').trim();
    if (driverNameRaw && driverNameRaw.toLowerCase() !== 'pending assignment') {
      const driver = await resolveDriverEmail(driverNameRaw);
      if (driver.email) {
        const driverSubject = `Velvet Drivers - Job cancellation ${bookingCode}`;
        const driverHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Job Cancelled</title></head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:20px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:6px; overflow:hidden;">
        <tr><td align="center" style="background:linear-gradient(90deg,#3A0511,#000000); padding:24px 20px;">
          <h1 style="margin:0; font-size:22px; color:#ffffff;">Velvet Drivers</h1>
          <p style="margin:8px 0 0; font-size:13px; color:#f2f2f2;">Driver Cancellation Notice</p>
        </td></tr>
        <tr><td style="padding:24px 26px; color:#333333; font-size:14px; line-height:1.6;">
          <p>Dear ${escapeHtml(driver.name || 'Driver')},</p>
          <p>The following job has been cancelled and removed from queue:</p>
          <p><strong>Reference:</strong> ${escapeHtml(bookingCode)}<br />
             <strong>Journey:</strong> ${escapeHtml(date)} at ${escapeHtml(time)}<br />
             <strong>Route:</strong> ${escapeHtml(String(booking.pickup || ''))} to ${escapeHtml(String(booking.destination || ''))}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
        const driverText =
          `Job ${bookingCode} has been cancelled and removed from queue.\n` +
          `Route: ${booking.pickup} -> ${booking.destination}.`;
        try {
          await sendEmail({ to: driver.email, subject: driverSubject, html: driverHtml, text: driverText });
        } catch (err: any) {
          warnings.push(`Driver email not sent: ${err?.message || 'unknown error'}`);
        }
      } else {
        warnings.push('Driver email missing, cancellation email skipped.');
      }
    }

    return NextResponse.json({
      ok: true,
      refunded: true,
      refundId: refund.id,
      amount: refundAmount,
      warning: warnings.length ? warnings.join(' ') : undefined,
    });
  } catch (err: any) {
    console.error('Refund booking error', err);
    const message =
      err?.type === 'StripeInvalidRequestError'
        ? err?.message || 'Stripe refund failed'
        : 'Failed to refund booking';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
