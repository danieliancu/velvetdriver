import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.API_PORT ? Number(process.env.API_PORT) : 4000;

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'velvet';
const DB_PORT = Number(process.env.DB_PORT || '3306');
const DB_CHARSET = process.env.DB_CHARSET || 'utf8mb4';

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  charset: DB_CHARSET,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/blog-posts', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, slug, title, summary, body, hero_image, tag, published_at
       FROM blog_posts
       ORDER BY published_at DESC, id DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching blog posts', err);
    res.status(500).json({ error: 'Failed to load blog posts' });
  }
});

app.listen(PORT, () => {
  console.log(`API server listening on http://localhost:${PORT}`);
});
