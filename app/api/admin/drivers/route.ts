import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type DriverRow = DbRow<{
  driver_id: number;
  user_id: number;
  email: string;
  phone: string | null;
  surname: string | null;
  first_and_middle_name: string | null;
  address: string | null;
  pco_license_no: string | null;
  pco_expires_date: string | null;
  commission: number | null;
  status: string;
  created_at: string;
  updated_at: string;
}>;

type DocumentRow = DbRow<{
  driver_id: number;
  doc_type: string;
  file_url: string;
  format: string | null;
  file_name: string | null;
}>;

type CarRow = DbRow<{
  driver_id: number;
  vehicle_registration: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  keeper_info: string | null;
}>;

const DOC_LABELS: Record<string, string> = {
  pco_license: 'PCO Licence',
  driving_license_front: 'Driving Licence Front',
  driving_license_back: 'Driving Licence Back',
  profile_photo: 'Profile Photo',
  mot: 'MOT',
  insurance: 'Insurance',
  phv_car_licence: 'PHV Car Licence',
  logbook_v5: 'Logbook V5',
};

export async function GET() {
  try {
    const [rows] = await pool.query<DriverRow[]>(
      `SELECT d.id AS driver_id,
              u.id AS user_id,
              u.email,
              u.status,
              u.created_at,
              u.updated_at,
              d.phone,
              d.surname,
              d.first_and_middle_name,
              d.address,
              d.pco_license_no,
              d.pco_expires_date,
              d.commission
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.status <> 'pending'
       ORDER BY u.created_at DESC
       LIMIT 200`
    );

    const driverIds = rows.map((row) => row.driver_id);
    let documentsByDriver: Record<number, Array<{ name: string; url: string; type: string }>> = {};
    let profilePhotoByDriver: Record<number, string> = {};
    let carsByDriver: Record<number, Array<{ vrm: string; make: string; model: string; colour: string; keeper: string }>> = {};
    if (driverIds.length) {
      const [docs] = await pool.query<DocumentRow[]>(
        `SELECT driver_id, doc_type, file_url, format, file_name
         FROM driver_documents
         WHERE driver_id IN (${driverIds.map(() => '?').join(',')})`,
        driverIds
      );
      documentsByDriver = docs.reduce((acc, doc) => {
        const label = DOC_LABELS[doc.doc_type] || doc.file_name || doc.doc_type;
        const name = DOC_LABELS[doc.doc_type] || doc.doc_type;
        const type = (doc.format || '').toUpperCase() || 'FILE';
        if (!acc[doc.driver_id]) acc[doc.driver_id] = [];
        acc[doc.driver_id].push({ name, url: doc.file_url, type });
        if (doc.doc_type === 'profile_photo') {
          profilePhotoByDriver[doc.driver_id] = doc.file_url;
        }
        return acc;
      }, {} as Record<number, Array<{ name: string; url: string; type: string }>>);

      const [cars] = await pool.query<CarRow[]>(
        `SELECT driver_id, vehicle_registration, make, model, colour, keeper_info
         FROM driver_car_details
         WHERE driver_id IN (${driverIds.map(() => '?').join(',')})`,
        driverIds
      );
      carsByDriver = cars.reduce((acc, car) => {
        if (!acc[car.driver_id]) acc[car.driver_id] = [];
        acc[car.driver_id].push({
          vrm: car.vehicle_registration || '-',
          make: car.make || '-',
          model: car.model || '-',
          colour: car.colour || '-',
          keeper: car.keeper_info || '-',
        });
        return acc;
      }, {} as Record<number, Array<{ vrm: string; make: string; model: string; colour: string; keeper: string }>>);
    }

    const drivers = rows.map((row) => ({
      id: String(row.driver_id),
      name: [row.first_and_middle_name, row.surname].filter(Boolean).join(' ').trim() || `Driver ${row.driver_id}`,
      phone: row.phone || '-',
      email: row.email,
      address: row.address || '-',
      license: row.pco_license_no || '-',
      pcoExpiry: row.pco_expires_date || '-',
      commission: row.commission ?? 20,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      documents: documentsByDriver[row.driver_id] || [],
      profilePhotoUrl: profilePhotoByDriver[row.driver_id] || null,
      carDetails: carsByDriver[row.driver_id] || [],
    }));

    return NextResponse.json({ drivers });
  } catch (err) {
    console.error('Admin drivers fetch error', err);
    return NextResponse.json({ error: 'Failed to load drivers' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const driverId = Number(body.driverId);
    const nextStatus = body.status !== undefined ? String(body.status ?? '').trim().toLowerCase() : null;
    const commission = body.commission !== undefined ? Number(body.commission) : null;
    if (!driverId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (commission === null && !nextStatus) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (commission !== null && Number.isNaN(commission)) {
      return NextResponse.json({ error: 'Invalid commission' }, { status: 400 });
    }

    if (commission !== null) {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE drivers SET commission = ? WHERE id = ? LIMIT 1`,
        [commission, driverId]
      );
      if (!result.affectedRows) {
        return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
      }
    }

    let updatedAt: string | null = null;
    let status: string | null = null;
    if (nextStatus) {
      const allowed = new Set(['active', 'holiday', 'blocked']);
      if (!allowed.has(nextStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE users u
         INNER JOIN drivers d ON d.user_id = u.id
         SET u.status = ?
         WHERE d.id = ?`,
        [nextStatus, driverId]
      );
      if (!result.affectedRows) {
        return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
      }
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT u.status, u.updated_at
         FROM users u
         INNER JOIN drivers d ON d.user_id = u.id
         WHERE d.id = ? LIMIT 1`,
        [driverId]
      );
      status = rows[0]?.status || nextStatus;
      updatedAt = rows[0]?.updated_at || null;
    }

    return NextResponse.json({ ok: true, status, updatedAt });
  } catch (err) {
    console.error('Admin driver commission update error', err);
    return NextResponse.json({ error: 'Failed to update commission' }, { status: 500 });
  }
}
