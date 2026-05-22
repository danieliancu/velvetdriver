import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get('email') || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ eligible: false, reason: 'Missing email' }, { status: 400 });

  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT c.id,
              c.company_name,
              c.status,
              c.invoice_payments_enabled,
              c.credit_limit,
              COALESCE(SUM(CASE WHEN i.status IN ('Pending','Sent','Overdue') THEN i.total_amount ELSE 0 END), 0) AS unpaid_total
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'corporate'
       INNER JOIN corporates c ON c.user_id = u.id
       LEFT JOIN invoices i ON i.corporate_id = c.id AND i.deleted_at IS NULL
       WHERE u.email = ?
       GROUP BY c.id
       LIMIT 1`,
      [email]
    );
    const row = rows[0];
    if (!row) return NextResponse.json({ eligible: false, reason: 'Corporate account not found' }, { status: 404 });
    const status = String(row.status || '').toLowerCase();
    const unpaidTotal = Number(row.unpaid_total || 0);
    const creditLimit = Number(row.credit_limit || 2000);
    const eligible =
      ['approved', 'active'].includes(status) &&
      Boolean(row.invoice_payments_enabled) &&
      unpaidTotal < creditLimit;
    let reason = '';
    if (!['approved', 'active'].includes(status)) reason = status === 'suspended' ? 'Corporate account is suspended.' : 'Corporate account is not approved.';
    else if (!row.invoice_payments_enabled) reason = 'Pay by Invoice is not enabled for this corporate account.';
    else if (unpaidTotal >= creditLimit) reason = 'Corporate credit limit reached.';

    return NextResponse.json({
      eligible,
      reason,
      corporateId: Number(row.id),
      companyName: row.company_name || '',
      status,
      invoicePaymentsEnabled: Boolean(row.invoice_payments_enabled),
      unpaidTotal,
      creditLimit,
    });
  } catch (err) {
    console.error('Corporate invoice eligibility error', err);
    return NextResponse.json({ eligible: false, reason: 'Failed to check corporate account' }, { status: 500 });
  }
}
