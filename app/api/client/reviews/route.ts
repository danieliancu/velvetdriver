import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

async function resolveClientId(email?: string | null) {
  if (!email) return null;
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    'SELECT id FROM users WHERE email = ? LIMIT 1',
    [email.trim().toLowerCase()]
  );
  return rows[0]?.id ?? null;
}

async function validateJourneyForClient(journeyId: number | null, clientId: number | null) {
  if (!journeyId) return { journeyId: null, journeyRef: null };
  if (!clientId) return { journeyId, journeyRef: `VD_${journeyId}` };
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id FROM client_journeys WHERE id = ? AND client_id = ? LIMIT 1`,
    [journeyId, clientId]
  );
  if (!rows.length) {
    throw new Error('INVALID_JOURNEY');
  }
  return { journeyId, journeyRef: `VD_${journeyId}` };
}

async function logAdminNotification(payload: {
  title: string;
  message: string;
  severity?: 'critical' | 'warning' | 'info' | 'success';
  relatedId?: number;
  tags?: Record<string, string | number | null | undefined>;
}) {
  try {
    const tagsJson = payload.tags ? JSON.stringify(payload.tags) : null;
    await pool.execute(
      `INSERT INTO admin_notifications (category, title, message, severity, tags, related_table, related_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'reviews',
        payload.title,
        payload.message,
        payload.severity ?? 'success',
        tagsJson,
        'client_reviews',
        payload.relatedId ?? null,
      ]
    );
  } catch (err) {
    console.error('Admin notification insert failed', err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const requestedSource = String(body.source ?? '').trim().toLowerCase();
    const isGuest = body.isGuest === true || requestedSource === 'guest';
    const source = isGuest ? 'guest' : 'client';
    const journeyId = Number(body.journeyId) || null;
    const rating = Number(body.rating);
    const review = String(body.review ?? '').trim();
    const bookingReference = String(body.bookingReference ?? '').trim();
    const bookingDate = String(body.bookingDate ?? '').trim();
    const reviewerName = String(body.reviewerName ?? '').trim();

    if (!rating || rating < 1 || rating > 5 || !review) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const clientId = isGuest ? null : await resolveClientId(email);
    let resolvedJourneyId: number | null = null;
    let journeyRef: string | null = bookingReference || null;
    try {
      const validated = await validateJourneyForClient(journeyId, clientId);
      resolvedJourneyId = validated.journeyId;
      journeyRef = journeyRef || validated.journeyRef;
    } catch (err: any) {
      if (err?.message === 'INVALID_JOURNEY') {
        return NextResponse.json({ error: 'Journey not found for this client' }, { status: 404 });
      }
      throw err;
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO client_reviews
       (client_id, journey_id, ref_no, booking_date, reviewer_name, reviewer_email, rating, review, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        resolvedJourneyId,
        journeyRef || null,
        bookingDate || null,
        reviewerName || '',
        email || '',
        rating,
        review,
        source,
      ]
    );

    await logAdminNotification({
      title: `New review${journeyRef ? ` (${journeyRef})` : ''}`,
      message: `${reviewerName || 'A customer'} left a ${rating}-star review.`,
      severity: rating <= 2 ? 'warning' : 'success',
      relatedId: result.insertId,
      tags: {
        ref: journeyRef || 'n/a',
        rating,
        source,
        reviewer: reviewerName || 'n/a',
        email: email || 'n/a',
      },
    });

    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_JOURNEY') {
      return NextResponse.json({ error: 'Journey not found for this client' }, { status: 404 });
    }
    console.error('Review submit error', err);
    return NextResponse.json({ error: 'Failed to submit review' }, { status: 500 });
  }
}
