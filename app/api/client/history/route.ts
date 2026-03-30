import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

const stripStopLabel = (value: string) => value.replace(/^Stop\s+\d+:\s*/i, '').trim();
const parseDestinationStops = (destination: string) => {
  const raw = String(destination || '').trim();
  if (!raw) return [''];
  if (!raw.includes('Stop ')) return [raw];
  return raw
    .split(', ')
    .map((part) => stripStopLabel(part))
    .filter(Boolean);
};

const TIME_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

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
              cj.invoice_url,
              cj.booking_payload,
              cj.updated_at
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
      let payload: Record<string, any> = {};
      if (row.booking_payload) {
        try {
          payload = typeof row.booking_payload === 'string' ? JSON.parse(row.booking_payload) : row.booking_payload;
        } catch {
          payload = {};
        }
      }
      const modificationHistory = Array.isArray(payload?.modificationHistory) ? payload.modificationHistory : [];
      const lastModifiedAtRaw = payload?.lastModifiedAt || (modificationHistory.length ? modificationHistory[modificationHistory.length - 1]?.timestamp : null);
      const lastModifiedAt = lastModifiedAtRaw ? new Date(String(lastModifiedAtRaw)) : null;
      const hasModifications = Boolean(lastModifiedAt && !Number.isNaN(lastModifiedAt.getTime()));
      const diffMs = dateValue ? dateValue.getTime() - Date.now() : 0;
      const canModify = row.status === 'Upcoming' && diffMs >= 6 * 60 * 60 * 1000;
      const canEditTime = row.status === 'Upcoming' && diffMs >= TIME_EDIT_WINDOW_MS;

      return {
        id: row.id,
        date: formattedDate,
        journeyDateIso: dateValue && !Number.isNaN(dateValue.getTime()) ? dateValue.toISOString() : null,
        pickup: row.pickup,
        destination: row.destination,
        dropOffs:
          Array.isArray(payload?.dropOffs) && payload.dropOffs.length
            ? payload.dropOffs.map((stop: unknown) => String(stop || '').trim()).filter(Boolean)
            : parseDestinationStops(String(row.destination || '')),
        serviceType: row.service_type || 'Transfer',
        driver: row.driver_name_display || '-',
        car: row.car_display || '-',
        plate: row.plate_display || '-',
        status: row.status,
        displayStatus: row.status === 'Upcoming' && hasModifications ? 'Modified' : null,
        modifiedAt: hasModifications ? lastModifiedAt!.toISOString() : null,
        canModify,
        canEditTime,
        price: Number(row.price),
        flightNumber: String(payload?.flightNumber || '').trim(),
        passengers: Math.max(0, Number(payload?.passengers) || 0),
        specialRequests: [String(payload?.specialEvents || '').trim(), String(payload?.notes || '').trim()]
          .filter(Boolean)
          .join(' | '),
        invoiceUrl: row.invoice_url,
      };
    });
    return NextResponse.json({ journeys });
  } catch (err) {
    console.error('History fetch error', err);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }
}
