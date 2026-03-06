import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const quoteId = Number(body.id);
    if (!email || !quoteId) return NextResponse.json({ error: 'Missing email or quote reference' }, { status: 400 });

    const conn = await pool.getConnection();
    try {
      const [users] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      const user = users[0];
      if (!user) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

      const [quotes] = await conn.query<mysql.RowDataPacket[]>(
        'SELECT payload FROM client_saved_quotes WHERE id = ? AND client_id = ? LIMIT 1',
        [quoteId, user.id]
      );
      const quote = quotes[0];
      if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

      const payload = typeof quote.payload === 'string' ? JSON.parse(quote.payload) : quote.payload;
      const pickup = String(payload?.pickup ?? '').trim();
      const dropOffs: string[] = Array.isArray(payload?.dropOffs) ? payload.dropOffs.filter(Boolean).map((d: string) => String(d)) : [];
      const dateStr = String(payload?.date ?? '').trim();
      const timeStr = String(payload?.time ?? '').trim();
      const passengerName = String(payload?.passengerName ?? '').trim() || String(payload?.passenger_name ?? '').trim() || 'Passenger';
      const passengerEmail = String(payload?.passengerEmail ?? '').trim() || email;
      const passengerPhone = String(payload?.passengerPhone ?? '').trim() || '';
      const serviceType = String(payload?.serviceType ?? 'Transfer');
      const price = Number(payload?.totalFare ?? payload?.price ?? 0);
      const destination = dropOffs
        .map((stop: string, index: number) =>
          index === dropOffs.length - 1 ? stop : `Stop ${index + 1}: ${stop}`
        )
        .join(', ');

      let journeyDate: string | null = null;
      if (dateStr && timeStr) {
        const dt = new Date(`${dateStr}T${timeStr}`);
        if (!Number.isNaN(dt.getTime())) {
          journeyDate = dt.toISOString().slice(0, 19).replace('T', ' ');
        }
      }

      const [result] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO client_journeys
          (client_id, journey_date, pickup, destination, service_type, driver_name, car, plate, status, price, invoice_url, passenger_name, passenger_email, passenger_phone, vehicle_type_id, booking_payload)
         VALUES (?, ?, ?, ?, ?, 'Pending assignment', 'TBD', 'TBD', 'Upcoming', ?, NULL, ?, ?, ?, ?, ?)
         `,
        [
          user.id,
          journeyDate,
          pickup,
          destination || 'Destination TBD',
          serviceType,
          price,
          passengerName,
          passengerEmail,
          passengerPhone,
          payload?.vehicleTypeId ? Number(payload.vehicleTypeId) : null,
          JSON.stringify(payload),
        ]
      );

      return NextResponse.json({ id: result.insertId, status: 'Upcoming' });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Book saved quote error', err);
    return NextResponse.json({ error: 'Failed to book saved quote' }, { status: 500 });
  }
}
