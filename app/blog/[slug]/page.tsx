import Link from 'next/link';
import { getDbPool } from '@/lib/db';
import { ensureBlogPostsTable, type BlogPostRow } from '@/lib/blog-posts';
import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

type BlogArticle = {
  id: string | number;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  hero_image: string | null;
  tag: string | null;
  published_at: string | null;
};

const pool = getDbPool();

type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'divider' };

const DIVIDER_PATTERN = /^(?:[\-\u2501\u2014_]\s*){5,}$/;
const BULLET_PATTERN = /^(?:\u2022|â€¢)\s*/;
const INLINE_DIVIDER_PATTERN = /(?:\s*(?:[\u2501\u2014-]\s*){8,}\s*)/g;
const INLINE_BULLET_PATTERN = /\s+(?:\u2022)\s+/g;

const isLikelyHeading = (line: string) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 120) return false;
  if (BULLET_PATTERN.test(trimmed)) return false;
  const lettersOnly = trimmed.replace(/[^A-Za-z]/g, '');
  if (!lettersOnly) return false;
  const uppercaseLetters = lettersOnly.replace(/[^A-Z]/g, '').length;
  return uppercaseLetters / lettersOnly.length > 0.72;
};

const parsePlainTextBody = (body: string): ContentBlock[] => {
  const normalized = body
    .replace(/\r\n/g, '\n')
    .replace(INLINE_DIVIDER_PATTERN, (match) => `\n${match.trim()}\n`)
    .replace(INLINE_BULLET_PATTERN, '\n• ')
    .trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const blocks: ContentBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: string[] = [];

  const flushParagraph = () => {
    if (!paragraphBuffer.length) return;
    const text = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ type: 'paragraph', text });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer.length) return;
    blocks.push({ type: 'list', items: listBuffer });
    listBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (DIVIDER_PATTERN.test(line)) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'divider' });
      continue;
    }

    if (BULLET_PATTERN.test(line)) {
      flushParagraph();
      listBuffer.push(line.replace(BULLET_PATTERN, '').trim());
      continue;
    }

    flushList();

    if (isLikelyHeading(line)) {
      flushParagraph();
      blocks.push({ type: 'heading', text: line });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
};

async function fetchArticleBySlug(slug: string): Promise<BlogArticle | null> {
  try {
    await ensureBlogPostsTable(pool);
    const [rows] = await pool.query<BlogPostRow[]>(
      `SELECT id, slug, title, summary, body, hero_image, tag, published_at
       FROM blog_posts
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );
    return rows.length ? (rows[0] as unknown as BlogArticle) : null;
  } catch {
    return null;
  }
}

export default async function BlogArticlePage({ params }: { params: { slug: string } }) {
  const article = await fetchArticleBySlug(params.slug);

  if (!article) {
    return (
      <main className="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16 bg-black text-white min-h-screen">
        <div className="max-w-4xl w-full text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">Article not found</h1>
          <Link
            href="/blog"
            className="inline-flex px-6 py-3 rounded-md border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-black transition-colors"
          >
            Back to Blog
          </Link>
        </div>
      </main>
    );
  }

  const contentBlocks: ContentBlock[] = article.body
    ? (() => {
        try {
          const parsed = JSON.parse(article.body);
          if (Array.isArray(parsed)) {
            return parsed
              .map((paragraph) => String(paragraph).trim())
              .filter(Boolean)
              .map((text) => ({ type: 'paragraph', text }) satisfies ContentBlock);
          }
          return parsePlainTextBody(String(article.body));
        } catch {
          return parsePlainTextBody(article.body);
        }
      })()
    : [];

  const renderBlock = (block: ContentBlock, index: number): ReactNode => {
    if (block.type === 'heading') {
      return (
        <h2 key={index} className="pt-2 text-xl font-semibold uppercase tracking-[0.18em] text-amber-300">
          {block.text}
        </h2>
      );
    }

    if (block.type === 'list') {
      return (
        <ul key={index} className="space-y-2 pl-5 text-lg text-gray-200/90 list-disc marker:text-amber-300">
          {block.items.map((item, itemIndex) => (
            <li key={`${index}-${itemIndex}`}>{item}</li>
          ))}
        </ul>
      );
    }

    if (block.type === 'divider') {
      return <div key={index} className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/50 to-transparent" />;
    }

    return (
      <p key={index} className="text-lg text-gray-200/90">
        {block.text}
      </p>
    );
  };

  return (
    <main className="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16 bg-black text-white min-h-screen">
      <div className="max-w-4xl w-full space-y-8">
        <div className="space-y-2">
          <Link href="/blog" className="text-sm text-amber-300 hover:text-amber-200">
            &lt;- Back to Blog
          </Link>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
            {article.published_at
              ? new Date(article.published_at).toLocaleDateString('en-GB', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })
              : ''}{' '}
            - {article.tag || 'News'}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white">{article.title}</h1>
        </div>
        <div className="rounded-3xl overflow-hidden border border-white/10 shadow-xl shadow-black/30">
          {article.hero_image ? (
            <img src={article.hero_image} alt={article.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-[360px] bg-gradient-to-br from-neutral-800 to-neutral-950" />
          )}
        </div>
        <div className="space-y-4 text-gray-200 leading-relaxed">
          {contentBlocks.length > 0 ? (
            contentBlocks.map((block, index) => renderBlock(block, index))
          ) : (
            <p className="text-gray-400 text-sm">No content available for this article.</p>
          )}
        </div>
        <div className="pt-4">
          <Link
            href="/booking"
            className="px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
          >
            Book a Journey
          </Link>
        </div>
      </div>
    </main>
  );
}
