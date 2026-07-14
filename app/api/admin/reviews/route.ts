import { NextResponse } from 'next/server';
import { getDbPool, DbRow } from '@/lib/db';
import { ensureReviewsVisibleColumn } from '@/lib/client-reviews';

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
  visible: number;
  created_at: string;
}>;

export async function GET() {
  try {
    await ensureReviewsVisibleColumn(pool);
    const [rows] = await pool.query<ReviewRow[]>(
      `SELECT id, client_id, journey_id, ref_no, reviewer_name, reviewer_email, rating, review, source, visible, created_at
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
      visible: Boolean(row.visible),
      createdAt: row.created_at,
    }));

    return NextResponse.json({ reviews });
  } catch (err) {
    console.error('Admin reviews fetch error', err);
    return NextResponse.json({ error: 'Failed to load reviews' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureReviewsVisibleColumn(pool);
    const body = await request.json();
    const id = Number(body?.id);
    const visible = Boolean(body?.visible);
    if (!id) {
      return NextResponse.json({ error: 'Missing review id' }, { status: 400 });
    }
    await pool.execute('UPDATE client_reviews SET visible = ? WHERE id = ? LIMIT 1', [visible ? 1 : 0, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin review update error', err);
    return NextResponse.json({ error: 'Failed to update review' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) {
      return NextResponse.json({ error: 'Missing review id' }, { status: 400 });
    }
    await pool.execute('DELETE FROM client_reviews WHERE id = ? LIMIT 1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Admin review delete error', err);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
