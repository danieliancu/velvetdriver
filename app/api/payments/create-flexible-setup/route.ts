import { NextResponse } from 'next/server';
import { createFlexibleSetupIntent } from '@/lib/ride-payments';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createFlexibleSetupIntent({
      passengerName: String(body?.passengerName ?? ''),
      passengerEmail: String(body?.passengerEmail ?? ''),
      pickup: String(body?.pickup ?? ''),
      dropOffs: Array.isArray(body?.dropOffs) ? body.dropOffs : [],
      rideId: body?.rideId ? Number(body.rideId) : null,
      customerId: body?.customerId ? String(body.customerId) : null,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Create flexible setup intent error', err);
    return NextResponse.json({ error: err?.message || 'Failed to save card for later payment' }, { status: 500 });
  }
}
