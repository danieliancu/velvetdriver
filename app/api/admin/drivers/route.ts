import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';
import { ensureDriverStatementsTable } from '@/lib/driver-statements';

const pool = getDbPool();

type DriverRow = DbRow<{
  driver_id: number;
  user_id: number;
  email: string;
  phone: string | null;
  surname: string | null;
  first_and_middle_name: string | null;
  address: string | null;
  date_of_birth: string | null;
  nino: string | null;
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
  id: number;
  driver_id: number;
  status: string | null;
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
  car_id: number;
  doc_type: string;
  expiry_date: string | null;
  file_url: string;
  format: string | null;
  file_name: string | null;
}>;

type StatementRow = DbRow<{
  driver_id: number;
  booking_ref: string;
  journey_date: string | null;
  collection: string | null;
  destination: string | null;
  vehicle_type: string | null;
  fare_quoted: number | null;
  status: 'Paid' | 'Unpaid' | null;
  statement_pdf_url: string | null;
}>;

const DOC_LABELS: Record<string, string> = {
  pco_license: 'PCO Licence',
  driving_license_front: 'Driving Licence Front',
  driving_license_back: 'Driving Licence Back',
  profile_photo: 'Profile Photo',
};

const isRetryableDbError = (err: any) =>
  err?.code === 'ECONNRESET' ||
  err?.code === 'PROTOCOL_CONNECTION_LOST' ||
  err?.code === 'ETIMEDOUT';

const queryWithRetry = async <T extends mysql.RowDataPacket[]>(
  sql: string,
  params?: any[]
) => {
  try {
    return await pool.query<T>(sql, params);
  } catch (err) {
    if (!isRetryableDbError(err)) throw err;
    console.warn('Retrying admin/drivers query after transient DB error:', err?.code);
    return pool.query<T>(sql, params);
  }
};

const executeWithRetry = async <T extends mysql.ResultSetHeader>(
  sql: string,
  params?: any[]
) => {
  try {
    return await pool.execute<T>(sql, params);
  } catch (err) {
    if (!isRetryableDbError(err)) throw err;
    console.warn('Retrying admin/drivers execute after transient DB error:', err?.code);
    return pool.execute<T>(sql, params);
  }
};

const executeOptional = async (
  conn: mysql.PoolConnection,
  sql: string,
  params?: any[]
) => {
  try {
    return await conn.execute(sql, params);
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return null;
    throw err;
  }
};

export async function GET() {
  try {
    const [rows] = await queryWithRetry<DriverRow[]>(
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
              d.date_of_birth,
              d.nino,
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
    let carsByDriver: Record<number, Array<{ id: number; vrm: string; make: string; model: string; colour: string; keeper: string; status: string; vehicleTypeId: number | null; vehicleTypeLabel: string; documents: Array<{ docType: string; name: string; url: string; type: string; expiryDate: string | null }> }>> = {};
    let statementsByDriver: Record<number, Array<{ date: string; ref: string; pickup: string; dropoff: string; vehicle: string; miles: number; wait: number; fare: number; status: 'Paid' | 'Unpaid'; pdfUrl: string | null }>> = {};
    let pricingVehicles: Array<{ id: number; label: string }> = [];
    if (driverIds.length) {
      const [docs] = await queryWithRetry<DocumentRow[]>(
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

      const [cars] = await queryWithRetry<CarRow[]>(
        `SELECT dc.id,
                dc.driver_id,
                dc.status,
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
      const carIds = cars.map((car) => car.id);
      let carDocsByCar: Record<number, Array<{ docType: string; name: string; url: string; type: string; expiryDate: string | null }>> = {};
      if (carIds.length) {
        try {
          const [carDocs] = await queryWithRetry<CarDocRow[]>(
            `SELECT car_id, doc_type, expiry_date, file_url, format, file_name
             FROM driver_car_documents
             WHERE car_id IN (${carIds.map(() => '?').join(',')})`,
            carIds
          );
          carDocsByCar = carDocs.reduce((acc, doc) => {
            if (!acc[doc.car_id]) acc[doc.car_id] = [];
            acc[doc.car_id].push({
              docType: doc.doc_type,
              name: doc.file_name || doc.doc_type,
              url: doc.file_url,
              type: (doc.format || '').toUpperCase() || 'FILE',
              expiryDate: doc.expiry_date || null,
            });
            return acc;
          }, {} as Record<number, Array<{ docType: string; name: string; url: string; type: string; expiryDate: string | null }>>);
        } catch (err: any) {
          if (err?.code !== 'ER_NO_SUCH_TABLE') {
            throw err;
          }
          console.warn('driver_car_documents missing, skipping car docs');
        }
      }
      carsByDriver = cars.reduce((acc, car) => {
        if (!acc[car.driver_id]) acc[car.driver_id] = [];
        acc[car.driver_id].push({
          id: car.id,
          vrm: car.vehicle_registration || '-',
          make: car.make || '-',
          model: car.model || '-',
          colour: car.colour || '-',
          keeper: car.keeper_info || '-',
          status: car.status || 'inactive',
          vehicleTypeId: car.vehicle_type_id,
          vehicleTypeLabel: car.vehicle_type_label || '-',
          documents: carDocsByCar[car.id] || [],
        });
        return acc;
      }, {} as Record<number, Array<{ id: number; vrm: string; make: string; model: string; colour: string; keeper: string; status: string; vehicleTypeId: number | null; vehicleTypeLabel: string; documents: Array<{ docType: string; name: string; url: string; type: string; expiryDate: string | null }> }>>);

      const [pricingRows] = await queryWithRetry<PricingVehicleRow[]>(
        `SELECT id, label FROM pricing_vehicles ORDER BY id`
      );
      pricingVehicles = pricingRows.map((row) => ({ id: row.id, label: row.label }));

      await ensureDriverStatementsTable(pool);
      const [statementRows] = await queryWithRetry<StatementRow[]>(
        `SELECT ds.driver_id,
                ds.booking_ref,
                ds.journey_date,
                ds.collection,
                ds.destination,
                ds.vehicle_type,
                ds.fare_quoted,
                ds.status,
                ds.statement_pdf_url
           FROM driver_statements ds
           INNER JOIN client_journeys cj ON cj.id = ds.journey_id
          WHERE ds.driver_id IN (${driverIds.map(() => '?').join(',')})
            AND cj.status = 'Completed'
          ORDER BY ds.journey_date DESC, ds.id DESC`,
        driverIds
      );
      statementsByDriver = statementRows.reduce((acc, row) => {
        if (!acc[row.driver_id]) acc[row.driver_id] = [];
        acc[row.driver_id].push({
          date: row.journey_date || '-',
          ref: row.booking_ref || '',
          pickup: row.collection || '-',
          dropoff: row.destination || '-',
          vehicle: row.vehicle_type || '-',
          miles: 0,
          wait: 0,
          fare: Number(row.fare_quoted ?? 0) || 0,
          status: (row.status || 'Unpaid') as 'Paid' | 'Unpaid',
          pdfUrl: row.statement_pdf_url || null,
        });
        return acc;
      }, {} as Record<number, Array<{ date: string; ref: string; pickup: string; dropoff: string; vehicle: string; miles: number; wait: number; fare: number; status: 'Paid' | 'Unpaid'; pdfUrl: string | null }>>);
    }

    const drivers = rows.map((row) => ({
      id: String(row.driver_id),
      name: [row.first_and_middle_name, row.surname].filter(Boolean).join(' ').trim() || `Driver ${row.driver_id}`,
      phone: row.phone || '-',
      email: row.email,
      address: row.address || '-',
      dateOfBirth: row.date_of_birth || '-',
      nino: row.nino || '-',
      license: row.pco_license_no || '-',
      pcoExpiry: row.pco_expires_date || '-',
      commission: row.commission ?? 20,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      documents: documentsByDriver[row.driver_id] || [],
      profilePhotoUrl: profilePhotoByDriver[row.driver_id] || null,
      carDetails: carsByDriver[row.driver_id] || [],
      statementRows: statementsByDriver[row.driver_id] || [],
    }));

    return NextResponse.json({ drivers, pricingVehicles });
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
    const driverCarId = Number(body.driverCarId);
    const vehicleTypeId = body.vehicleTypeId !== undefined ? Number(body.vehicleTypeId) : null;
    const docType = body.docType !== undefined ? String(body.docType ?? '').trim() : null;
    const expiryDate = body.expiryDate !== undefined ? String(body.expiryDate ?? '').trim() : null;
    if (!driverId) {
      if (!driverCarId) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
      }
    }
    if (commission === null && !nextStatus && !driverCarId) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    if (commission !== null && Number.isNaN(commission)) {
      return NextResponse.json({ error: 'Invalid commission' }, { status: 400 });
    }

    if (commission !== null) {
      const [result] = await executeWithRetry<mysql.ResultSetHeader>(
        `UPDATE drivers SET commission = ? WHERE id = ? LIMIT 1`,
        [commission, driverId]
      );
      if (!result.affectedRows) {
        return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
      }
    }

    if (driverCarId && vehicleTypeId) {
      const [result] = await executeWithRetry<mysql.ResultSetHeader>(
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

    if (driverCarId && docType) {
      const allowedDocTypes = new Set(['mot', 'insurance', 'phv_car_licence']);
      if (!allowedDocTypes.has(docType)) {
        return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
      }

      const normalizedExpiryDate = expiryDate || null;
      await executeWithRetry<mysql.ResultSetHeader>(
        `INSERT INTO driver_car_documents
         (car_id, doc_type, expiry_date, file_name, file_url, public_id, resource_type, format, bytes, width, height)
         VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL)
         ON DUPLICATE KEY UPDATE
           expiry_date = VALUES(expiry_date),
           updated_at = CURRENT_TIMESTAMP`,
        [driverCarId, docType, normalizedExpiryDate]
      );

      return NextResponse.json({ ok: true, docType, expiryDate: normalizedExpiryDate });
    }

    let updatedAt: string | null = null;
    let status: string | null = null;
    if (nextStatus) {
      const allowed = new Set(['active', 'holiday', 'blocked']);
      if (!allowed.has(nextStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      const [result] = await executeWithRetry<mysql.ResultSetHeader>(
        `UPDATE users u
         INNER JOIN drivers d ON d.user_id = u.id
         SET u.status = ?
         WHERE d.id = ?`,
        [nextStatus, driverId]
      );
      if (!result.affectedRows) {
        return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
      }
      const [rows] = await queryWithRetry<mysql.RowDataPacket[]>(
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

export async function DELETE(request: Request) {
  const conn = await pool.getConnection();
  try {
    const body = await request.json().catch(() => ({}));
    const driverId = Number(body?.driverId);
    if (!driverId) {
      return NextResponse.json({ error: 'Invalid driver id' }, { status: 400 });
    }

    const [driverRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT d.id,
              d.user_id,
              d.first_and_middle_name,
              d.surname
         FROM drivers d
        WHERE d.id = ?
        LIMIT 1`,
      [driverId]
    );
    const driver = driverRows[0];
    if (!driver?.id || !driver?.user_id) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const driverName =
      [driver.first_and_middle_name, driver.surname]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean)
        .join(' ') || `Driver ${driverId}`;
    const driverIdText = String(driverId).trim().toLowerCase();
    const driverNameText = driverName.trim().toLowerCase();
    const userId = Number(driver.user_id);

    await conn.beginTransaction();

    await conn.execute(
      `UPDATE client_journeys
          SET driver_name = ?,
              car = 'TBD',
              plate = 'TBD',
              driver_commission_applied = NULL,
              driver_price = NULL
        WHERE status <> 'Completed'
          AND (
            LOWER(TRIM(driver_name)) = ?
            OR LOWER(TRIM(driver_name)) = ?
          )`,
      ['Pending assignment', driverIdText, driverNameText]
    );

    await conn.execute(
      `UPDATE client_journeys
          SET driver_name = ?
        WHERE status = 'Completed'
          AND (
            LOWER(TRIM(driver_name)) = ?
            OR LOWER(TRIM(driver_name)) = ?
          )`,
      [driverName, driverIdText, driverNameText]
    );

    const [driverCarRows] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT id, car_id
         FROM driver_cars
        WHERE driver_id = ?`,
      [driverId]
    );
    const driverCarIds = driverCarRows.map((row) => Number(row.id)).filter(Boolean);
    const carIds = driverCarRows.map((row) => Number(row.car_id)).filter(Boolean);

    if (driverCarIds.length) {
      await executeOptional(
        conn,
        `DELETE FROM driver_car_documents
          WHERE car_id IN (${driverCarIds.map(() => '?').join(',')})`,
        driverCarIds
      );
    }

    await executeOptional(
      conn,
      `DELETE FROM driver_bank_details WHERE driver_id = ?`,
      [driverId]
    );

    await conn.execute(
      `DELETE FROM driver_documents WHERE driver_id = ?`,
      [driverId]
    );

    await executeOptional(
      conn,
      `DELETE FROM driver_statements WHERE driver_id = ?`,
      [driverId]
    );

    await conn.execute(
      `DELETE FROM driver_cars WHERE driver_id = ?`,
      [driverId]
    );

    if (carIds.length) {
      await conn.execute(
        `DELETE FROM cars
          WHERE id IN (${carIds.map(() => '?').join(',')})
            AND id NOT IN (
              SELECT car_id
                FROM (
                  SELECT car_id
                    FROM driver_cars
                   WHERE car_id IN (${carIds.map(() => '?').join(',')})
                ) AS linked_cars
            )`,
        [...carIds, ...carIds]
      );
    }

    await executeOptional(
      conn,
      `DELETE FROM password_reset_tokens WHERE user_id = ?`,
      [userId]
    );

    await conn.execute(
      `DELETE FROM drivers WHERE id = ? LIMIT 1`,
      [driverId]
    );

    await conn.execute(
      `DELETE FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    await conn.commit();
    return NextResponse.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error('Admin driver delete error', err);
    return NextResponse.json({ error: 'Failed to delete driver' }, { status: 500 });
  } finally {
    conn.release();
  }
}
