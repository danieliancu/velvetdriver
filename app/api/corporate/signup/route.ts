import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

type CorporateMeta = {
  accountsEmail?: string;
  journeyTypes?: string[];
  vehicleTypes?: string;
  paymentMethod?: string;
};

const META_MARKER = '[meta]';

const toOptional = (value: unknown) => {
  const text = String(value ?? '').trim();
  return text || null;
};

const parseJourneyTypes = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item ?? '').trim()).filter(Boolean);
};

const parseEstimatedJourneys = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed);
};

const parsePoRequired = (value: unknown) => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'yes') return 1;
  if (normalized === 'no') return 0;
  return null;
};

const buildAdditionalNotes = (serviceNotes: string | null, meta: CorporateMeta) => {
  const chunks: string[] = [];
  if (serviceNotes) chunks.push(serviceNotes);
  chunks.push(`${META_MARKER}${JSON.stringify(meta)}`);
  return chunks.join('\n\n');
};

const resolveInvoiceMethodId = async (conn: mysql.PoolConnection, invoiceMethodRaw: string | null) => {
  if (!invoiceMethodRaw) return null;
  const normalized = invoiceMethodRaw.trim().toLowerCase();
  if (!normalized) return null;
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    `SELECT id
     FROM invoice_methods
     WHERE LOWER(code) = ? OR LOWER(name) = ?
     LIMIT 1`,
    [normalized, normalized]
  );
  return rows[0] ? Number(rows[0].id) : null;
};

export async function POST(request: Request) {
  let conn: mysql.PoolConnection | null = null;
  try {
    const body = await request.json();
    const companyName = String(body.companyName ?? '').trim();
    const businessAddress = toOptional(body.businessAddress);
    const companyRegNumber = toOptional(body.companyRegNumber);
    const vatNumber = toOptional(body.vatNumber);
    const businessType = toOptional(body.businessType);
    const contactName = String(body.contactName ?? '').trim();
    const contactTitle = toOptional(body.contactTitle);
    const contactEmail = String(body.contactEmail ?? '').trim().toLowerCase();
    const contactPhone = toOptional(body.contactPhone);
    const password = String(body.password ?? '');
    const accountsName = toOptional(body.accountsName);
    const accountsEmail = toOptional(body.accountsEmail);
    const accountsPhone = toOptional(body.accountsPhone);
    const billingAddress = toOptional(body.billingAddress);
    const invoiceMethodRaw = toOptional(body.invoiceMethod);
    const estimatedMonthlyJourneys = parseEstimatedJourneys(body.estimatedJourneys);
    const poNumbersRequired = parsePoRequired(body.poRequired);
    const invoiceEmail = toOptional(body.invoiceEmail);
    const serviceNotes = toOptional(body.serviceNotes);
    const journeyTypes = parseJourneyTypes(body.journeyTypes);
    const vehicleTypes = toOptional(body.vehicleTypes);
    const paymentMethod = toOptional(body.paymentMethod);
    const acceptedTerms = String(body.tandc ?? '').trim().toLowerCase() === 'yes';
    const acceptedGdpr = String(body.gdpr ?? '').trim().toLowerCase() === 'yes';

    if (!companyName || !contactName || !contactEmail || !contactPhone || !password) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }
    if (!acceptedTerms || !acceptedGdpr) {
      return NextResponse.json({ error: 'Terms and GDPR consent are required.' }, { status: 400 });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT u.id, r.code AS role_code
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [contactEmail]
    );

    if (existing.length) {
      await conn.rollback();
      const roleCode = String(existing[0]?.role_code ?? '').toLowerCase();
      if (roleCode && roleCode !== 'corporate') {
        return NextResponse.json(
          {
            error: `This email is already registered as ${roleCode}. A ${roleCode} account cannot be registered as corporate.`,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'This email is already registered as corporate. Please sign in.' },
        { status: 409 }
      );
    }

    const [roleResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO roles (code, label, is_active)
       VALUES ('corporate', 'Corporate', 1)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), is_active = VALUES(is_active)`
    );
    const roleId = Number(roleResult.insertId);

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (role_id, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [roleId, contactEmail, contactPhone, hash]
    );
    const userId = Number(userResult.insertId);
    const preferredInvoiceMethodId = await resolveInvoiceMethodId(conn, invoiceMethodRaw);
    const additionalNotes = buildAdditionalNotes(serviceNotes, {
      accountsEmail: accountsEmail || undefined,
      journeyTypes,
      vehicleTypes: vehicleTypes || undefined,
      paymentMethod: paymentMethod || undefined,
    });

    await conn.execute(
      `INSERT INTO corporates (
         user_id,
         company_name,
         registered_business_address,
         company_registration_number,
         vat_number,
         industry,
         contact_name,
         job_title,
         phone,
         accounts_contact_name,
         accounts_phone,
         billing_address,
         preferred_invoice_method_id,
         estimated_monthly_journeys,
         po_numbers_required,
         invoice_email,
         additional_notes,
         status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        companyName,
        businessAddress,
        companyRegNumber,
        vatNumber,
        businessType,
        contactName,
        contactTitle,
        contactPhone,
        accountsName,
        accountsPhone,
        billingAddress,
        preferredInvoiceMethodId,
        estimatedMonthlyJourneys,
        poNumbersRequired,
        invoiceEmail,
        additionalNotes,
      ]
    );

    await conn.commit();
    return NextResponse.json({
      ok: true,
      id: userId,
      email: contactEmail,
      message: 'Corporate account request submitted. We will contact you after approval.',
    });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error('Corporate signup error', err);
    return NextResponse.json({ error: 'Failed to submit corporate signup.' }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}
