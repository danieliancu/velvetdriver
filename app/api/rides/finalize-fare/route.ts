import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { loadRideForPayment } from '@/lib/ride-payments';

const pool = getDbPool();

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const rideId = Number(body?.rideId);
    const finalFare = Number(body?.finalFare ?? 0);
    if (!rideId || !Number.isFinite(finalFare) || finalFare < 0) {
      return NextResponse.json({ error: 'Invalid ride or final fare' }, { status: 400 });
    }
    await conn.beginTransaction();
    const ride = await loadRideForPayment(conn, rideId);
    await conn.execute(
      `UPDATE client_journeys
          SET final_fare = ?, fare_finalized_at = NOW(), ride_status = 'fare_finalized'
        WHERE id = ?
        LIMIT 1`,
      [finalFare, rideId]
    );
    await conn.commit();
    return NextResponse.json({
      ok: true,
      rideId,
      previousFare: Number(ride.current_estimated_fare ?? ride.price ?? 0),
      finalFare,
    });
  } catch (err: any) {
    await conn.rollback();
    return NextResponse.json({ error: err?.message || 'Failed to finalize fare' }, { status: 500 });
  } finally {
    conn.release();
  }
}
