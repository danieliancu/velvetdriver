import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { updateRideAuthorization } from '@/lib/ride-payments';

const pool = getDbPool();

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const rideId = Number(body?.rideId);
    const newEstimatedAmount = Number(body?.newEstimatedAmount ?? 0);
    if (!rideId || !Number.isFinite(newEstimatedAmount) || newEstimatedAmount < 0) {
      return NextResponse.json({ error: 'Invalid ride or amount' }, { status: 400 });
    }
    await conn.beginTransaction();
    const result = await updateRideAuthorization(conn, {
      rideId,
      newEstimatedAmount,
      source: body?.source === 'admin' ? 'admin' : body?.source === 'system' ? 'system' : 'customer',
      reason: body?.reason ? String(body.reason) : null,
      note: body?.note ? String(body.note) : null,
      paymentIntentId: body?.paymentIntentId ? String(body.paymentIntentId) : null,
    });
    await conn.commit();
    return NextResponse.json(result);
  } catch (err: any) {
    await conn.rollback();
    console.error('Update authorization error', err);
    return NextResponse.json({ error: err?.message || 'Failed to update authorization' }, { status: 500 });
  } finally {
    conn.release();
  }
}
