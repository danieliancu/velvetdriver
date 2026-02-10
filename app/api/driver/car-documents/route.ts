import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db';

export const runtime = 'nodejs';

const pool = getDbPool();

const ALLOWED_DOC_TYPES = new Set([
  'mot',
  'insurance',
  'phv_car_licence',
  'logbook_v5',
  'logbook_v5_page2',
  'other',
]);

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

async function uploadToCloudinary(file: File, driverId: number, carId: number, docType: string) {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnv('CLOUDINARY_API_KEY');
  const apiSecret = getEnv('CLOUDINARY_API_SECRET');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `drivers/${driverId}/cars/${carId}`;
  const publicId = docType;
  const signature = buildSignature({ folder, public_id: publicId, timestamp }, apiSecret);
  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', publicId);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CloudinaryUpload;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const carId = Number(form.get('carId'));
    const docType = String(form.get('docType') ?? '').trim();
    const expiryDate = String(form.get('expiryDate') ?? '').trim();
    const file = form.get('file');
    if (!email || !carId || !docType || !(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (!ALLOWED_DOC_TYPES.has(docType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT d.id AS driver_id
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id AND r.code = 'driver'
       INNER JOIN drivers d ON d.user_id = u.id
       INNER JOIN driver_cars c ON c.driver_id = d.id
       WHERE u.email = ? AND c.id = ?
       LIMIT 1`,
      [email, carId]
    );
    const driverId = rows[0]?.driver_id;
    if (!driverId) {
      return NextResponse.json({ error: 'Car not found' }, { status: 404 });
    }

    const upload = await uploadToCloudinary(file, driverId, carId, docType);
    const fileName = upload.original_filename
      ? `${upload.original_filename}${upload.format ? `.${upload.format}` : ''}`
      : null;

    await pool.execute(
      `INSERT INTO driver_car_documents
       (car_id, doc_type, expiry_date, file_name, file_url, public_id, resource_type, format, bytes, width, height)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         expiry_date = VALUES(expiry_date),
         file_name = VALUES(file_name),
         file_url = VALUES(file_url),
         public_id = VALUES(public_id),
         resource_type = VALUES(resource_type),
         format = VALUES(format),
         bytes = VALUES(bytes),
         width = VALUES(width),
         height = VALUES(height),
         updated_at = CURRENT_TIMESTAMP`,
      [
        carId,
        docType,
        expiryDate || null,
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

    return NextResponse.json({
      ok: true,
      docType,
      url: upload.secure_url,
      type: (upload.format || 'FILE').toUpperCase(),
      fileName,
      expiryDate: expiryDate || null,
    });
  } catch (err) {
    console.error('Driver car document upload error', err);
    return NextResponse.json({ error: 'Failed to upload car document' }, { status: 500 });
  }
}
