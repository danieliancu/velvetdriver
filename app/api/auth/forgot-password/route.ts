import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

const TOKEN_TTL_MINUTES = 60;
const GENERIC_MESSAGE = 'If this email is on file, we will send reset instructions shortly.';

type UserRow = mysql.RowDataPacket & {
  id: number;
  email: string;
  role_code: string;
};

const toMysqlDateTime = (date: Date) => date.toISOString().slice(0, 19).replace('T', ' ');

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

async function sendResetEmail(payload: { to: string; resetUrl: string; emailFrom: string; resendApiKey: string }) {
  const subject = 'Velvet Drivers - Password reset';
  const text = [
    'We received a request to reset your password.',
    `Use this link within ${TOKEN_TTL_MINUTES} minutes:`,
    payload.resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
  ].join('\n');
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Password reset</title></head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:20px;background:linear-gradient(90deg,#3A0511,#000);color:#fff;">
            <h1 style="margin:0;font-size:20px;">Velvet Drivers</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;color:#333;">
            <p style="margin-top:0;">We received a request to reset your password.</p>
            <p>Use the button below within ${TOKEN_TTL_MINUTES} minutes:</p>
            <p style="margin:24px 0;">
              <a href="${payload.resetUrl}" style="display:inline-block;background:#f59e0b;color:#000;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700;">
                Reset password
              </a>
            </p>
            <p style="font-size:13px;color:#666;word-break:break-all;">If the button does not work, open this URL:<br/>${payload.resetUrl}</p>
            <p style="font-size:13px;color:#666;">If you did not request this, you can ignore this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${payload.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: payload.emailFrom,
      to: payload.to,
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend error ${response.status}: ${details}`);
  }
}

export async function POST(request: Request) {
  let conn: mysql.PoolConnection | null = null;
  try {
    const body = await request.json();
    const email = String(body?.email ?? '').trim().toLowerCase();
    const expectedRole = String(body?.expectedRole ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const emailFrom = process.env.EMAIL_FROM;
    if (!resendApiKey || !emailFrom) {
      return NextResponse.json({ error: 'Email service is not configured' }, { status: 500 });
    }

    const requestBaseUrl = normalizeBaseUrl(new URL(request.url).origin);
    const appBaseUrl = normalizeBaseUrl(
      String(process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || requestBaseUrl)
    );

    const [users] = await pool.query<UserRow[]>(
      `SELECT u.id, u.email, r.code AS role_code
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const user = users[0];

    if (!user) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    if (expectedRole && user.role_code !== expectedRole) {
      return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MINUTES * 60 * 1000);

    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.execute('DELETE FROM password_reset_tokens WHERE user_id = ?', [user.id]);
    await conn.execute(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [user.id, tokenHash, toMysqlDateTime(expiresAt)]
    );
    await conn.commit();

    const resetUrl = `${appBaseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendResetEmail({
      to: user.email,
      resetUrl,
      emailFrom,
      resendApiKey,
    });

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
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
    console.error('Forgot password error', err);
    return NextResponse.json({ error: 'Failed to process password recovery' }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}

