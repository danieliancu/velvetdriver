import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type LostRow = DbRow<{
  id: number;
  client_id: number | null;
  journey_id: number | null;
  ref_no: string | null;
  handed_in_by: string | null;
  received_at: string | null;
  booking_datetime: string | null;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  customer_phone: string;
  item_description: string;
  details: string;
  return_method: string | null;
  result: string | null;
  representative: string | null;
  status: string;
  created_at: string;
  source: 'guest' | 'client';
}>;

export async function GET() {
  try {
    const [rows] = await pool.query<LostRow[]>(
      `SELECT id, client_id, journey_id, ref_no, handed_in_by, received_at, booking_datetime, customer_name, customer_email, customer_address, customer_phone, item_description, details, return_method, result, representative, status, source, created_at
       FROM client_lost_property
       ORDER BY created_at DESC
       LIMIT 200`
    );

    const items = rows.map((row) => ({
      id: row.id,
      refNo: row.ref_no || (row.journey_id ? `VD_${row.journey_id}` : `LP-${row.id}`),
      journeyId: row.journey_id,
      handedInBy: row.handed_in_by,
      receivedAt: row.received_at,
      bookingDateTime: row.booking_datetime,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      customerAddress: row.customer_address,
      customerPhone: row.customer_phone,
      itemDescription: row.item_description,
      details: row.details,
      returnMethod: row.return_method,
      result: row.result,
      representative: row.representative,
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ items });
  } catch (err) {
    console.error('Admin lost property fetch error', err);
    return NextResponse.json({ error: 'Failed to load lost property' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const status = String(body.status ?? '').trim().toLowerCase();
    const returnMethod = body.returnMethod !== undefined ? String(body.returnMethod ?? '').trim() : undefined;
    const result = body.result !== undefined ? String(body.result ?? '').trim() : undefined;
    const representative = body.representative !== undefined ? String(body.representative ?? '').trim() : undefined;
    const allowed = new Set(['open', 'closed']);
    if (!id || !status || !allowed.has(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const updates = ['status = ?'];
    const params: Array<any> = [status];
    if (returnMethod !== undefined) {
      updates.push('return_method = ?');
      params.push(returnMethod || null);
    }
    if (result !== undefined) {
      updates.push('result = ?');
      params.push(result || null);
    }
    if (representative !== undefined) {
      updates.push('representative = ?');
      params.push(representative || null);
    }
    params.push(id);
    const [res] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_lost_property SET ${updates.join(', ')} WHERE id = ? LIMIT 1`,
      params
    );
    if (!res.affectedRows) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin lost property update error', err);
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
  }
}
