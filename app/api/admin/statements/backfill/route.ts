import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { ensureDriverStatementsTable } from '@/lib/driver-statements';
import { generateStatementForJourney } from '@/lib/statement-generation';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    await ensureDriverStatementsTable(pool);

    const body = await request.json().catch(() => ({}));
    const requestedLimit = Number(body?.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0 ? Math.min(200, requestedLimit) : 100;
    const requestedJourneyId = Number(body?.journeyId);
    const force = Boolean(body?.force);

    let rows: mysql.RowDataPacket[] = [];

    if (requestedJourneyId) {
      const [singleRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT cj.id
           FROM client_journeys cj
          WHERE cj.id = ?
            AND cj.status = 'Completed'
          LIMIT 1`,
        [requestedJourneyId]
      );
      rows = singleRows;
    } else {
      if (force) {
        const [allRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT cj.id
             FROM client_journeys cj
            WHERE cj.status = 'Completed'
            ORDER BY cj.id DESC
            LIMIT ?`,
          [limit]
        );
        rows = allRows;
      } else {
        const [missingRows] = await pool.query<mysql.RowDataPacket[]>(
          `SELECT cj.id
             FROM client_journeys cj
             LEFT JOIN driver_statements ds ON ds.journey_id = cj.id
            WHERE cj.status = 'Completed'
              AND ds.id IS NULL
            ORDER BY cj.id ASC
            LIMIT ?`,
          [limit]
        );
        rows = missingRows;
      }
    }

    const generated: Array<{ journeyId: number; bookingRef: string; driverId: number }> = [];
    const skipped: Array<{ journeyId: number; bookingRef: string; reason: string }> = [];
    const failed: Array<{ journeyId: number; reason: string }> = [];

    for (const row of rows) {
      const journeyId = Number(row.id);
      try {
        const result = await generateStatementForJourney(pool, journeyId);
        if (result.status === 'generated') {
          generated.push({
            journeyId: result.journeyId,
            bookingRef: result.bookingRef,
            driverId: result.driverId,
          });
        } else {
          skipped.push({
            journeyId: result.journeyId,
            bookingRef: result.bookingRef,
            reason: result.reason,
          });
        }
      } catch (err: any) {
        console.error(`Statement backfill failed for journey ${journeyId}`, err);
        failed.push({
          journeyId,
          reason: err?.message || 'Unknown statement generation failure',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: rows.length,
      generatedCount: generated.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      generated,
      skipped,
      failed,
    });
  } catch (err) {
    console.error('Statements backfill error', err);
    return NextResponse.json({ error: 'Failed to backfill statements' }, { status: 500 });
  }
}
