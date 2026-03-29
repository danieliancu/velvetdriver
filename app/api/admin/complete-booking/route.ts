import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { generateStatementForJourney } from '@/lib/statement-generation';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const journeyId = Number(body?.journeyId);
    if (!journeyId) {
      return NextResponse.json({ error: 'Missing journey id' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_journeys
          SET status = 'Completed'
        WHERE id = ?
          AND status = 'Upcoming'
        LIMIT 1`,
      [journeyId]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Booking not found or not upcoming' }, { status: 404 });
    }

    try {
      const statementResult = await generateStatementForJourney(pool, journeyId);
      if (statementResult.status === 'skipped') {
        return NextResponse.json({
          ok: true,
          warning: `Job marked as completed, but ${statementResult.reason}`,
        });
      }
    } catch (statementErr) {
      console.error('Complete booking statement generation error', statementErr);
      return NextResponse.json({
        ok: true,
        warning: 'Job marked as completed, but statement PDF could not be generated.',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Complete booking error', err);
    return NextResponse.json({ error: 'Failed to mark booking as completed' }, { status: 500 });
  }
}
