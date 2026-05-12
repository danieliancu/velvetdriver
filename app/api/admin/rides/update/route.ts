import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { calculateRideFare } from '@/lib/ride-fares';
import { loadRideForPayment, logRideChange, updateRideAuthorization } from '@/lib/ride-payments';
import { getRequestIp, logSiteActivity } from '@/lib/site-activity';

const pool = getDbPool();
const ADMIN_BOOKING_MODIFY_EMAILS = ['roxy.viulet@gmail.com', 'daniiancu1978@gmail.com'];
const TIME_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: '-', time: '-' };
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

const formatTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) {
    throw new Error('Email service is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
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

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || `Resend error ${response.status}`);
  }
}

async function resolveAssignedDriverRecipient(
  conn: mysql.PoolConnection,
  rideId: number
): Promise<{ email: string | null; name: string }> {
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT u.email AS driver_email,
            COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname)), ''), cj.driver_name) AS driver_name_display
       FROM client_journeys cj
       LEFT JOIN drivers d
         ON d.id = CASE
                     WHEN cj.driver_name REGEXP '^[0-9]+$' THEN CAST(cj.driver_name AS UNSIGNED)
                     ELSE NULL
                   END
       LEFT JOIN users u ON u.id = d.user_id
      WHERE cj.id = ?
      LIMIT 1`,
    [rideId]
  );

  const row = rows[0];
  return {
    email: row?.driver_email ? String(row.driver_email).trim().toLowerCase() : null,
    name: String(row?.driver_name_display || 'Chauffeur').trim() || 'Chauffeur',
  };
}

async function sendRideUpdateEmails(input: {
  rideId: number;
  clientEmail: string | null;
  clientName: string;
  passengerName: string;
  oldPrice: number;
  newPrice: number;
  oldDriverPrice: number | null;
  newDriverPrice: number | null;
  previousState: {
    journeyDate: string;
    pickup: string;
    destination: string;
  };
  nextState: {
    journeyDate: string;
    pickup: string;
    destination: string;
  };
  driverEmail: string | null;
  driverName: string;
}) {
  const warnings: string[] = [];
  const bookingCode = `VD-${String(input.rideId).padStart(4, '0')}`;
  const before = formatDateTime(input.previousState.journeyDate);
  const after = formatDateTime(input.nextState.journeyDate);
  const fareChangeLine =
    input.newPrice > input.oldPrice
      ? `Fare increased by GBP ${(input.newPrice - input.oldPrice).toFixed(2)}`
      : input.newPrice < input.oldPrice
        ? `Fare decreased by GBP ${(input.oldPrice - input.newPrice).toFixed(2)}`
        : 'No fare change';

  const summaryRows = `
    <tr><td style="padding:6px 0;font-weight:700;">Reference</td><td style="padding:6px 0;">${escapeHtml(bookingCode)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old pickup</td><td style="padding:6px 0;">${escapeHtml(input.previousState.pickup)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New pickup</td><td style="padding:6px 0;">${escapeHtml(input.nextState.pickup)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old destination</td><td style="padding:6px 0;">${escapeHtml(input.previousState.destination)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New destination</td><td style="padding:6px 0;">${escapeHtml(input.nextState.destination)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old date/time</td><td style="padding:6px 0;">${escapeHtml(`${before.date} ${before.time}`)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New date/time</td><td style="padding:6px 0;">${escapeHtml(`${after.date} ${after.time}`)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Old fare</td><td style="padding:6px 0;">GBP ${input.oldPrice.toFixed(2)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">New fare</td><td style="padding:6px 0;">GBP ${input.newPrice.toFixed(2)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Change</td><td style="padding:6px 0;">${escapeHtml(fareChangeLine)}</td></tr>
  `;

  if (input.clientEmail) {
    const clientHtml = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 16px;">Booking updated</h2>
    <p style="margin:0 0 16px;">Hello ${escapeHtml(input.clientName || input.passengerName || 'Client')}, your booking has been updated by our dispatch team.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;">${summaryRows}</table>
  </div>
</body>
</html>`;
    const clientText = [
      `Booking updated: ${bookingCode}`,
      `Old pickup: ${input.previousState.pickup}`,
      `New pickup: ${input.nextState.pickup}`,
      `Old destination: ${input.previousState.destination}`,
      `New destination: ${input.nextState.destination}`,
      `Old date/time: ${before.date} ${before.time}`,
      `New date/time: ${after.date} ${after.time}`,
      `Old fare: GBP ${input.oldPrice.toFixed(2)}`,
      `New fare: GBP ${input.newPrice.toFixed(2)}`,
      `Change: ${fareChangeLine}`,
    ].join('\n');
    try {
      await sendEmail({
        to: input.clientEmail,
        subject: `Velvet Drivers - Booking updated ${bookingCode}`,
        html: clientHtml,
        text: clientText,
      });
    } catch (err) {
      console.error('Admin ride update client email error', err);
      warnings.push('Ride updated, but client email could not be sent.');
    }
  }

  if (input.driverEmail) {
    const driverHtml = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 16px;">Assigned booking updated</h2>
    <p style="margin:0 0 16px;">Hello ${escapeHtml(input.driverName)}, booking ${escapeHtml(bookingCode)} assigned to you was updated by admin.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;">
      ${summaryRows}
      <tr><td style="padding:6px 0;font-weight:700;">Old your amount</td><td style="padding:6px 0;">${input.oldDriverPrice != null ? `GBP ${input.oldDriverPrice.toFixed(2)}` : '-'}</td></tr>
      <tr><td style="padding:6px 0;font-weight:700;">New your amount</td><td style="padding:6px 0;">${input.newDriverPrice != null ? `GBP ${input.newDriverPrice.toFixed(2)}` : '-'}</td></tr>
    </table>
  </div>
</body>
</html>`;
    const driverText = [
      `Assigned booking updated: ${bookingCode}`,
      `Passenger: ${input.passengerName}`,
      `New pickup: ${input.nextState.pickup}`,
      `New destination: ${input.nextState.destination}`,
      `New date/time: ${after.date} ${after.time}`,
      `Old your amount: ${input.oldDriverPrice != null ? `GBP ${input.oldDriverPrice.toFixed(2)}` : '-'}`,
      `New your amount: ${input.newDriverPrice != null ? `GBP ${input.newDriverPrice.toFixed(2)}` : '-'}`,
    ].join('\n');
    try {
      await sendEmail({
        to: input.driverEmail,
        subject: `Velvet Drivers - Booking updated ${bookingCode}`,
        html: driverHtml,
        text: driverText,
      });
    } catch (err) {
      console.error('Admin ride update driver email error', err);
      warnings.push('Ride updated, but driver email could not be sent.');
    }
  } else {
    warnings.push('Ride updated, but no allocated driver email was found.');
  }

  const adminHtml = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background:#f5f5f5;font-family:Arial,sans-serif;color:#111827;">
  <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
    <h2 style="margin:0 0 16px;">Booking updated by admin</h2>
    <p style="margin:0 0 16px;">Booking ${escapeHtml(bookingCode)} was updated by dispatch.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;">${summaryRows}</table>
  </div>
</body>
</html>`;
  const adminText = [
    `Booking updated by admin: ${bookingCode}`,
    `Passenger: ${input.passengerName}`,
    `Client: ${input.clientEmail || '-'}`,
    `New pickup: ${input.nextState.pickup}`,
    `New destination: ${input.nextState.destination}`,
    `New date/time: ${after.date} ${after.time}`,
    `Old fare: GBP ${input.oldPrice.toFixed(2)}`,
    `New fare: GBP ${input.newPrice.toFixed(2)}`,
    `Change: ${fareChangeLine}`,
  ].join('\n');
  try {
    await sendEmail({
      to: ADMIN_BOOKING_MODIFY_EMAILS,
      subject: `Velvet Drivers Admin - Booking updated ${bookingCode}`,
      html: adminHtml,
      text: adminText,
    });
  } catch (err) {
    console.error('Admin ride update admin email error', err);
    warnings.push('Ride updated, but admin email could not be sent.');
  }

  return warnings;
}

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const rideId = Number(body?.rideId);
    if (!rideId) {
      return NextResponse.json({ error: 'Missing ride id' }, { status: 400 });
    }

    await conn.beginTransaction();
    const ride = await loadRideForPayment(conn, rideId);
    const [existingRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT pickup, destination, journey_date, service_type, vehicle_type_id, booking_payload,
              passenger_name, passenger_email, price, driver_price
         FROM client_journeys
        WHERE id = ?
        LIMIT 1`,
      [rideId]
    );
    const existing = existingRows[0];
    if (!existing) throw new Error('Ride not found');
    let bookingPayload: Record<string, any> = {};
    if (existing.booking_payload) {
      try {
        bookingPayload =
          typeof existing.booking_payload === 'string'
            ? JSON.parse(existing.booking_payload)
            : existing.booking_payload;
      } catch {
        bookingPayload = {};
      }
    }
    if (String(bookingPayload.paymentFlow || '').toLowerCase() === 'fixed_pay_now') {
      await conn.rollback();
      return NextResponse.json({ error: 'Fixed Price bookings cannot have fare-changing edits.' }, { status: 409 });
    }

    const pickup = String(body?.pickup ?? existing.pickup ?? '').trim();
    const dropOffs = Array.isArray(body?.dropOffs)
      ? body.dropOffs.map((value: string) => String(value || '').trim()).filter(Boolean)
      : String(existing.destination || '')
          .split(', ')
          .map((value: string) => value.replace(/^Stop \d+:\s*/i, '').trim())
          .filter(Boolean);
    const serviceType = String(body?.serviceType ?? existing.service_type ?? 'Transfer');
    const vehicleTypeId = body?.vehicleTypeId ? Number(body.vehicleTypeId) : Number(existing.vehicle_type_id || 0) || null;
    const journeyDate = body?.journeyDate ? new Date(String(body.journeyDate)) : new Date(existing.journey_date);
    const timeEditLocked = new Date(existing.journey_date).getTime() - Date.now() < TIME_EDIT_WINDOW_MS;
    if (timeEditLocked && formatTimeValue(existing.journey_date) !== formatTimeValue(journeyDate)) {
      throw new Error('Pickup time can no longer be changed within 2 hours of the journey.');
    }
    const manualFare = body?.manualFare != null ? Number(body.manualFare) : null;
    const fare = manualFare != null
      ? { estimatedFare: Math.max(0, manualFare), baseFare: Math.max(0, manualFare), distanceMiles: Number(body?.distanceMiles ?? 0), hasTolls: Boolean(body?.tolls), extras: [] }
      : await calculateRideFare(conn, {
          pickup,
          dropOffs,
          serviceType,
          vehicleTypeId,
          waitingMinutes: body?.waitingMinutes ? Number(body.waitingMinutes) : null,
          tolls: body?.tolls ? Number(body.tolls) : null,
          surcharge: body?.surcharge ? Number(body.surcharge) : null,
          manualFareAdjustment: body?.manualFareAdjustment ? Number(body.manualFareAdjustment) : null,
          journeyTime: body?.journeyTime ? String(body.journeyTime) : null,
        });
    const destination = dropOffs
      .map((stop: string, index: number) => (index === dropOffs.length - 1 ? stop : `Stop ${index + 1}: ${stop}`))
      .join(', ');
    const journeyDateDb = journeyDate.toISOString().slice(0, 19).replace('T', ' ');

    await conn.execute(
      `UPDATE client_journeys
          SET pickup = ?, destination = ?, journey_date = ?, service_type = ?, vehicle_type_id = ?,
              price = ?, current_estimated_fare = ?, ride_status = 'trip_updated'
        WHERE id = ?
        LIMIT 1`,
      [
        pickup,
        destination,
        journeyDateDb,
        serviceType,
        vehicleTypeId,
        fare.estimatedFare,
        fare.estimatedFare,
        rideId,
      ]
    );

    await conn.execute(
      `UPDATE client_journeys
          SET booking_payload = ?
        WHERE id = ?
        LIMIT 1`,
      [
        JSON.stringify({
          ...bookingPayload,
          pickup,
          dropOffs,
          date: journeyDateDb.slice(0, 10),
          time: journeyDateDb.slice(11, 16),
          totalFare: fare.estimatedFare,
        }),
        rideId,
      ]
    );

    const paymentResult = await updateRideAuthorization(conn, {
      rideId,
      newEstimatedAmount: fare.estimatedFare,
      source: 'admin',
      reason: body?.reason ? String(body.reason) : 'admin_update',
      note: body?.note ? String(body.note) : null,
    });

    await logRideChange(conn, {
      rideId,
      changeSource: 'admin',
      changedByAdminId: body?.adminId ? Number(body.adminId) : null,
      changeReason: body?.reason ? String(body.reason) : 'admin_update',
      note: body?.note ? String(body.note) : null,
      previousSnapshot: {
        pickup: existing.pickup,
        destination: existing.destination,
        journeyDate: existing.journey_date,
        serviceType: existing.service_type,
        vehicleTypeId: existing.vehicle_type_id,
      },
      nextSnapshot: {
        pickup,
        dropOffs,
        journeyDate: journeyDate.toISOString(),
        serviceType,
        vehicleTypeId,
        estimatedFare: fare.estimatedFare,
      },
      fareBefore: Number(ride.current_estimated_fare ?? ride.price ?? 0),
      fareAfter: fare.estimatedFare,
      paymentAdjustmentStatus: paymentResult.strategy,
    });

    const driverRecipient = await resolveAssignedDriverRecipient(conn, rideId);
    await conn.commit();

    const emailWarnings = await sendRideUpdateEmails({
      rideId,
      clientEmail: existing.passenger_email ? String(existing.passenger_email).trim().toLowerCase() : null,
      clientName: String(bookingPayload.passengerName || existing.passenger_name || '').trim(),
      passengerName: String(existing.passenger_name || bookingPayload.passengerName || 'Client').trim(),
      oldPrice: Number(existing.price ?? ride.current_estimated_fare ?? ride.price ?? 0) || 0,
      newPrice: Number(fare.estimatedFare ?? 0) || 0,
      oldDriverPrice: existing.driver_price !== null && existing.driver_price !== undefined ? Number(existing.driver_price) : null,
      newDriverPrice: existing.driver_price !== null && existing.driver_price !== undefined
        ? Number((Number(existing.driver_price) || 0) + (Number(fare.estimatedFare || 0) - (Number(existing.price) || 0)))
        : null,
      previousState: {
        journeyDate: String(existing.journey_date || ''),
        pickup: String(existing.pickup || ''),
        destination: String(existing.destination || ''),
      },
      nextState: {
        journeyDate: journeyDate.toISOString(),
        pickup,
        destination,
      },
      driverEmail: driverRecipient.email,
      driverName: driverRecipient.name,
    });

    await logSiteActivity(pool, {
      tableName: 'client_journeys',
      operation: 'UPDATE',
      pk: rideId,
      category: 'booking',
      title: 'Ride updated by admin',
      message: `VD-${String(rideId).padStart(4, '0')} was updated by admin.`,
      severity: 'info',
      tags: {
        actor: 'admin',
        reason: body?.reason ? String(body.reason) : 'admin_route_update',
      },
      ip: getRequestIp(request),
      old: {
        pickup: existing.pickup,
        destination: existing.destination,
        journeyDate: String(existing.journey_date || ''),
        fare: Number(existing.price ?? 0) || 0,
      },
      next: {
        pickup,
        destination,
        journeyDate: journeyDate.toISOString(),
        fare: Number(fare.estimatedFare ?? 0) || 0,
      },
    }).catch((err) => {
      console.error('Ride update audit error', err);
    });

    return NextResponse.json({ ok: true, fare, payment: paymentResult, warnings: emailWarnings });
  } catch (err: any) {
    await conn.rollback();
    console.error('Admin ride update error', err);
    return NextResponse.json({ error: err?.message || 'Failed to update ride' }, { status: 500 });
  } finally {
    conn.release();
  }
}
