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

const formatPriceDetails = (price: number, extras?: unknown) => {
  const base = `£${price.toFixed(2)}`;
  if (!Array.isArray(extras) || extras.length === 0) return base;
  const cleanedExtras = extras.map((entry) => String(entry).replace(/^Extras applied:\s*/i, '').trim());
  return `${base} ( ${cleanedExtras.join(' + ')} )`;
};

const buildNotes = (payload: any) => {
  const pieces = [
    payload?.flightNumber ? `Flight ${payload.flightNumber}` : null,
    payload?.specialEvents || null,
    payload?.notes || null,
  ].filter(Boolean);
  return pieces.length ? pieces.join(' - ') : '—';
};

export async function GET() {
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_phone,
              cj.price,
              cj.booking_payload,
              cj.service_type,
              u.name AS client_name
         FROM client_journeys cj
         LEFT JOIN users u ON cj.client_id = u.id
        WHERE cj.status <> 'Completed'
        ORDER BY cj.journey_date ASC`
    );

    const bookings = rows.map((row) => {
      let payload: any = null;
      if (row.booking_payload) {
        try {
          payload = typeof row.booking_payload === 'string' ? JSON.parse(row.booking_payload) : row.booking_payload;
        } catch {
          payload = null;
        }
      }
      const { date, time } = formatDate(String(row.journey_date));
      const priceNumber = Number(row.price ?? payload?.totalFare ?? 0) || 0;
      return {
        id: Number(row.id),
        code: `VD-${String(row.id).padStart(4, '0')}`,
        pickup: row.pickup,
        dropOff: row.destination,
        passenger: row.passenger_name || payload?.passengerName || 'Guest Passenger',
        phone: row.passenger_phone || payload?.passengerPhone || '',
        bookedBy: row.client_name || payload?.passengerName || 'Guest Booking',
        notes: buildNotes(payload),
        date,
        time,
        priceDetails: formatPriceDetails(priceNumber, payload?.extras),
      };
    });

    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('Admin live bookings fetch error', err);
    return NextResponse.json({ error: 'Failed to load live bookings' }, { status: 500 });
  }
}
