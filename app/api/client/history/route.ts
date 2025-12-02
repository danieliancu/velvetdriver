import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id, cj.journey_date, cj.pickup, cj.destination, cj.service_type, cj.driver_name, cj.car, cj.plate, cj.status, cj.price, cj.invoice_url
       FROM client_journeys cj
       INNER JOIN users u ON cj.client_id = u.id
       WHERE u.email = ?
       ORDER BY cj.journey_date DESC`,
      [email]
    );
    const journeys = rows.map((row) => ({
      id: row.id,
      date: new Date(row.journey_date).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      pickup: row.pickup,
      destination: row.destination,
      serviceType: row.service_type || 'Transfer',
      driver: row.driver_name,
      car: row.car,
      plate: row.plate,
      status: row.status,
      price: Number(row.price),
      invoiceUrl: row.invoice_url,
    }));
    return NextResponse.json({ journeys });
  } catch (err) {
    console.error('History fetch error', err);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
