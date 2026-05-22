import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

const formatDateTime = (value: unknown) => {
  const parsed = new Date(String(value ?? ''));
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  try {
    const [users] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id, c.id AS corporate_id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       LEFT JOIN corporates c ON c.user_id = u.id
       WHERE u.email = ? AND r.code = 'corporate'
       LIMIT 1`,
      [email]
    );
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'Corporate account not found' }, { status: 404 });

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.service_type,
              CASE
                WHEN cj.driver_name REGEXP '^[0-9]+$'
                  THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', d.first_and_middle_name, d.surname)), ''), cj.driver_name)
                ELSE cj.driver_name
              END AS driver_name_display,
              CASE
                WHEN cj.car IS NULL OR cj.car = '' OR cj.car = 'TBD'
                  THEN COALESCE(NULLIF(TRIM(CONCAT_WS(' ', car_info.make, car_info.model)), ''), cj.car, 'TBD')
                ELSE cj.car
              END AS car_display,
              CASE
                WHEN cj.plate IS NULL OR cj.plate = '' OR cj.plate = 'TBD'
                  THEN COALESCE(NULLIF(car_info.vehicle_registration, ''), cj.plate, 'TBD')
                ELSE cj.plate
              END AS plate_display,
              cj.status,
              cj.price,
              cj.invoice_url
       FROM client_journeys cj
       LEFT JOIN drivers d ON d.id = CAST(cj.driver_name AS UNSIGNED)
       LEFT JOIN (
         SELECT ranked.driver_id,
                ranked.make,
                ranked.model,
                ranked.vehicle_registration
         FROM (
           SELECT dc.driver_id,
                  c.make,
                  c.model,
                  c.vehicle_registration,
                  ROW_NUMBER() OVER (
                    PARTITION BY dc.driver_id
                    ORDER BY (dc.status = 'active') DESC, dc.id DESC
                  ) AS rn
           FROM driver_cars dc
           INNER JOIN cars c ON c.id = dc.car_id
           WHERE dc.deleted_at IS NULL
         ) ranked
         WHERE ranked.rn = 1
       ) car_info ON car_info.driver_id = d.id
       WHERE (cj.client_id = ? OR LOWER(cj.passenger_email) = ? OR cj.corporate_id = ?)
         AND cj.status <> 'Saved'
       ORDER BY cj.journey_date DESC`,
      [Number(user.id), email, Number(user.corporate_id || 0)]
    );

    const [invoiceRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT i.id,
              i.reference,
              i.status,
              i.total_amount,
              i.amount,
              i.issued_at,
              i.due_at,
              i.paid_at,
              i.pdf_url,
              GROUP_CONCAT(CONCAT('VD-', LPAD(ib.journey_id, 4, '0')) ORDER BY ib.journey_id SEPARATOR ', ') AS booking_refs
       FROM invoices i
       LEFT JOIN invoice_bookings ib ON ib.invoice_id = i.id
       WHERE i.corporate_id = ?
         AND i.deleted_at IS NULL
       GROUP BY i.id
       ORDER BY COALESCE(i.issued_at, i.created_at) DESC`,
      [Number(user.corporate_id || 0)]
    );

    const journeys = rows.map((row) => ({
      id: row.id,
      date: formatDateTime(row.journey_date),
      pickup: row.pickup,
      destination: row.destination,
      serviceType: row.service_type || 'Transfer',
      driver: row.driver_name_display || '-',
      car: row.car_display || '-',
      plate: row.plate_display || '-',
      status: row.status,
      price: Number(row.price || 0),
      invoiceUrl: row.invoice_url || null,
    }));

    const invoices = invoiceRows.map((row) => ({
      id: Number(row.id),
      reference: row.reference || '',
      status: row.status || 'Pending',
      amount: Number(row.total_amount ?? row.amount ?? 0),
      issuedAt: row.issued_at ? formatDateTime(row.issued_at) : '-',
      dueAt: row.due_at ? formatDateTime(row.due_at) : '-',
      paidAt: row.paid_at ? formatDateTime(row.paid_at) : '',
      bookingRefs: row.booking_refs || '',
      pdfUrl: row.pdf_url || null,
    }));

    return NextResponse.json({ journeys, invoices });
  } catch (err) {
    console.error('Corporate history load error', err);
    return NextResponse.json({ error: 'Failed to load corporate history' }, { status: 500 });
  }
}
