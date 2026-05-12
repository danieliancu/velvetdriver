import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { calculateRideFare } from '@/lib/ride-fares';
import { loadRideForPayment } from '@/lib/ride-payments';

const pool = getDbPool();
const TIME_EDIT_WINDOW_MS = 2 * 60 * 60 * 1000;

const formatTimeValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const rideId = Number(body?.rideId);
    if (!rideId) {
      return NextResponse.json({ error: 'Missing ride id' }, { status: 400 });
    }

    const [existingRows] = await conn.query<any[]>(
      `SELECT pickup, destination, journey_date, service_type, vehicle_type_id, price, current_estimated_fare
         FROM client_journeys
        WHERE id = ?
        LIMIT 1`,
      [rideId]
    );
    const existing = existingRows[0];
    if (!existing) {
      return NextResponse.json({ error: 'Ride not found' }, { status: 404 });
    }

    const pickup = String(body?.pickup ?? existing.pickup ?? '').trim();
    const dropOffs = Array.isArray(body?.dropOffs)
      ? body.dropOffs.map((value: string) => String(value || '').trim()).filter(Boolean)
      : String(existing.destination || '')
          .split(', ')
          .map((value: string) => value.replace(/^Stop \d+:\s*/i, '').trim())
          .filter(Boolean);
    const serviceType = String(body?.serviceType ?? existing.service_type ?? 'Transfer');
    const vehicleTypeId = body?.vehicleTypeId ? Number(body.vehicleTypeId) : Number(existing.vehicle_type_id || 0) || null;
    const journeyDate = body?.journeyDate ? new Date(String(body.journeyDate)) : new Date(existing.journey_date);
    const timeEditLocked = new Date(existing.journey_date).getTime() - Date.now() < TIME_EDIT_WINDOW_MS;
    if (timeEditLocked && formatTimeValue(existing.journey_date) !== formatTimeValue(journeyDate)) {
      return NextResponse.json(
        { error: 'Pickup time can no longer be changed within 2 hours of the journey.' },
        { status: 400 }
      );
    }

    const fare = await calculateRideFare(conn, {
      pickup,
      dropOffs,
      serviceType,
      vehicleTypeId,
      waitingMinutes: body?.waitingMinutes ? Number(body.waitingMinutes) : null,
      tolls: body?.tolls ? Number(body.tolls) : null,
      surcharge: body?.surcharge ? Number(body.surcharge) : null,
      manualFareAdjustment: body?.manualFareAdjustment ? Number(body.manualFareAdjustment) : null,
      journeyTime: body?.journeyTime ? String(body.journeyTime) : null,
    });

    const ride = await loadRideForPayment(conn, rideId);
    const currentFare = Number(ride.current_estimated_fare ?? ride.price ?? existing.current_estimated_fare ?? existing.price ?? 0) || 0;

    return NextResponse.json({
      ok: true,
      currentFare,
      newFare: fare.estimatedFare,
      difference: Number((fare.estimatedFare - currentFare).toFixed(2)),
      fare,
    });
  } catch (err: any) {
    console.error('Ride preview fare error', err);
    return NextResponse.json({ error: err?.message || 'Failed to preview fare' }, { status: 500 });
  } finally {
    conn.release();
  }
}
