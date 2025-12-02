import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

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

    if (!pickup || !dropOffs.length || !date || !time || !passengerName || !passengerEmail || !passengerPhone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const journeyDate = new Date(`${date}T${time}`);
    if (Number.isNaN(journeyDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date or time' }, { status: 400 });
    }

    let clientId: number | null = null;
    if (body.clientEmail) {
      const email = String(body.clientEmail ?? '').trim().toLowerCase();
      if (email) {
        const [users] = await pool.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
        const user = users[0];
        if (user) clientId = Number(user.id);
      }
    }

    const destination = dropOffs
      .map((stop: string, index: number) => (index === 0 ? stop : `Stop ${index + 1}: ${stop}`))
      .join(', ');

    const payload = {
      ...body,
      pickup,
      dropOffs,
    };

    await pool.execute(
      `INSERT INTO client_journeys
        (client_id, journey_date, pickup, destination, service_type, driver_name, car, plate, status, price, invoice_url, passenger_name, passenger_email, passenger_phone, booking_payload)
       VALUES (?, ?, ?, ?, ?, 'Pending assignment', 'TBD', 'TBD', 'Upcoming', ?, NULL, ?, ?, ?, ?)`,
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
        JSON.stringify(payload),
      ]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Booking create error', err);
    return NextResponse.json({ error: 'Failed to submit booking' }, { status: 500 });
  }
}
