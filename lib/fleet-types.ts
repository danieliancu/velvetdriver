import { unstable_noStore as noStore } from 'next/cache';
import { getDbPool, type DbRow } from '@/lib/db';

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
};

type DbFleetTypeRow = DbRow<DbFleetType>;

export type FleetTypePublic = {
  id: number;
  slug: string;
  label: string;
  summary: string | null;
  description: string | null;
  hero_image: string | null;
  features: string | null;
  sort_order: number | null;
  is_active: number | null;
};

export async function getPublicFleetTypes() {
  noStore();
  const pool = getDbPool();
  const [rows] = await pool.query<DbFleetTypeRow[]>(
    `SELECT id, slug, label, summary, description, hero_image, features, sort_order, is_active
     FROM fleet_types
     WHERE is_active = 1
     ORDER BY sort_order ASC, label ASC, id ASC`
  );

  return rows
    .map((row) => ({
      id: Number(row.id),
      slug: String(row.slug || '').trim(),
      label: String(row.label || '').trim(),
      summary: row.summary ?? null,
      description: row.description ?? null,
      hero_image: row.hero_image ?? null,
      features: row.features ?? null,
      sort_order: row.sort_order ?? 0,
      is_active: row.is_active ?? 0,
    }))
    .filter((row) => row.slug && row.label) as FleetTypePublic[];
}
