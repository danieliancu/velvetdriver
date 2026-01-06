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
      `SELECT u.id, u.email, u.phone, c.full_name AS name
       FROM users u
       LEFT JOIN clients c ON c.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
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

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const hashed = newPassword ? await bcrypt.hash(newPassword, 10) : null;
      const userUpdate: Array<string> = ['phone = ?'];
      const userParams: Array<any> = [phone || null];
      if (hashed) {
        userUpdate.push('password_hash = ?');
        userParams.push(hashed);
      }
      userParams.push(email);
      await conn.execute(`UPDATE users SET ${userUpdate.join(', ')} WHERE email = ?`, userParams);

      const [users] = await conn.query<mysql.RowDataPacket[]>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
      const user = users[0];
      if (user) {
        await conn.execute(
          `INSERT INTO clients (user_id, full_name, phone)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone)`,
          [user.id, name, phone || null]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Profile update error', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
