import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { sendPendingDocumentExpiryNotifications } from '@/lib/document-expiry-notifications';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const authHeader = request.headers.get('authorization') || '';
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pool = getDbPool();
    const result = await sendPendingDocumentExpiryNotifications(pool);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('Document expiry cron error', err);
    return NextResponse.json({ error: 'Failed to process document expiry notifications' }, { status: 500 });
  }
}
