import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, DbRow } from '@/lib/db';
import { getRequestIp, logSiteActivity } from '@/lib/site-activity';

export const dynamic = 'force-dynamic';

const pool = getDbPool();

type DriverRow = DbRow<{
  driver_id: number;
  email: string;
  user_phone: string | null;
  first_and_middle_name: string | null;
  surname: string | null;
  address: string | null;
  pco_license_no: string | null;
  pco_expires_date: string | null;
  driving_license_no: string | null;
  user_created_at: string;
}>;

type DocumentRow = DbRow<{
  doc_type: string;
  file_url: string;
  format: string | null;
  file_name: string | null;
}>;

type CarRow = DbRow<{
  driver_car_id: number;
  car_id: number;
  status: string | null;
  vehicle_registration: string | null;
  make: string | null;
  model: string | null;
  colour: string | null;
  keeper_info: string | null;
}>;

type CarDocRow = DbRow<{
  id: number;
  car_id: number;
  doc_type: string;
  expiry_date: string | null;
  file_url: string;
  format: string | null;
  file_name: string | null;
}>;

type BankRow = DbRow<{
  bank_name: string | null;
  account_name: string | null;
  sort_code: string | null;
  account_number: string | null;
}>;

const DOC_LABELS: Record<string, string> = {
  pco_license: 'PCO Licence',
  driving_license_front: 'Driving Licence Front',
  driving_license_back: 'Driving Licence Back',
  profile_photo: 'Profile Photo',
};

const DRIVER_DOC_TYPES = new Set([
  'pco_license',
  'driving_license_front',
  'driving_license_back',
  'profile_photo',
]);

const CAR_DOC_TYPES = new Set([
  'mot',
  'insurance',
  'phv_car_licence',
  'logbook_v5',
  'logbook_v5_page2',
  'other',
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const email = String(searchParams.get('email') ?? '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const [rows] = await pool.query<DriverRow[]>(
      `SELECT d.id AS driver_id,
              u.email,
              u.phone AS user_phone,
              u.created_at AS user_created_at,
              d.first_and_middle_name,
              d.surname,
              d.address,
              d.pco_license_no,
              d.pco_expires_date,
              d.driving_license_no
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    const driver = rows[0];
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const [docs] = await pool.query<DocumentRow[]>(
      `SELECT doc_type, file_url, format, file_name
       FROM driver_documents
       WHERE driver_id = ?`,
      [driver.driver_id]
    );
    const driverDocuments = docs
      .filter((doc) => DRIVER_DOC_TYPES.has(doc.doc_type))
      .map((doc) => ({
        docType: doc.doc_type,
        name: DOC_LABELS[doc.doc_type] || doc.doc_type,
        url: doc.file_url,
        type: (doc.format || '').toUpperCase() || 'FILE',
        fileName: doc.file_name,
      }));

    const [cars] = await pool.query<CarRow[]>(
      `SELECT dc.id AS driver_car_id,
              c.id AS car_id,
              dc.status,
              c.vehicle_registration,
              c.make,
              c.model,
              c.colour,
              c.keeper_info
       FROM driver_cars dc
       INNER JOIN cars c ON c.id = dc.car_id
       WHERE dc.driver_id = ? AND dc.deleted_at IS NULL`,
      [driver.driver_id]
    );

    let carDocumentsByCar: Record<number, Array<{ docType: string; name: string; url: string; type: string; expiryDate: string | null }>> = {};
    if (cars.length) {
      try {
        const [carDocs] = await pool.query<CarDocRow[]>(
          `SELECT id, car_id, doc_type, expiry_date, file_url, format, file_name
           FROM driver_car_documents
           WHERE car_id IN (${cars.map(() => '?').join(',')})
           ORDER BY updated_at DESC, id DESC`,
          cars.map((car) => car.driver_car_id)
        );
        carDocumentsByCar = carDocs.reduce((acc, doc) => {
          const existingDocs = acc[doc.car_id] || [];
          if (existingDocs.some((entry) => entry.docType === doc.doc_type)) {
            return acc;
          }
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

    const [bankRows] = await pool.query<BankRow[]>(
      `SELECT bank_name, account_name, sort_code, account_number
       FROM driver_bank_details
       WHERE driver_id = ?
       LIMIT 1`,
      [driver.driver_id]
    );
    const bank = bankRows[0] || null;

    const fallbackCarDocs = docs
      .filter((doc) => CAR_DOC_TYPES.has(doc.doc_type))
      .map((doc) => ({
        docType: doc.doc_type,
        name: doc.file_name || doc.doc_type,
        url: doc.file_url,
        type: (doc.format || '').toUpperCase() || 'FILE',
        expiryDate: null,
      }));

    return NextResponse.json({
      driver: {
        id: driver.driver_id,
        email: driver.email,
        phone: driver.user_phone,
        firstAndMiddleName: driver.first_and_middle_name,
        surname: driver.surname,
        address: driver.address,
        pcoLicenseNo: driver.pco_license_no,
        pcoExpiresDate: driver.pco_expires_date,
        drivingLicenseNo: driver.driving_license_no,
        createdAt: driver.user_created_at,
      },
      documents: driverDocuments,
      cars: cars.map((car) => {
        const docsForCar = carDocumentsByCar[car.driver_car_id] || [];
        const useFallback = docsForCar.length === 0 && fallbackCarDocs.length > 0 && cars.length === 1;
        return {
          id: car.driver_car_id,
          status: car.status || 'active',
          isActive: car.status === 'active',
          vehicle_registration: car.vehicle_registration,
          make: car.make,
          model: car.model,
          colour: car.colour,
          keeper_info: car.keeper_info,
          documents: useFallback ? fallbackCarDocs : docsForCar,
        };
      }),
      bank: bank
        ? {
            bankName: bank.bank_name,
            accountName: bank.account_name,
            sortCode: bank.sort_code,
            accountNumber: bank.account_number,
          }
        : null,
    });
  } catch (err) {
    console.error('Driver profile fetch error', err);
    return NextResponse.json({ error: 'Failed to load driver profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const nextEmail = String(body.nextEmail ?? '').trim().toLowerCase();
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const drivingLicense = String(body.drivingLicense ?? '').trim();
    const address = String(body.address ?? '').trim();
    const pcoLicenceNo = String(body.pcoLicenceNo ?? '').trim();
    const pcoExpiry = body.pcoExpiry ? String(body.pcoExpiry).trim() : null;

    if (!email || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [users] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT u.id,
                d.id AS driver_id,
                u.phone AS user_phone,
                d.first_and_middle_name,
                d.surname,
                d.address,
                d.pco_license_no,
                d.pco_expires_date,
                d.driving_license_no
           FROM users u
           INNER JOIN drivers d ON d.user_id = u.id
          WHERE u.email = ?
          LIMIT 1`,
        [email]
      );
      const user = users[0];
      if (!user) {
        await conn.rollback();
        return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
      }

      if (nextEmail && nextEmail !== email) {
        const [existing] = await conn.query<mysql.RowDataPacket[]>(
          'SELECT id FROM users WHERE email = ? LIMIT 1',
          [nextEmail]
        );
        if (existing.length) {
          await conn.rollback();
          return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
        }
      }

      await conn.execute(
        `UPDATE users
         SET email = ?, phone = ?
         WHERE id = ?`,
        [nextEmail || email, phone || null, user.id]
      );

      await conn.execute(
        `UPDATE drivers
         SET first_and_middle_name = ?,
             surname = ?,
             address = ?,
             phone = ?,
             pco_license_no = ?,
             pco_expires_date = ?,
             driving_license_no = ?
         WHERE user_id = ?`,
        [
          firstName,
          lastName,
          address || null,
          phone || null,
          pcoLicenceNo || null,
          pcoExpiry || null,
          drivingLicense || null,
          user.id,
        ]
      );

      await conn.commit();

      await logSiteActivity(pool, {
        tableName: 'drivers',
        operation: 'UPDATE',
        pk: user.driver_id || user.id,
        category: 'driver',
        title: 'Driver profile updated',
        message: `${firstName} ${lastName} updated their driver profile.`,
        severity: 'info',
        tags: {
          actor: 'driver',
        },
        changedBy: user.id,
        changedByEmail: nextEmail || email,
        ip: getRequestIp(request),
        old: {
          email,
          phone: user.user_phone,
          firstName: user.first_and_middle_name,
          lastName: user.surname,
          address: user.address,
          pcoLicenceNo: user.pco_license_no,
          pcoExpiry: user.pco_expires_date,
          drivingLicense: user.driving_license_no,
        },
        next: {
          email: nextEmail || email,
          phone,
          firstName,
          lastName,
          address,
          pcoLicenceNo,
          pcoExpiry,
          drivingLicense,
        },
      }).catch((err) => {
        console.error('Driver profile audit error', err);
      });

      return NextResponse.json({ ok: true, email: nextEmail || email });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Driver profile update error', err);
    return NextResponse.json({ error: 'Failed to update driver profile' }, { status: 500 });
  }
}
