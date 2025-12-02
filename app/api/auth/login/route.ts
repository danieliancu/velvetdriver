import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id, name, email, phone, password_hash, role FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash || ''))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    return NextResponse.json({
      id: Number(user.id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  } catch (err) {
    console.error('Login error', err);
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
  }
}
