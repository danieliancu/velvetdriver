import mysql from 'mysql2/promise';
import type { DbRow } from '@/lib/db';

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  hero_image: string | null;
  tag: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type BlogPostRow = DbRow<BlogPost>;

let tableEnsured = false;

export async function ensureBlogPostsTable(pool: mysql.Pool) {
  if (tableEnsured) return;

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

  tableEnsured = true;
}

const toNullableString = (value: unknown, maxLen?: number) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  return maxLen ? text.slice(0, maxLen) : text;
};

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 150) || `post-${Date.now()}`;

const parsePublishedAt = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export type ParsedBlogPostPayload = {
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  heroImage: string | null;
  tag: string | null;
  publishedAt: Date | null;
};

export function parseBlogPostPayload(payload: any): ParsedBlogPostPayload | null {
  const title = toNullableString(payload?.title, 255);
  if (!title) return null;

  return {
    title,
    slug: slugify(toNullableString(payload?.slug, 180) || title),
    summary: toNullableString(payload?.summary),
    body: toNullableString(payload?.body),
    heroImage: toNullableString(payload?.hero_image),
    tag: toNullableString(payload?.tag, 80),
    publishedAt: parsePublishedAt(payload?.published_at),
  };
}
