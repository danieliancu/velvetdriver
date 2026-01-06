import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type ComplaintRow = DbRow<{
  id: number;
  client_id: number | null;
  journey_id: number | null;
  ref_no: string | null;
  booking_datetime: string | null;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  subject: string;
  details: string;
  method_enquiry: string | null;
  resolution_result: string | null;
  representative_name: string | null;
  status: string;
  created_at: string;
  source: 'guest' | 'client';
}>;

export async function GET() {
  try {
    const [rows] = await pool.query<ComplaintRow[]>(
      `SELECT id, client_id, journey_id, ref_no, booking_datetime, full_name, email, phone, address, subject, details, method_enquiry, resolution_result, representative_name, status, source, created_at
       FROM client_complaints
       ORDER BY created_at DESC
       LIMIT 200`
    );

    const complaints = rows.map((row) => ({
      id: row.id,
      refNo: row.ref_no || (row.journey_id ? `VD_${row.journey_id}` : `CC-${row.id}`),
      journeyId: row.journey_id,
      bookingDateTime: row.booking_datetime,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      subject: row.subject,
      details: row.details,
      methodEnquiry: row.method_enquiry,
      resolutionResult: row.resolution_result,
      representativeName: row.representative_name,
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ complaints });
  } catch (err) {
    console.error('Admin complaints fetch error', err);
    return NextResponse.json({ error: 'Failed to load complaints' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const status = String(body.status ?? '').trim().toLowerCase();
    const allowed = new Set(['open', 'closed', 'in_progress', 'resolved']);
    const methodEnquiry =
      body.methodEnquiry !== undefined ? String(body.methodEnquiry ?? '').trim() : undefined;
    const resolutionResult =
      body.resolutionResult !== undefined ? String(body.resolutionResult ?? '').trim() : undefined;
    const representativeName =
      body.representativeName !== undefined ? String(body.representativeName ?? '').trim() : undefined;
    if (!id || !status || !allowed.has(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const updates = ['status = ?'];
    const params: Array<any> = [status];
    if (methodEnquiry !== undefined) {
      updates.push('method_enquiry = ?');
      params.push(methodEnquiry || null);
    }
    if (resolutionResult !== undefined) {
      updates.push('resolution_result = ?');
      params.push(resolutionResult || null);
    }
    if (representativeName !== undefined) {
      updates.push('representative_name = ?');
      params.push(representativeName || null);
    }
    params.push(id);
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE client_complaints SET ${updates.join(', ')} WHERE id = ? LIMIT 1`,
      params
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Complaint not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin complaints update error', err);
    return NextResponse.json({ error: 'Failed to update complaint' }, { status: 500 });
  }
}
