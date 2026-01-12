import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'UPDATE client_journeys SET driver_name = ? WHERE id = ? LIMIT 1',
      ['Pending assignment', journeyId]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Unassign driver error', err);
    return NextResponse.json({ error: 'Failed to unassign driver' }, { status: 500 });
  }
}
