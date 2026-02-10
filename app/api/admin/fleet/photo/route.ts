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

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function uploadToCloudinary(file: File, folder: string, publicId: string) {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnv('CLOUDINARY_API_KEY');
  const apiSecret = getEnv('CLOUDINARY_API_SECRET');
  const timestamp = Math.floor(Date.now() / 1000).toString();
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
    const fleetIdRaw = form.get('fleetId');
    const slugRaw = form.get('slug');
    const file = form.get('file');
    const fleetId = fleetIdRaw ? Number(fleetIdRaw) : null;
    const slug = slugRaw ? normalizeSlug(String(slugRaw)) : '';
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    if (fleetId) {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM fleet_types WHERE id = ? LIMIT 1',
        [fleetId]
      );
      if (!rows.length) {
        return NextResponse.json({ error: 'Fleet type not found' }, { status: 404 });
      }
    }

    const folderBase = fleetId ? `fleet-types/${fleetId}` : slug ? `fleet-types/${slug}` : 'fleet-types/unsaved';
    const publicId = fleetId || slug ? 'hero_image' : `hero_${Date.now()}`;
    const upload = await uploadToCloudinary(file, folderBase, publicId);

    return NextResponse.json({
      ok: true,
      url: upload.secure_url,
      format: upload.format || null,
      publicId: upload.public_id,
    });
  } catch (err) {
    console.error('Fleet photo upload error', err);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}
