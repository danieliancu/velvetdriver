import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

async function getClientJourneyColumns() {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'client_journeys'`
  );
  return new Set(rows.map((row) => String(row.COLUMN_NAME || '')));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const clientJourneyColumns = await getClientJourneyColumns();
    const updateParts = [
      'driver_name = ?',
      'driver_commission_applied = NULL',
      'driver_price = NULL',
    ];
    if (clientJourneyColumns.has('driver_id')) {
      updateParts.splice(1, 0, 'driver_id = NULL');
    }
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_journeys
          SET ${updateParts.join(',\n              ')}
        WHERE id = ?
        LIMIT 1`,
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
