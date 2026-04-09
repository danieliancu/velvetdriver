import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

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

const buildNotes = (payload: any) => {
  const pieces = [
    payload?.flightNumber ? `Flight ${payload.flightNumber}` : null,
    payload?.specialEvents || null,
    payload?.notes || null,
  ].filter(Boolean);
  return pieces.length ? pieces.join(' - ') : '-';
};

const parseDropOffs = (destination: string, payload: any) => {
  if (Array.isArray(payload?.dropOffs)) {
    return payload.dropOffs.map((stop: unknown) => String(stop || '').trim()).filter(Boolean);
  }
  const trimmedDestination = String(destination || '').trim();
  return trimmedDestination ? [trimmedDestination] : [];
};

const buildJourneyLocationRows = (pickup: string, dropOffs: string[]) => {
  const cleanedStops = dropOffs.map((stop) => String(stop || '').trim()).filter(Boolean);
  const finalDestination = cleanedStops[cleanedStops.length - 1] || '';
  const intermediateStops = cleanedStops.slice(0, -1);

  const rows = [
    `<tr>
      <td style="padding:4px 0; font-weight:bold;">Pickup Location:</td>
      <td style="padding:4px 0;">${escapeHtml(pickup)}</td>
    </tr>`,
  ];

  if (!intermediateStops.length) {
    rows.push(`<tr>
      <td style="padding:4px 0; font-weight:bold;">Destination:</td>
      <td style="padding:4px 0;">${escapeHtml(finalDestination)}</td>
    </tr>`);
    return rows.join('');
  }

  intermediateStops.forEach((stop, index) => {
    rows.push(`<tr>
      <td style="padding:4px 0; font-weight:bold;">To</td>
      <td style="padding:4px 0;"></td>
    </tr>`);
    rows.push(`<tr>
      <td style="padding:4px 0; font-weight:bold;">Stop ${index + 1}:</td>
      <td style="padding:4px 0;">${escapeHtml(stop)}</td>
    </tr>`);
  });

  rows.push(`<tr>
    <td style="padding:4px 0; font-weight:bold;">To</td>
    <td style="padding:4px 0;"></td>
  </tr>`);
  rows.push(`<tr>
    <td style="padding:4px 0; font-weight:bold;">Destination:</td>
    <td style="padding:4px 0;">${escapeHtml(finalDestination)}</td>
  </tr>`);

  return rows.join('');
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_email,
              cj.price,
              cj.booking_payload,
              cj.vehicle_type_id,
              u.email AS client_email
         FROM client_journeys cj
         LEFT JOIN users u ON cj.client_id = u.id
        WHERE cj.id = ?
        LIMIT 1`,
      [journeyId]
    );

    const booking = rows[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const recipient = booking.client_email || booking.passenger_email;
    if (!recipient) {
      return NextResponse.json({ error: 'No client email available' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    if (!resendApiKey || !emailFrom) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    let payload: any = null;
    if (booking.booking_payload) {
      try {
        payload =
          typeof booking.booking_payload === 'string'
            ? JSON.parse(booking.booking_payload)
            : booking.booking_payload;
      } catch {
        payload = null;
      }
    }

    const [vehicleRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT label FROM pricing_vehicles WHERE id = ? LIMIT 1`,
      [booking.vehicle_type_id]
    );
    const vehicleLabel =
      vehicleRows[0]?.label ||
      payload?.vehicle ||
      payload?.vehicleLabel ||
      payload?.vehicleTypeLabel ||
      'Executive';

    const { date, time } = formatDate(String(booking.journey_date));
    const code = `VD-${String(booking.id).padStart(4, '0')}`;
    const passengerName = booking.passenger_name || payload?.passengerName || 'Client';
    const pickup = booking.pickup || '';
    const dropOffs = parseDropOffs(String(booking.destination || ''), payload);
    const finalDestination = dropOffs[dropOffs.length - 1] || '';
    const journeyLocationRows = buildJourneyLocationRows(pickup, dropOffs);
    const passengerCount =
      Number(payload?.passengerCount || payload?.passengers || payload?.numberOfPassengers || 1) || 1;
    const notes = buildNotes(payload);
    const fareAmount = Number(booking.price ?? payload?.totalFare ?? 0) || 0;
    const paymentMethod = payload?.paymentMethod || payload?.paymentType || 'Card';

    const subject = `Velvet Drivers - Booking confirmation ${code}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Velvet Drivers - Booking Confirmation</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:6px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background:linear-gradient(90deg,#3A0511,#000000); padding:24px 20px;">
              <h1 style="margin:0; font-size:22px; color:#ffffff; letter-spacing:1px; text-transform:uppercase;">
                Velvet Drivers
              </h1>
              <p style="margin:8px 0 0; font-size:13px; color:#f2f2f2;">
                Booking Confirmation
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 26px 10px; color:#333333; font-size:14px; line-height:1.6;">
              <p style="margin-top:0;">Dear ${escapeHtml(passengerName)},</p>
              <p>
                Thank you for choosing <strong>Velvet Drivers Limited</strong>. Your booking has been
                <strong>successfully confirmed</strong>. Please find your journey details below.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Journey Details
              </h2>

              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#333333;">
                <tr>
                  <td width="40%" style="padding:4px 0; font-weight:bold;">Booking Reference:</td>
                  <td width="60%" style="padding:4px 0;">${escapeHtml(code)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Pickup Date &amp; Time:</td>
                  <td style="padding:4px 0;">${escapeHtml(date)} at ${escapeHtml(time)}</td>
                </tr>
                ${journeyLocationRows}
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Vehicle Type:</td>
                  <td style="padding:4px 0;">${escapeHtml(vehicleLabel)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Passengers:</td>
                  <td style="padding:4px 0;">${passengerCount}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold; vertical-align:top;">Notes:</td>
                  <td style="padding:4px 0;">${escapeHtml(notes)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Driver Allocation
              </h2>
              <p style="margin:0; font-size:14px; color:#333333;">
                A licensed Velvet Drivers chauffeur will be allocated shortly. You will receive a separate notification
                once the driver is assigned.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Payment Information
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#333333;">
                <tr>
                  <td width="40%" style="padding:4px 0; font-weight:bold;">Fare:</td>
                  <td width="60%" style="padding:4px 0;">&pound;${fareAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Payment Method:</td>
                  <td style="padding:4px 0;">${escapeHtml(paymentMethod)}</td>
                </tr>
              </table>
              <p style="margin:6px 0 0; font-size:13px; color:#555555;">
                A receipt or invoice will be issued automatically after your journey, in line with our Payment &amp; Refund Policy.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Contact &amp; Support
              </h2>
              <p style="margin:0 0 4px; font-size:14px; color:#333333;">
                If you have any questions, changes or special requests, please contact us:
              </p>
              <p style="margin:0; font-size:14px; color:#333333;">
                Phone: <strong>0208 175 9186</strong><br />
                Email: <a href="mailto:bookings@velvetdrivers.co.uk" style="color:#3A0511; text-decoration:none;">bookings@velvetdrivers.co.uk</a><br />
                Website: <a href="https://www.velvetdrivers.co.uk" style="color:#3A0511; text-decoration:none;">www.velvetdrivers.co.uk</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 20px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Important Information
              </h2>
              <ul style="margin:0; padding-left:18px; font-size:13px; color:#555555;">
                <li>All journeys must be pre-booked through Velvet Drivers Limited.</li>
                <li>Drivers cannot accept street hails or unbooked journeys.</li>
                <li>Cancellations and changes are subject to our Cancellation &amp; Refund Policy.</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td align="center" style="background-color:#f7f7f7; padding:14px 20px;">
              <p style="margin:0; font-size:12px; color:#777777;">
                Velvet Drivers Limited - Where luxury meets professionalism.
              </p>
              <p style="margin:4px 0 0; font-size:11px; color:#aaaaaa;">
                This email is an automatic booking confirmation. Please do not reply directly; use the contact details above.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

    const text = `Booking confirmed for ${passengerName}. Reference ${code}. Pickup ${pickup}. Drop-off ${finalDestination}.`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: recipient,
        subject,
        html,
        text,
      }),
    });

    if (!resendRes.ok) {
      const data = await resendRes.json().catch(() => ({}));
      return NextResponse.json({ error: data?.message || 'Failed to send confirmation email' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Client confirmation email error', err);
    return NextResponse.json({ error: 'Failed to send confirmation email' }, { status: 500 });
  }
}
