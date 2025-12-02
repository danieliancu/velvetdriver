import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';

const pool = getDbPool();

type DbPost = {
  id: number;
  slug: string | null;
  title: string | null;
  summary: string | null;
  body: string | null;
  hero_image: string | null;
  tag: string | null;
  published_at: string | null;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || `post-${Date.now()}`;

export async function GET() {
  try {
    const [rows] = await pool.query<DbPost[]>(
      `SELECT id, slug, title, summary, body, hero_image, tag, published_at
       FROM blog_posts
       ORDER BY COALESCE(published_at, NOW()) DESC, id DESC`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Error fetching blog posts', err);
    return NextResponse.json({ error: 'Failed to load blog posts' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = String(body.title ?? '').trim();
    const summary = body.summary ?? null;
    const content = body.body ?? null;
    const hero = body.hero_image ?? null;
    const tag = body.tag ?? null;
    const publishedAt = body.published_at ? new Date(body.published_at) : null;
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    const slug = slugify(body.slug || title);
    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO blog_posts (slug, title, summary, body, hero_image, tag, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [slug, title, summary, content, hero, tag, publishedAt ? publishedAt : null]
    );
    return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
  } catch (err) {
    console.error('Error creating blog post', err);
    return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    const title = String(body.title ?? '').trim();
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });
    const slug = slugify(body.slug || title);
    const summary = body.summary ?? null;
    const content = body.body ?? null;
    const hero = body.hero_image ?? null;
    const tag = body.tag ?? null;
    const publishedAt = body.published_at ? new Date(body.published_at) : null;
    await pool.execute(
      `UPDATE blog_posts
       SET slug = ?, title = ?, summary = ?, body = ?, hero_image = ?, tag = ?, published_at = ?
       WHERE id = ?`,
      [slug, title, summary, content, hero, tag, publishedAt ? publishedAt : null, id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error updating blog post', err);
    return NextResponse.json({ error: 'Failed to update blog post' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const idParam = url.searchParams.get('id');
    const id = idParam ? Number(idParam) : null;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await pool.execute('DELETE FROM blog_posts WHERE id = ?', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Error deleting blog post', err);
    return NextResponse.json({ error: 'Failed to delete blog post' }, { status: 500 });
  }
}
