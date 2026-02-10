import { NextResponse } from 'next/server';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type DiscountRow = DbRow<{
  code: string;
  name: string;
  amount: number;
  discount_type: 'fixed' | 'percent';
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
}>;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = String(searchParams.get('code') ?? '').trim().toUpperCase();
    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }
    const [rows] = await pool.query<DiscountRow[]>(
      `SELECT code, name, amount, discount_type, starts_at, ends_at, is_active
       FROM discount_codes
       WHERE UPPER(code) = ?
         AND is_active = 1
         AND (starts_at IS NULL OR starts_at <= CURRENT_DATE())
         AND (ends_at IS NULL OR ends_at >= CURRENT_DATE())
       LIMIT 1`,
      [code]
    );
    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Invalid discount code' }, { status: 404 });
    }
    return NextResponse.json({
      code: row.code,
      name: row.name,
      amount: Number(row.amount),
      type: row.discount_type,
    });
  } catch (err) {
    console.error('Discount code validate error', err);
    return NextResponse.json({ error: 'Failed to validate discount code' }, { status: 500 });
  }
}
