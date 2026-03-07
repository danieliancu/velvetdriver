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

let blogTableEnsured = false;

async function ensureBlogPostsTable() {
  if (blogTableEnsured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      slug VARCHAR(180) NOT NULL,
      title VARCHAR(255) NOT NULL,
      summary TEXT NULL,
      body LONGTEXT NULL,
      hero_image TEXT NULL,
      tag VARCHAR(80) NULL,
      published_at DATETIME NULL,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_blog_posts_slug (slug),
      KEY idx_blog_posts_published (published_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
  blogTableEnsured = true;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/blog-posts', async (_req, res) => {
  try {
    await ensureBlogPostsTable();
    const [rows] = await pool.query(
      `SELECT id, slug, title, summary, body, hero_image, tag, published_at
       FROM blog_posts
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
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
