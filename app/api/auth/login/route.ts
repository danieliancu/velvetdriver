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
    const expectedRole = String(body.expectedRole ?? '')
      .trim()
      .toLowerCase();
    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    type UserRow = mysql.RowDataPacket & {
      id: number;
      email: string;
      phone: string | null;
      password_hash: string | null;
      role: string;
      status: string;
      client_name: string | null;
      driver_first: string | null;
      driver_surname: string | null;
      corp_contact: string | null;
      corp_company: string | null;
    };

    const [rows] = await pool.query<UserRow[]>(
      `SELECT u.id,
              u.email,
              u.phone,
              u.password_hash,
              r.code AS role,
              u.status,
              c.full_name AS client_name,
              d.first_and_middle_name AS driver_first,
              d.surname AS driver_surname,
              corp.contact_name AS corp_contact,
              corp.company_name AS corp_company
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN clients c ON c.user_id = u.id
       LEFT JOIN drivers d ON d.user_id = u.id
       LEFT JOIN corporates corp ON corp.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash || ''))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
    if (user.role === 'driver' && user.status !== 'active') {
      return NextResponse.json({ error: 'Driver account not active.' }, { status: 403 });
    }
    if (expectedRole && user.role !== expectedRole) {
      return NextResponse.json(
        { error: `This account is ${user.role}, not ${expectedRole}.` },
        { status: 403 }
      );
    }

    let name: string | null = null;
    if (user.role === 'client') {
      name = user.client_name;
    } else if (user.role === 'driver') {
      name = [user.driver_first, user.driver_surname].filter(Boolean).join(' ').trim() || null;
    } else if (user.role === 'corporate') {
      name = user.corp_contact || user.corp_company;
    }

    return NextResponse.json({
      id: Number(user.id),
      name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    });
  } catch (err) {
    console.error('Login error', err);
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
  }
}
