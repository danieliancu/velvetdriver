import { NextResponse } from 'next/server';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type ReviewRow = DbRow<{
  id: number;
  client_id: number | null;
  journey_id: number | null;
  ref_no: string | null;
  reviewer_name: string | null;
  reviewer_email: string | null;
  rating: number;
  review: string;
  source: 'guest' | 'client';
  created_at: string;
}>;

export async function GET() {
  try {
    const [rows] = await pool.query<ReviewRow[]>(
      `SELECT id, client_id, journey_id, ref_no, reviewer_name, reviewer_email, rating, review, source, created_at
       FROM client_reviews
       ORDER BY created_at DESC
       LIMIT 200`
    );

    const reviews = rows.map((row) => ({
      id: row.id,
      refNo: row.ref_no || (row.journey_id ? `VD_${row.journey_id}` : `RV-${row.id}`),
      journeyId: row.journey_id,
      reviewerName: row.reviewer_name,
      reviewerEmail: row.reviewer_email,
      rating: row.rating,
      review: row.review,
      source: row.source,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error('Admin reviews fetch error', err);
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 });
  }
}
