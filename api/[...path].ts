import type { NextApiRequest, NextApiResponse } from 'next';
import { getDbPool } from '@/lib/db';
import { ensureBlogPostsTable } from '@/lib/blog-posts';

const pool = getDbPool();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = (req.query.path as string[] | undefined) || [];
  const route = '/' + path.join('/');

  try {
    if (req.method === 'GET' && route === '/health') {
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'GET' && route === '/blog-posts') {
      await ensureBlogPostsTable(pool);
      const [rows] = await pool.query(
        `SELECT id, slug, title, summary, body, hero_image, tag, published_at, created_at, updated_at
         FROM blog_posts
         ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
      );
      return res.status(200).json(rows);
    }

    // Add other routes here as needed (bookings, drivers, notifications, etc.)

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
