import { NextResponse } from 'next/server';
import { computeGoogleRoute } from '@/lib/google-routes';

export async function GET() {
  try {
    await computeGoogleRoute({
      origin: 'Charing Cross, London',
      destination: 'Liverpool Street Station, London',
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Google Routes API unavailable' },
      { status: 200 }
    );
  }
}
