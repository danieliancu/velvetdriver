import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const pool = getDbPool();

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

const resolveJobType = (vehicleLabel?: string) => {
  const normalized = String(vehicleLabel || '').toLowerCase();
  if (normalized.includes('luxury mpv')) return 'LUXURY MPV';
  if (normalized.includes('luxury')) return 'LUXURY';
  return 'EXECUTIVE';
};

const resolvePriceType = (paymentMethod?: string) => {
  const normalized = String(paymentMethod || '').toLowerCase();
  if (normalized.includes('account')) return 'ACCOUNT';
  if (normalized.includes('cash') || normalized.includes('card')) return 'CASH/CARD';
  return 'PAYED';
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const [drivers] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id,
              d.first_and_middle_name,
              d.surname
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
    const driverFullName = [drivers[0]?.first_and_middle_name, drivers[0]?.surname]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(' ');
    const driverIdText = String(driverId).trim();
    const driverFullNameLower = driverFullName.toLowerCase();
    const driverIdLower = driverIdText.toLowerCase();

    const [nextRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_phone,
              cj.price,
              cj.driver_price,
              cj.booking_payload,
              pv.label AS vehicle_label
       FROM client_journeys cj
       LEFT JOIN pricing_vehicles pv ON pv.id = cj.vehicle_type_id
       WHERE cj.status = 'Upcoming'
         AND cj.journey_date > NOW()
         AND (
              LOWER(TRIM(cj.driver_name)) = ?
              OR LOWER(TRIM(cj.driver_name)) = ?
         )
       ORDER BY cj.journey_date ASC, cj.id ASC`,
      [driverIdLower, driverFullNameLower]
    );

    const [completedRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_phone,
              cj.price,
              cj.driver_price,
              cj.booking_payload,
              pv.label AS vehicle_label
       FROM client_journeys cj
       LEFT JOIN pricing_vehicles pv ON pv.id = cj.vehicle_type_id
       WHERE cj.status = 'Completed'
         AND (
              LOWER(TRIM(cj.driver_name)) = ?
              OR LOWER(TRIM(cj.driver_name)) = ?
         )
       ORDER BY cj.journey_date DESC, cj.id DESC`,
      [driverIdLower, driverFullNameLower]
    );

    const mapJob = (row: mysql.RowDataPacket) => {
      let payload: any = null;
      if (row.booking_payload) {
        try {
          payload =
            typeof row.booking_payload === 'string'
              ? JSON.parse(row.booking_payload)
              : row.booking_payload;
        } catch {
          payload = null;
        }
      }
      const { date, time } = formatDate(String(row.journey_date));
      const paymentMethod = String(payload?.paymentMethod || payload?.paymentType || '').trim();
      const vehicleLabel =
        String(row.vehicle_label || payload?.vehicle || payload?.vehicleLabel || payload?.vehicleTypeLabel || '')
          .trim();
      return {
        id: Number(row.id),
        code: `VD-${String(row.id).padStart(4, '0')}`,
        pickup: row.pickup,
        destination: row.destination,
        passenger: row.passenger_name || 'Client',
        phone: row.passenger_phone || payload?.passengerPhone || '-',
        jobType: resolveJobType(vehicleLabel),
        priceType: resolvePriceType(paymentMethod),
        price: Number(row.driver_price ?? row.price ?? 0) || 0,
        date,
        time,
      };
    };

    const nextJobs = nextRows.map(mapJob);
    const completedJobs = completedRows.map(mapJob);

    return NextResponse.json({ nextJobs, completedJobs });
  } catch (err) {
    console.error('Driver jobs fetch error', err);
    return NextResponse.json({ error: 'Failed to load jobs' }, { status: 500 });
  }
}
