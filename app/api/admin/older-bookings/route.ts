import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

async function getClientJourneyColumns() {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_journeys'`
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '')));
}

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { date: '', time: '' };
  return {
    date: date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
};

const formatPriceDetails = (price: number, extras?: unknown) => {
  const base = `GBP ${price.toFixed(2)}`;
  if (!Array.isArray(extras) || extras.length === 0) return base;
  const cleanedExtras = extras
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.replace(/^Extras applied:\s*/i, '').trim();
      }
      if (entry && typeof entry === 'object') {
        const label = 'label' in entry ? String((entry as { label?: unknown }).label || '').trim() : '';
        const amountRaw = 'amount' in entry ? Number((entry as { amount?: unknown }).amount) : NaN;
        if (label && Number.isFinite(amountRaw) && amountRaw > 0) {
          return `${label} GBP ${amountRaw.toFixed(2)}`;
        }
        if (label) return label;
      }
      return String(entry || '').replace(/^Extras applied:\s*/i, '').trim();
    })
    .filter(Boolean);
  if (!cleanedExtras.length) return base;
  return `${base} ( ${cleanedExtras.join(' + ')} )`;
};

const buildNotes = (payload: any) => {
  const pieces = [
    payload?.flightNumber ? `Flight ${payload.flightNumber}` : null,
    payload?.specialEvents || null,
    payload?.notes || null,
  ].filter(Boolean);
  return pieces.length ? pieces.join(' - ') : '-';
};

export async function GET() {
  try {
    const existingColumns = await getClientJourneyColumns();
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.passenger_phone,
              cj.passenger_email,
              cj.driver_name,
              ${existingColumns.has('driver_id') ? 'cj.driver_id' : 'NULL AS driver_id'},
              cj.client_confirmed,
              cj.status,
              cj.created_at,
              cj.updated_at,
              cj.price,
              cj.booking_payload,
              cj.booked_by_staff_id,
              cj.service_type,
              cj.vehicle_type_id,
              u.email AS client_email
         , staff.full_name AS staff_name
         , pv.label AS vehicle_label
         FROM client_journeys cj
         LEFT JOIN users u ON cj.client_id = u.id
         LEFT JOIN admin_staff staff ON cj.booked_by_staff_id = staff.id
         LEFT JOIN pricing_vehicles pv ON pv.id = cj.vehicle_type_id
        WHERE cj.status IN ('Completed', 'Cancelled')
        ORDER BY cj.journey_date DESC, cj.id DESC`
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
      const bookedByStaffId = row.booked_by_staff_id ? Number(row.booked_by_staff_id) : null;
      const bookedByName = row.staff_name || null;
      const vehicleLabel =
        row.vehicle_label || payload?.vehicle || payload?.vehicleLabel || payload?.vehicleTypeLabel || 'Unknown';
      const rawDriverName = String(row.driver_name ?? '').trim();
      const driverIdFromColumn = row.driver_id !== null && row.driver_id !== undefined ? String(row.driver_id).trim() : '';
      const driverId =
        driverIdFromColumn ||
        (rawDriverName && rawDriverName.toLowerCase() !== 'pending assignment' && /^\d+$/.test(rawDriverName)
          ? rawDriverName
          : '');
      const driverName =
        rawDriverName && rawDriverName.toLowerCase() !== 'pending assignment' && !/^\d+$/.test(rawDriverName)
          ? rawDriverName
          : '';
      return {
        journeyId: Number(row.id),
        id: Number(row.id),
        code: `VD-${String(row.id).padStart(4, '0')}`,
        status: String(row.status || ''),
        journeyDate: row.journey_date ? String(row.journey_date) : null,
        pickup: row.pickup,
        dropOff: row.destination,
        passenger: row.passenger_name || payload?.passengerName || 'Guest Passenger',
        phone: row.passenger_phone || payload?.passengerPhone || '',
        bookedBy: bookedByName || row.client_email || payload?.passengerName || 'Guest Booking',
        bookedByStaffId,
        notes: buildNotes(payload),
        date,
        time,
        priceDetails: formatPriceDetails(priceNumber, payload?.extras),
        vehicle: vehicleLabel,
        serviceType: row.service_type || payload?.serviceType || 'Transfer',
        vehicleTypeId: row.vehicle_type_id ? Number(row.vehicle_type_id) : null,
        passengerEmail: row.passenger_email || payload?.passengerEmail || '',
        clientEmail: row.client_email || '',
        driverId,
        driverName,
        clientConfirmed: Boolean(row.client_confirmed),
        createdAt: row.created_at ? String(row.created_at) : null,
        updatedAt: row.updated_at ? String(row.updated_at) : null,
      };
    });

    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('Admin older bookings fetch error', err);
    return NextResponse.json({ error: 'Failed to load older bookings' }, { status: 500 });
  }
}
