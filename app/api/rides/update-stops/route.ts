import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { calculateRideFare } from '@/lib/ride-fares';
import { loadRideForPayment, logRideChange, updateRideAuthorization } from '@/lib/ride-payments';

const pool = getDbPool();

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const rideId = Number(body?.rideId);
    const pickup = String(body?.pickup ?? '').trim();
    const dropOffs = Array.isArray(body?.dropOffs) ? body.dropOffs.map((value: string) => String(value || '').trim()).filter(Boolean) : [];
    if (!rideId || !pickup || !dropOffs.length) {
      return NextResponse.json({ error: 'Ride, pickup and drop-offs are required' }, { status: 400 });
    }

    await conn.beginTransaction();
    const ride = await loadRideForPayment(conn, rideId);
    const fare = await calculateRideFare(conn, {
      pickup,
      dropOffs,
      serviceType: body?.serviceType || 'Transfer',
      vehicleTypeId: body?.vehicleTypeId ? Number(body.vehicleTypeId) : null,
      waitingMinutes: body?.waitingMinutes ? Number(body.waitingMinutes) : null,
      tolls: body?.tolls ? Number(body.tolls) : null,
      surcharge: body?.surcharge ? Number(body.surcharge) : null,
      manualFareAdjustment: body?.manualFareAdjustment ? Number(body.manualFareAdjustment) : null,
      journeyTime: body?.time ? String(body.time) : null,
    });
    const destination = dropOffs
      .map((stop: string, index: number) => (index === dropOffs.length - 1 ? stop : `Stop ${index + 1}: ${stop}`))
      .join(', ');

    await conn.execute(
      `UPDATE client_journeys
          SET pickup = ?, destination = ?, price = ?, current_estimated_fare = ?, ride_status = 'trip_updated'
        WHERE id = ?
        LIMIT 1`,
      [pickup, destination, fare.estimatedFare, fare.estimatedFare, rideId]
    );

    const authResult = await updateRideAuthorization(conn, {
      rideId,
      newEstimatedAmount: fare.estimatedFare,
      source: body?.source === 'admin' ? 'admin' : 'customer',
      reason: body?.reason ? String(body.reason) : 'stops_updated',
      note: body?.note ? String(body.note) : null,
    });

    await logRideChange(conn, {
      rideId,
      changeSource: body?.source === 'admin' ? 'admin' : 'customer',
      changeReason: body?.reason ? String(body.reason) : 'stops_updated',
      note: body?.note ? String(body.note) : null,
      previousSnapshot: { currentEstimatedFare: Number(ride.current_estimated_fare ?? ride.price ?? 0) },
      nextSnapshot: { pickup, dropOffs, estimatedFare: fare.estimatedFare, extras: fare.extras },
      fareBefore: Number(ride.current_estimated_fare ?? ride.price ?? 0),
      fareAfter: fare.estimatedFare,
      paymentAdjustmentStatus: authResult.strategy,
    });
    await conn.commit();
    return NextResponse.json({ ok: true, fare, payment: authResult });
  } catch (err: any) {
    await conn.rollback();
    console.error('Ride update stops error', err);
    return NextResponse.json({ error: err?.message || 'Failed to update ride stops' }, { status: 500 });
  } finally {
    conn.release();
  }
}
