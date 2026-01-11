import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db';

export const runtime = 'nodejs';

const pool = getDbPool();

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

async function uploadToCloudinary(file: File, driverId: number) {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnv('CLOUDINARY_API_KEY');
  const apiSecret = getEnv('CLOUDINARY_API_SECRET');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `drivers/${driverId}`;
  const publicId = 'profile_photo';
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
    const driverId = Number(form.get('driverId'));
    const file = form.get('file');
    if (!driverId || !(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      'SELECT id FROM drivers WHERE id = ? LIMIT 1',
      [driverId]
    );
    if (!rows.length) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }

    const upload = await uploadToCloudinary(file, driverId);
    const fileName = upload.original_filename
      ? `${upload.original_filename}${upload.format ? `.${upload.format}` : ''}`
      : null;
    await pool.execute(
      `INSERT INTO driver_documents
       (driver_id, doc_type, file_name, file_url, public_id, resource_type, format, bytes, width, height)
       VALUES (?, 'profile_photo', ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
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
        driverId,
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
      url: upload.secure_url,
      format: upload.format || null,
    });
  } catch (err) {
    console.error('Driver photo upload error', err);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
