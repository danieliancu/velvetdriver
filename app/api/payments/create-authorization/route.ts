import { NextResponse } from 'next/server';
import { createBookingAuthorization } from '@/lib/ride-payments';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amount = Number(body?.amount ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    const result = await createBookingAuthorization({
      amount,
      currency: String(body?.currency ?? 'gbp'),
      passengerName: String(body?.passengerName ?? ''),
      passengerEmail: String(body?.passengerEmail ?? ''),
      pickup: String(body?.pickup ?? ''),
      dropOffs: Array.isArray(body?.dropOffs) ? body.dropOffs : [],
      rideId: body?.rideId ? Number(body.rideId) : null,
      customerId: body?.customerId ? String(body.customerId) : null,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Create authorization error', err);
    return NextResponse.json({ error: err?.message || 'Failed to create authorization' }, { status: 500 });
  }
}
