import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();
const META_MARKER = '[meta]';

type CorporateMeta = {
  accountsEmail?: string;
  journeyTypes?: string[];
  vehicleTypes?: string;
  paymentMethod?: string;
};

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

const extractMeta = (notes: string | null) => {
  const source = String(notes ?? '');
  const idx = source.lastIndexOf(META_MARKER);
  if (idx < 0) return { meta: {} as CorporateMeta, serviceNotes: source.trim() };
  const serviceNotes = source.slice(0, idx).trim();
  const rawMeta = source.slice(idx + META_MARKER.length).trim();
  try {
    const parsed = JSON.parse(rawMeta);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { meta: {} as CorporateMeta, serviceNotes };
    }
    return { meta: parsed as CorporateMeta, serviceNotes };
  } catch {
    return { meta: {} as CorporateMeta, serviceNotes: source.trim() };
  }
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  try {
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT u.id,
              u.email,
              u.phone,
              u.status AS user_status,
              c.company_name,
              c.registered_business_address,
              c.company_registration_number,
              c.vat_number,
              c.industry,
              c.contact_name,
              c.job_title,
              c.phone AS contact_phone,
              c.accounts_contact_name,
              c.accounts_phone,
              c.billing_address,
              c.estimated_monthly_journeys,
              c.po_numbers_required,
              c.invoice_email,
              c.additional_notes,
              c.status AS corporate_status,
              im.code AS invoice_method_code,
              im.name AS invoice_method_name
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'corporate'
       LEFT JOIN corporates c ON c.user_id = u.id
       LEFT JOIN invoice_methods im ON im.id = c.preferred_invoice_method_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return NextResponse.json({ error: 'Corporate account not found' }, { status: 404 });
    }

    const row = rows[0];
    const { meta, serviceNotes } = extractMeta(row.additional_notes ?? null);
    return NextResponse.json({
      id: Number(row.id),
      email: row.email,
      phone: row.phone,
      userStatus: row.user_status,
      corporateStatus: row.corporate_status || null,
      companyName: row.company_name || '',
      businessAddress: row.registered_business_address || '',
      companyRegNumber: row.company_registration_number || '',
      vatNumber: row.vat_number || '',
      businessType: row.industry || '',
      contactName: row.contact_name || '',
      contactTitle: row.job_title || '',
      contactPhone: row.contact_phone || row.phone || '',
      accountsName: row.accounts_contact_name || '',
      accountsEmail: meta.accountsEmail || '',
      accountsPhone: row.accounts_phone || '',
      billingAddress: row.billing_address || '',
      invoiceMethod: row.invoice_method_name || row.invoice_method_code || '',
      estimatedJourneys:
        row.estimated_monthly_journeys !== null && row.estimated_monthly_journeys !== undefined
          ? String(row.estimated_monthly_journeys)
          : '',
      poRequired:
        row.po_numbers_required === 1
          ? 'yes'
          : row.po_numbers_required === 0
            ? 'no'
            : '',
      invoiceEmail: row.invoice_email || '',
      serviceNotes: serviceNotes || '',
      journeyTypes: Array.isArray(meta.journeyTypes) ? meta.journeyTypes : [],
      vehicleTypes: meta.vehicleTypes || '',
      paymentMethod: meta.paymentMethod || '',
    });
  } catch (err) {
    console.error('Corporate profile load error', err);
    return NextResponse.json({ error: 'Failed to load corporate profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  let conn: mysql.PoolConnection | null = null;
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const companyName = String(body.companyName ?? '').trim();
    const businessAddress = toOptional(body.businessAddress);
    const companyRegNumber = toOptional(body.companyRegNumber);
    const vatNumber = toOptional(body.vatNumber);
    const businessType = toOptional(body.businessType);
    const contactName = String(body.contactName ?? '').trim();
    const contactTitle = toOptional(body.contactTitle);
    const contactPhone = toOptional(body.contactPhone);
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
    const newPassword = String(body.newPassword ?? '').trim();

    if (!email || !companyName || !contactName || !contactPhone) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [users] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT u.id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.email = ? AND r.code = 'corporate'
       LIMIT 1`,
      [email]
    );
    const user = users[0];
    if (!user) {
      await conn.rollback();
      return NextResponse.json({ error: 'Corporate account not found' }, { status: 404 });
    }

    const preferredInvoiceMethodId = await resolveInvoiceMethodId(conn, invoiceMethodRaw);
    const additionalNotes = buildAdditionalNotes(serviceNotes, {
      accountsEmail: accountsEmail || undefined,
      journeyTypes,
      vehicleTypes: vehicleTypes || undefined,
      paymentMethod: paymentMethod || undefined,
    });

    const userUpdateFields = ['phone = ?'];
    const userUpdateParams: Array<string | number | null> = [contactPhone];
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      userUpdateFields.push('password_hash = ?');
      userUpdateParams.push(hash);
    }
    userUpdateParams.push(Number(user.id));
    await conn.execute(
      `UPDATE users SET ${userUpdateFields.join(', ')} WHERE id = ? LIMIT 1`,
      userUpdateParams
    );

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
         additional_notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         company_name = VALUES(company_name),
         registered_business_address = VALUES(registered_business_address),
         company_registration_number = VALUES(company_registration_number),
         vat_number = VALUES(vat_number),
         industry = VALUES(industry),
         contact_name = VALUES(contact_name),
         job_title = VALUES(job_title),
         phone = VALUES(phone),
         accounts_contact_name = VALUES(accounts_contact_name),
         accounts_phone = VALUES(accounts_phone),
         billing_address = VALUES(billing_address),
         preferred_invoice_method_id = VALUES(preferred_invoice_method_id),
         estimated_monthly_journeys = VALUES(estimated_monthly_journeys),
         po_numbers_required = VALUES(po_numbers_required),
         invoice_email = VALUES(invoice_email),
         additional_notes = VALUES(additional_notes)`,
      [
        Number(user.id),
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    console.error('Corporate profile update error', err);
    return NextResponse.json({ error: 'Failed to update corporate profile' }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}
