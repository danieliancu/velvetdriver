import { NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { ensureBlogPostsTable, type BlogPostRow } from '@/lib/blog-posts';

export const dynamic = 'force-dynamic';

const pool = getDbPool();

export async function GET() {
  try {
    await ensureBlogPostsTable(pool);
    const [rows] = await pool.query<BlogPostRow[]>(
      `SELECT id, slug, title, summary, body, hero_image, tag, published_at, created_at, updated_at
       FROM blog_posts
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('Error fetching blog posts', err);
    return NextResponse.json({ error: 'Failed to load blog posts' }, { status: 500 });
  }
}
