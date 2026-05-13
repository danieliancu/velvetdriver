import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { getRequestIp, logSiteActivity } from '@/lib/site-activity';
import { buildJourneyLocationLines, resolveDropOffs } from '@/lib/journey-locations';

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

const buildJourneyLocationRows = (pickup: string, dropOffs: string[]) => {
  return buildJourneyLocationLines(pickup, dropOffs)
    .map(
      (line) => `<tr>
      <td style="padding:4px 0; font-weight:bold;">${escapeHtml(line.label)}:</td>
      <td style="padding:4px 0;">${escapeHtml(line.value)}</td>
    </tr>`
    )
    .join('');
};

const normalizeForCompare = (value: unknown) => String(value || '').trim().toLowerCase();

async function getClientJourneyColumns() {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_journeys'`
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '')));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    const driverId = String(body?.driverId ?? '').trim();
    const requestedCommission = body?.commission !== undefined ? Number(body.commission) : null;

    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }
    if (!driverId) {
      return NextResponse.json({ error: 'Missing driver id' }, { status: 400 });
    }

    const driverIdNumber = Number(driverId);
    if (Number.isNaN(driverIdNumber)) {
      return NextResponse.json({ error: 'Invalid driver id' }, { status: 400 });
    }

    const [driverExistsRows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, commission FROM drivers WHERE id = ? LIMIT 1',
      [driverIdNumber]
    );
    if (!driverExistsRows.length) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }
    const driverCommission = Number(driverExistsRows[0]?.commission ?? 20);
    const appliedCommissionRaw =
      requestedCommission !== null && Number.isFinite(requestedCommission)
        ? requestedCommission
        : driverCommission;
    const appliedCommission = Math.min(100, Math.max(0, appliedCommissionRaw));

    const [pricingRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT price, booking_payload
         FROM client_journeys
        WHERE id = ?
        LIMIT 1`,
      [journeyId]
    );
    const pricingRow = pricingRows[0];
    if (!pricingRow) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    let pricingPayload: any = null;
    if (pricingRow.booking_payload) {
      try {
        pricingPayload =
          typeof pricingRow.booking_payload === 'string'
            ? JSON.parse(pricingRow.booking_payload)
            : pricingRow.booking_payload;
      } catch {
        pricingPayload = null;
      }
    }
    const pricingFareAmount = Number(pricingRow.price ?? pricingPayload?.totalFare ?? 0) || 0;
    const driverAmount = Number((pricingFareAmount * (1 - appliedCommission / 100)).toFixed(2));
    const warnings: string[] = [];

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    const hasEmailService = Boolean(resendApiKey && emailFrom);
    if (!hasEmailService) {
      warnings.push('Booking allocated, but email service is not configured.');
    }

    const [bookingRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.created_at,
              cj.pickup,
              cj.destination,
              cj.driver_name,
              cj.car,
              cj.plate,
              cj.driver_commission_applied,
              cj.passenger_name,
              cj.passenger_email,
              cj.passenger_phone,
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
    const booking = bookingRows[0];
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const recipient = booking.client_email || booking.passenger_email;
    if (!recipient) {
      warnings.push('Booking allocated, but client email is missing and notification was skipped.');
    }

    const [driverRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id,
              d.first_and_middle_name,
              d.surname,
              d.pco_license_no,
              u.email AS user_email
         FROM drivers d
         LEFT JOIN users u ON u.id = d.user_id
        WHERE d.id = ?
        LIMIT 1`,
      [driverIdNumber]
    );
    const driver = driverRows[0] || {};

    const [driverPhotoRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT file_url, public_id, format
         FROM driver_documents
        WHERE driver_id = ?
          AND doc_type = 'profile_photo'
        LIMIT 1`,
      [driverIdNumber]
    );
    const photoRow = driverPhotoRows[0] || {};
    const directPhotoUrl = String(photoRow.file_url || '').trim();
    let driverPhotoUrl = '';
    if (directPhotoUrl) {
      if (/^https?:\/\//i.test(directPhotoUrl)) {
        driverPhotoUrl = directPhotoUrl;
      } else if (directPhotoUrl.startsWith('//')) {
        driverPhotoUrl = `https:${directPhotoUrl}`;
      }
    }
    if (!driverPhotoUrl) {
      const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const publicId = String(photoRow.public_id || '').trim();
      const format = String(photoRow.format || '').trim();
      if (cloudName && publicId) {
        const ext = format ? `.${format}` : '';
        driverPhotoUrl = `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}${ext}`;
      }
    }

    const [carRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT c.make,
              c.model,
              c.colour,
              c.vehicle_registration
         FROM driver_cars dc
         INNER JOIN cars c ON c.id = dc.car_id
        WHERE dc.driver_id = ?
          AND dc.deleted_at IS NULL
        ORDER BY (dc.status = 'active') DESC, dc.id DESC
        LIMIT 1`,
      [driverIdNumber]
    );
    const car = carRows[0] || {};

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
    const bookingCode = `VD-${String(booking.id).padStart(4, '0')}`;
    const passengerName = booking.passenger_name || payload?.passengerName || 'Client';
    const routeLines = buildJourneyLocationLines(
      String(booking.pickup || ''),
      resolveDropOffs(String(booking.destination || ''), payload)
    );
    const journeyLocationRows = routeLines
      .map(
        (line) => `<tr>
      <td style="padding:4px 0; font-weight:bold;">${escapeHtml(line.label)}:</td>
      <td style="padding:4px 0;">${escapeHtml(line.value)}</td>
    </tr>`
      )
      .join('');
    const passengerCount =
      Number(payload?.passengerCount || payload?.passengers || payload?.numberOfPassengers || 1) || 1;
    const notes = buildNotes(payload);
    const fareAmount = Number(booking.price ?? payload?.totalFare ?? 0) || 0;
    const paymentMethod = payload?.paymentMethod || payload?.paymentType || 'Card';

    const driverName = [driver.first_and_middle_name, driver.surname].filter(Boolean).join(' ').trim();
    const driverRecipient = String(driver.user_email || '').trim();
    const chauffeurId = `VD-${String(driverIdNumber).padStart(3, '0')}`;
    const driverLicence = driver.pco_license_no || '-';
    const carMakeModel = [car.make, car.model].filter(Boolean).join(' ').trim() || '-';
    const carColour = car.colour || '-';
    const carRegistration = car.vehicle_registration || '-';
    const previousDriverName = String(booking.driver_name || '').trim();
    const previousCommissionApplied =
      booking.driver_commission_applied !== null && booking.driver_commission_applied !== undefined
        ? Number(booking.driver_commission_applied)
        : null;
    const previousCarMakeModel = String(booking.car || '').trim();
    const previousCarRegistration = String(booking.plate || '').trim();
    const hadAssignedDriver = previousDriverName && normalizeForCompare(previousDriverName) !== 'pending assignment';
    const sameDriver =
      normalizeForCompare(previousDriverName) === normalizeForCompare(driverName || driverId) ||
      normalizeForCompare(previousDriverName) === normalizeForCompare(driverId);
    const sameCommission =
      previousCommissionApplied !== null && Math.abs(previousCommissionApplied - appliedCommission) < 0.0001;
    const sameCar =
      normalizeForCompare(previousCarMakeModel) === normalizeForCompare(carMakeModel) &&
      normalizeForCompare(previousCarRegistration) === normalizeForCompare(carRegistration);

    if (hadAssignedDriver && sameDriver && sameCommission && sameCar) {
      return NextResponse.json({
        ok: true,
        warning: 'This chauffeur is already allocated with the same commission. No duplicate emails were sent.',
        driverPrice: driverAmount,
        commissionApplied: appliedCommission,
      });
    }

    const clientJourneyColumns = await getClientJourneyColumns();
    const updateParts = [
      'driver_name = ?',
      'car = ?',
      'plate = ?',
      'driver_commission_applied = ?',
      'driver_price = ?',
    ];
    const updateParams: Array<string | number> = [
      driverName || driverId,
      carMakeModel,
      carRegistration,
      appliedCommission,
      driverAmount,
    ];
    if (clientJourneyColumns.has('driver_id')) {
      updateParts.splice(1, 0, 'driver_id = ?');
      updateParams.splice(1, 0, driverIdNumber);
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_journeys
          SET ${updateParts.join(',\n              ')}
        WHERE id = ?
        LIMIT 1`,
      [...updateParams, journeyId]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isReallocation = Boolean(hadAssignedDriver);
    const clientSubject = isReallocation
      ? `Velvet Drivers - Chauffeur updated ${bookingCode}`
      : `Velvet Drivers - Chauffeur allocated ${bookingCode}`;
    const clientTitle = isReallocation ? 'Chauffeur Update' : 'Chauffeur Allocation';
    const clientIntro = isReallocation
      ? `We are writing to let you know that your chauffeur details have been updated for your upcoming journey with
                <strong>Velvet Drivers Limited</strong>. Please find your latest chauffeur and vehicle details below.`
      : `We are pleased to confirm that your chauffeur has now been allocated for your upcoming journey with
                <strong>Velvet Drivers Limited</strong>. Please find your full chauffeur and vehicle details below.`;
    const previousChauffeurRows = isReallocation
      ? `<tr>
                  <td width="40%" style="padding:4px 0; font-weight:bold;">Previous Driver:</td>
                  <td width="60%" style="padding:4px 0;">${escapeHtml(previousDriverName)}</td>
                </tr>`
      : '';
    const clientHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Velvet Drivers - ${clientTitle}</title>
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
                ${clientTitle}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 26px 10px; color:#333333; font-size:14px; line-height:1.6;">
              <p style="margin-top:0;">Dear ${escapeHtml(passengerName)},</p>
              <p>${clientIntro}</p>
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
                  <td width="60%" style="padding:4px 0;">${escapeHtml(bookingCode)}</td>
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
                Your Chauffeur
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#333333;">
                <tr>
                  <td width="40%" style="padding:4px 0; font-weight:bold;">Driver Name:</td>
                  <td width="60%" style="padding:4px 0;">${escapeHtml(driverName || 'Assigned driver')}</td>
                </tr>
                ${previousChauffeurRows}
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Velvet Drivers Chauffeur ID:</td>
                  <td style="padding:4px 0;">${escapeHtml(chauffeurId)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">TfL PHV Licence:</td>
                  <td style="padding:4px 0;">${escapeHtml(driverLicence)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Experience:</td>
                  <td style="padding:4px 0;">7+ years executive &amp; airport chauffeur services</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Languages:</td>
                  <td style="padding:4px 0;">English</td>
                </tr>
              </table>
              <div style="margin-top:10px;">
                <p style="margin:0 0 6px; font-weight:bold;">Driver Photo:</p>
                ${driverPhotoUrl ? `<img src="${escapeHtml(driverPhotoUrl)}" alt="Driver photo" style="width:120px; height:auto; border-radius:6px; border:1px solid #e0e0e0;" />` : `<p style="margin:0; color:#555555; font-size:13px;">Photo will be provided shortly.</p>`}
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Your Vehicle
              </h2>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#333333;">
                <tr>
                  <td width="40%" style="padding:4px 0; font-weight:bold;">Make &amp; Model:</td>
                  <td width="60%" style="padding:4px 0;">${escapeHtml(carMakeModel)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Colour:</td>
                  <td style="padding:4px 0;">${escapeHtml(carColour)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Registration:</td>
                  <td style="padding:4px 0;">${escapeHtml(carRegistration)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0; font-weight:bold;">Vehicle Licence (TfL):</td>
                  <td style="padding:4px 0;">On file</td>
                </tr>
              </table>
              <p style="margin:6px 0 0; font-size:13px; color:#555555;">
                This vehicle is fully licensed, insured, and operated in accordance with Transport for London regulations.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                What to Expect on the Day
              </h2>
              <ul style="margin:0; padding-left:18px; font-size:13px; color:#555555;">
                <li>Your chauffeur will arrive 10 minutes before your pickup time</li>
                <li>The driver will introduce themselves and confirm your name</li>
                <li>Luggage assistance and door-to-door service included</li>
                <li>Live GPS tracking may be enabled for your journey</li>
              </ul>
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
                A receipt or VAT invoice will be issued automatically after your journey, in line with our Payment &amp; Refund Policy.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 26px 16px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">
                Contact &amp; Support
              </h2>
              <p style="margin:0 0 4px; font-size:14px; color:#333333;">
                If you need to update your journey or contact us:
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
                <li>All journeys must be pre-booked through Velvet Drivers Limited</li>
                <li>Chauffeurs cannot accept street hails or unbooked journeys</li>
                <li>Cancellations and refunds are governed by our published policy</li>
                <li>All drivers and vehicles are fully TfL licensed</li>
              </ul>
            </td>
          </tr>

          <tr>
            <td align="center" style="background-color:#f7f7f7; padding:14px 20px;">
              <p style="margin:0; font-size:12px; color:#777777;">
                Velvet Drivers Limited - Luxury Chauffeur Services
              </p>
              <p style="margin:4px 0 0; font-size:11px; color:#aaaaaa;">
                We look forward to welcoming you aboard and providing you with a smooth, discreet and luxury journey.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const clientText = [
      isReallocation
        ? `Your chauffeur details were updated for booking ${bookingCode}.`
        : `Your chauffeur has been allocated for booking ${bookingCode}.`,
      isReallocation && previousDriverName ? `Previous driver: ${previousDriverName}` : '',
      `New driver: ${driverName || 'Assigned driver'}`,
      `Vehicle: ${carMakeModel}`,
      `Registration: ${carRegistration}`,
    ]
      .filter(Boolean)
      .join('\n');

    if (hasEmailService && recipient) {
      const clientEmailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: recipient,
          subject: clientSubject,
          html: clientHtml,
          text: clientText,
        }),
      });

      if (!clientEmailRes.ok) {
        const data = await clientEmailRes.json().catch(() => ({}));
        warnings.push(
          data?.message || 'Booking allocated, but client allocation email could not be sent.'
        );
      }
    }

    if (!driverRecipient) {
      warnings.push('Booking allocated, but driver email is missing and could not be sent.');
    } else if (hasEmailService) {
      const driverSubject = `Velvet Drivers - New Job Allocation ${bookingCode}`;
      const driverHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Velvet Drivers - New Job Allocation</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:6px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td align="center" style="background:linear-gradient(90deg,#3A0511,#000000); padding:24px 20px;">
              <h1 style="margin:0; font-size:22px; color:#ffffff; letter-spacing:1px; text-transform:uppercase;">Velvet Drivers</h1>
              <p style="margin:8px 0 0; font-size:13px; color:#f2f2f2;">Driver Allocation Notice</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 26px 10px; color:#333333; font-size:14px; line-height:1.6;">
              <p style="margin-top:0;">Dear ${escapeHtml(driverName || 'Driver')},</p>
              <p>A new booking has been allocated to you. Please retain this email for your records.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 26px 18px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">Job Details</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#333333;">
                <tr><td width="40%" style="padding:4px 0; font-weight:bold;">Booking Reference:</td><td width="60%" style="padding:4px 0;">${escapeHtml(bookingCode)}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Pickup Date & Time:</td><td style="padding:4px 0;">${escapeHtml(date)} at ${escapeHtml(time)}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Passenger:</td><td style="padding:4px 0;">${escapeHtml(passengerName)}</td></tr>
                ${journeyLocationRows}
                <tr><td style="padding:4px 0; font-weight:bold;">Vehicle Type:</td><td style="padding:4px 0;">${escapeHtml(vehicleLabel)}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Allocated Driver Pay:</td><td style="padding:4px 0;">&pound;${driverAmount.toFixed(2)}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold; vertical-align:top;">Notes:</td><td style="padding:4px 0;">${escapeHtml(notes)}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 26px 18px; font-size:13px; color:#555555;">
              For support regarding this booking, contact dispatch at
              <a href="mailto:bookings@velvetdrivers.co.uk" style="color:#3A0511; text-decoration:none;"> bookings@velvetdrivers.co.uk</a>
              or call <strong>0208 175 9186</strong>.
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#f7f7f7; padding:14px 20px;">
              <p style="margin:0; font-size:12px; color:#777777;">Velvet Drivers Limited - Driver Operations</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const driverText =
        `New job allocated ${bookingCode}\n` +
        `Date/Time: ${date} ${time}\n` +
        `Passenger: ${passengerName}\n` +
        `${routeLines.map((line) => `${line.label}: ${line.value}`).join('\n')}\n` +
        `Vehicle: ${vehicleLabel}\n` +
        `Driver Pay: GBP ${driverAmount.toFixed(2)}\n` +
        `Notes: ${notes}`;

      const driverEmailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: driverRecipient,
          subject: driverSubject,
          html: driverHtml,
          text: driverText,
        }),
      });

      if (!driverEmailRes.ok) {
        const data = await driverEmailRes.json().catch(() => ({}));
        warnings.push(
          data?.message ||
            'Booking allocated, but driver allocation email could not be sent.'
        );
      }
    }

    await logSiteActivity(pool, {
      tableName: 'client_journeys',
      operation: 'UPDATE',
      pk: journeyId,
      category: 'allocation',
      title: 'Driver allocated to job',
      message: `${driverName || driverId} was allocated to VD-${String(journeyId).padStart(4, '0')}.`,
      severity: 'success',
      tags: {
        actor: 'admin',
        commission: appliedCommission,
        driverPrice: driverAmount,
      },
      ip: getRequestIp(request),
      next: {
        driverId,
        driverName,
        driverPrice: driverAmount,
        bookingRef: `VD-${String(journeyId).padStart(4, '0')}`,
      },
    }).catch((err) => {
      console.error('Allocate driver audit error', err);
    });

    return NextResponse.json(warnings.length ? {
      ok: true,
      driverPrice: driverAmount,
      commissionApplied: appliedCommission,
      warning: warnings.join(' '),
    } : {
      ok: true,
      driverPrice: driverAmount,
      commissionApplied: appliedCommission,
    });
  } catch (err) {
    console.error('Allocate driver error', err);
    return NextResponse.json({ error: 'Failed to allocate driver' }, { status: 500 });
  }
}
