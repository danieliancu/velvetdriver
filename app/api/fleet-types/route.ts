import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool, type DbRow } from '@/lib/db';

const pool = getDbPool();

type DbFleetType = {
  id: number;
  slug: string | null;
  label: string | null;
  summary: string | null;
  description: string | null;
  hero_image: string | null;
  features: string | null;
  sort_order: number | null;
  is_active: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type DbFleetTypeRow = DbRow<DbFleetType>;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || `fleet-${Date.now()}`;

const normalizeBool = (value: any, fallback = true) => {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return fallback;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const includeInactive = url.searchParams.get('includeInactive') === '1';
    const [rows] = await pool.query<DbFleetTypeRow[]>(
      `SELECT id, slug, label, summary, description, hero_image, features, sort_order, is_active, created_at, updated_at
       FROM fleet_types
       ${includeInactive ? '' : 'WHERE is_active = 1'}
       ORDER BY sort_order ASC, label ASC, id ASC`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Error fetching fleet types', err);
    return NextResponse.json({ error: 'Failed to load fleet types' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const label = String(body.label ?? '').trim();
    if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 });
    const slug = slugify(body.slug || label);
    const summary = body.summary ?? null;
    const description = body.description ?? null;
    const hero = body.hero_image ?? null;
    const features = body.features ?? null;
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    const isActive = normalizeBool(body.is_active, true) ? 1 : 0;

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO fleet_types (slug, label, summary, description, hero_image, features, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [slug, label, summary, description, hero, features, sortOrder, isActive]
    );
    return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
  } catch (err) {
    console.error('Error creating fleet type', err);
    return NextResponse.json({ error: 'Failed to create fleet type' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const label = String(body.label ?? '').trim();
    if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 });
    const slug = slugify(body.slug || label);
    const summary = body.summary ?? null;
    const description = body.description ?? null;
    const hero = body.hero_image ?? null;
    const features = body.features ?? null;
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
    const isActive = normalizeBool(body.is_active, true) ? 1 : 0;

    await pool.execute(
      `UPDATE fleet_types
       SET slug = ?, label = ?, summary = ?, description = ?, hero_image = ?, features = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [slug, label, summary, description, hero, features, sortOrder, isActive, id]
    );
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    console.error('Error updating fleet type', err);
    return NextResponse.json({ error: 'Failed to update fleet type' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get('id');
    const id = idParam ? Number(idParam) : null;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await pool.execute('DELETE FROM fleet_types WHERE id = ?', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error deleting fleet type', err);
    return NextResponse.json({ error: 'Failed to delete fleet type' }, { status: 500 });
  }
}
