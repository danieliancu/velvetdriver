import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { ensureDriverStatementsTable } from '@/lib/driver-statements';

export const dynamic = 'force-dynamic';

const pool = getDbPool();

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    await ensureDriverStatementsTable(pool);

    const [drivers] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    const driverId = Number(drivers[0]?.id || 0);
    if (!driverId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ds.booking_ref,
              ds.journey_date,
              ds.collection,
              ds.destination,
              ds.vehicle_type,
              ds.fare_quoted,
              ds.status,
              ds.statement_pdf_url
       FROM driver_statements ds
       INNER JOIN client_journeys cj ON cj.id = ds.journey_id
       WHERE ds.driver_id = ?
         AND cj.status = 'Completed'
       ORDER BY ds.journey_date DESC, ds.id DESC
       LIMIT 1000`,
      [driverId]
    );

    const statements = rows.map((row) => ({
      date: formatDate(row.journey_date ? String(row.journey_date) : null),
      ref: String(row.booking_ref || ''),
      pickup: String(row.collection || '-'),
      dropoff: String(row.destination || '-'),
      vehicle: String(row.vehicle_type || '-'),
      miles: 0,
      wait: 0,
      fare: Number(row.fare_quoted ?? 0) || 0,
      status: String(row.status || 'Unpaid') as 'Paid' | 'Unpaid',
      pdfUrl: row.statement_pdf_url ? String(row.statement_pdf_url) : null,
    }));

    return NextResponse.json({ statements });
  } catch (err) {
    console.error('Driver statements fetch error', err);
    return NextResponse.json({ error: 'Failed to load statements' }, { status: 500 });
  }
}
