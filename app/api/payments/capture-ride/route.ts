import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { captureRidePayment } from '@/lib/ride-payments';

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
    const result = await captureRidePayment(conn, { rideId, finalFare });
    await conn.commit();
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (err: any) {
    await conn.rollback();
    console.error('Capture ride payment error', err);
    return NextResponse.json({ error: err?.message || 'Failed to capture ride payment' }, { status: 500 });
  } finally {
    conn.release();
  }
}
