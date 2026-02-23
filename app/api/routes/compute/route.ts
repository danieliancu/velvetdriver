import { NextResponse } from 'next/server';
import { computeGoogleRoute } from '@/lib/google-routes';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      origin?: string;
      destination?: string;
      intermediates?: string[];
    };

    const origin = String(body.origin || '').trim();
    const destination = String(body.destination || '').trim();
    const intermediates = Array.isArray(body.intermediates) ? body.intermediates : [];

    if (!origin || !destination) {
      return NextResponse.json({ error: 'Origin and destination are required' }, { status: 400 });
    }

    const route = await computeGoogleRoute({ origin, destination, intermediates });
    return NextResponse.json({ ok: true, ...route });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to compute route' },
      { status: 503 }
    );
  }
}
