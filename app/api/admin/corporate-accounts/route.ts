import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

const STATUS_TO_USER_STATUS: Record<string, string> = {
  pending_approval: 'pending',
  approved: 'active',
  rejected: 'rejected',
  suspended: 'suspended',
};

const normalizeCorporateStatus = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'pending') return 'pending_approval';
  if (normalized === 'active') return 'approved';
  if (['pending_approval', 'approved', 'rejected', 'suspended'].includes(normalized)) return normalized;
  return '';
};

const parseSettings = (payload: unknown) => {
  try {
    const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, any>) : {};
  } catch {
    return {};
  }
};

async function getVatSettings(conn: mysql.PoolConnection) {
  const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT payload FROM app_settings WHERE id = 1 LIMIT 1');
  const payload = parseSettings(rows[0]?.payload);
  return {
    vatEnabled: Boolean(payload.vatEnabled),
    vatRate: Number.isFinite(Number(payload.vatRate)) ? Math.max(0, Number(payload.vatRate)) : 20,
    paymentInstructions:
      String(payload.invoicePaymentInstructions || '').trim() ||
      'Please pay by bank transfer within 14 days.',
  };
}

export async function GET() {
  try {
    const [accountRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT c.id,
              c.user_id,
              u.email,
              u.status AS user_status,
              c.company_name,
              c.contact_name,
              c.phone,
              c.registered_business_address,
              c.company_registration_number,
              c.vat_number,
              c.billing_address,
              c.billing_contact_email,
              c.invoice_email,
              c.estimated_monthly_journeys,
              c.status,
              c.internal_notes,
              c.invoice_payments_enabled,
              c.credit_limit,
              c.created_at,
              COALESCE(SUM(CASE WHEN i.status IN ('Pending','Sent','Overdue') THEN i.total_amount ELSE 0 END), 0) AS unpaid_total,
              COALESCE(SUM(CASE WHEN i.status = 'Paid' THEN i.total_amount ELSE 0 END), 0) AS paid_total,
              COUNT(DISTINCT cj.id) AS booking_count
       FROM corporates c
       INNER JOIN users u ON u.id = c.user_id
       LEFT JOIN invoices i ON i.corporate_id = c.id AND i.deleted_at IS NULL
       LEFT JOIN client_journeys cj ON cj.corporate_id = c.id
       WHERE c.deleted_at IS NULL
       GROUP BY c.id, u.email, u.status
       ORDER BY FIELD(c.status, 'pending_approval', 'approved', 'rejected', 'suspended'), c.created_at DESC`
    );

    const [readyRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT cj.id,
              cj.corporate_id,
              cj.journey_date,
              cj.pickup,
              cj.destination,
              cj.passenger_name,
              cj.price,
              cj.final_fare,
              c.company_name
       FROM client_journeys cj
       INNER JOIN corporates c ON c.id = cj.corporate_id
       LEFT JOIN invoice_bookings ib ON ib.journey_id = cj.id
       WHERE cj.status = 'Completed'
         AND cj.invoice_status = 'Ready for invoicing'
         AND ib.id IS NULL
       ORDER BY cj.journey_date ASC`
    );

    const [invoiceRows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT i.id,
              i.reference,
              i.corporate_id,
              c.company_name,
              i.status,
              i.amount,
              i.subtotal,
              i.vat_amount,
              i.total_amount,
              i.issued_at,
              i.due_at,
              i.sent_at,
              i.paid_at,
              GROUP_CONCAT(CONCAT('VD-', LPAD(ib.journey_id, 4, '0')) ORDER BY ib.journey_id SEPARATOR ', ') AS booking_refs
       FROM invoices i
       LEFT JOIN corporates c ON c.id = i.corporate_id
       LEFT JOIN invoice_bookings ib ON ib.invoice_id = i.id
       WHERE i.deleted_at IS NULL
       GROUP BY i.id
       ORDER BY COALESCE(i.issued_at, i.created_at) DESC`
    );

    return NextResponse.json({
      accounts: accountRows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.user_id),
        email: row.email || '',
        userStatus: row.user_status || '',
        companyName: row.company_name || '',
        contactName: row.contact_name || '',
        phone: row.phone || '',
        businessAddress: row.registered_business_address || '',
        companyRegNumber: row.company_registration_number || '',
        vatNumber: row.vat_number || '',
        billingAddress: row.billing_address || '',
        billingEmail: row.billing_contact_email || row.invoice_email || row.email || '',
        estimatedMonthlyJourneys: row.estimated_monthly_journeys,
        status: normalizeCorporateStatus(row.status) || row.status || 'pending_approval',
        internalNotes: row.internal_notes || '',
        invoicePaymentsEnabled: Boolean(row.invoice_payments_enabled),
        creditLimit: Number(row.credit_limit ?? 2000),
        unpaidTotal: Number(row.unpaid_total ?? 0),
        paidTotal: Number(row.paid_total ?? 0),
        bookingCount: Number(row.booking_count ?? 0),
        createdAt: row.created_at ? String(row.created_at) : null,
      })),
      readyBookings: readyRows.map((row) => ({
        id: Number(row.id),
        code: `VD-${String(row.id).padStart(4, '0')}`,
        corporateId: Number(row.corporate_id),
        companyName: row.company_name || '',
        journeyDate: row.journey_date ? String(row.journey_date) : '',
        pickup: row.pickup || '',
        destination: row.destination || '',
        passengerName: row.passenger_name || '',
        amount: Number(row.final_fare ?? row.price ?? 0),
      })),
      invoices: invoiceRows.map((row) => ({
        id: Number(row.id),
        reference: row.reference || '',
        corporateId: row.corporate_id ? Number(row.corporate_id) : null,
        companyName: row.company_name || '',
        status: row.status || 'Pending',
        amount: Number(row.total_amount ?? row.amount ?? 0),
        subtotal: Number(row.subtotal ?? row.amount ?? 0),
        vatAmount: Number(row.vat_amount ?? 0),
        issuedAt: row.issued_at ? String(row.issued_at) : null,
        dueAt: row.due_at ? String(row.due_at) : null,
        sentAt: row.sent_at ? String(row.sent_at) : null,
        paidAt: row.paid_at ? String(row.paid_at) : null,
        bookingRefs: row.booking_refs || '',
      })),
    });
  } catch (err) {
    console.error('Corporate accounts admin load error', err);
    return NextResponse.json({ error: 'Failed to load corporate accounts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json();
    const action = String(body.action || '').trim();

    await conn.beginTransaction();

    if (action === 'update_account') {
      const corporateId = Number(body.corporateId);
      const status = normalizeCorporateStatus(body.status);
      const internalNotes = String(body.internalNotes ?? '');
      const invoicePaymentsEnabled = Boolean(body.invoicePaymentsEnabled);
      const creditLimit = Math.max(0, Number(body.creditLimit ?? 2000));
      if (!corporateId || !status) {
        await conn.rollback();
        return NextResponse.json({ error: 'Invalid corporate account update' }, { status: 400 });
      }
      const [rows] = await conn.query<mysql.RowDataPacket[]>('SELECT user_id FROM corporates WHERE id = ? LIMIT 1', [corporateId]);
      const userId = Number(rows[0]?.user_id || 0);
      if (!userId) {
        await conn.rollback();
        return NextResponse.json({ error: 'Corporate account not found' }, { status: 404 });
      }
      await conn.execute(
        `UPDATE corporates
            SET status = ?,
                internal_notes = ?,
                invoice_payments_enabled = ?,
                credit_limit = ?,
                updated_at = NOW()
          WHERE id = ?
          LIMIT 1`,
        [status, internalNotes, invoicePaymentsEnabled ? 1 : 0, creditLimit, corporateId]
      );
      await conn.execute('UPDATE users SET status = ? WHERE id = ? LIMIT 1', [
        STATUS_TO_USER_STATUS[status] || 'pending',
        userId,
      ]);
    } else if (action === 'generate_invoice') {
      const corporateId = Number(body.corporateId);
      const bookingIds = Array.isArray(body.bookingIds) ? body.bookingIds.map(Number).filter(Boolean) : [];
      if (!corporateId || !bookingIds.length) {
        await conn.rollback();
        return NextResponse.json({ error: 'Select completed corporate bookings to invoice' }, { status: 400 });
      }
      const placeholders = bookingIds.map(() => '?').join(',');
      const [bookingRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT id, COALESCE(final_fare, price, 0) AS amount
           FROM client_journeys
          WHERE corporate_id = ?
            AND status = 'Completed'
            AND invoice_status = 'Ready for invoicing'
            AND id IN (${placeholders})`,
        [corporateId, ...bookingIds]
      );
      if (!bookingRows.length) {
        await conn.rollback();
        return NextResponse.json({ error: 'No ready bookings found for this corporate account' }, { status: 400 });
      }
      const settings = await getVatSettings(conn);
      const subtotal = bookingRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const vatAmount = settings.vatEnabled ? Number((subtotal * (settings.vatRate / 100)).toFixed(2)) : 0;
      const total = Number((subtotal + vatAmount).toFixed(2));
      const reference = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Date.now()).slice(-6)}`;
      const [result] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO invoices (journey_id, corporate_id, reference, amount, subtotal, vat_amount, total_amount, status, issued_at, due_at, payment_instructions)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NOW(), DATE_ADD(NOW(), INTERVAL 14 DAY), ?)`,
        [null, corporateId, reference, total, subtotal, vatAmount, total, settings.paymentInstructions]
      );
      const invoiceId = Number(result.insertId);
      for (const row of bookingRows) {
        await conn.execute(
          `INSERT INTO invoice_bookings (invoice_id, journey_id, amount) VALUES (?, ?, ?)`,
          [invoiceId, Number(row.id), Number(row.amount || 0)]
        );
      }
      await conn.query(
        `UPDATE client_journeys
            SET invoice_status = 'Pending',
                payment_status = 'Awaiting payment'
          WHERE id IN (${bookingRows.map(() => '?').join(',')})`,
        bookingRows.map((row) => Number(row.id))
      );
    } else if (action === 'update_invoice_status') {
      const invoiceId = Number(body.invoiceId);
      const status = String(body.status || '').trim();
      if (!invoiceId || !['Pending', 'Sent', 'Paid', 'Overdue', 'Cancelled'].includes(status)) {
        await conn.rollback();
        return NextResponse.json({ error: 'Invalid invoice status' }, { status: 400 });
      }
      const statusFields =
        status === 'Sent'
          ? ', sent_at = NOW()'
          : status === 'Paid'
            ? ', paid_at = NOW()'
            : status === 'Cancelled'
              ? ', cancelled_at = NOW()'
              : '';
      await conn.execute(`UPDATE invoices SET status = ?${statusFields} WHERE id = ? LIMIT 1`, [status, invoiceId]);
      const paymentStatus =
        status === 'Paid'
          ? 'Paid by invoice'
          : status === 'Overdue'
            ? 'Overdue'
            : status === 'Sent'
              ? 'Awaiting payment'
              : 'Invoice pending';
      await conn.execute(
        `UPDATE client_journeys cj
         INNER JOIN invoice_bookings ib ON ib.journey_id = cj.id
            SET cj.invoice_status = ?,
                cj.payment_status = ?
          WHERE ib.invoice_id = ?`,
        [status, paymentStatus, invoiceId]
      );
    } else {
      await conn.rollback();
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }

    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    await conn.rollback();
    console.error('Corporate accounts admin update error', err);
    return NextResponse.json({ error: err?.message || 'Failed to update corporate accounts' }, { status: 500 });
  } finally {
    conn.release();
  }
}
