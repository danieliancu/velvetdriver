import fs from 'fs';
import path from 'path';
import { getDbPool } from '../lib/db';
import { ensureDriverStatementsTable } from '../lib/driver-statements';
import { generateStatementForJourney } from '../lib/statement-generation';

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadDotEnvLocal();

  const pool = getDbPool();
  await ensureDriverStatementsTable(pool);

  const [rows] = await pool.query<any[]>(
    `SELECT cj.id
       FROM client_journeys cj
       LEFT JOIN driver_statements ds ON ds.journey_id = cj.id
      WHERE cj.status = 'Completed'
        AND ds.id IS NULL
      ORDER BY cj.id ASC`
  );

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
      failed.push({
        journeyId,
        reason: err?.message || 'Unknown statement generation failure',
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        processed: rows.length,
        generatedCount: generated.length,
        skippedCount: skipped.length,
        failedCount: failed.length,
        generated,
        skipped,
        failed,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
