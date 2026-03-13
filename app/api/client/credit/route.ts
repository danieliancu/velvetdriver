import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { getClientCreditBalance } from '@/lib/client-credit';

const pool = getDbPool();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );
    const clientId = Number(rows[0]?.id ?? 0);
    if (!clientId) {
      return NextResponse.json({ balance: 0 });
    }

    const balance = await getClientCreditBalance(pool, clientId);
    return NextResponse.json({ balance: Math.round(balance * 100) / 100 });
  } catch (err) {
    console.error('Client credit fetch error', err);
    return NextResponse.json({ error: 'Failed to load credit balance' }, { status: 500 });
  }
}
