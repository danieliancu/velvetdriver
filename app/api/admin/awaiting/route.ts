import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';

const pool = getDbPool();

type AwaitingRow = DbRow<{
  driver_id: number;
  user_id: number;
  email: string;
  phone: string | null;
  surname: string | null;
  first_and_middle_name: string | null;
  address: string | null;
  pco_license_no: string | null;
  pco_expires_date: string | null;
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
  driver_car_id: number;
  vehicle_type_id: number | null;
  vehicle_type_label: string | null;
  vehicle_registration: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  keeper_info: string | null;
}>;

type PricingVehicleRow = DbRow<{
  id: number;
  label: string;
}>;

type CarDocRow = DbRow<{
  driver_id: number;
  doc_type: string;
  file_url: string;
  format: string | null;
  file_name: string | null;
}>;

const DOC_LABELS: Record<string, string> = {
  pco_license: 'PCO Licence',
  driving_license_front: 'Driving Licence Front',
  driving_license_back: 'Driving Licence Back',
  profile_photo: 'Profile Photo',
  mot: 'MOT',
  insurance: 'Insurance',
  phv_car_licence: 'PHV Car License',
  logbook_v5: 'Logbook V5 Page 1',
  logbook_v5_page2: 'Logbook V5 Page 2',
  other: 'Other documents',
};

export async function GET() {
  try {
    const [rows] = await pool.query<AwaitingRow[]>(
      `SELECT d.id AS driver_id,
              u.id AS user_id,
              u.email,
              d.phone,
              d.surname,
              d.first_and_middle_name,
              d.address,
              d.pco_license_no,
              d.pco_expires_date
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.status = 'pending'
       ORDER BY u.created_at DESC
       LIMIT 200`
    );

    const driverIds = rows.map((row) => row.driver_id);
    let documentsByDriver: Record<number, Array<{ label: string; url: string; type: string }>> = {};
    let carsByDriver: Record<number, Array<{ id: number; vrm: string; make: string; model: string; colour: string; keeper: string; vehicleTypeId: number | null; vehicleTypeLabel: string }>> = {};
    let pricingVehicles: Array<{ id: number; label: string }> = [];
    if (driverIds.length) {
      const [docs] = await pool.query<DocumentRow[]>(
        `SELECT driver_id, doc_type, file_url, format, file_name
         FROM driver_documents
         WHERE driver_id IN (${driverIds.map(() => '?').join(',')})`,
        driverIds
      );
      documentsByDriver = docs.reduce((acc, doc) => {
        const label = DOC_LABELS[doc.doc_type] || doc.file_name || doc.doc_type;
        const type = (doc.format || '').toUpperCase() || 'FILE';
        if (!acc[doc.driver_id]) acc[doc.driver_id] = [];
        acc[doc.driver_id].push({ label, url: doc.file_url, type });
        return acc;
      }, {} as Record<number, Array<{ label: string; url: string; type: string }>>);

      const [cars] = await pool.query<CarRow[]>(
        `SELECT dc.driver_id,
                dc.id AS driver_car_id,
                c.vehicle_type_id,
                pv.label AS vehicle_type_label,
                c.vehicle_registration,
                c.make,
                c.model,
                c.colour,
                c.keeper_info
         FROM driver_cars dc
         INNER JOIN cars c ON c.id = dc.car_id
         LEFT JOIN pricing_vehicles pv ON pv.id = c.vehicle_type_id
         WHERE dc.driver_id IN (${driverIds.map(() => '?').join(',')})
           AND dc.deleted_at IS NULL`,
        driverIds
      );
      carsByDriver = cars.reduce((acc, car) => {
        if (!acc[car.driver_id]) acc[car.driver_id] = [];
        acc[car.driver_id].push({
          id: car.driver_car_id,
          vrm: car.vehicle_registration || '-',
          make: car.make || '-',
          model: car.model || '-',
          colour: car.colour || '-',
          keeper: car.keeper_info || '-',
          vehicleTypeId: car.vehicle_type_id,
          vehicleTypeLabel: car.vehicle_type_label || '-',
        });
        return acc;
      }, {} as Record<number, Array<{ id: number; vrm: string; make: string; model: string; colour: string; keeper: string; vehicleTypeId: number | null; vehicleTypeLabel: string }>>);

      const [carDocs] = await pool.query<CarDocRow[]>(
        `SELECT dc.driver_id, dcd.doc_type, dcd.file_url, dcd.format, dcd.file_name
         FROM driver_cars dc
         INNER JOIN driver_car_documents dcd ON dcd.car_id = dc.id
         WHERE dc.driver_id IN (${driverIds.map(() => '?').join(',')})`,
        driverIds
      );
      carDocs.forEach((doc) => {
        const label = DOC_LABELS[doc.doc_type] || doc.doc_type;
        const type = (doc.format || '').toUpperCase() || 'FILE';
        if (!documentsByDriver[doc.driver_id]) documentsByDriver[doc.driver_id] = [];
        documentsByDriver[doc.driver_id].push({ label, url: doc.file_url, type });
      });

      const [pricingRows] = await pool.query<PricingVehicleRow[]>(
        `SELECT id, label FROM pricing_vehicles ORDER BY id`
      );
      pricingVehicles = pricingRows.map((row) => ({ id: row.id, label: row.label }));
    }

    const drivers = rows.map((row) => ({
      id: String(row.driver_id),
      name: [row.first_and_middle_name, row.surname].filter(Boolean).join(' ').trim() || `Driver ${row.driver_id}`,
      phone: row.phone || '-',
      email: row.email,
      address: row.address || '-',
      license: row.pco_license_no || '-',
      pcoExpiry: row.pco_expires_date || '-',
      documents: documentsByDriver[row.driver_id] || [],
      cars: carsByDriver[row.driver_id] || [],
    }));

    return NextResponse.json({ drivers, pricingVehicles });
  } catch (err) {
    console.error('Admin awaiting drivers fetch error', err);
    return NextResponse.json({ error: 'Failed to load awaiting drivers' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const driverId = Number(body.driverId);
    const driverCarId = Number(body.driverCarId);
    const vehicleTypeId = body.vehicleTypeId !== undefined ? Number(body.vehicleTypeId) : null;
    if (driverCarId && vehicleTypeId) {
      const [result] = await pool.execute<mysql.ResultSetHeader>(
        `UPDATE cars c
         INNER JOIN driver_cars dc ON dc.car_id = c.id
         SET c.vehicle_type_id = ?
         WHERE dc.id = ?`,
        [vehicleTypeId, driverCarId]
      );
      if (!result.affectedRows) {
        return NextResponse.json({ error: 'Car not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    }
    if (!driverId) {
      return NextResponse.json({ error: 'Missing driver id' }, { status: 400 });
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT user_id FROM drivers WHERE id = ? LIMIT 1',
      [driverId]
    );
    const userId = rows[0]?.user_id;
    if (!userId) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE users SET status = 'active' WHERE id = ? LIMIT 1`,
      [userId]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin awaiting approve error', err);
    return NextResponse.json({ error: 'Failed to approve driver' }, { status: 500 });
  }
}
