import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const journeyId = Number(body.journeyId);
    const rating = Number(body.rating);
    const review = String(body.review ?? '').trim();
    if (!email || !journeyId || !rating || !review) {
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
      `INSERT INTO client_reviews (client_id, journey_id, rating, review) VALUES (?, ?, ?, ?)`,
      [record.client_id, journeyId, rating, review]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Review submit error', err);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
