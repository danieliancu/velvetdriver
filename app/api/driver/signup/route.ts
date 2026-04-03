import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db';
import { getRequestIp, logSiteActivity } from '@/lib/site-activity';

export const runtime = 'nodejs';

const pool = getDbPool();

const DRIVER_DOC_TYPE_MAP: Record<string, string> = {
  pcoLicenseDoc: 'pco_license',
  drivingLicenseFront: 'driving_license_front',
  drivingLicenseBack: 'driving_license_back',
  profilePhoto: 'profile_photo',
};

const CAR_DOC_TYPE_MAP: Record<string, string> = {
  motDoc: 'mot',
  insuranceDoc: 'insurance',
  phvDoc: 'phv_car_licence',
  logbookDoc: 'logbook_v5',
  logbookDocPage2: 'logbook_v5_page2',
  otherDoc: 'other',
};

type CloudinaryUpload = {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  original_filename?: string;
};

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function buildSignature(params: Record<string, string>, apiSecret: string) {
  const pairs = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(pairs + apiSecret).digest('hex');
}

function resolveResourceType(file: File) {
  if (file.type === 'application/pdf') return 'image';
  const name = file.name?.toLowerCase?.() ?? '';
  if (name.endsWith('.pdf')) return 'image';
  return 'auto';
}

async function uploadToCloudinary(file: File, driverId: number, docType: string) {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnv('CLOUDINARY_API_KEY');
  const apiSecret = getEnv('CLOUDINARY_API_SECRET');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `drivers/${driverId}`;
  const publicId = docType;
  const resourceType = resolveResourceType(file);
  const signature = buildSignature({ folder, public_id: publicId, timestamp }, apiSecret);
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', publicId);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CloudinaryUpload;
}

async function uploadCarDoc(file: File, driverId: number, carId: number, docType: string) {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnv('CLOUDINARY_API_KEY');
  const apiSecret = getEnv('CLOUDINARY_API_SECRET');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `drivers/${driverId}/cars/${carId}`;
  const publicId = docType;
  const resourceType = resolveResourceType(file);
  const signature = buildSignature({ folder, public_id: publicId, timestamp }, apiSecret);
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', publicId);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CloudinaryUpload;
}

async function destroyCloudinary(publicId: string, resourceType: string) {
  try {
    const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
    const apiKey = getEnv('CLOUDINARY_API_KEY');
    const apiSecret = getEnv('CLOUDINARY_API_SECRET');
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = buildSignature({ public_id: publicId, timestamp }, apiSecret);
    const form = new FormData();
    form.append('public_id', publicId);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('signature', signature);
    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: 'POST',
      body: form,
    });
  } catch (err) {
    console.error('Cloudinary cleanup failed', err);
  }
}

function requireField(value: string, label: string) {
  if (!value) {
    throw new Error(`Missing ${label}`);
  }
}

export async function POST(request: Request) {
  let conn: mysql.PoolConnection | null = null;
  const uploaded: Array<{ publicId: string; resourceType: string }> = [];
  try {
    const form = await request.formData();
    const getText = (key: string) => String(form.get(key) ?? '').trim();

    const surname = getText('surname');
    const firstMiddleNames = getText('firstMiddleNames');
    const address = getText('address');
    const postcode = getText('postcode');
    const dob = getText('dob');
    const nino = getText('nationalInsurance');
    const phone = getText('phone');
    const email = getText('email').toLowerCase();
    const password = getText('password');
    const pcoLicenseNumber = getText('pcoLicenseNumber');
    const pcoExpiry = getText('pcoExpiry');
    const drivingLicenseNumber = getText('drivingLicenseNumber');
    const dvlaCode = getText('dvlaCode');
    const vehicleReg = getText('vehicleReg');
    const make = getText('make');
    const model = getText('model');
    const colour = getText('colour');
    const keeperInfo = getText('keeperInfo');

    requireField(surname, 'surname');
    requireField(firstMiddleNames, 'first & middle names');
    requireField(address, 'address');
    requireField(postcode, 'postcode');
    requireField(dob, 'date of birth');
    requireField(nino, 'national insurance');
    requireField(phone, 'phone');
    requireField(email, 'email');
    requireField(password, 'password');
    requireField(pcoLicenseNumber, 'PCO licence number');
    requireField(pcoExpiry, 'PCO expiry date');
    requireField(drivingLicenseNumber, 'driving licence number');
    requireField(dvlaCode, 'DVLA code');

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existing] = await conn.query<mysql.RowDataPacket[]>(
      `SELECT u.id, r.code AS role_code
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.email = ?
       LIMIT 1`,
      [email]
    );
    if (existing.length) {
      await conn.rollback();
      const roleCode = String(existing[0]?.role_code ?? '').toLowerCase();
      if (roleCode && roleCode !== 'driver') {
        return NextResponse.json(
          {
            error: `This email is already registered as ${roleCode}. A ${roleCode} account cannot be registered as driver.`,
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'This email is already registered as driver. Please sign in.' },
        { status: 409 }
      );
    }

    const [roleResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO roles (code, label, is_active)
       VALUES ('driver', 'Driver', 1)
       ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`
    );
    const roleId = roleResult.insertId;

    const hash = await bcrypt.hash(password, 10);
    const [userResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO users (role_id, email, phone, password_hash, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [roleId, email, phone || null, hash]
    );
    const userId = userResult.insertId;

    const [driverResult] = await conn.execute<mysql.ResultSetHeader>(
      `INSERT INTO drivers
       (user_id, surname, first_and_middle_name, address, postcode, date_of_birth, nino, phone, pco_license_no, pco_expires_date, driving_license_no, dvla_check_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        surname,
        firstMiddleNames,
        address,
        postcode,
        dob || null,
        nino,
        phone,
        pcoLicenseNumber,
        pcoExpiry || null,
        drivingLicenseNumber,
        dvlaCode,
      ]
    );
    const driverId = driverResult.insertId;

    let driverCarId: number | null = null;
    if (vehicleReg || make || model || colour || keeperInfo) {
      const [pricingRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT id
         FROM pricing_vehicles
         ORDER BY id
         LIMIT 1`
      );
      const vehicleTypeId = pricingRows[0]?.id || null;
      if (!vehicleTypeId) {
        throw new Error('Missing vehicle types');
      }

      let carId: number | null = null;
      if (vehicleReg) {
        const [existingCar] = await conn.query<mysql.RowDataPacket[]>(
          `SELECT id FROM cars WHERE vehicle_registration = ? LIMIT 1`,
          [vehicleReg]
        );
        if (existingCar.length) {
          carId = existingCar[0].id;
        }
      }
      if (!carId) {
        const [carResult] = await conn.execute<mysql.ResultSetHeader>(
          `INSERT INTO cars
           (vehicle_type_id, vehicle_registration, make, model, colour, keeper_info)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [vehicleTypeId, vehicleReg || null, make || null, model || null, colour || null, keeperInfo || null]
        );
        carId = carResult.insertId;
      }

      const [countRows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM driver_cars WHERE driver_id = ? AND deleted_at IS NULL`,
        [driverId]
      );
      const status = countRows[0]?.total ? 'inactive' : 'active';
      const [driverCarResult] = await conn.execute<mysql.ResultSetHeader>(
        `INSERT INTO driver_cars
         (driver_id, car_id, status, assigned_from)
         VALUES (?, ?, ?, NOW())`,
        [driverId, carId, status]
      );
      driverCarId = driverCarResult.insertId;
    }

    for (const [field, docType] of Object.entries(DRIVER_DOC_TYPE_MAP)) {
      const file = form.get(field);
      if (!file || !(file instanceof File)) {
        continue;
      }
      const upload = await uploadToCloudinary(file, driverId, docType);
      uploaded.push({ publicId: upload.public_id, resourceType: upload.resource_type });
      const fileName = upload.original_filename
        ? `${upload.original_filename}${upload.format ? `.${upload.format}` : ''}`
        : null;
      await conn.execute(
        `INSERT INTO driver_documents
         (driver_id, doc_type, file_name, file_url, public_id, resource_type, format, bytes, width, height)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          driverId,
          docType,
          fileName,
          upload.secure_url,
          upload.public_id,
          upload.resource_type,
          upload.format || null,
          upload.bytes || null,
          upload.width || null,
          upload.height || null,
        ]
      );
    }

    if (driverCarId) {
      for (const [field, docType] of Object.entries(CAR_DOC_TYPE_MAP)) {
        const file = form.get(field);
        if (!file || !(file instanceof File)) {
          continue;
        }
        const upload = await uploadCarDoc(file, driverId, driverCarId, docType);
        uploaded.push({ publicId: upload.public_id, resourceType: upload.resource_type });
        const fileName = upload.original_filename
          ? `${upload.original_filename}${upload.format ? `.${upload.format}` : ''}`
          : null;
        await conn.execute(
          `INSERT INTO driver_car_documents
           (car_id, doc_type, file_name, file_url, public_id, resource_type, format, bytes, width, height)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            driverCarId,
            docType,
            fileName,
            upload.secure_url,
            upload.public_id,
            upload.resource_type,
            upload.format || null,
            upload.bytes || null,
            upload.width || null,
            upload.height || null,
          ]
        );
      }
    }

    await conn.commit();

    await logSiteActivity(pool, {
      tableName: 'drivers',
      operation: 'INSERT',
      pk: driverId,
      category: 'driver',
      title: 'New driver signup submitted',
      message: `${firstMiddleNames} ${surname} submitted a new driver application.`,
      severity: 'info',
      tags: {
        actor: 'driver',
        status: 'pending',
        vehicleReg: vehicleReg || null,
      },
      changedBy: userId,
      changedByEmail: email,
      ip: getRequestIp(request),
      next: {
        name: `${firstMiddleNames} ${surname}`.trim(),
        phone,
        email,
        pcoLicenseNumber,
        pcoExpiry,
      },
    }).catch((err) => {
      console.error('Driver signup audit error', err);
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    for (const item of uploaded) {
      await destroyCloudinary(item.publicId, item.resourceType);
    }
    if (err?.message?.startsWith('Missing')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (typeof err?.message === 'string' && err.message.trim()) {
      console.error('Driver signup error', err);
      return NextResponse.json({ error: err.message.trim() }, { status: 500 });
    }
    console.error('Driver signup error', err);
    return NextResponse.json({ error: 'Failed to submit driver application' }, { status: 500 });
  } finally {
    if (conn) conn.release();
  }
}
