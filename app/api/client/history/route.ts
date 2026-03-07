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
       INNER JOIN users u ON cj.client_id = u.id
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
       WHERE u.email = ? AND cj.status <> 'Saved'
       ORDER BY cj.journey_date DESC`,
      [email]
    );
    const journeys = rows.map((row) => {
      const dateValue = row.journey_date ? new Date(row.journey_date) : null;
      const formattedDate =
        dateValue && !Number.isNaN(dateValue.getTime())
          ? dateValue.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          : '-';
      return {
        id: row.id,
        date: formattedDate,
        pickup: row.pickup,
        destination: row.destination,
        serviceType: row.service_type || 'Transfer',
        driver: row.driver_name_display || '-',
        car: row.car_display || '-',
        plate: row.plate_display || '-',
        status: row.status,
        price: Number(row.price),
        invoiceUrl: row.invoice_url,
      };
    });
    return NextResponse.json({ journeys });
  } catch (err) {
    console.error('History fetch error', err);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
