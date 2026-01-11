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

function formatJourneyDate(raw: any): string | null {
  if (!raw) return null;
  const dateValue = new Date(raw);
  if (Number.isNaN(dateValue.getTime())) {
    return String(raw);
  }
  return dateValue.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function validateJourneyForClient(journeyId: number | null, clientId: number | null) {
  if (!journeyId) return { journeyId: null, journeyRef: null, journeyDate: null as string | null };
  const params: Array<any> = [journeyId];
  let where = 'id = ?';
  if (clientId) {
    where += ' AND client_id = ?';
    params.push(clientId);
  }
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `SELECT id, journey_date FROM client_journeys WHERE ${where} LIMIT 1`,
    params
  );
  if (clientId && !rows.length) {
    throw new Error('INVALID_JOURNEY');
  }
  const journeyRow = rows[0];
  return {
    journeyId,
    journeyRef: `VD_${journeyId}`,
    journeyDate: formatJourneyDate(journeyRow?.journey_date),
  };
}

async function logAdminNotification(payload: {
  category: string;
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
        payload.category,
        payload.title,
        payload.message,
        payload.severity ?? 'warning',
        tagsJson,
        'client_complaints',
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
    const subject = String(body.subject ?? '').trim() || 'Complaint/Compliment';
    const details = String(body.details ?? '').trim();
    const fullName = String(body.fullName ?? '').trim();
    const address = String(body.address ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const bookingReference = String(body.bookingReference ?? '').trim();
    const bookingDateTimeInput = String(body.bookingDateTime ?? '').trim() || null;
    let bookingDate: string | null = bookingDateTimeInput;

    if (!subject || !details || !fullName || !address || !phone) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const clientId = isGuest ? null : await resolveClientId(email);
    let resolvedJourneyId: number | null = null;
    let journeyRef: string | null = bookingReference || null;
    try {
      const validated = await validateJourneyForClient(journeyId, clientId);
      resolvedJourneyId = validated.journeyId;
      journeyRef = journeyRef || validated.journeyRef;
      bookingDate = validated.journeyDate || bookingDate;
    } catch (err: any) {
      if (err?.message === 'INVALID_JOURNEY') {
        return NextResponse.json({ error: 'Journey not found for this client' }, { status: 404 });
      }
      throw err;
    }
    const bookingDateTime = bookingDate || bookingDateTimeInput;

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO client_complaints
       (client_id, journey_id, ref_no, booking_datetime, full_name, email, phone, address, subject, details, method_enquiry, resolution_result, representative_name, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        clientId,
        resolvedJourneyId,
        journeyRef || null,
        bookingDateTime,
        fullName,
        email || address || '',
        phone,
        address,
        subject,
        details,
        null,
        null,
        null,
        source,
      ]
    );

    await logAdminNotification({
      category: 'complaints',
      title: `New complaint${journeyRef ? ` (${journeyRef})` : ''}`,
      message: `${fullName} submitted a complaint${email ? ` (${email})` : ''}.`,
      severity: 'warning',
      relatedId: result.insertId,
      tags: {
        ref: journeyRef || 'n/a',
        phone,
        source,
      },
    });

    return NextResponse.json({ ok: true, id: result.insertId });
  } catch (err) {
    if (err instanceof Error && err.message === 'INVALID_JOURNEY') {
      return NextResponse.json({ error: 'Journey not found for this client' }, { status: 404 });
    }
    console.error('Complaint submit error', err);
    return NextResponse.json({ error: 'Failed to submit complaint' }, { status: 500 });
  }
}
