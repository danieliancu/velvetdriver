import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type DiscountRow = DbRow<{
  id: number;
  code: string;
  name: string;
  amount: number;
  discount_type: 'fixed' | 'percent';
  starts_at: string | null;
  ends_at: string | null;
  is_active: number;
  created_at: string;
}>;

export async function GET() {
  try {
    const [rows] = await pool.query<DiscountRow[]>(
      `SELECT id, code, name, amount, discount_type, starts_at, ends_at, is_active, created_at
       FROM discount_codes
       ORDER BY created_at DESC`
    );
    return NextResponse.json({
      codes: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        amount: Number(row.amount),
        type: row.discount_type,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        isActive: Boolean(row.is_active),
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    console.error('Discount codes fetch error', err);
    return NextResponse.json({ error: 'Failed to load discount codes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    const amount = Number(body.amount ?? 0);
    const type = String(body.type ?? '').trim();
    const startsAt = body.startsAt ? String(body.startsAt) : null;
    const endsAt = body.endsAt ? String(body.endsAt) : null;
    const isActive = body.isActive === false ? 0 : 1;

    if (!code || !name || !amount || !['fixed', 'percent'].includes(type)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO discount_codes (code, name, amount, discount_type, starts_at, ends_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         amount = VALUES(amount),
         discount_type = VALUES(discount_type),
         starts_at = VALUES(starts_at),
         ends_at = VALUES(ends_at),
         is_active = VALUES(is_active),
         updated_at = CURRENT_TIMESTAMP`,
      [code, name, amount, type, startsAt, endsAt, isActive]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Discount codes create error', err);
    return NextResponse.json({ error: 'Failed to save discount code' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const isActive = body.isActive !== undefined ? Number(body.isActive ? 1 : 0) : null;
    if (!id || isActive === null) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE discount_codes SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [isActive, id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Discount codes update error', err);
    return NextResponse.json({ error: 'Failed to update discount code' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    const code = String(body.code ?? '').trim().toUpperCase();
    const name = String(body.name ?? '').trim();
    const amount = Number(body.amount ?? 0);
    const type = String(body.type ?? '').trim();
    const startsAt = body.startsAt ? String(body.startsAt) : null;
    const endsAt = body.endsAt ? String(body.endsAt) : null;
    const isActive = body.isActive === false ? 0 : 1;

    if (!id || !code || !name || !amount || !['fixed', 'percent'].includes(type)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE discount_codes
          SET code = ?,
              name = ?,
              amount = ?,
              discount_type = ?,
              starts_at = ?,
              ends_at = ?,
              is_active = ?,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        LIMIT 1`,
      [code, name, amount, type, startsAt, endsAt, isActive, id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }
    console.error('Discount codes edit error', err);
    return NextResponse.json({ error: 'Failed to edit discount code' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const id = Number(body.id);
    if (!id) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `DELETE FROM discount_codes WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Discount code not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Discount codes delete error', err);
    return NextResponse.json({ error: 'Failed to delete discount code' }, { status: 500 });
  }
}
