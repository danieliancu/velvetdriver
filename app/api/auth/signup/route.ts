import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();
    const password = String(body.password ?? '');

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [existing] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (existing.length) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (role, name, email, phone, password_hash, status)
       VALUES ('client', ?, ?, ?, ?, 'active')`,
      [name, email, phone || null, hash]
    );

    return NextResponse.json({ id: result.insertId, email });
  } catch (err) {
    console.error('Signup error', err);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
