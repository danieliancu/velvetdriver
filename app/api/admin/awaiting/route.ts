import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type AwaitingRow = DbRow<{
  driver_id: number;
  user_id: number;
  email: string;
  phone: string | null;
  surname: string | null;
  first_and_middle_name: string | null;
  address: string | null;
  pco_license_no: string | null;
  pco_expires_date: string | null;
}>;

type DocumentRow = DbRow<{
  driver_id: number;
  doc_type: string;
  file_url: string;
  format: string | null;
  file_name: string | null;
}>;

type CarRow = DbRow<{
  driver_id: number;
  driver_car_id: number;
  vehicle_type_id: number | null;
  vehicle_type_label: string | null;
  vehicle_registration: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  keeper_info: string | null;
}>;

type PricingVehicleRow = DbRow<{
  id: number;
  label: string;
}>;

type CarDocRow = DbRow<{
  driver_id: number;
  doc_type: string;
  file_url: string;
  format: string | null;
  file_name: string | null;
}>;

const DOC_LABELS: Record<string, string> = {
  pco_license: 'PCO Licence',
  driving_license_front: 'Driving Licence Front',
  driving_license_back: 'Driving Licence Back',
  profile_photo: 'Profile Photo',
  mot: 'MOT',
  insurance: 'Insurance',
  phv_car_licence: 'PHV Car License',
  logbook_v5: 'Logbook V5 Page 1',
  logbook_v5_page2: 'Logbook V5 Page 2',
  other: 'Other documents',
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

async function sendDriverWelcomeEmail(payload: {
  to: string;
  driverId: number;
  fullName: string;
  phone: string;
  address: string;
  postcode: string;
  pcoLicense: string;
  pcoExpiry: string;
  drivingLicense: string;
  dvlaCode: string;
  car: {
    vrm: string;
    make: string;
    model: string;
    colour: string;
    keeper: string;
    vehicleType: string;
  } | null;
}) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM;
  if (!resendApiKey || !emailFrom) {
    throw new Error('Email service not configured');
  }

  const subject = 'Welcome to Velvet Drivers';
  const safeName = escapeHtml(payload.fullName || `Driver ${payload.driverId}`);
  const safePhone = escapeHtml(payload.phone);
  const safeAddress = escapeHtml(payload.address);
  const safePostcode = escapeHtml(payload.postcode);
  const safePco = escapeHtml(payload.pcoLicense);
  const safePcoExpiry = escapeHtml(payload.pcoExpiry);
  const safeDriving = escapeHtml(payload.drivingLicense);
  const safeDvla = escapeHtml(payload.dvlaCode);
  const safeDriverId = escapeHtml(String(payload.driverId));
  const carHtml = payload.car
    ? `
      <tr><td style="padding:4px 0; font-weight:bold;">Vehicle Type:</td><td style="padding:4px 0;">${escapeHtml(payload.car.vehicleType)}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold;">VRM:</td><td style="padding:4px 0;">${escapeHtml(payload.car.vrm)}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold;">Make / Model:</td><td style="padding:4px 0;">${escapeHtml(`${payload.car.make} ${payload.car.model}`.trim())}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold;">Colour:</td><td style="padding:4px 0;">${escapeHtml(payload.car.colour)}</td></tr>
      <tr><td style="padding:4px 0; font-weight:bold;">Keeper:</td><td style="padding:4px 0;">${escapeHtml(payload.car.keeper)}</td></tr>
    `
    : `<tr><td style="padding:4px 0;" colspan="2">No vehicle details on file.</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Welcome to Velvet Drivers</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f4; font-family:Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4; padding:20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
          <tr>
            <td align="center" style="background:linear-gradient(90deg,#3A0511,#000000); padding:24px 20px;">
              <h1 style="margin:0; font-size:22px; color:#ffffff; letter-spacing:1px; text-transform:uppercase;">Velvet Drivers</h1>
              <p style="margin:8px 0 0; font-size:13px; color:#f2f2f2;">Welcome Onboard</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 26px 10px; color:#333333; font-size:14px; line-height:1.6;">
              <p style="margin-top:0;">Dear ${safeName},</p>
              <p>Your driver account has been approved by the admin team. Welcome to Velvet Drivers.</p>
              <p>Below is a summary of the details from your application:</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 26px 18px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">Profile Details</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#333333;">
                <tr><td width="42%" style="padding:4px 0; font-weight:bold;">Driver ID:</td><td width="58%" style="padding:4px 0;">${safeDriverId}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Full Name:</td><td style="padding:4px 0;">${safeName}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Email:</td><td style="padding:4px 0;">${escapeHtml(payload.to)}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Phone:</td><td style="padding:4px 0;">${safePhone}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Address:</td><td style="padding:4px 0;">${safeAddress}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Postcode:</td><td style="padding:4px 0;">${safePostcode}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">PCO Licence:</td><td style="padding:4px 0;">${safePco}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">PCO Expiry:</td><td style="padding:4px 0;">${safePcoExpiry}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">Driving Licence:</td><td style="padding:4px 0;">${safeDriving}</td></tr>
                <tr><td style="padding:4px 0; font-weight:bold;">DVLA Check Code:</td><td style="padding:4px 0;">${safeDvla}</td></tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 26px 18px;">
              <h2 style="margin:0 0 8px; font-size:16px; color:#3A0511; border-bottom:2px solid #D1A95F; display:inline-block;">Vehicle Details</h2>
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="font-size:14px; color:#333333;">
                ${carHtml}
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#f7f7f7; padding:14px 20px;">
              <p style="margin:0; font-size:12px; color:#777777;">For support, contact bookings@velvetdrivers.co.uk.</p>
              <p style="margin:4px 0 0; font-size:11px; color:#aaaaaa;">Automated message from Velvet Drivers.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Welcome to Velvet Drivers, ${payload.fullName}.`,
    'Your account has been approved.',
    '',
    'Application details:',
    `Driver ID: ${payload.driverId}`,
    `Name: ${payload.fullName}`,
    `Email: ${payload.to}`,
    `Phone: ${payload.phone}`,
    `Address: ${payload.address}`,
    `Postcode: ${payload.postcode}`,
    `PCO Licence: ${payload.pcoLicense}`,
    `PCO Expiry: ${payload.pcoExpiry}`,
    `Driving Licence: ${payload.drivingLicense}`,
    `DVLA Check Code: ${payload.dvlaCode}`,
    '',
    payload.car
      ? `Vehicle: ${payload.car.vehicleType} | ${payload.car.vrm} | ${payload.car.make} ${payload.car.model} | ${payload.car.colour}`
      : 'Vehicle: No vehicle details on file.',
  ].join('\n');

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: emailFrom,
      to: payload.to,
      subject,
      html,
      text,
    }),
  });

  if (!resendRes.ok) {
    const data = await resendRes.json().catch(() => ({}));
    throw new Error(data?.message || 'Failed to send welcome email');
  }
}

export async function GET() {
  try {
    const [rows] = await pool.query<AwaitingRow[]>(
      `SELECT d.id AS driver_id,
              u.id AS user_id,
              u.email,
              d.phone,
              d.surname,
              d.first_and_middle_name,
              d.address,
              d.pco_license_no,
              d.pco_expires_date
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.status = 'pending'
       ORDER BY u.created_at DESC
       LIMIT 200`
    );

    const driverIds = rows.map((row) => row.driver_id);
    let documentsByDriver: Record<number, Array<{ label: string; url: string; type: string }>> = {};
    let carsByDriver: Record<number, Array<{ id: number; vrm: string; make: string; model: string; colour: string; keeper: string; vehicleTypeId: number | null; vehicleTypeLabel: string }>> = {};
    let pricingVehicles: Array<{ id: number; label: string }> = [];
    if (driverIds.length) {
      const [docs] = await pool.query<DocumentRow[]>(
        `SELECT driver_id, doc_type, file_url, format, file_name
         FROM driver_documents
         WHERE driver_id IN (${driverIds.map(() => '?').join(',')})`,
        driverIds
      );
      documentsByDriver = docs.reduce((acc, doc) => {
        const label = DOC_LABELS[doc.doc_type] || doc.file_name || doc.doc_type;
        const type = (doc.format || '').toUpperCase() || 'FILE';
        if (!acc[doc.driver_id]) acc[doc.driver_id] = [];
        acc[doc.driver_id].push({ label, url: doc.file_url, type });
        return acc;
      }, {} as Record<number, Array<{ label: string; url: string; type: string }>>);

      const [cars] = await pool.query<CarRow[]>(
        `SELECT dc.driver_id,
                dc.id AS driver_car_id,
                c.vehicle_type_id,
                pv.label AS vehicle_type_label,
                c.vehicle_registration,
                c.make,
                c.model,
                c.colour,
                c.keeper_info
         FROM driver_cars dc
         INNER JOIN cars c ON c.id = dc.car_id
         LEFT JOIN pricing_vehicles pv ON pv.id = c.vehicle_type_id
         WHERE dc.driver_id IN (${driverIds.map(() => '?').join(',')})
           AND dc.deleted_at IS NULL`,
        driverIds
      );
      carsByDriver = cars.reduce((acc, car) => {
        if (!acc[car.driver_id]) acc[car.driver_id] = [];
        acc[car.driver_id].push({
          id: car.driver_car_id,
          vrm: car.vehicle_registration || '-',
          make: car.make || '-',
          model: car.model || '-',
          colour: car.colour || '-',
          keeper: car.keeper_info || '-',
          vehicleTypeId: car.vehicle_type_id,
          vehicleTypeLabel: car.vehicle_type_label || '-',
        });
        return acc;
      }, {} as Record<number, Array<{ id: number; vrm: string; make: string; model: string; colour: string; keeper: string; vehicleTypeId: number | null; vehicleTypeLabel: string }>>);

      const [carDocs] = await pool.query<CarDocRow[]>(
        `SELECT dc.driver_id, dcd.doc_type, dcd.file_url, dcd.format, dcd.file_name
         FROM driver_cars dc
         INNER JOIN driver_car_documents dcd ON dcd.car_id = dc.id
         WHERE dc.driver_id IN (${driverIds.map(() => '?').join(',')})`,
        driverIds
      );
      carDocs.forEach((doc) => {
        const label = DOC_LABELS[doc.doc_type] || doc.doc_type;
        const type = (doc.format || '').toUpperCase() || 'FILE';
        if (!documentsByDriver[doc.driver_id]) documentsByDriver[doc.driver_id] = [];
        documentsByDriver[doc.driver_id].push({ label, url: doc.file_url, type });
      });

      const [pricingRows] = await pool.query<PricingVehicleRow[]>(
        `SELECT id, label FROM pricing_vehicles ORDER BY id`
      );
      pricingVehicles = pricingRows.map((row) => ({ id: row.id, label: row.label }));
    }

    const drivers = rows.map((row) => ({
      id: String(row.driver_id),
      name: [row.first_and_middle_name, row.surname].filter(Boolean).join(' ').trim() || `Driver ${row.driver_id}`,
      phone: row.phone || '-',
      email: row.email,
      address: row.address || '-',
      license: row.pco_license_no || '-',
      pcoExpiry: row.pco_expires_date || '-',
      documents: documentsByDriver[row.driver_id] || [],
      cars: carsByDriver[row.driver_id] || [],
    }));

    return NextResponse.json({ drivers, pricingVehicles });
  } catch (err) {
    console.error('Admin awaiting drivers fetch error', err);
    return NextResponse.json({ error: 'Failed to load awaiting drivers' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const driverId = Number(body.driverId);
    const driverCarId = Number(body.driverCarId);
    const vehicleTypeId = body.vehicleTypeId !== undefined ? Number(body.vehicleTypeId) : null;
    if (driverCarId && vehicleTypeId) {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE cars c
         INNER JOIN driver_cars dc ON dc.car_id = c.id
         SET c.vehicle_type_id = ?
         WHERE dc.id = ?`,
        [vehicleTypeId, driverCarId]
      );
      if (!result.affectedRows) {
        return NextResponse.json({ error: 'Car not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }
    if (!driverId) {
      return NextResponse.json({ error: 'Missing driver id' }, { status: 400 });
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.user_id,
              d.id AS driver_id,
              d.first_and_middle_name,
              d.surname,
              d.phone,
              d.address,
              d.postcode,
              d.pco_license_no,
              d.pco_expires_date,
              d.driving_license_no,
              d.dvla_check_code,
              u.email
       FROM drivers d
       INNER JOIN users u ON u.id = d.user_id
       WHERE d.id = ?
       LIMIT 1`,
      [driverId]
    );
    const driverRow = rows[0];
    const userId = driverRow?.user_id;
    if (!userId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE users SET status = 'active' WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    let warning: string | null = null;
    try {
      const [carRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT c.vehicle_registration,
                c.make,
                c.model,
                c.colour,
                c.keeper_info,
                pv.label AS vehicle_type
         FROM driver_cars dc
         INNER JOIN cars c ON c.id = dc.car_id
         LEFT JOIN pricing_vehicles pv ON pv.id = c.vehicle_type_id
         WHERE dc.driver_id = ?
           AND dc.deleted_at IS NULL
         ORDER BY (dc.status = 'active') DESC, dc.id DESC
         LIMIT 1`,
        [driverId]
      );
      const car = carRows[0]
        ? {
            vrm: String(carRows[0].vehicle_registration || '-'),
            make: String(carRows[0].make || '-'),
            model: String(carRows[0].model || '-'),
            colour: String(carRows[0].colour || '-'),
            keeper: String(carRows[0].keeper_info || '-'),
            vehicleType: String(carRows[0].vehicle_type || '-'),
          }
        : null;

      const fullName =
        [String(driverRow.first_and_middle_name || ''), String(driverRow.surname || '')]
          .filter(Boolean)
          .join(' ')
          .trim() || `Driver ${driverId}`;

      await sendDriverWelcomeEmail({
        to: String(driverRow.email || '').trim(),
        driverId,
        fullName,
        phone: String(driverRow.phone || '-'),
        address: String(driverRow.address || '-'),
        postcode: String(driverRow.postcode || '-'),
        pcoLicense: String(driverRow.pco_license_no || '-'),
        pcoExpiry: formatDate(driverRow.pco_expires_date ? String(driverRow.pco_expires_date) : null),
        drivingLicense: String(driverRow.driving_license_no || '-'),
        dvlaCode: String(driverRow.dvla_check_code || '-'),
        car,
      });
    } catch (emailErr) {
      console.error('Admin awaiting welcome email error', emailErr);
      warning = 'Driver approved, but welcome email could not be sent.';
    }

    return NextResponse.json(warning ? { ok: true, warning } : { ok: true });
  } catch (err) {
    console.error('Admin awaiting approve error', err);
    return NextResponse.json({ error: 'Failed to approve driver' }, { status: 500 });
  }
}
