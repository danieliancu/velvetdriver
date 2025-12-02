import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });
  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, name, email, phone FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('Profile load error', err);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const newPassword = body.newPassword ? String(body.newPassword) : null;
    if (!email || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    const updates: Array<string> = [];
    const params: Array<any> = [];
    updates.push('name = ?');
    params.push(name);
    updates.push('phone = ?');
    params.push(phone || null);
    if (newPassword) {
      updates.push('password_hash = ?');
      params.push(await bcrypt.hash(newPassword, 10));
    }
    params.push(email);
    await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE email = ?`, params);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Profile update error', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
