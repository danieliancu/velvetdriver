import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    const confirmed = Boolean(body?.confirmed);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'UPDATE client_journeys SET client_confirmed = ? WHERE id = ? LIMIT 1',
      [confirmed ? 1 : 0, journeyId]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Client confirmation update error', err);
    return NextResponse.json({ error: 'Failed to update client confirmation' }, { status: 500 });
  }
}
