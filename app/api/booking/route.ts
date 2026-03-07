import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { createOrUpdatePaidInvoice } from '@/lib/client-invoices';

const pool = getDbPool();
const BOOKING_PAYMENT_NOTIFICATION_RECIPIENTS = ['roxy.viulet@gmail.com', 'dani.iancu@yahoo.com'];

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

const sendPaymentEmail = async (payload: {
  journeyId: number;
  journeyDate: string;
  pickup: string;
  destination: string;
  passengerName: string;
  passengerEmail: string;
  totalFare: number;
  paymentIntentId?: string;
  paymentMethod?: string;
  invoiceAttachmentBase64?: string;
  invoiceFileName?: string;
}) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) return;

  const { date, time } = formatDate(payload.journeyDate);
  const code = `VD-${String(payload.journeyId).padStart(4, '0')}`;
  const subject = `Velvet Drivers - Payment received ${code}`;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Velvet Drivers - Payment Receipt</title>
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
                Payment Receipt
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 26px 10px; color:#333333; font-size:14px; line-height:1.6;">
              <p style="margin-top:0;">Dear ${escapeHtml(payload.passengerName)},</p>
              <p>Thank you for your payment. Your booking is confirmed.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Booking Summary
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
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Pickup:</td>
                  <td style="padding:4px 0;">${escapeHtml(payload.pickup)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Destination:</td>
                  <td style="padding:4px 0;">${escapeHtml(payload.destination)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Amount Paid:</td>
                  <td style="padding:4px 0;">&pound;${payload.totalFare.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Payment Method:</td>
                  <td style="padding:4px 0;">${escapeHtml(payload.paymentMethod || 'Card')}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Payment Ref:</td>
                  <td style="padding:4px 0;">${escapeHtml(payload.paymentIntentId || '-')}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#f7f7f7; padding:14px 20px;">
              <p style="margin:0; font-size:12px; color:#777777;">
                Velvet Drivers Limited - Where luxury meets professionalism.
              </p>
              <p style="margin:4px 0 0; font-size:11px; color:#aaaaaa;">
                This is an automated payment receipt. Please keep it for your records.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: payload.passengerEmail,
      subject,
      html,
      text: `Payment received for booking ${code}. Amount GBP${payload.totalFare.toFixed(2)}.`,
      attachments:
        payload.invoiceAttachmentBase64 && payload.invoiceFileName
          ? [
              {
                filename: payload.invoiceFileName,
                content: payload.invoiceAttachmentBase64,
              },
            ]
          : undefined,
    }),
  }).catch((err) => {
    console.error('Failed to send payment email', err);
  });
};

const sendInternalPaymentNotification = async (payload: {
  journeyId: number;
  journeyDate: string;
  pickup: string;
  destination: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  totalFare: number;
  paymentIntentId?: string;
  paymentMethod?: string;
}) => {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) return;

  const { date, time } = formatDate(payload.journeyDate);
  const code = `VD-${String(payload.journeyId).padStart(4, '0')}`;
  const subject = `New paid booking ${code}`;
  const html = `
    <h2>New paid booking received</h2>
    <p><strong>Reference:</strong> ${escapeHtml(code)}</p>
    <p><strong>Date &amp; time:</strong> ${escapeHtml(date)} ${escapeHtml(time)}</p>
    <p><strong>Passenger:</strong> ${escapeHtml(payload.passengerName)}</p>
    <p><strong>Email:</strong> ${escapeHtml(payload.passengerEmail)}</p>
    <p><strong>Phone:</strong> ${escapeHtml(payload.passengerPhone)}</p>
    <p><strong>Pickup:</strong> ${escapeHtml(payload.pickup)}</p>
    <p><strong>Destination:</strong> ${escapeHtml(payload.destination)}</p>
    <p><strong>Amount paid:</strong> GBP ${payload.totalFare.toFixed(2)}</p>
    <p><strong>Payment method:</strong> ${escapeHtml(payload.paymentMethod || 'Card')}</p>
    <p><strong>Payment ref:</strong> ${escapeHtml(payload.paymentIntentId || '-')}</p>
  `;
  const text = [
    `New paid booking received: ${code}`,
    `Date & time: ${date} ${time}`,
    `Passenger: ${payload.passengerName}`,
    `Email: ${payload.passengerEmail}`,
    `Phone: ${payload.passengerPhone}`,
    `Pickup: ${payload.pickup}`,
    `Destination: ${payload.destination}`,
    `Amount paid: GBP ${payload.totalFare.toFixed(2)}`,
    `Payment method: ${payload.paymentMethod || 'Card'}`,
    `Payment ref: ${payload.paymentIntentId || '-'}`,
  ].join('\n');

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: BOOKING_PAYMENT_NOTIFICATION_RECIPIENTS,
      subject,
      html,
      text,
    }),
  }).catch((err) => {
    console.error('Failed to send internal payment notification', err);
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pickup = String(body.pickup ?? '').trim();
    const dropOffs = Array.isArray(body.dropOffs) ? body.dropOffs.map((d: string) => String(d ?? '').trim()).filter(Boolean) : [];
    const date = String(body.date ?? '').trim();
    const time = String(body.time ?? '').trim();
    const passengerName = String(body.passengerName ?? '').trim();
    const passengerEmail = String(body.passengerEmail ?? '').trim();
    const passengerPhone = String(body.passengerPhone ?? '').trim();
    const paymentStatus = String(body.paymentStatus ?? '').trim().toLowerCase();
    const paymentMethodRaw = String(body.paymentMethod ?? '').trim();
    const paymentMethod = paymentMethodRaw.toLowerCase();

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
      const [users] = await pool.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [clientLookupEmail]);
      const user = users[0];
      if (user) clientId = Number(user.id);
    }

    if (clientId) {
      const [countRows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT COUNT(*) AS total FROM client_journeys WHERE client_id = ?',
        [clientId]
      );
      const previousJourneys = Number(countRows[0]?.total ?? 0);
      const inFirstFiveJourneys = previousJourneys < 5;
      const isAdvanceCardPayment = paymentStatus === 'succeeded' && paymentMethod === 'card';
      if (inFirstFiveJourneys && !isAdvanceCardPayment) {
        return NextResponse.json(
          { error: 'Registered clients must pay in advance by card for their first 5 journeys.' },
          { status: 403 }
        );
      }
    }

    const destination = dropOffs
      .map((stop: string, index: number) =>
        index === dropOffs.length - 1 ? stop : `Stop ${index + 1}: ${stop}`
      )
      .join(', ');

    const payload = {
      ...body,
      pickup,
      dropOffs,
    };

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO client_journeys
        (client_id, journey_date, pickup, destination, service_type, driver_name, car, plate, status, price, invoice_url, passenger_name, passenger_email, passenger_phone, vehicle_type_id, booking_payload)
       VALUES (?, ?, ?, ?, ?, 'Pending assignment', 'TBD', 'TBD', 'Upcoming', ?, NULL, ?, ?, ?, ?, ?)`,
      [
        clientId,
        journeyDate.toISOString().slice(0, 19).replace('T', ' '),
        pickup,
        destination,
        String(body.serviceType ?? 'Transfer'),
        Number(body.totalFare ?? 0),
        passengerName,
        passengerEmail,
        passengerPhone,
        body.vehicleTypeId ? Number(body.vehicleTypeId) : null,
        JSON.stringify(payload),
      ]
    );

    const journeyId = Number(result.insertId);
    if (journeyId && paymentStatus === 'succeeded') {
      let invoiceAttachmentBase64: string | undefined;
      let invoiceFileName: string | undefined;
      try {
        const invoice = await createOrUpdatePaidInvoice(pool, {
          journeyId,
          clientId,
          journeyDateIso: journeyDate.toISOString(),
          passengerName,
          passengerEmail,
          passengerPhone,
          pickup,
          destination,
          totalFare: Number(body.totalFare ?? 0),
          paymentIntentId: body.paymentIntentId ? String(body.paymentIntentId) : undefined,
          paymentMethod: paymentMethodRaw || undefined,
        });
        invoiceAttachmentBase64 = Buffer.from(invoice.pdfBytes).toString('base64');
        invoiceFileName = invoice.fileName;
      } catch (invoiceErr) {
        console.error('Invoice create/save error', invoiceErr);
      }

      const emailPayload = {
        journeyId,
        journeyDate: journeyDate.toISOString(),
        pickup,
        destination,
        passengerName,
        passengerEmail,
        passengerPhone,
        totalFare: Number(body.totalFare ?? 0),
        paymentIntentId: body.paymentIntentId ? String(body.paymentIntentId) : undefined,
        paymentMethod: paymentMethodRaw || undefined,
        invoiceAttachmentBase64,
        invoiceFileName,
      };
      await Promise.allSettled([
        sendPaymentEmail(emailPayload),
        sendInternalPaymentNotification(emailPayload),
      ]);
    }

    return NextResponse.json({ success: true, journeyId });
  } catch (err) {
    console.error('Booking create error', err);
    return NextResponse.json({ error: 'Failed to submit booking' }, { status: 500 });
  }
}
