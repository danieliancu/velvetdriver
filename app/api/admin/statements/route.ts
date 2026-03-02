import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { ensureDriverStatementsTable } from '@/lib/driver-statements';

const pool = getDbPool();

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
};

export async function GET(request: Request) {
  try {
    await ensureDriverStatementsTable(pool);

    const { searchParams } = new URL(request.url);
    const startDate = String(searchParams.get('startDate') ?? '').trim();
    const endDate = String(searchParams.get('endDate') ?? '').trim();

    const filters: string[] = [];
    const params: any[] = [];

    if (startDate) {
      filters.push('DATE(ds.journey_date) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      filters.push('DATE(ds.journey_date) <= ?');
      params.push(endDate);
    }

    const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT ds.id,
              ds.booking_ref,
              ds.person_accepting,
              ds.booking_date,
              ds.journey_date,
              ds.customer_name,
              ds.phone_number,
              ds.collection,
              ds.destination,
              ds.fare_quoted,
              ds.person_dispatching,
              ds.driver_name,
              ds.driver_license_no,
              ds.vehicle_reg,
              ds.sublet_operator_no,
              ds.sublet_operator_name,
              ds.statement_pdf_url,
              ds.status,
              ds.created_at
       FROM driver_statements ds
       ${where}
       ORDER BY ds.created_at DESC
       LIMIT 1000`,
      params
    );

    const statements = rows.map((row) => ({
      id: Number(row.id),
      ref: String(row.booking_ref || ''),
      personAccepting: String(row.person_accepting || '-'),
      bookingDate: formatDate(row.booking_date ? String(row.booking_date) : null),
      journeyDate: formatDate(row.journey_date ? String(row.journey_date) : null),
      customerName: String(row.customer_name || '-'),
      phoneNumber: String(row.phone_number || '-'),
      collection: String(row.collection || '-'),
      destination: String(row.destination || '-'),
      fare: Number(row.fare_quoted ?? 0) || 0,
      despatcher: String(row.person_dispatching || '-'),
      driverName: String(row.driver_name || '-'),
      driverLicenseNo: String(row.driver_license_no || '-'),
      vehicleReg: String(row.vehicle_reg || '-'),
      subletOperatorNo: String(row.sublet_operator_no || '-'),
      subletOperatorName: String(row.sublet_operator_name || '-'),
      status: String(row.status || 'Unpaid') as 'Paid' | 'Unpaid',
      pdfUrl: row.statement_pdf_url ? String(row.statement_pdf_url) : null,
    }));

    return NextResponse.json({ statements });
  } catch (err) {
    console.error('Admin statements fetch error', err);
    return NextResponse.json({ error: 'Failed to load statements' }, { status: 500 });
  }
}
