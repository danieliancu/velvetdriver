import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import crypto from 'crypto';
import { getDbPool } from '@/lib/db';
import { ensureBlogPostsTable } from '@/lib/blog-posts';

export const runtime = 'nodejs';

const pool = getDbPool();

type CloudinaryUpload = {
  secure_url: string;
  public_id: string;
  format?: string;
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
    .slice(0, 120);
}

function createUploadId() {
  return `blog_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

type UploadPayload = {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
};

async function uploadToCloudinary(payload: UploadPayload, folder: string, publicId: string) {
  const cloudName = getEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = getEnv('CLOUDINARY_API_KEY');
  const apiSecret = getEnv('CLOUDINARY_API_SECRET');

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = buildSignature({ folder, public_id: publicId, timestamp }, apiSecret);

  const form = new FormData();
  form.append('file', new Blob([payload.bytes], { type: payload.contentType }), payload.fileName);
  form.append('api_key', apiKey);
  form.append('timestamp', timestamp);
  form.append('signature', signature);
  form.append('folder', folder);
  form.append('public_id', publicId);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudinary upload failed: ${response.status} ${text}`);
  }

  return (await response.json()) as CloudinaryUpload;
}

export async function POST(request: Request) {
  try {
    await ensureBlogPostsTable(pool);

    const form = await request.formData();
    const postIdRaw = form.get('postId');
    const slugRaw = form.get('slug');
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!bytes.byteLength) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    const postId = postIdRaw ? Number(postIdRaw) : null;
    if (postId) {
      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        'SELECT id FROM blog_posts WHERE id = ? LIMIT 1',
        [postId]
      );
      if (!rows.length) {
        return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
      }
    }

    const slug = slugRaw ? normalizeSlug(String(slugRaw)) : '';
    const folder = postId ? `blog/${postId}` : slug ? `blog/${slug}` : 'blog/unsaved';
    const publicId = createUploadId();

    const upload = await uploadToCloudinary(
      {
        bytes,
        fileName: file.name || `${publicId}.bin`,
        contentType: file.type || 'application/octet-stream',
      },
      folder,
      publicId
    );

    if (postId) {
      await pool.execute(
        `UPDATE blog_posts
            SET hero_image = ?,
                updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          LIMIT 1`,
        [upload.secure_url, postId]
      );
    }

    return NextResponse.json({
      ok: true,
      url: upload.secure_url,
      format: upload.format || null,
      publicId: upload.public_id,
    });
  } catch (err: any) {
    console.error('Blog photo upload error', err);
    const message = err?.message ? String(err.message) : 'Failed to upload blog photo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
