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
        'lost_property',
        payload.title,
        payload.message,
        payload.severity ?? 'info',
        tagsJson,
        'client_lost_property',
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
    const journeyId = Number(body.journeyId) || null;
    const description = String(body.description ?? '').trim();
    const details = String(body.details ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const address = String(body.address ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const bookingReference = String(body.bookingReference ?? '').trim();
    const bookingDateTime = String(body.bookingDateTime ?? '').trim();
    const representativeTag = String(body.representative ?? '').trim();

    if (!description || !details || !fullName || !address || !phone) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const clientId = await resolveClientId(email);
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

    const [resultSet] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO client_lost_property
       (client_id, journey_id, ref_no, handed_in_by, received_at, booking_datetime, customer_name, customer_email, customer_address, customer_phone, item_description, details, return_method, result, representative, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        resolvedJourneyId,
        journeyRef || null,
        null,
        null,
        bookingDateTime || null,
        fullName,
        email || '',
        address,
        phone,
        description,
        details,
        null,
        null,
        null,
        email ? 'client' : 'guest',
      ]
    );

    await logAdminNotification({
      title: `Lost property reported${journeyRef ? ` (${journeyRef})` : ''}`,
      message: `${fullName} submitted a lost property form${email ? ` (${email})` : ''}.`,
      severity: 'warning',
      relatedId: resultSet.insertId,
      tags: {
        ref: journeyRef || 'n/a',
        phone,
        representative: representativeTag || 'n/a',
        source: email ? 'client' : 'guest',
      },
    });

    return NextResponse.json({ ok: true, id: resultSet.insertId });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_JOURNEY') {
      return NextResponse.json({ error: 'Journey not found for this client' }, { status: 404 });
    }
    console.error('Lost property submit error', err);
    return NextResponse.json({ error: 'Failed to submit lost property report' }, { status: 500 });
  }
}
