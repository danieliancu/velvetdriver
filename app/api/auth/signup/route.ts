import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function POST(request: Request) {
  let conn: mysql.PoolConnection | null = null;
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const phone = String(body.phone ?? '').trim();
    const password = String(body.password ?? '');

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    if (existing.length) {
      await conn.rollback();
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const [roleResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO roles (code, label, is_active)
       VALUES ('client', 'Client', 1)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`
    );
    const roleId = roleResult.insertId;

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (role_id, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [roleId, email, phone || null, hash]
    );
    const userId = userResult.insertId;

    await conn.execute(
      `INSERT INTO clients (user_id, full_name, phone)
       VALUES (?, ?, ?)`,
      [userId, name, phone || null]
    );

    await conn.commit();
    return NextResponse.json({ id: userId, email });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error('Signup error', err);
    return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}
