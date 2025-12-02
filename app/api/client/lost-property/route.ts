import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const journeyId = Number(body.journeyId);
    const description = String(body.description ?? '').trim();
    const details = String(body.details ?? '').trim();
    if (!email || !journeyId || !description) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id, u.id AS client_id
       FROM client_journeys cj
       INNER JOIN users u ON cj.client_id = u.id
       WHERE cj.id = ? AND u.email = ? LIMIT 1`,
      [journeyId, email]
    );
    const record = rows[0];
    if (!record) {
      return NextResponse.json({ error: 'Journey not found for this client' }, { status: 404 });
    }
    await pool.execute(
      `INSERT INTO client_lost_property (client_id, journey_id, item_description, details) VALUES (?, ?, ?, ?)`,
      [record.client_id, journeyId, description, details]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Lost property submit error', err);
    return NextResponse.json({ error: 'Failed to submit lost property report' }, { status: 500 });
  }
}
