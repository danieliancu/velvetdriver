import { NextResponse } from 'next/server';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type AdminStaffRow = DbRow<{
  id: number;
  full_name: string;
  email: string | null;
  username: string;
  role: string | null;
}>;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '').trim();

    if (!username || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    const [rows] = await pool.query<AdminStaffRow[]>(
      `SELECT id, full_name, email, username, role
       FROM admin_staff
       WHERE username = ? AND password = ?
       LIMIT 1`,
      [username, password]
    );

    const staff = rows[0];
    if (!staff) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    return NextResponse.json({
      id: Number(staff.id),
      name: String(staff.full_name || 'Administrator'),
      email: String(staff.email || `${staff.username}@admin.local`),
      username: String(staff.username),
      role: String(staff.role || 'Admin'),
    });
  } catch (err) {
    console.error('Admin login error', err);
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
  }
}
