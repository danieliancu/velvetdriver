import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { consumeClientCredit, getClientCreditBalance } from '@/lib/client-credit';
import { persistBookingAuthorization } from '@/lib/ride-payments';

const pool = getDbPool();
const ADMIN_BOOKING_NOTIFICATION_EMAILS = ['roxy.viulet@gmail.com', 'dani.iancu@yahoo.com'];

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateForEmail = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value || '-';
  return `${match[3]}/${match[2]}/${match[1]}`;
};

const formatTimeForEmail = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '-';
  return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
};

async function sendAdminBookingCreatedEmail(input: {
  journeyId: number;
  date: string;
  time: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  pickup: string;
  destination: string;
  serviceType: string;
  totalFare: number;
  paymentMethod: string;
  amountDueNow: number;
  appliedCreditAmount: number;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) return;

  const bookingCode = `VD-${String(input.journeyId).padStart(4, '0')}`;
  const formattedDate = formatDateForEmail(input.date);
  const formattedTime = formatTimeForEmail(input.time);
  const paymentMethodLabel = input.paymentMethod || 'Not specified';
  const html = `
    <h2>New booking received (${escapeHtml(bookingCode)})</h2>
    <p>A new booking was created on the website.</p>
    <p><strong>Booking ref:</strong> ${escapeHtml(bookingCode)}</p>
    <p><strong>Date:</strong> ${escapeHtml(formattedDate)}</p>
    <p><strong>Time:</strong> ${escapeHtml(formattedTime)}</p>
    <p><strong>Passenger:</strong> ${escapeHtml(input.passengerName || 'N/A')}</p>
    <p><strong>Email:</strong> ${escapeHtml(input.passengerEmail || 'N/A')}</p>
    <p><strong>Phone:</strong> ${escapeHtml(input.passengerPhone || 'N/A')}</p>
    <p><strong>Pickup:</strong> ${escapeHtml(input.pickup || 'N/A')}</p>
    <p><strong>Destination:</strong> ${escapeHtml(input.destination || 'N/A')}</p>
    <p><strong>Service:</strong> ${escapeHtml(input.serviceType || 'Transfer')}</p>
    <p><strong>Estimated fare:</strong> GBP ${input.totalFare.toFixed(2)}</p>
    <p><strong>Payment method:</strong> ${escapeHtml(paymentMethodLabel)}</p>
    <p><strong>Amount due now:</strong> GBP ${input.amountDueNow.toFixed(2)}</p>
    <p><strong>Credit applied:</strong> GBP ${input.appliedCreditAmount.toFixed(2)}</p>
  `;
  const text = [
    `New booking received (${bookingCode})`,
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Passenger: ${input.passengerName || 'N/A'}`,
    `Email: ${input.passengerEmail || 'N/A'}`,
    `Phone: ${input.passengerPhone || 'N/A'}`,
    `Pickup: ${input.pickup || 'N/A'}`,
    `Destination: ${input.destination || 'N/A'}`,
    `Service: ${input.serviceType || 'Transfer'}`,
    `Estimated fare: GBP ${input.totalFare.toFixed(2)}`,
    `Payment method: ${paymentMethodLabel}`,
    `Amount due now: GBP ${input.amountDueNow.toFixed(2)}`,
    `Credit applied: GBP ${input.appliedCreditAmount.toFixed(2)}`,
  ].join('\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: ADMIN_BOOKING_NOTIFICATION_EMAILS,
      subject: `Velvet Drivers Admin - New booking ${bookingCode}`,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || `Resend error ${response.status}`);
  }
}

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const pickup = String(body.pickup ?? '').trim();
    const dropOffs = Array.isArray(body.dropOffs) ? body.dropOffs.map((d: string) => String(d ?? '').trim()).filter(Boolean) : [];
    const date = String(body.date ?? '').trim();
    const time = String(body.time ?? '').trim();
    const passengerName = String(body.passengerName ?? '').trim();
    const passengerEmail = String(body.passengerEmail ?? '').trim();
    const passengerPhone = String(body.passengerPhone ?? '').trim();
    const paymentMethod = String(body.paymentMethod ?? '').trim();
    const paymentIntentId = String(body.paymentIntentId ?? '').trim();
    const totalFare = Math.max(0, Number(body.totalFare ?? 0));
    const requestedAppliedCredit = Math.max(0, Number(body.appliedCreditAmount ?? 0));
    if (!pickup || !dropOffs.length || !date || !time || !passengerName || !passengerEmail || !passengerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const journeyDate = new Date(`${date}T${time}`);
    if (Number.isNaN(journeyDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 });
    }

    let clientId: number | null = null;
    const clientLookupEmail = String(body.clientEmail ?? passengerEmail ?? '').trim().toLowerCase();
    if (clientLookupEmail) {
      const [users] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [clientLookupEmail]);
      if (users[0]?.id) clientId = Number(users[0].id);
    }

    let appliedCreditAmount = 0;
    if (clientId) {
      const availableCredit = await getClientCreditBalance(conn, clientId);
      appliedCreditAmount = Math.min(totalFare, availableCredit, requestedAppliedCredit);
    }
    const amountDueNow = Math.max(0, Math.round((totalFare - appliedCreditAmount) * 100) / 100);
    if (paymentMethod.toLowerCase() === 'card authorization' && amountDueNow > 0 && !paymentIntentId) {
      return NextResponse.json({ error: 'Missing authorized payment intent' }, { status: 400 });
    }

    const destination = dropOffs
      .map((stop: string, index: number) => (index === dropOffs.length - 1 ? stop : `Stop ${index + 1}: ${stop}`))
      .join(', ');
    const payload = {
      ...body,
      pickup,
      dropOffs,
      totalFare,
      appliedCreditAmount,
      amountDueNow,
      paymentStatus:
        paymentMethod.toLowerCase() === 'card authorization'
          ? 'authorized'
          : paymentMethod.toLowerCase() === 'credit'
            ? 'captured'
            : 'authorization_pending',
    };

    await conn.beginTransaction();
    const [result] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO client_journeys
        (client_id, journey_date, pickup, destination, service_type, driver_name, car, plate, status, ride_status,
         payment_status, price, original_estimated_fare, current_estimated_fare, final_fare, originally_authorized_amount,
         latest_authorized_amount, captured_amount, invoice_url, passenger_name, passenger_email, passenger_phone,
         vehicle_type_id, booking_payload)
       VALUES (?, ?, ?, ?, ?, 'Pending assignment', 'TBD', 'TBD', 'Upcoming', ?, ?, ?, ?, ?, NULL, 0, 0, 0, NULL, ?, ?, ?, ?, ?)`,
      [
        clientId,
        journeyDate.toISOString().slice(0, 19).replace('T', ' '),
        pickup,
        destination,
        String(body.serviceType ?? 'Transfer'),
        paymentMethod.toLowerCase() === 'card authorization' ? 'payment_authorized' : 'booked',
        paymentMethod.toLowerCase() === 'card authorization'
          ? 'authorized'
          : paymentMethod.toLowerCase() === 'credit'
            ? 'captured'
            : 'authorization_pending',
        totalFare,
        totalFare,
        totalFare,
        passengerName,
        passengerEmail,
        passengerPhone,
        body.vehicleTypeId ? Number(body.vehicleTypeId) : null,
        JSON.stringify(payload),
      ]
    );
    const rideId = Number(result.insertId);

    if (clientId && appliedCreditAmount > 0) {
      await consumeClientCredit(conn, {
        clientId,
        journeyId: rideId,
        amount: appliedCreditAmount,
        reason: 'Applied to booking authorization',
        metadata: { source: 'booking', totalFare, amountDueNow },
      });
    }

    if (paymentMethod.toLowerCase() === 'card authorization' && amountDueNow > 0) {
      await persistBookingAuthorization(conn, { rideId, paymentIntentId, estimatedAmount: amountDueNow });
    } else if (paymentMethod.toLowerCase() === 'credit') {
      await conn.execute(
        `UPDATE client_journeys
            SET payment_status = 'captured',
                ride_status = 'payment_captured',
                originally_authorized_amount = 0,
                latest_authorized_amount = 0,
                captured_amount = 0
          WHERE id = ?
          LIMIT 1`,
        [rideId]
      );
    }

    await conn.commit();

    try {
      await sendAdminBookingCreatedEmail({
        journeyId: rideId,
        date,
        time,
        passengerName,
        passengerEmail,
        passengerPhone,
        pickup,
        destination,
        serviceType: String(body.serviceType ?? 'Transfer'),
        totalFare,
        paymentMethod,
        amountDueNow,
        appliedCreditAmount,
      });
    } catch (emailErr) {
      console.error('Admin booking create email error', emailErr);
    }

    return NextResponse.json({ success: true, journeyId: rideId });
  } catch (err: any) {
    await conn.rollback();
    console.error('Booking create error', err);
    return NextResponse.json({ error: err?.message || 'Failed to submit booking' }, { status: 500 });
  } finally {
    conn.release();
  }
}
