import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const idParam = searchParams.get('id');
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  try {
    const params: any[] = [email];
    let query = `SELECT sq.id, sq.label, sq.payload, sq.created_at
                 FROM client_saved_quotes sq
                 INNER JOIN users u ON sq.client_id = u.id
                 WHERE u.email = ?`;
    if (idParam) {
      query += ' AND sq.id = ?';
      params.push(Number(idParam));
    }
    query += ' ORDER BY sq.created_at DESC';
    const [rows] = await pool.query<mysql.RowDataPacket[]>(query, params);
    if (idParam) {
      const record = rows[0];
      if (!record) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
      return NextResponse.json({ id: record.id, payload: JSON.parse(record.payload) });
    }
    const quotes = rows.map((row) => ({
      id: row.id,
      label: row.label,
      createdAt: row.created_at,
      payload: JSON.parse(row.payload),
    }));
    return NextResponse.json({ quotes });
  } catch (err) {
    console.error('Saved quotes fetch error', err);
    return NextResponse.json({ error: 'Failed to load saved quotes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const payload = body.payload;
    const label = String(body.label ?? '').trim() || `${payload?.pickup || 'Journey'} -> ${(payload?.dropOffs?.[0] ?? '')}`;
    if (!email || !payload) return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    const [users] = await pool.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const user = users[0];
    if (!user) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'INSERT INTO client_saved_quotes (client_id, label, payload) VALUES (?, ?, ?)',
      [user.id, label, JSON.stringify(payload)]
    );
    return NextResponse.json({ id: result.insertId });
  } catch (err) {
    console.error('Saved quote create error', err);
    return NextResponse.json({ error: 'Failed to save quote' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const id = Number(body.id);
    if (!email || !id) {
      return NextResponse.json({ error: 'Missing quote reference' }, { status: 400 });
    }

    const [users] = await pool.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    const user = users[0];
    if (!user) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      'DELETE FROM client_saved_quotes WHERE id = ? AND client_id = ?',
      [id, user.id]
    );
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Saved quote delete error', err);
    return NextResponse.json({ error: 'Failed to delete saved quote' }, { status: 500 });
  }
}
