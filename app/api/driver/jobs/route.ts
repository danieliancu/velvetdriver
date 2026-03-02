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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const [drivers] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const driverId = drivers[0]?.id;
    if (!driverId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.price,
              cj.driver_price
       FROM client_journeys cj
       WHERE cj.status = 'Upcoming'
         AND cj.driver_name = ?
       ORDER BY cj.journey_date ASC`,
      [String(driverId)]
    );

    const jobs = rows.map((row) => {
      const { date, time } = formatDate(String(row.journey_date));
      return {
        id: Number(row.id),
        code: `VD-${String(row.id).padStart(4, '0')}`,
        pickup: row.pickup,
        dropOff: row.destination,
        passenger: row.passenger_name || 'Client',
        price: Number(row.driver_price ?? row.price ?? 0) || 0,
        date,
        time,
      };
    });

    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Driver jobs fetch error', err);
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 });
  }
}
