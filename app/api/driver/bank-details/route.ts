import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    const bankName = String(body.bankName ?? '').trim();
    const accountName = String(body.accountName ?? '').trim();
    const sortCode = String(body.sortCode ?? '').trim();
    const accountNumber = String(body.accountNumber ?? '').trim();

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id AS driver_id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const driverId = rows[0]?.driver_id;
    if (!driverId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    await pool.execute(
      `INSERT INTO driver_bank_details (driver_id, bank_name, account_name, sort_code, account_number)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         bank_name = VALUES(bank_name),
         account_name = VALUES(account_name),
         sort_code = VALUES(sort_code),
         account_number = VALUES(account_number),
         updated_at = CURRENT_TIMESTAMP`,
      [driverId, bankName || null, accountName || null, sortCode || null, accountNumber || null]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Driver bank details update error', err);
    return NextResponse.json({ error: 'Failed to update bank details' }, { status: 500 });
  }
}
