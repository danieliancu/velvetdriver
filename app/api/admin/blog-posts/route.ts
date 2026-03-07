import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { getDbPool } from '@/lib/db';
import { ensureBlogPostsTable, parseBlogPostPayload, type BlogPostRow } from '@/lib/blog-posts';

const pool = getDbPool();

export async function GET() {
  try {
    await ensureBlogPostsTable(pool);
    const [rows] = await pool.query<BlogPostRow[]>(
      `SELECT id, slug, title, summary, body, hero_image, tag, published_at, created_at, updated_at
       FROM blog_posts
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
    );

    return NextResponse.json({ posts: rows });
  } catch (err) {
    console.error('Admin blog posts fetch error', err);
    return NextResponse.json({ error: 'Failed to load blog posts' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureBlogPostsTable(pool);
    const body = await request.json();
    const parsed = parseBlogPostPayload(body);

    if (!parsed) {
      return NextResponse.json({ error: 'Invalid payload: title is required' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `INSERT INTO blog_posts (slug, title, summary, body, hero_image, tag, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        parsed.slug,
        parsed.title,
        parsed.summary,
        parsed.body,
        parsed.heroImage,
        parsed.tag,
        parsed.publishedAt,
      ]
    );

    return NextResponse.json({ ok: true, id: result.insertId, slug: parsed.slug }, { status: 201 });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    console.error('Admin blog post create error', err);
    return NextResponse.json({ error: 'Failed to create blog post' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await ensureBlogPostsTable(pool);
    const body = await request.json();
    const id = Number(body?.id);
    if (!id) {
      return NextResponse.json({ error: 'Invalid payload: id is required' }, { status: 400 });
    }

    const parsed = parseBlogPostPayload(body);
    if (!parsed) {
      return NextResponse.json({ error: 'Invalid payload: title is required' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `UPDATE blog_posts
          SET slug = ?,
              title = ?,
              summary = ?,
              body = ?,
              hero_image = ?,
              tag = ?,
              published_at = ?
        WHERE id = ?
        LIMIT 1`,
      [
        parsed.slug,
        parsed.title,
        parsed.summary,
        parsed.body,
        parsed.heroImage,
        parsed.tag,
        parsed.publishedAt,
        id,
      ]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
    }
    console.error('Admin blog post update error', err);
    return NextResponse.json({ error: 'Failed to update blog post' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await ensureBlogPostsTable(pool);
    const url = new URL(request.url);
    const id = Number(url.searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const [result] = await pool.execute<mysql.ResultSetHeader>(
      `DELETE FROM blog_posts WHERE id = ? LIMIT 1`,
      [id]
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('Admin blog post delete error', err);
    return NextResponse.json({ error: 'Failed to delete blog post' }, { status: 500 });
  }
}
