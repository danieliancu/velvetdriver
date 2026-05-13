import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import Stripe from 'stripe';
import { getDbPool } from '@/lib/db';
import { getRequestIp, logSiteActivity } from '@/lib/site-activity';
import { buildJourneyLocationLines, resolveDropOffs } from '@/lib/journey-locations';

const pool = getDbPool();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' }) : null;
const ADMIN_CANCELLATION_EMAILS = ['roxy.viulet@gmail.com', 'daniiancu1978@gmail.com'];

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
  driver_id?: number | null;
  journey_date: string;
  pickup: string;
  destination: string;
  passenger_name: string | null;
  passenger_email: string | null;
  price: number | string | null;
  driver_name: string | null;
  booking_payload: unknown;
  client_email: string | null;
  payment_status?: string | null;
  ride_status?: string | null;
};

const HOLD_PAYMENT_STATUSES = new Set([
  'authorized',
  'authorization_updated',
  'additional_authorization_created',
  'requires_capture',
  'partially_captured',
]);

const isManualPaymentMethod = (value: string) => {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('invoice') ||
    normalized.includes('cash') ||
    normalized.includes('chauffeur') ||
    normalized.includes('driver') ||
    normalized.includes('bank transfer') ||
    normalized.includes('account')
  );
};

async function getClientJourneyColumns() {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_journeys'`
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '')));
}

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
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const clientJourneyColumns = await getClientJourneyColumns();
    const selectPaymentStatus = clientJourneyColumns.has('payment_status')
      ? 'cj.payment_status'
      : `JSON_UNQUOTE(JSON_EXTRACT(cj.booking_payload, '$.paymentStatus')) AS payment_status`;
    const selectRideStatus = clientJourneyColumns.has('ride_status')
      ? 'cj.ride_status'
      : `NULL AS ride_status`;
    const selectDriverId = clientJourneyColumns.has('driver_id') ? 'cj.driver_id' : 'NULL AS driver_id';

    const [rows] = await pool.query<BookingRow[]>(
      `SELECT cj.id,
              cj.status,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_email,
              cj.price,
              ${selectDriverId},
              cj.driver_name,
              cj.booking_payload,
              ${selectPaymentStatus},
              ${selectRideStatus},
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
    const paymentFlow = String(payload?.paymentFlow || '').trim().toLowerCase();
    const paymentMethod = String(payload?.paymentMethod || payload?.paymentType || '').trim();
    const paymentStatus = String(booking.payment_status || payload?.paymentStatus || '').trim().toLowerCase();
    const isCapturedPayment =
      paymentStatus === 'succeeded' ||
      paymentStatus === 'captured' ||
      paymentStatus === 'extra_charge_succeeded' ||
      paymentStatus === 'final_charge_succeeded';
    const isHoldAuthorization = HOLD_PAYMENT_STATUSES.has(paymentStatus);
    const isFlexibleNoChargeCancellation =
      paymentFlow === 'flexible_after_journey' &&
      !isCapturedPayment &&
      !isHoldAuthorization &&
      ['card_saved', 'payment_pending', 'authorization_pending'].includes(paymentStatus || 'card_saved');
    const isManualCancellation =
      !isCapturedPayment &&
      !isHoldAuthorization &&
      !isFlexibleNoChargeCancellation &&
      (paymentFlow === 'manual' || isManualPaymentMethod(paymentMethod) || paymentStatus === 'authorization_pending');
    if (
      (!paymentIntentId && !isFlexibleNoChargeCancellation && !isManualCancellation) ||
      (!isCapturedPayment && !isHoldAuthorization && !isFlexibleNoChargeCancellation && !isManualCancellation)
    ) {
      return NextResponse.json({ error: 'This job is not eligible for refund or hold cancellation.' }, { status: 400 });
    }
    if ((isCapturedPayment || isHoldAuthorization) && !stripe) {
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
    }
    if (String(payload?.refund?.status || '').trim().toLowerCase() === 'succeeded') {
      return NextResponse.json({ error: 'This booking has already been refunded.' }, { status: 409 });
    }

    let refundId: string | null = null;
    let refundAmount = 0;
    let action: 'refund' | 'cancel_hold' | 'cancel_no_charge' | 'manual_cancel' = 'refund';
    let clientMessage = 'Your booking has been cancelled and your payment has been refunded in full.';
    let driverMessage = 'The following job has been cancelled and removed from queue:';
    const nowIso = new Date().toISOString();

    if (isManualCancellation) {
      refundId = null;
      refundAmount = 0;
      action = 'manual_cancel';
      clientMessage = 'Your booking has been cancelled. No Stripe payment action was required for this payment method.';
    } else if (isFlexibleNoChargeCancellation) {
      refundId = null;
      refundAmount = 0;
      action = 'cancel_no_charge';
      clientMessage = 'Your booking has been cancelled. No payment has been taken and your saved card will not be charged.';
    } else if (isCapturedPayment) {
      const refund = await stripe!.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: { journeyId: String(journeyId) },
      });
      refundId = refund.id;
      refundAmount = Number(refund.amount || 0) / 100;
      action = 'refund';
    } else {
      const intent = await stripe!.paymentIntents.retrieve(paymentIntentId);
      if (!['canceled', 'succeeded'].includes(intent.status)) {
        await stripe!.paymentIntents.cancel(paymentIntentId, {
          cancellation_reason: 'requested_by_customer',
        });
      } else if (intent.status === 'succeeded') {
        const refund = await stripe!.refunds.create({
          payment_intent: paymentIntentId,
          reason: 'requested_by_customer',
          metadata: { journeyId: String(journeyId), recoveredFromStatus: intent.status },
        });
        refundId = refund.id;
        refundAmount = Number(refund.amount || 0) / 100;
        action = 'refund';
        clientMessage = 'Your booking has been cancelled and your payment has been refunded in full.';
      }
      if (action === 'refund') {
        // The intent was captured between listing and cancellation; refund path above has handled it.
      } else {
        refundId = paymentIntentId;
        refundAmount = Number(payload?.paymentAmount || payload?.totalFare || booking.price || 0);
        action = 'cancel_hold';
        clientMessage = 'Your booking has been cancelled and the Stripe card hold has been released.';
      }
    }

    const updatedPayload = {
      ...payload,
      refund:
        action === 'refund'
          ? {
              id: refundId,
              status: 'succeeded',
              amount: refundAmount,
              currency: 'GBP',
              createdAt: nowIso,
            }
          : payload.refund,
      authorizationCancellation:
        action === 'cancel_hold'
          ? {
              paymentIntentId,
              status: 'canceled',
              amount: refundAmount,
              currency: 'GBP',
              createdAt: nowIso,
            }
          : payload.authorizationCancellation,
        noChargeCancellation:
        action === 'cancel_no_charge'
          ? {
              status: 'canceled',
              amount: 0,
              currency: 'GBP',
              createdAt: nowIso,
            }
          : payload.noChargeCancellation,
      manualCancellation:
        action === 'manual_cancel'
          ? {
              status: 'canceled',
              paymentMethod,
              amount: 0,
              currency: 'GBP',
              createdAt: nowIso,
            }
          : payload.manualCancellation,
      cancellation: {
        source:
          action === 'refund'
            ? 'admin-refund'
            : action === 'cancel_hold'
              ? 'admin-cancel-hold'
              : action === 'cancel_no_charge'
                ? 'admin-cancel-no-charge'
                : 'admin-manual-cancel',
        reason:
          action === 'refund'
            ? 'Booking cancelled by admin and fully refunded.'
            : action === 'cancel_hold'
              ? 'Booking cancelled by admin and authorization hold released.'
              : action === 'cancel_no_charge'
                ? 'Booking cancelled by admin before final flexible fare charge.'
                : 'Booking cancelled by admin for a manual payment method.',
        at: nowIso,
      },
      paymentStatus: action === 'refund' ? 'refunded' : 'canceled',
    };

    const updateParts = [`status = 'Cancelled'`, `booking_payload = ?`, `updated_at = NOW()`];
    const updateParams: Array<string | number | null> = [JSON.stringify(updatedPayload)];
    if (clientJourneyColumns.has('payment_status')) {
      updateParts.push(`payment_status = ?`);
      updateParams.push(action === 'refund' ? 'canceled' : 'canceled');
    }
    if (clientJourneyColumns.has('ride_status')) {
      updateParts.push(`ride_status = ?`);
      updateParams.push('canceled');
    }
    if (clientJourneyColumns.has('captured_amount') && action === 'cancel_hold') {
      updateParts.push(`captured_amount = 0`);
    }
    updateParams.push(journeyId);
    await pool.execute(
      `UPDATE client_journeys
          SET ${updateParts.join(', ')}
        WHERE id = ?
        LIMIT 1`,
      updateParams
    );

    const bookingCode = `VD-${String(journeyId).padStart(4, '0')}`;
    const recipient = String(booking.client_email || booking.passenger_email || '').trim();
    const passengerName = String(booking.passenger_name || payload?.passengerName || 'Client').trim();
    const { date, time } = formatDate(String(booking.journey_date || ''));
    const routeLines = buildJourneyLocationLines(
      String(booking.pickup || ''),
      resolveDropOffs(String(booking.destination || ''), payload)
    );
    const routeHtml = routeLines
      .map((line) => `<strong>${escapeHtml(line.label)}:</strong> ${escapeHtml(line.value)}`)
      .join('<br />');
    const routeText = routeLines.map((line) => `${line.label}: ${line.value}`).join('\n');

    const warnings: string[] = [];

    if (recipient) {
      const clientSubject =
        action === 'refund'
          ? `Velvet Drivers - Booking cancelled and refunded ${bookingCode}`
          : action === 'cancel_hold'
            ? `Velvet Drivers - Booking cancelled and card hold released ${bookingCode}`
          : `Velvet Drivers - Booking cancelled ${bookingCode}`;
      const clientHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Booking Refunded</title></head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:20px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:6px; overflow:hidden;">
        <tr><td align="center" style="background:linear-gradient(90deg,#3A0511,#000000); padding:24px 20px;">
          <h1 style="margin:0; font-size:22px; color:#ffffff;">Velvet Drivers</h1>
          <p style="margin:8px 0 0; font-size:13px; color:#f2f2f2;">${action === 'refund' ? 'Cancellation & Refund Confirmation' : action === 'cancel_hold' ? 'Cancellation & Hold Release Confirmation' : 'Cancellation Confirmation'}</p>
        </td></tr>
        <tr><td style="padding:24px 26px; color:#333333; font-size:14px; line-height:1.6;">
          <p>Dear ${escapeHtml(passengerName)},</p>
          <p>${escapeHtml(clientMessage)}</p>
          <p><strong>Reference:</strong> ${escapeHtml(bookingCode)}<br />
             <strong>Journey:</strong> ${escapeHtml(date)} at ${escapeHtml(time)}<br />
             ${routeHtml}<br />
             <strong>${action === 'refund' ? 'Refunded Amount' : action === 'cancel_hold' ? 'Released Hold Amount' : 'Charged Amount'}:</strong> GBP ${refundAmount.toFixed(2)}</p>
          <p>${action === 'refund' ? 'The refund may take a short time to appear depending on your card issuer.' : action === 'cancel_hold' ? 'The hold release timing depends on the card issuer and may take a short time to show on the customer account.' : 'No Stripe payment action was required for this cancellation.'}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
      const clientText =
        `Booking ${bookingCode} was cancelled${action === 'refund' ? ' and refunded' : action === 'cancel_hold' ? ' and the card hold was released' : ''}.\n` +
        `${action === 'refund' ? 'Refunded amount' : action === 'cancel_hold' ? 'Released hold amount' : 'Charged amount'}: GBP ${refundAmount.toFixed(2)}.\n` +
        `${routeText}`;
      try {
        await sendEmail({ to: recipient, subject: clientSubject, html: clientHtml, text: clientText });
      } catch (err: any) {
        warnings.push(`Client email not sent: ${err?.message || 'unknown error'}`);
      }
    } else {
      warnings.push('Client email missing, refund email skipped.');
    }

    const driverNameRaw = String(booking.driver_id || booking.driver_name || '').trim();
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
          <p>${escapeHtml(driverMessage)}</p>
          <p><strong>Reference:</strong> ${escapeHtml(bookingCode)}<br />
             <strong>Journey:</strong> ${escapeHtml(date)} at ${escapeHtml(time)}<br />
             ${routeHtml}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
        const driverText =
          `Job ${bookingCode} has been cancelled and removed from queue.\n` +
          `${routeText}`;
        try {
          await sendEmail({ to: driver.email, subject: driverSubject, html: driverHtml, text: driverText });
        } catch (err: any) {
          warnings.push(`Driver email not sent: ${err?.message || 'unknown error'}`);
        }
      } else {
        warnings.push('Driver email missing, cancellation email skipped.');
      }
    }

    const adminSubject = `Velvet Drivers - Admin cancellation notice ${bookingCode}`;
    const adminActionLabel =
      action === 'refund'
        ? 'Refunded and cancelled'
      : action === 'cancel_hold'
        ? 'Cancelled and hold released'
        : action === 'manual_cancel'
          ? 'Cancelled without Stripe action'
          : 'Cancelled with no charge';
    const adminHtml = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Booking Cancelled</title></head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:20px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:6px; overflow:hidden;">
        <tr><td align="center" style="background:linear-gradient(90deg,#3A0511,#000000); padding:24px 20px;">
          <h1 style="margin:0; font-size:22px; color:#ffffff;">Velvet Drivers</h1>
          <p style="margin:8px 0 0; font-size:13px; color:#f2f2f2;">Admin Cancellation Notice</p>
        </td></tr>
        <tr><td style="padding:24px 26px; color:#333333; font-size:14px; line-height:1.6;">
          <p><strong>Status:</strong> ${escapeHtml(adminActionLabel)}</p>
          <p><strong>Reference:</strong> ${escapeHtml(bookingCode)}<br />
             <strong>Passenger:</strong> ${escapeHtml(passengerName)}<br />
             <strong>Journey:</strong> ${escapeHtml(date)} at ${escapeHtml(time)}<br />
             ${routeHtml}<br />
             <strong>Amount:</strong> GBP ${refundAmount.toFixed(2)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
    const adminText =
      `${adminActionLabel}: ${bookingCode}\n` +
      `Passenger: ${passengerName}\n` +
      `Journey: ${date} at ${time}\n` +
      `Amount: GBP ${refundAmount.toFixed(2)}\n` +
      `${routeText}`;
    for (const adminEmail of ADMIN_CANCELLATION_EMAILS) {
      try {
        await sendEmail({ to: adminEmail, subject: adminSubject, html: adminHtml, text: adminText });
      } catch (err: any) {
        warnings.push(`Admin email not sent to ${adminEmail}: ${err?.message || 'unknown error'}`);
      }
    }

    await logSiteActivity(pool, {
      tableName: 'client_journeys',
      operation: 'UPDATE',
      pk: journeyId,
      category: 'booking',
      title: action === 'refund' ? 'Booking refunded and cancelled' : 'Booking cancelled',
      message: `${bookingCode} was ${action === 'refund' ? 'refunded and cancelled' : 'cancelled and hold released'}.`,
      severity: 'warning',
      tags: {
        actor: 'admin',
        action,
        amount: refundAmount,
      },
      ip: getRequestIp(request),
      next: {
        bookingRef: bookingCode,
        status: 'Cancelled',
        refundAmount,
        action,
      },
    }).catch((err) => {
      console.error('Refund booking audit error', err);
    });

    return NextResponse.json({
      ok: true,
      refunded: action === 'refund',
      releasedHold: action === 'cancel_hold',
      canceledNoCharge: action === 'cancel_no_charge',
      manualCanceled: action === 'manual_cancel',
      refundId,
      amount: refundAmount,
      action,
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
