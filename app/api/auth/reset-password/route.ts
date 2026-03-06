import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

type ResetTokenRow = mysql.RowDataPacket & {
  id: number;
  user_id: number;
  expires_at: Date | string;
  used_at: Date | string | null;
};

const asDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

export async function POST(request: Request) {
  let conn: mysql.PoolConnection | null = null;
  try {
    const body = await request.json();
    const token = String(body?.token ?? '').trim();
    const password = String(body?.password ?? '');

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [rows] = await conn.query<ResetTokenRow[]>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = ?
       LIMIT 1`,
      [tokenHash]
    );
    const resetToken = rows[0];
    if (!resetToken) {
      await conn.rollback();
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 400 });
    }
    if (resetToken.used_at) {
      await conn.rollback();
      return NextResponse.json({ error: 'This reset link has already been used' }, { status: 400 });
    }
    if (asDate(resetToken.expires_at).getTime() <= Date.now()) {
      await conn.rollback();
      return NextResponse.json({ error: 'This reset link has expired' }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.execute<mysql.ResultSetHeader>(
      `UPDATE users
       SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
       LIMIT 1`,
      [hash, resetToken.user_id]
    );
    if (!userResult.affectedRows) {
      await conn.rollback();
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await conn.execute(
      `UPDATE password_reset_tokens
       SET used_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [resetToken.id]
    );
    await conn.execute(
      `DELETE FROM password_reset_tokens
       WHERE user_id = ? AND id <> ?`,
      [resetToken.user_id, resetToken.id]
    );

    await conn.commit();
    return NextResponse.json({ ok: true, message: 'Password updated successfully' });
  } catch (err: any) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return NextResponse.json(
        { error: 'Missing password_reset_tokens table. Apply the password reset SQL migration.' },
        { status: 500 }
      );
    }
    console.error('Reset password error', err);
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}

